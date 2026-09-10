// =========================================================
// CandidateRetrievalService — candidate POOLING (phase 3).
//
// This is the "candidate selection" stage: it produces a bounded,
// unbiased pool of job candidates the worker is ELIGIBLE for, from
// five independent sources. It does NOT score, rank, diversify, or
// choose an output ordering — a later scoring service consumes the
// returned pool and does the ranking.
//
// Every source starts from the shared eligibility filter
// (homlo_eligible_candidates), so no source re-implements
// status/deadline/fullness/fraud/application/commute logic.
//
// Sources:
//   1. geo        — near the worker (geoRadiusKm, never past the hard
//                   commute cap), category-preference-matched jobs first,
//                   then nearest-first. Requires the worker location.
//   2. preferences— exact match on the worker's stated preferences
//                   (categories, pay type, pay range). Skipped entirely
//                   when no preference fields are supplied (cold start).
//   3. general    — safety net: any job near the worker (generalRadiusKm,
//                   clamped to the hard commute cap), newest first.
//   4. trending   — recent engagement proxy: impressions/clicks/views in
//                   the last trendingWindowHours, normalized by lifetime
//                   engagement, minimum recent-event guard. Returns [] until
//                   events accumulate. NOTE: temporary approach — to be
//                   replaced by the scheduled job_quality_stats aggregation.
//   5. exploration— controlled newness: posted within explorationRecencyHours,
//                   or by an employer with < explorationMinEmployerJobs active
//                   listings (small/new employers), newest-first, then
//                   newest-employer-first.
//
// Merging: results are deduplicated by job id (keeping source provenance),
// each active source is capped proportionally (poolMax / active sources,
// bounded by its configured sourceCap), then any remaining pool slots are
// filled from any source (dedupe-first) up to candidatePoolMax. There is no
// padding below candidatePoolMin — the pool is simply smaller if candidates
// are scarce.
// =========================================================

import type { DatabaseAdapter } from "../infrastructure/database/DatabaseAdapter";
import { rankingConfig } from "../config/rankingConfig";

export type CandidateSourceId = "geo" | "preferences" | "general" | "trending" | "exploration";

export type RetrievalPreferences = {
  categoryIds?: string[];
  payTypes?: string[];
  payRangeMin?: number;
  payRangeMax?: number;
};

export type RetrievalInput = {
  workerId?: string | null;
  userLocation?: { latitude: number; longitude: number } | null;
  preferences?: RetrievalPreferences | null;
  /** Explicit ranking instant. Defaults to `new Date()`; injected for determinism (phase 7). */
  now?: Date;
};

export type RetrievalCandidate = {
  jobId: string;
  employerId: string;
  categoryId: string | null;
  createdAt: string;
  sources: CandidateSourceId[];
  trendingVelocity?: number;
};

export type RetrievalResult = {
  candidates: RetrievalCandidate[];
  poolSize: number;
  sourcesActive: CandidateSourceId[];
  skipped: { source: CandidateSourceId; reason: string }[];
};

type CandidateRow = {
  id: string;
  employer_id: string;
  category_id: string | null;
  created_at: string | Date;
  trending_velocity?: number | string;
};

type SourceContext = {
  workerId: string | null;
  latitude: number | null;
  longitude: number | null;
  hardMaxKm: number;
  nowMs: number;
  /** ISO-8601 instant injected for determinism; bound as the 5th eligibility arg. */
  nowIso: string;
};

type SourceBatch = {
  source: CandidateSourceId;
  rows: CandidateRow[];
  skippedReason?: string;
};

export class CandidateRetrievalService {
  constructor(private readonly database: DatabaseAdapter) {}

  async retrieve(input: RetrievalInput): Promise<RetrievalResult> {
    const config = rankingConfig;
    const poolMax = config.retrieval.candidatePoolMax;
    if (poolMax <= 0) {
      return { candidates: [], poolSize: 0, sourcesActive: [], skipped: [] };
    }

    const now =
      input.now instanceof Date && !Number.isNaN(input.now.getTime()) ? input.now : new Date();

    const workerId = input.workerId ?? null;
    const hasLocation =
      input.userLocation != null &&
      Number.isFinite(input.userLocation.latitude) &&
      Number.isFinite(input.userLocation.longitude);
    const userLocation = hasLocation
      ? { latitude: input.userLocation!.latitude, longitude: input.userLocation!.longitude }
      : null;
    const preferences = input.preferences ?? null;
    const hasPreferences = Boolean(
      preferences &&
        (preferences.categoryIds?.length ||
          preferences.payTypes?.length ||
          preferences.payRangeMin != null ||
          preferences.payRangeMax != null),
    );

    const context: SourceContext = {
      workerId,
      latitude: userLocation?.latitude ?? null,
      longitude: userLocation?.longitude ?? null,
      hardMaxKm: config.location.hardMaxCommuteKm,
      nowMs: now.getTime(),
      nowIso: now.toISOString(),
    };

    const batches: SourceBatch[] = [];

    if (hasLocation) {
      batches.push({ source: "geo", rows: await this.sourceGeo(context, preferences) });
    } else {
      batches.push({ source: "geo", rows: [], skippedReason: "no user location" });
    }

    if (hasPreferences && preferences) {
      batches.push({ source: "preferences", rows: await this.sourcePreferences(context, preferences) });
    } else {
      batches.push({ source: "preferences", rows: [], skippedReason: "no preferences supplied (cold start or anonymous)" });
    }

    if (hasLocation) {
      batches.push({ source: "general", rows: await this.sourceGeneral(context) });
    } else {
      batches.push({ source: "general", rows: [], skippedReason: "no user location" });
    }

    batches.push({ source: "trending", rows: await this.sourceTrending(context) });
    batches.push({ source: "exploration", rows: await this.sourceExploration(context) });

    return this.merge(batches, config.retrieval.candidatePoolMax, config.retrieval.sourceCaps);
  }

  // ---- Sources ---------------------------------------------------------------

  private async sourceGeo(context: SourceContext, preferences: RetrievalPreferences | null): Promise<CandidateRow[]> {
    if (context.latitude == null || context.longitude == null) return [];
    const config = rankingConfig;
    const radiusKm = Math.min(config.retrieval.geoRadiusKm, context.hardMaxKm);
    const categoryIds = preferences?.categoryIds?.length ? preferences.categoryIds : null;

    const { rows } = await this.database.query<CandidateRow>(
      `select eje.id, j.employer_id, j.category_id, j.created_at
         from homlo_eligible_candidates($1, $2, $3, $4, $5) as eje
         join jobs j on j.id = eje.id
        where j.location is not null
          and st_dwithin(j.location, st_setsrid(st_makepoint($7, $6), 4326)::geography, $8::double precision * 1000)
        order by
          (case when $9::uuid[] is null then 0 when j.category_id = any($9::uuid[]) then 0 else 1 end) asc,
          st_distance(j.location, st_setsrid(st_makepoint($7, $6), 4326)::geography) asc,
          j.created_at desc
        limit $10`,
      [
        context.workerId,
        context.latitude,
        context.longitude,
        context.hardMaxKm,
        context.nowIso,
        context.longitude,
        context.latitude,
        radiusKm,
        categoryIds ? `{${categoryIds.join(",")}}` : null,
        config.retrieval.sourceCaps.geo,
      ],
    );
    return rows;
  }

  private async sourcePreferences(context: SourceContext, preferences: RetrievalPreferences): Promise<CandidateRow[]> {
    const config = rankingConfig;
    const categoryIds = preferences.categoryIds?.length ? preferences.categoryIds : null;
    const payTypes = preferences.payTypes?.length ? preferences.payTypes : null;

    const { rows } = await this.database.query<CandidateRow>(
      `select eje.id, j.employer_id, j.category_id, j.created_at
         from homlo_eligible_candidates($1, $2, $3, $4, $5) as eje
         join jobs j on j.id = eje.id
        where ($6::uuid[] is null or j.category_id = any($6::uuid[]))
          and ($7::text[] is null or j.pay_type = any($7::text[]))
          and ($8::numeric is null or j.pay_amount >= $8::numeric)
          and ($9::numeric is null or j.pay_amount <= $9::numeric)
        order by j.created_at desc
        limit $10`,
      [
        context.workerId,
        context.latitude,
        context.longitude,
        context.hardMaxKm,
        context.nowIso,
        categoryIds ? `{${categoryIds.join(",")}}` : null,
        payTypes ? `{${payTypes.join(",")}}` : null,
        preferences.payRangeMin ?? null,
        preferences.payRangeMax ?? null,
        config.retrieval.sourceCaps.preferences,
      ],
    );
    return rows;
  }

  private async sourceGeneral(context: SourceContext): Promise<CandidateRow[]> {
    if (context.latitude == null || context.longitude == null) return [];
    const config = rankingConfig;
    const radiusKm = Math.min(config.retrieval.generalRadiusKm, context.hardMaxKm);

    const { rows } = await this.database.query<CandidateRow>(
      `select eje.id, j.employer_id, j.category_id, j.created_at
         from homlo_eligible_candidates($1, $2, $3, $4, $5) as eje
         join jobs j on j.id = eje.id
        where j.location is not null
          and st_dwithin(j.location, st_setsrid(st_makepoint($7, $6), 4326)::geography, $8::double precision * 1000)
        order by j.created_at desc
        limit $9`,
      [
        context.workerId,
        context.latitude,
        context.longitude,
        context.hardMaxKm,
        context.nowIso,
        context.longitude,
        context.latitude,
        radiusKm,
        config.retrieval.sourceCaps.general,
      ],
    );
    return rows;
  }

  private async sourceTrending(context: SourceContext): Promise<CandidateRow[]> {
    const config = rankingConfig;
    const cutoff = new Date(context.nowMs - config.retrieval.trendingWindowHours * 60 * 60 * 1000);

    // TODO(quality-stats): replace this event-derived proxy with the scheduled
    // job_quality_stats aggregation when it exists. Kept as a standalone CTE so
    // the swap is confined to this one query.
    const { rows } = await this.database.query<CandidateRow>(
      `with trending as (
         select je.job_id, count(*)::bigint as recent_events
           from job_events je
          where je.event_type in ('impression', 'click', 'view')
            and je.occurred_at >= $6
          group by je.job_id
         having count(*)::bigint >= $7::bigint
       ),
       lifetime as (
         select je.job_id, count(*)::bigint as total_events
           from job_events je
           join trending t on t.job_id = je.job_id
          where je.event_type in ('impression', 'click', 'view')
          group by je.job_id
       )
       select eje.id, j.employer_id, j.category_id, j.created_at,
              (t.recent_events::double precision / greatest(l.total_events, 1)) as trending_velocity
         from homlo_eligible_candidates($1, $2, $3, $4, $5) as eje
         join jobs j on j.id = eje.id
         join trending t on t.job_id = eje.id
         join lifetime l on l.job_id = eje.id
        order by trending_velocity desc, j.created_at desc
        limit $8`,
      [
        context.workerId,
        context.latitude,
        context.longitude,
        context.hardMaxKm,
        context.nowIso,
        cutoff,
        config.retrieval.trendingMinRecentEvents,
        config.retrieval.sourceCaps.trending,
      ],
    );
    return rows;
  }

  private async sourceExploration(context: SourceContext): Promise<CandidateRow[]> {
    const config = rankingConfig;
    const cutoff = new Date(context.nowMs - config.retrieval.explorationRecencyHours * 60 * 60 * 1000);

    const { rows } = await this.database.query<CandidateRow>(
      `select eje.id, j.employer_id, j.category_id, j.created_at
         from homlo_eligible_candidates($1, $2, $3, $4, $5) as eje
         join jobs j on j.id = eje.id
         join users emp on emp.id = eje.employer_id
        where (j.created_at >= $6 or eje.employer_active_jobs_count < $7::bigint)
        order by j.created_at desc, emp.created_at desc
        limit $8`,
      [
        context.workerId,
        context.latitude,
        context.longitude,
        context.hardMaxKm,
        context.nowIso,
        cutoff,
        config.retrieval.explorationMinEmployerJobs,
        config.retrieval.sourceCaps.exploration,
      ],
    );
    return rows;
  }

  // ---- Merging ---------------------------------------------------------------

  private merge(
    batches: SourceBatch[],
    poolMax: number,
    sourceCaps: { geo: number; preferences: number; general: number; trending: number; exploration: number },
  ): RetrievalResult {
    const active = batches.filter((batch) => batch.skippedReason == null);
    const perSourceCap =
      active.length > 0 ? Math.ceil(poolMax / active.length) : poolMax;

    const candidates: RetrievalCandidate[] = [];
    const byJobId = new Map<string, RetrievalCandidate>();
    const takenBySource = new Map<CandidateSourceId, number>();

    const add = (row: CandidateRow, source: CandidateSourceId): boolean => {
      const existing = byJobId.get(row.id);
      if (existing) {
        if (!existing.sources.includes(source)) existing.sources.push(source);
        return false;
      }
      if (candidates.length >= poolMax) return false;
      const candidate: RetrievalCandidate = {
        jobId: row.id,
        employerId: row.employer_id,
        categoryId: row.category_id ?? null,
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
        sources: [source],
      };
      if (typeof row.trending_velocity === "number" && Number.isFinite(row.trending_velocity)) {
        candidate.trendingVelocity = row.trending_velocity;
      }
      candidates.push(candidate);
      byJobId.set(row.id, candidate);
      return true;
    };

    // Pass 1: proportional per-source contribution (diversity before volume).
    for (const batch of batches) {
      if (batch.rows.length === 0) continue;
      const pass1Limit = Math.min(sourceCaps[batch.source], perSourceCap);
      for (const row of batch.rows) {
        if (candidates.length >= poolMax) break;
        if ((takenBySource.get(batch.source) ?? 0) >= pass1Limit) break;
        if (add(row, batch.source)) {
          takenBySource.set(batch.source, (takenBySource.get(batch.source) ?? 0) + 1);
        }
      }
    }

    // Pass 2: fill remaining pool slots from any source, dedupe-first.
    if (candidates.length < poolMax) {
      for (const batch of batches) {
        for (const row of batch.rows) {
          if (candidates.length >= poolMax) break;
          if (byJobId.has(row.id)) continue;
          add(row, batch.source);
        }
      }
    }

    return {
      candidates,
      poolSize: candidates.length,
      sourcesActive: batches.filter((batch) => batch.rows.length > 0).map((batch) => batch.source),
      skipped: batches
        .filter((batch) => batch.skippedReason != null)
        .map((batch) => ({ source: batch.source, reason: batch.skippedReason! })),
    };
  }
}