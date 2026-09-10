import { describe, expect, it } from "vitest";

import { rankingConfig } from "../backend/config/rankingConfig";
import type { DatabaseAdapter, QueryResult, SqlParameter } from "../backend/infrastructure/database/DatabaseAdapter";
import {
  computeEmployerQualityStats,
  computeJobQualityStats,
  wilsonRate,
  type EmployerQualityEvidence,
  type JobInteractionCounts,
} from "../backend/ranking/quality-aggregation";
import { QualityAggregationService, type QualityAggregationRunReport } from "../backend/ranking/quality-aggregation-service";
import {
  combinedQuality,
  jobQualityEffective,
  qualityMultiplier,
  RankingScoringService,
  type ScoredCandidate,
} from "../backend/ranking/scoring-service";
import { wilsonLowerBound } from "../backend/ranking/wilson";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const NOW = new Date("2026-08-01T12:00:00.000Z");
const CONFIG = rankingConfig.quality;
const AGG_VERSION = rankingConfig.qualityAggregation.version;

const JOB_ID = "11111111-1111-4111-8111-111111111111";
const EMPLOYER_ID = "22222222-2222-4222-8222-222222222222";

function eventSummary(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    job_id: JOB_ID,
    employer_id: EMPLOYER_ID,
    impressions: 100,
    clicks: 20,
    applies_started: 4,
    applies_submitted: 2,
    n_events: 26,
    ...overrides,
  };
}

/** camelCase JobInteractionCounts for the pure computeJobQualityStats tests. */
function countsFixture(overrides: Partial<JobInteractionCounts> = {}): JobInteractionCounts {
  return {
    jobId: JOB_ID,
    employerId: EMPLOYER_ID,
    impressions: 100,
    clicks: 20,
    appliesStarted: 4,
    appliesSubmitted: 2,
    nEvents: 26,
    ...overrides,
  };
}

function completedEmployerEvidence(overrides: Partial<EmployerQualityEvidence> = {}): EmployerQualityEvidence {
  return {
    employerId: EMPLOYER_ID,
    nJobsPosted: 3,
    nApplications: 10,
    nCompletions: 4,
    nReports: 1,
    nReviews: 5,
    nPositiveReviews: 4,
    nWorkerInitiated: 6,
    nResponded: 3,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// wilsonRate (pure aggregation wrapper)
// ---------------------------------------------------------------------------

describe("wilsonRate", () => {
  it("returns null (no evidence) when the trial base is empty or negative", () => {
    expect(wilsonRate(0, 0)).toBeNull();
    expect(wilsonRate(10, 0)).toBeNull();
    expect(wilsonRate(2, -5)).toBeNull();
    expect(wilsonRate(0, Number.NaN)).toBeNull();
  });

  it("matches the shared Wilson bound for valid counts", () => {
    expect(wilsonRate(20, 100)).toBeCloseTo(wilsonLowerBound(20, 100), 9);
    expect(wilsonRate(2, 10)).toBeCloseTo(wilsonLowerBound(2, 10), 9);
    expect(wilsonRate(100, 100)).toBeCloseTo(wilsonLowerBound(100, 100), 9);
  });

  it("clamps inconsistent successes down to trials instead of inflating to 1.0", () => {
    expect(wilsonRate(150, 100)).toBeCloseTo(wilsonLowerBound(100, 100), 9);
  });

  it("floors negatives and non-finite successes to zero", () => {
    expect(wilsonRate(-5, 10)).toBeCloseTo(wilsonLowerBound(0, 10), 9);
    expect(wilsonRate(Number.NaN, 10)).toBeCloseTo(wilsonLowerBound(0, 10), 9);
  });

  it("always stays within [0, 1] and never NaN", () => {
    for (const s of [0, 1, 3, 50, 1000]) {
      for (const n of [1, 2, 10, 100]) {
        const value = wilsonRate(s, n);
        if (value == null) continue;
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Job quality aggregation (pure)
// ---------------------------------------------------------------------------

describe("computeJobQualityStats", () => {
  it("produces the expected Wilson lower bounds from the persisted counters", () => {
    const stats = computeJobQualityStats(countsFixture());
    expect(stats.impressions).toBe(100);
    expect(stats.clicks).toBe(20);
    expect(stats.appliesStarted).toBe(4);
    expect(stats.appliesSubmitted).toBe(2);
    expect(stats.nEvents).toBe(26);
    expect(stats.ctrWilsonLB).toBeCloseTo(wilsonLowerBound(20, 100), 9);
    expect(stats.applyRateWilsonLB).toBeCloseTo(wilsonLowerBound(2, 100), 9);
  });

  it("leaves both bounds null, not punitive zeros, when a job was never exposed", () => {
    const stats = computeJobQualityStats(countsFixture({ impressions: 0 }));
    expect(stats.ctrWilsonLB).toBeNull();
    expect(stats.applyRateWilsonLB).toBeNull();
    expect(stats.impressions).toBe(0);
  });

  it("clamps malformed counts to non-negative integers", () => {
    const stats = computeJobQualityStats({
      jobId: JOB_ID,
      employerId: EMPLOYER_ID,
      impressions: 50.9,
      clicks: -12,
      appliesStarted: Number.NaN,
      appliesSubmitted: "3.7",
      nEvents: null,
    });
    expect(stats.impressions).toBe(50);
    expect(stats.clicks).toBe(0);
    expect(stats.appliesStarted).toBe(0);
    expect(stats.appliesSubmitted).toBe(3);
    expect(stats.nEvents).toBe(0);
    expect(stats.ctrWilsonLB).toBeCloseTo(wilsonLowerBound(0, 50), 9);
  });

  it("never lets inconsistent clicks exceed impressions (no inflated LB)", () => {
    const stats = computeJobQualityStats(countsFixture({ impressions: 10, clicks: 30 }));
    expect(stats.ctrWilsonLB).toBeCloseTo(wilsonLowerBound(10, 10), 9);
  });
});

// ---------------------------------------------------------------------------
// Employer quality aggregation (pure)
// ---------------------------------------------------------------------------

describe("computeEmployerQualityStats", () => {
  it("produces the expected employer hull from real evidence", () => {
    const stats = computeEmployerQualityStats(completedEmployerEvidence());
    expect(stats.nJobsPosted).toBe(3);
    expect(stats.nCompletions).toBe(4);
    expect(stats.nReports).toBe(1);
    expect(stats.completionRateWilsonLB).toBeCloseTo(wilsonLowerBound(4, 10), 9);
    expect(stats.positiveReviewRateWilsonLB).toBeCloseTo(wilsonLowerBound(4, 5), 9);
    expect(stats.responseRateWilsonLB).toBeCloseTo(wilsonLowerBound(3, 6), 9);
  });

  it("returns null LBs when a component has no evidence (missing ≠ bad)", () => {
    const stats = computeEmployerQualityStats({
      employerId: EMPLOYER_ID,
      nJobsPosted: 3,
      nApplications: 0,
      nCompletions: 0,
      nReports: 0,
      nReviews: 0,
      nPositiveReviews: 0,
      nWorkerInitiated: 0,
      nResponded: 0,
    });
    expect(stats.completionRateWilsonLB).toBeNull();
    expect(stats.positiveReviewRateWilsonLB).toBeNull();
    expect(stats.responseRateWilsonLB).toBeNull();
    expect(stats.nJobsPosted).toBe(3);
  });

  it("stays within [0, 1] for every present bound", () => {
    const stats = computeEmployerQualityStats(completedEmployerEvidence());
    for (const value of [stats.completionRateWilsonLB, stats.positiveReviewRateWilsonLB, stats.responseRateWilsonLB]) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value as number).toBeGreaterThanOrEqual(0);
      expect(value as number).toBeLessThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// Shrinkage + combined quality (phase 4 consumers of the persisted columns)
// ---------------------------------------------------------------------------

describe("quality formulas consume the aggregation output", () => {
  const employerQ = 0.9;
  const observed = 0.6;

  it("shrinks continuously with w = n / (n + shrinkageK) across n = 0,1,50,100,200", () => {
    const k = CONFIG.shrinkageK;
    const expected: [number, number][] = [
      [0, 0],
      [1, 1 / (1 + k)],
      [50, 50 / (50 + k)],
      [100, 100 / (100 + k)],
      [200, 200 / (200 + k)],
    ];
    for (const [n, w] of expected) {
      const effective = jobQualityEffective(n, observed, employerQ, k);
      const reference = w * observed + (1 - w) * employerQ;
      expect(effective).toBeCloseTo(reference, 9);
    }
    // edges: no evidence ⇒ employer dominates; heavy evidence ⇒ observed dominates
    expect(jobQualityEffective(0, observed, employerQ, k)).toBeCloseTo(employerQ, 9);
    const heavyW = 10_000 / (10_000 + k);
    expect(jobQualityEffective(10_000, observed, employerQ, k)).toBeCloseTo(
      heavyW * observed + (1 - heavyW) * employerQ,
      9,
    );
  });

  it("combines with the configured 0.75/0.25 weights and maps to the penalty-only multiplier", () => {
    const effective = jobQualityEffective(50, observed, employerQ, CONFIG.shrinkageK);
    const combined = combinedQuality(employerQ, effective, CONFIG.employerWeight, CONFIG.jobWeight);
    const multiplier = qualityMultiplier(combined, CONFIG.qualityMultiplierFloor, CONFIG.qualityMultiplierScale);
    expect(combined).toBeCloseTo(CONFIG.employerWeight * employerQ + CONFIG.jobWeight * effective, 9);
    expect(multiplier).toBeCloseTo(CONFIG.qualityMultiplierFloor + CONFIG.qualityMultiplierScale * combined, 9);
    expect(multiplier).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// In-memory database for the aggregation service
// ---------------------------------------------------------------------------

type ServiceSeeds = {
  rawEventCount?: number;
  eventSummaries?: Record<string, unknown>[];
  jobsPosted?: Record<string, unknown>[];
  applications?: Record<string, unknown>[];
  reviews?: Record<string, unknown>[];
  reports?: Record<string, unknown>[];
  responses?: Record<string, unknown>[];
  lockAcquired?: boolean;
};

class AggregationDatabase implements DatabaseAdapter {
  public queryCount = 0;
  public jobWrites: Record<string, unknown>[] = [];
  public employerWrites: Record<string, unknown>[] = [];

  constructor(private readonly seeds: ServiceSeeds) {}

  async query<Row extends Record<string, unknown> = Record<string, unknown>>(
    statement: string,
    parameters: readonly SqlParameter[] = [],
  ): Promise<QueryResult<Row>> {
    this.queryCount += 1;
    const s = statement.trimStart();
    let raw: Record<string, unknown>[] = [];

    if (s.startsWith("select count(*)::bigint as total_events")) {
      raw = [{ total_events: this.seeds.rawEventCount ?? 0 }];
    } else if (s.startsWith("with sig as (")) {
      raw = this.seeds.eventSummaries ?? [];
    } else if (s.startsWith("select employer_id, count(*)::int as n_jobs_posted")) {
      raw = this.seeds.jobsPosted ?? [];
    } else if (s.startsWith("select j.employer_id,")) {
      raw = this.seeds.applications ?? [];
    } else if (s.startsWith("select r.reviewee_id as employer_id")) {
      raw = this.seeds.reviews ?? [];
    } else if (s.startsWith("select e.employer_id, count(r.id)")) {
      raw = this.seeds.reports ?? [];
    } else if (s.startsWith("with job_convs as (")) {
      raw = this.seeds.responses ?? [];
    } else if (s.startsWith("select pg_try_advisory_xact_lock")) {
      raw = [{ locked: this.seeds.lockAcquired ?? true }];
    } else if (s.startsWith("insert into job_quality_stats")) {
      const names = ["job_id", "impressions", "clicks", "applies_started", "applies_submitted", "ctr_wilson_lb", "apply_rate_wilson_lb", "n_events", "last_computed_at"];
      this.jobWrites.push(...zipRows(parameters, names));
      raw = [];
    } else if (s.startsWith("insert into employer_quality_stats")) {
      const names = ["employer_id", "n_jobs_posted", "n_completions", "n_reports", "completion_rate_wilson_lb", "positive_review_rate_wilson_lb", "response_rate_wilson_lb", "last_computed_at"];
      this.employerWrites.push(...zipRows(parameters, names));
      raw = [];
    }

    return { rows: raw as Row[], rowCount: raw.length };
  }

  transaction<T>(work: (database: DatabaseAdapter) => Promise<T>): Promise<T> {
    return work(this);
  }
}

function parseArrayParam(param: SqlParameter): unknown[] {
  if (typeof param !== "string") return [param];
  if (!param.startsWith("{") || !param.endsWith("}")) return [param];
  const inner = param.slice(1, -1).trim();
  if (!inner) return [];
  return inner.split(",").map((raw) => {
    const token = raw.trim();
    if (token === "NULL") return null;
    const numeric = Number(token);
    return Number.isFinite(numeric) ? numeric : token;
  });
}

function zipRows(parameters: readonly SqlParameter[], names: readonly string[]): Record<string, unknown>[] {
  if (!parameters.length) return [];
  const dimensions = names.length;
  const count = parseArrayParam(parameters[0]).length;
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < count; i += 1) {
    const row: Record<string, unknown> = {};
    for (let d = 0; d < dimensions; d += 1) {
      row[names[d]] = parseArrayParam(parameters[d])[i];
    }
    rows.push(row);
  }
  return rows;
}

function stripOperationalTiming(report: QualityAggregationRunReport): Omit<QualityAggregationRunReport, "startedAt" | "finishedAt" | "durationMs"> {
  const { startedAt, finishedAt, durationMs, ...stable } = report;
  void startedAt;
  void finishedAt;
  void durationMs;
  return stable;
}

function serdeCopy<T>(rows: readonly T[]): T[] {
  return JSON.parse(JSON.stringify(rows)) as T[];
}

function defaultSeeds(): ServiceSeeds {
  return {
    rawEventCount: 180,
    eventSummaries: [eventSummary()],
    jobsPosted: [{ employer_id: EMPLOYER_ID, n_jobs_posted: 3 }],
    applications: [{ employer_id: EMPLOYER_ID, n_applications: 10, n_completions: 4 }],
    reviews: [{ employer_id: EMPLOYER_ID, n_reviews: 5, n_positive_reviews: 4 }],
    reports: [{ employer_id: EMPLOYER_ID, n_reports: 1 }],
    responses: [{ employer_id: EMPLOYER_ID, n_worker_initiated: 6, n_responded: 3 }],
  };
}

// ---------------------------------------------------------------------------
// Aggregation service
// ---------------------------------------------------------------------------

describe("QualityAggregationService", () => {
  it("writes the deterministic snapshot (report + rows) for a given now", async () => {
    const database = new AggregationDatabase(defaultSeeds());
    const report = await new QualityAggregationService(database).run({ now: NOW });

    expect(report.ok).toBe(true);
    expect(report.ran).toBe(true);
    expect(report.aggregationVersion).toBe(AGG_VERSION);
    expect(report.now).toBe(NOW.toISOString());
    expect(report.jobsProcessed).toBe(1);
    expect(report.employersProcessed).toBe(1);
    expect(report.eventsConsidered).toBe(126); // 100 impressions + 26 signal rows
    expect(report.eventsExcluded).toBe(54); // raw 180 − considered 126 (duplicates/tombstones)
    expect(report.jobRowsWritten).toBe(1);
    expect(report.employerRowsWritten).toBe(1);

    const [jobRow] = database.jobWrites;
    expect(jobRow.job_id).toBe(JOB_ID);
    expect(jobRow.impressions).toBe(100);
    expect(jobRow.clicks).toBe(20);
    expect(jobRow.applies_submitted).toBe(2);
    expect(jobRow.n_events).toBe(26);
    expect(jobRow.ctr_wilson_lb).toBeCloseTo(wilsonLowerBound(20, 100), 9);
    expect(jobRow.apply_rate_wilson_lb).toBeCloseTo(wilsonLowerBound(2, 100), 9);
    expect(jobRow.last_computed_at).toBe(NOW.toISOString());

    const [employerRow] = database.employerWrites;
    expect(employerRow.employer_id).toBe(EMPLOYER_ID);
    expect(employerRow.n_jobs_posted).toBe(3);
    expect(employerRow.n_completions).toBe(4);
    expect(employerRow.n_reports).toBe(1);
    expect(employerRow.completion_rate_wilson_lb).toBeCloseTo(wilsonLowerBound(4, 10), 9);
    expect(employerRow.positive_review_rate_wilson_lb).toBeCloseTo(wilsonLowerBound(4, 5), 9);
    expect(employerRow.response_rate_wilson_lb).toBeCloseTo(wilsonLowerBound(3, 6), 9);
    expect(employerRow.last_computed_at).toBe(NOW.toISOString());
    // verification_status is never written by the aggregation job
    expect("verification_status" in employerRow).toBe(false);
  });

  it("is deterministic: identical seeds + now produce identical reports and rows", async () => {
    const a = new AggregationDatabase(defaultSeeds());
    const b = new AggregationDatabase(defaultSeeds());
    const serviceA = new QualityAggregationService(a);
    const serviceB = new QualityAggregationService(b);
    const reportA = await serviceA.run({ now: NOW });
    const reportB = await serviceB.run({ now: NOW });

    expect(stripOperationalTiming(reportA)).toStrictEqual(stripOperationalTiming(reportB));
    expect(a.jobWrites).toStrictEqual(b.jobWrites);
    expect(a.employerWrites).toStrictEqual(b.employerWrites);
  });

  it("is idempotent: re-running never compounds counts (recomputed from events, not stats)", async () => {
    const database = new AggregationDatabase(defaultSeeds());
    const service = new QualityAggregationService(database);
    await service.run({ now: NOW });
    const firstSnapshot = serdeCopy(database.jobWrites);
    const second = await service.run({ now: NOW });
    expect(second.jobsProcessed).toBe(1);
    const secondSnapshot = database.jobWrites.slice(firstSnapshot.length);
    expect(secondSnapshot).toEqual(firstSnapshot); // identical snapshot, no increment
  });

  it("keeps a constant, bounded query count (no N+1 reads or per-row writes)", async () => {
    const database = new AggregationDatabase(defaultSeeds());
    await new QualityAggregationService(database).run({ now: NOW });
    // 7 batched reads + 1 advisory lock + 1 job upsert + 1 employer upsert
    expect(database.queryCount).toBe(10);
  });

  it("skips the write when a concurrent run holds the advisory lock", async () => {
    const database = new AggregationDatabase({ ...defaultSeeds(), lockAcquired: false });
    const report = await new QualityAggregationService(database).run({ now: NOW });
    expect(report.ok).toBe(true);
    expect(report.ran).toBe(false);
    expect(report.jobRowsWritten).toBe(0);
    expect(report.employerRowsWritten).toBe(0);
    expect(database.jobWrites).toHaveLength(0);
    expect(database.employerWrites).toHaveLength(0);
  });

  it("handles empty evidence (no events, no jobs) without writes", async () => {
    const database = new AggregationDatabase({ rawEventCount: 0, eventSummaries: [], jobsPosted: [] });
    const report = await new QualityAggregationService(database).run({ now: NOW });
    expect(report.jobsProcessed).toBe(0);
    expect(report.employersProcessed).toBe(0);
    expect(report.eventsConsidered).toBe(0);
    expect(report.eventsExcluded).toBe(0);
    expect(database.jobWrites).toHaveLength(0);
    expect(database.employerWrites).toHaveLength(0);
  });

  it("writes null, not punitive zeros, for employer components with no evidence", async () => {
    const seeds: ServiceSeeds = {
      rawEventCount: 0,
      eventSummaries: [],
      jobsPosted: [{ employer_id: EMPLOYER_ID, n_jobs_posted: 2 }],
      applications: [],
      reviews: [],
      reports: [],
      responses: [],
    };
    const database = new AggregationDatabase(seeds);
    await new QualityAggregationService(database).run({ now: NOW });
    const [row] = database.employerWrites;
    expect(row.n_jobs_posted).toBe(2);
    expect(row.n_completions).toBe(0);
    expect(row.completion_rate_wilson_lb).toBeNull();
    expect(row.positive_review_rate_wilson_lb).toBeNull();
    expect(row.response_rate_wilson_lb).toBeNull();
  });

  it("never writes NaN/out-of-range values even with malformed counters", async () => {
    const seeds: ServiceSeeds = {
      rawEventCount: 5,
      eventSummaries: [
        { job_id: JOB_ID, employer_id: EMPLOYER_ID, impressions: 10, clicks: 40, applies_started: Number.NaN, applies_submitted: 0, n_events: -3 },
      ],
      jobsPosted: [{ employer_id: EMPLOYER_ID, n_jobs_posted: "1.9" }],
      applications: [{ employer_id: EMPLOYER_ID, n_applications: 0, n_completions: 0 }],
      reviews: [],
      reports: [],
      responses: [],
    };
    const database = new AggregationDatabase(seeds);
    const report = await new QualityAggregationService(database).run({ now: NOW });
    const [jobRow] = database.jobWrites;
    const numeric = [jobRow.impressions, jobRow.clicks, jobRow.applies_started, jobRow.applies_submitted, jobRow.n_events, jobRow.ctr_wilson_lb as number, jobRow.apply_rate_wilson_lb as number];
    for (const value of numeric) expect(Number.isFinite(Number(value))).toBe(true);
    for (const value of [jobRow.ctr_wilson_lb as number, jobRow.apply_rate_wilson_lb as number]) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
    expect(report.jobsProcessed).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Phase 4 compatibility: aggregation output flows through the real scorer
// ---------------------------------------------------------------------------

class ScoringCompatDatabase implements DatabaseAdapter {
  constructor(
    private readonly jobStats: Record<string, unknown>[],
    private readonly employerStats: Record<string, unknown>[],
  ) {}

  async query<Row extends Record<string, unknown> = Record<string, unknown>>(
    statement: string,
  ): Promise<QueryResult<Row>> {
    const s = statement.trimStart();
    let raw: Record<string, unknown>[] = [];
    if (s.startsWith("select id, employer_id, category_id, pay_amount")) {
      raw = [
        {
          id: JOB_ID,
          employer_id: EMPLOYER_ID,
          category_id: "cat-1",
          pay_amount: 25,
          pay_currency: "USD",
          pay_type: "hourly",
          location_text: "Test City",
          latitude: 0,
          longitude: 0,
          start_date: null,
          start_time: null,
          end_time: null,
          created_at: NOW.toISOString(),
        },
      ];
    } else if (s.startsWith("select employer_id, completion_rate_wilson_lb")) {
      raw = this.employerStats.map((row) => ({
        employer_id: row.employer_id,
        completion_rate_wilson_lb: row.completion_rate_wilson_lb,
        positive_review_rate_wilson_lb: row.positive_review_rate_wilson_lb,
        response_rate_wilson_lb: row.response_rate_wilson_lb,
      }));
    } else if (s.startsWith("select job_id, ctr_wilson_lb")) {
      raw = this.jobStats.map((row) => ({
        job_id: row.job_id,
        ctr_wilson_lb: row.ctr_wilson_lb,
        apply_rate_wilson_lb: row.apply_rate_wilson_lb,
        n_events: row.n_events,
      }));
    }
    return { rows: raw as Row[], rowCount: raw.length };
  }

  transaction<T>(work: (database: DatabaseAdapter) => Promise<T>): Promise<T> {
    return work(this);
  }
}

function weightedMean(columns: { value: number | null; weight: number }[]): number {
  const present = columns.filter((c) => c.value != null && Number.isFinite(c.value) && c.weight >= 0);
  if (!present.length) return CONFIG.neutralPrior;
  const total = present.reduce((sum, c) => sum + c.weight, 0);
  if (!(total > 0)) return CONFIG.neutralPrior;
  return Math.min(1, Math.max(0, present.reduce((sum, c) => sum + c.weight * (c.value as number), 0) / total));
}

describe("Phase 4 compatibility (aggregation → stats tables → scorer)", () => {
  async function aggregateThenScore(): Promise<{ scored: ScoredCandidate[]; expected: Record<string, number> }> {
    const aggDb = new AggregationDatabase(defaultSeeds());
    await new QualityAggregationService(aggDb).run({ now: NOW });

    const scoringDb = new ScoringCompatDatabase(aggDb.jobWrites, aggDb.employerWrites);
    const scored = await new RankingScoringService(scoringDb).scoreCandidates({
      candidates: [
        {
          jobId: JOB_ID,
          employerId: EMPLOYER_ID,
          categoryId: "cat-1",
          createdAt: NOW.toISOString(),
          sources: ["general"],
        },
      ],
      now: NOW,
    });

    const [jobRow] = aggDb.jobWrites;
    const [employerRow] = aggDb.employerWrites;

    const employerQ = weightedMean([
      { value: employerRow.completion_rate_wilson_lb as number, weight: CONFIG.employerComponents.completion },
      { value: employerRow.positive_review_rate_wilson_lb as number, weight: CONFIG.employerComponents.positiveReview },
      { value: employerRow.response_rate_wilson_lb as number, weight: CONFIG.employerComponents.response },
    ]);
    const observed = weightedMean([
      { value: jobRow.ctr_wilson_lb as number, weight: CONFIG.jobComponents.ctr },
      { value: jobRow.apply_rate_wilson_lb as number, weight: CONFIG.jobComponents.applyRate },
    ]);
    const effective = jobQualityEffective(Number(jobRow.n_events), observed, employerQ, CONFIG.shrinkageK);
    const combined = combinedQuality(employerQ, effective, CONFIG.employerWeight, CONFIG.jobWeight);
    const multiplier = qualityMultiplier(combined, CONFIG.qualityMultiplierFloor, CONFIG.qualityMultiplierScale);

    const expected = { employerQ, observed, effective, combined, multiplier };
    return { scored, expected };
  }

  it("reproduces the exact quality figure the scorer computes from the persisted columns", async () => {
    const { scored, expected } = await aggregateThenScore();
    expect(scored).toHaveLength(1);
    const quality = scored[0].quality;

    expect(quality.employerQuality).toBeCloseTo(expected.employerQ, 9);
    expect(quality.jobObservedQuality).toBeCloseTo(expected.observed, 9);
    expect(quality.jobQualityEffective).toBeCloseTo(expected.effective, 9);
    expect(quality.combinedQuality).toBeCloseTo(expected.combined, 9);
    expect(quality.qualityMultiplier).toBeCloseTo(expected.multiplier, 9);
    expect(scored[0].rankingSnapshot.employerQuality).toBeCloseTo(expected.employerQ, 9);
    expect(scored[0].rankingSnapshot.combinedQuality).toBeCloseTo(expected.combined, 9);
    expect(scored[0].rankingSnapshot.qualityMultiplier).toBeCloseTo(expected.multiplier, 9);
  });

  it("stays in [0, 1] and finite end to end", async () => {
    const { scored, expected } = await aggregateThenScore();
    for (const value of [
      expected.employerQ,
      expected.observed,
      expected.effective,
      expected.combined,
      expected.multiplier,
      scored[0].organicScore,
    ]) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it("produces the pipe report type with all observability fields", async () => {
    const reportFactory = (): Promise<QualityAggregationRunReport> =>
      new QualityAggregationService(new AggregationDatabase(defaultSeeds())).run({ now: NOW });
    const report = await reportFactory();
    expect(typeof report.startedAt).toBe("string");
    expect(typeof report.finishedAt).toBe("string");
    expect(report.durationMs).toBeGreaterThanOrEqual(0);
    expect(report.now).toBe(NOW.toISOString());
    expect(report.aggregationVersion).toBe(AGG_VERSION);
  });
});