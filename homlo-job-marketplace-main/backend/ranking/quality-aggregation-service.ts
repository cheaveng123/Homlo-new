// =========================================================
// QualityAggregationService — scheduled quality computation (phase 8).
//
// The ONLY job that writes employer_quality_stats / job_quality_stats. It
// recomputes a deterministic snapshot from the append-only evidence and writes
// it atomically:
//
//   read (constant batched queries, no N+1) → pure compute (quality-aggregation.ts)
//   → single transaction (pg_try_advisory_xact_lock → two unnest upserts)
//
// Compatibility: preserves every existing column on both stats tables (see the
// migration comments in 018/019/020); NO schema change is required or made.
// `verification_status` is never written by this job (no verification flow
// exists in the schema — documented limitation); new employer rows keep the
// column default 'unverified'.
//
// Idempotency: the snapshot is derived entirely from immutable event/app/review/
// report/message/job rows — never from the current stats rows — so a re-run with
// the same evidence and `now` writes byte-identical rows. There is no increment,
// so double-running cannot double-count.
//
// Concurrency: one run acquires pg_try_advisory_xact_lock(key) inside the write
// transaction; a concurrent run fails fast and is skipped. The computation is
// read-only and may run concurrently; only the (deterministic) write is gated.
//
// Time window: CUMULATIVE evidence (job_events are append-only and never reset;
// stats reflect a job's/employer's lifetime). Recency stays a phase 3 retrieval
// concern (trending source); the aggregation never resets to zero.
//
// User-level dedupe: each job-level event row is reduced in SQL to
// DISTINCT (identity_key, event_type) where identity_key =
//   user_id, else session_id, else ip_hash
// so one user firing the same event 20× to the same job counts once (a vote,
// not a multiplier). Deterministic, documented, and applied before any math.
// =========================================================

import type { DatabaseAdapter, SqlParameter } from "../infrastructure/database/DatabaseAdapter";
import { rankingConfig } from "../config/rankingConfig";
import {
  computeEmployerQualityStats,
  computeJobQualityStats,
  type EmployerQualityEvidence,
  type EmployerQualityStats,type JobQualityStats
} from "./quality-aggregation";

// ---------------------------------------------------------------------------
// Read shapes
// ---------------------------------------------------------------------------

type JobEventSummaryRow = {
  job_id: string;
  employer_id: string;
  impressions: number | string;
  clicks: number | string;
  applies_started: number | string;
  applies_submitted: number | string;
  n_events: number | string;
};

type EmployerRow = { employer_id: string };
type JobsPostedRow = EmployerRow & { n_jobs_posted: number | string };
type ApplicationsRow = EmployerRow & { n_applications: number | string; n_completions: number | string };
type ReviewsRow = EmployerRow & { n_reviews: number | string; n_positive_reviews: number | string };
type ReportsRow = EmployerRow & { n_reports: number | string };
type ResponseRow = EmployerRow & { n_worker_initiated: number | string; n_responded: number | string };
type CountRow = { total_events: number | string };

// ---------------------------------------------------------------------------
// Public report
// ---------------------------------------------------------------------------

export type QualityAggregationRunReport = {
  ok: boolean;
  /** false when a concurrent run held the advisory lock (this run was skipped). */
  ran: boolean;
  aggregationVersion: string;
  /** deterministic aggregation instant (also last_computed_at of written rows). */
  now: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  jobsProcessed: number;
  employersProcessed: number;
  /** deduped (identity × event_type) rows consumed by the job snapshot. */
  eventsConsidered: number;
  /** raw live-job events minus eventsConsidered (dedupe collapses + tombstoned) . */
  eventsExcluded: number;
  jobRowsWritten: number;
  employerRowsWritten: number;
};

// ---------------------------------------------------------------------------
// SQL (constant statement set — no dynamic per-row SQL)
// ---------------------------------------------------------------------------

/**
 * Per-job signal snapshot. job_events rows are first reduced to DISTINCT
 * (identity_key, event_type) — user_id when present, else session_id, else
 * ip_hash — so a single user cannot vote more than once per event type per job.
 * Live (non-deleted) jobs only; employer_id comes from the authoritative jobs
 * row.
 */
const JOB_EVENTS_SQL = `
  with sig as (
    select je.job_id,
           je.event_type,
           coalesce(je.user_id::text, je.session_id::text, je.ip_hash) as identity_key
      from job_events je
      join jobs j on j.id = je.job_id and j.deleted_at is null
     group by je.job_id, je.event_type,
              coalesce(je.user_id::text, je.session_id::text, je.ip_hash)
  )
  select j.id as job_id,
         j.employer_id,
         count(*) filter (where s.event_type = 'impression')::int as impressions,
         count(*) filter (where s.event_type = 'click')::int as clicks,
         count(*) filter (where s.event_type = 'apply_started')::int as applies_started,
         count(*) filter (where s.event_type = 'apply_submitted')::int as applies_submitted,
         count(*) filter (where s.event_type <> 'impression')::int as n_events
    from sig s
    join jobs j on j.id = s.job_id and j.deleted_at is null
   group by j.id, j.employer_id`;

const JOB_EVENTS_RAW_COUNT_SQL = `
  select count(*)::bigint as total_events
    from job_events je
    join jobs j on j.id = je.job_id and j.deleted_at is null`;

const JOBS_POSTED_SQL = `
  select employer_id, count(*)::int as n_jobs_posted
    from jobs
   where deleted_at is null
   group by employer_id`;

const APPLICATIONS_SQL = `
  select j.employer_id,
         count(*)::int as n_applications,
         count(*) filter (where a.status = 'hired')::int as n_completions
    from applications a
    join jobs j on j.id = a.job_id and j.deleted_at is null
   group by j.employer_id`;

const REVIEWS_SQL = `
  select r.reviewee_id as employer_id,
         count(*)::int as n_reviews,
         count(*) filter (where r.rating >= $1::int)::int as n_positive_reviews
    from reviews r
   where r.deleted_at is null
   group by r.reviewee_id`;

const REPORTS_SQL = `
  select e.employer_id, count(r.id)::int as n_reports
    from (select j.id as job_id, j.employer_id from jobs j where j.deleted_at is null) e
    join reports r on (r.target_type = 'job' and r.target_id = e.job_id)
                   or (r.target_type = 'user' and r.target_id = e.employer_id)
   where r.status in ('open', 'reviewed', 'actioned')
   group by e.employer_id`;

const RESPONSE_SQL = `
  with job_convs as (
    select c.id as conversation_id, j.employer_id
      from conversations c
      join jobs j on j.id = c.job_id and j.deleted_at is null
      join conversation_members em on em.conversation_id = c.id and em.user_id = j.employer_id
     where c.deleted_at is null
  ),
  first_msg as (
    select distinct on (jc.conversation_id) jc.conversation_id, jc.employer_id, m.sender_id
      from job_convs jc
      join messages m on m.conversation_id = jc.conversation_id
     order by jc.conversation_id, m.created_at asc, m.id asc
  ),
  worker_initiated as (
    select conversation_id, employer_id
      from first_msg
     where sender_id is distinct from employer_id
  ),
  responded as (
    select distinct m.conversation_id as conversation_id
      from worker_initiated wi
      join messages m on m.conversation_id = wi.conversation_id and m.sender_id = wi.employer_id
  )
  select wi.employer_id,
         count(*)::int as n_worker_initiated,
         count(r.conversation_id)::int as n_responded
    from worker_initiated wi
    left join responded r on r.conversation_id = wi.conversation_id
   group by wi.employer_id`;

const JOB_STATS_UPSERT_SQL = `
  insert into job_quality_stats (
    job_id, impressions, clicks, applies_started, applies_submitted,
    ctr_wilson_lb, apply_rate_wilson_lb, n_events, last_computed_at
  )
  select * from unnest(
    $1::uuid[], $2::int[], $3::int[], $4::int[], $5::int[],
    $6::double precision[], $7::double precision[], $8::int[], ($9::text[])::timestamptz[]
  )
  on conflict (job_id) do update set
    impressions      = excluded.impressions,
    clicks           = excluded.clicks,
    applies_started  = excluded.applies_started,
    applies_submitted= excluded.applies_submitted,
    ctr_wilson_lb    = excluded.ctr_wilson_lb,
    apply_rate_wilson_lb = excluded.apply_rate_wilson_lb,
    n_events         = excluded.n_events,
    last_computed_at = excluded.last_computed_at`;

const EMPLOYER_STATS_UPSERT_SQL = `
  insert into employer_quality_stats (
    employer_id, n_jobs_posted, n_completions, n_reports,
    completion_rate_wilson_lb, positive_review_rate_wilson_lb, response_rate_wilson_lb,
    last_computed_at
  )
  select * from unnest(
    $1::uuid[], $2::int[], $3::int[], $4::int[],
    $5::double precision[], $6::double precision[], $7::double precision[],
    ($8::text[])::timestamptz[]
  )
  on conflict (employer_id) do update set
    n_jobs_posted                 = excluded.n_jobs_posted,
    n_completions                 = excluded.n_completions,
    n_reports                     = excluded.n_reports,
    completion_rate_wilson_lb     = excluded.completion_rate_wilson_lb,
    positive_review_rate_wilson_lb= excluded.positive_review_rate_wilson_lb,
    response_rate_wilson_lb       = excluded.response_rate_wilson_lb,
    last_computed_at              = excluded.last_computed_at`;

/** verification_status is intentionally not written: no schema verification flow. */

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export type QualityAggregationOptions = {
  /** Explicit aggregation instant; defaults to new Date(). Also last_computed_at. */
  now?: Date;
  /** Observability sink; defaults to console. Never logs IPs or event payloads. */
  logger?: (line: string) => void;
};

export class QualityAggregationService {
  private readonly logger: (line: string) => void;

  constructor(
    private readonly database: DatabaseAdapter,
    options: { logger?: (line: string) => void } = {},
  ) {
    this.logger = options.logger ?? ((line) => console.log(line));
  }

  async run(options: QualityAggregationOptions = {}): Promise<QualityAggregationRunReport> {
    const now = options.now instanceof Date && !Number.isNaN(options.now.getTime()) ? options.now : new Date();
    const version = rankingConfig.qualityAggregation.version;
    const startedAt = new Date();
    const startMs = startedAt.getTime();

    // ---- Read: constant number of batched queries (never per-row) ----------
    const [eventCountRows, jobEventRows, jobsPostedRows, applicationRows, reviewRows, reportRows, responseRows] =
      await Promise.all([
        this.database.query<CountRow>(JOB_EVENTS_RAW_COUNT_SQL),
        this.database.query<JobEventSummaryRow>(JOB_EVENTS_SQL),
        this.database.query<JobsPostedRow>(JOBS_POSTED_SQL),
        this.database.query<ApplicationsRow>(APPLICATIONS_SQL),
        this.database.query<ReviewsRow>(REVIEWS_SQL, [rankingConfig.qualityAggregation.positiveReviewMinRating]),
        this.database.query<ReportsRow>(REPORTS_SQL),
        this.database.query<ResponseRow>(RESPONSE_SQL),
      ]);

    // ---- Pure compute ------------------------------------------------------
    const jobStats: JobQualityStats[] = jobEventRows.rows.map((row) =>
      computeJobQualityStats({
        jobId: row.job_id,
        employerId: row.employer_id,
        impressions: row.impressions,
        clicks: row.clicks,
        appliesStarted: row.applies_started,
        appliesSubmitted: row.applies_submitted,
        nEvents: row.n_events,
      }),
    );

    const evidenceByEmployer = new Map<string, EmployerQualityEvidence>();
    for (const row of jobsPostedRows.rows) {
      evidenceByEmployer.set(row.employer_id, {
        employerId: row.employer_id,
        nJobsPosted: row.n_jobs_posted,
        nApplications: 0,
        nCompletions: 0,
        nReports: 0,
        nReviews: 0,
        nPositiveReviews: 0,
        nWorkerInitiated: 0,
        nResponded: 0,
      });
    }
    const merge = (employerId: string, patch: Partial<EmployerQualityEvidence>): void => {
      const existing = evidenceByEmployer.get(employerId);
      if (existing) Object.assign(existing, patch);
    };
    for (const row of applicationRows.rows) merge(row.employer_id, { nApplications: row.n_applications, nCompletions: row.n_completions });
    for (const row of reviewRows.rows) merge(row.employer_id, { nReviews: row.n_reviews, nPositiveReviews: row.n_positive_reviews });
    for (const row of reportRows.rows) merge(row.employer_id, { nReports: row.n_reports });
    for (const row of responseRows.rows) merge(row.employer_id, { nWorkerInitiated: row.n_worker_initiated, nResponded: row.n_responded });

    const employerStats: EmployerQualityStats[] = [...evidenceByEmployer.values()].map(computeEmployerQualityStats);

    const jobsProcessed = jobStats.length;
    const employersProcessed = employerStats.length;
    // Every deduped (identity × event_type) row is either an impression or a
    // non-impression signal; n_events excludes impressions by construction.
    const eventsConsidered = jobStats.reduce((sum, stats) => sum + stats.impressions + stats.nEvents, 0);
    const rawTotal = toNumber(eventCountRows.rows[0]?.total_events) ?? 0;
    const eventsExcluded = Math.max(0, rawTotal - eventsConsidered);

    // ---- Atomic write (advisory lock → batched unnest upserts) --------------
    const write = await this.database.transaction(async (tx) => {
      const lockRows = await tx.query<{ locked: boolean }>(
        `select pg_try_advisory_xact_lock($1::bigint) as locked`,
        [rankingConfig.qualityAggregation.advisoryLockKey],
      );
      if (lockRows.rows[0]?.locked !== true) {
        return { skipped: true, jobRowsWritten: 0, employerRowsWritten: 0 };
      }

      let jobRowsWritten = 0;
      if (jobStats.length > 0) {
        await tx.query(JOB_STATS_UPSERT_SQL, jobStatsUpsertParams(jobStats, now));
        jobRowsWritten = jobStats.length;
      }

      let employerRowsWritten = 0;
      if (employerStats.length > 0) {
        await tx.query(EMPLOYER_STATS_UPSERT_SQL, employerStatsUpsertParams(employerStats, now));
        employerRowsWritten = employerStats.length;
      }

      return { skipped: false, jobRowsWritten, employerRowsWritten };
    });

    const finishedAt = new Date();
    const durationMs = Math.max(0, finishedAt.getTime() - startMs);

    const report: QualityAggregationRunReport = {
      ok: true,
      ran: !write.skipped,
      aggregationVersion: version,
      now: now.toISOString(),
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs,
      jobsProcessed,
      employersProcessed,
      eventsConsidered,
      eventsExcluded,
      jobRowsWritten: write.jobRowsWritten,
      employerRowsWritten: write.employerRowsWritten,
    };

    this.logger(
      `aggregation ${write.skipped ? "SKIPPED (concurrent run held the advisory lock)" : "completed"} now=${report.now} ` +
        `jobs=${jobsProcessed} employers=${employersProcessed} events_considered=${eventsConsidered} ` +
        `events_excluded=${eventsExcluded} job_rows_written=${report.jobRowsWritten} ` +
        `employer_rows_written=${report.employerRowsWritten} duration_ms=${durationMs}`,
    );

    return report;
  }
}

// ---------------------------------------------------------------------------
// Upsert parameter builders
// ---------------------------------------------------------------------------
//
// The driver only accepts scalar parameters, so each unnest column is sent as a
// single Postgres array literal string (the same convention as toArrayParam in
// SupabaseAdapter/DatabaseAdapter) and cast in SQL via $n::uuid[] / $n::int[] /
// $n::double precision[] / ($n::text[])::timestamptz[].

/** `{a,b,...}` literals; null elements are spelled `NULL` (Postgres array-input). */
function arrayParam(values: readonly unknown[]): string {
  return `{${values.map((v) => (v == null ? "NULL" : String(v))).join(",")}}`;
}

function jobStatsUpsertParams(stats: readonly JobQualityStats[], now: Date): readonly SqlParameter[] {
  return [
    arrayParam(stats.map((s) => s.jobId)),
    arrayParam(stats.map((s) => s.impressions)),
    arrayParam(stats.map((s) => s.clicks)),
    arrayParam(stats.map((s) => s.appliesStarted)),
    arrayParam(stats.map((s) => s.appliesSubmitted)),
    arrayParam(stats.map((s) => doubleParam(s.ctrWilsonLB))),
    arrayParam(stats.map((s) => doubleParam(s.applyRateWilsonLB))),
    arrayParam(stats.map((s) => s.nEvents)),
    arrayParam(stats.map(() => now.toISOString())),
  ];
}

function employerStatsUpsertParams(stats: readonly EmployerQualityStats[], now: Date): readonly SqlParameter[] {
  return [
    arrayParam(stats.map((s) => s.employerId)),
    arrayParam(stats.map((s) => s.nJobsPosted)),
    arrayParam(stats.map((s) => s.nCompletions)),
    arrayParam(stats.map((s) => s.nReports)),
    arrayParam(stats.map((s) => doubleParam(s.completionRateWilsonLB))),
    arrayParam(stats.map((s) => doubleParam(s.positiveReviewRateWilsonLB))),
    arrayParam(stats.map((s) => doubleParam(s.responseRateWilsonLB))),
    arrayParam(stats.map(() => now.toISOString())),
  ];
}

/** Double-precision array element for the unnest cast; null stays null. */
function doubleParam(value: number | null): number | null {
  if (!Number.isFinite(value as number)) return null;
  return value as number;
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}