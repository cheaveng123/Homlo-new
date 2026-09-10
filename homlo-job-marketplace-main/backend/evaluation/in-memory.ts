// =========================================================
// In-memory DatabaseAdapter for evaluation (Phase 10).
//
// Routes every SQL statement the real ranking pipeline emits (Phase 3 retrieval,
// Phase 4 scoring, Phase 6 boosts, Phase 7 display) to an in-memory snapshot
// of `EvalDataset`, exactly mirroring the proven E2E routing patterns. This lets
// the evaluation run the real `RecommendationFeedService.getFeed` / `buildFinalPool`
// without a database, while keeping the evaluated code path identical to
// production.
//
// All matching is done via the same signature probes the E2E DB uses; a new
// statement from the pipeline that is NOT matched will produce a hard failure so
// the evaluation fails loudly instead of computing silently on empty data.
// =========================================================

import type { DatabaseAdapter, QueryResult, SqlParameter } from "../infrastructure/database/DatabaseAdapter";
import type { EvalDataset, EvalJob } from "./dataset";

type EvalRow = Record<string, unknown>;

export class EvalDatabase implements DatabaseAdapter {
  public queryCount = 0;

  constructor(private readonly dataset: EvalDataset) {}

  async query<Row extends Record<string, unknown> = Record<string, unknown>>(
    statement: string,
    parameters: readonly SqlParameter[] = [],
  ): Promise<QueryResult<Row>> {
    this.queryCount += 1;
    const rows = this.route(statement, parameters);
    return { rows: rows as Row[], rowCount: rows.length };
  }

  async transaction<T>(work: (database: DatabaseAdapter) => Promise<T>): Promise<T> {
    return work(this);
  }

  // -----------------------------------------------------------------------
  // SQL routing
  // -----------------------------------------------------------------------

  private route(statement: string, p: readonly SqlParameter[]): EvalRow[] {
    const s = this.dataset;

    // ---- Phase 3 · Trending source ------------------------------------------
    if (statement.includes("with trending as (")) return this.sourceTrending(p);

    // ---- Phase 3 · Exploration source ---------------------------------------
    if (statement.includes("employer_active_jobs_count < ")) return this.sourceExploration(p);

    // ---- Phase 3 · Geo source (case when $9 distinguishes it from general) -
    if (statement.includes("st_dwithin") && statement.includes("(case when ")) return this.sourceGeo(p);

    // ---- Phase 3 · Preferences source (category any) -----------------------
    if (statement.includes("j.category_id = any($6::uuid[])")) return this.sourcePreferences(p);

    // ---- Phase 3 · General source (st_dwithin without case when) -----------
    if (statement.includes("st_dwithin")) return this.sourceGeneral(p);

    // ---- Phase 4 · Scoring · jobs -------------------------------------------
    if (statement.includes("from jobs") && statement.includes("where id = any($1::uuid[])")) {
      const ids = parseUuidArray(String(p[0]));
      return s.jobs
        .filter((j) => ids.has(j.id))
        .map((j) => ({
          id: j.id,
          employer_id: j.employerId,
          category_id: j.categoryId,
          pay_amount: j.payAmount,
          pay_currency: j.payCurrency,
          pay_type: j.payType,
          location_text: j.locationText,
          latitude: j.latitude,
          longitude: j.longitude,
          start_date: j.startDate,
          start_time: j.startTime,
          end_time: j.endTime,
          created_at: j.createdAt.toISOString(),
        }));
    }

    // ---- Phase 4 · Scoring · employer_quality_stats -------------------------
    if (statement.startsWith("select employer_id, completion_rate_wilson_lb")) {
      const ids = parseUuidArray(String(p[0]));
      return [...s.employerQuality.values()]
        .filter((q) => ids.has(q.employerId))
        .map((q) => ({
          employer_id: q.employerId,
          completion_rate_wilson_lb: q.completionRateWilsonLB,
          positive_review_rate_wilson_lb: q.positiveReviewRateWilsonLB,
          response_rate_wilson_lb: q.responseRateWilsonLB,
        }));
    }

    // ---- Phase 4 · Scoring · job_quality_stats ------------------------------
    if (statement.startsWith("select job_id, ctr_wilson_lb")) {
      const ids = parseUuidArray(String(p[0]));
      return [...s.jobQuality.values()]
        .filter((q) => ids.has(q.jobId))
        .map((q) => ({
          job_id: q.jobId,
          ctr_wilson_lb: q.ctrWilsonLB,
          apply_rate_wilson_lb: q.applyRateWilsonLB,
          n_events: q.nEvents,
        }));
    }

    // ---- Phase 4 · Scoring · behavioral events ------------------------------
    if (statement.startsWith("select je.event_type, je.occurred_at")) {
      const userId = String(p[0]);
      const jobIndex = new Map<string, EvalJob>();
      for (const job of s.jobs) jobIndex.set(job.id, job);
      return s.events
        .filter((e) => e.userId === userId)
        .map((e) => ({
          event_type: e.eventType,
          occurred_at: e.occurredAt.toISOString(),
          dwell_time_ms: e.dwellTimeMs,
          employer_id: e.employerId,
          category_id: jobIndex.get(e.jobId)?.categoryId ?? null,
        }));
    }

    // ---- Phase 6 · Boosts ---------------------------------------------------
    if (statement.startsWith("select id, job_id, employer_id, package, start_at, expires_at")) {
      const jobIds = parseUuidArray(String(p[0]));
      const now = p[1] as Date;
      return s.boosts
        .filter(
          (b) =>
            jobIds.has(b.jobId) &&
            b.status === "active" &&
            b.startAt.getTime() <= now.getTime() &&
            now.getTime() < b.expiresAt.getTime(),
        )
        .map((b) => ({
          id: `boost-${b.jobId}`,
          job_id: b.jobId,
          employer_id: b.employerId,
          package: b.package,
          start_at: b.startAt.toISOString(),
          expires_at: b.expiresAt.toISOString(),
        }));
    }

    // ---- Phase 7 · Display --------------------------------------------------
    if (statement.includes("coalesce(c.name, 'Other') as category")) {
      const ids = parseUuidArray(String(p[0]));
      const profileIndex = new Map<string, EvalDataset["profiles"][0]>();
      for (const profile of s.profiles) profileIndex.set(profile.userId, profile);
      return s.jobs
        .filter((j) => !j.deleted && ids.has(j.id))
        .map((j) => ({
          id: j.id,
          title: j.title,
          description: j.description,
          pay_amount: j.payAmount,
          pay_currency: j.payCurrency,
          pay_type: j.payType,
          location_text: j.locationText,
          latitude: j.latitude,
          longitude: j.longitude,
          workers_needed: j.workersNeeded,
          created_at: j.createdAt.toISOString(),
          category: "Other",
          employer_name: profileIndex.get(j.employerId)?.fullName ?? null,
          employer_photo_key: null,
        }));
    }

    throw new EvalSQLRouteError(statement);
  }

  // -----------------------------------------------------------------------
  // Eligibility filter (mirrors 022_candidate_retrieval.sql exactly)
  // -----------------------------------------------------------------------

  private eligibleCandidates(workerId: string | null, workerLat: number | null, workerLng: number | null, hardMaxKm: number, nowIso: string): EvalRow[] {
    const s = this.dataset;
    const now = new Date(nowIso);
    const nowDate = now.toISOString().slice(0, 10);
    const nowTime = now.toISOString().slice(11, 19);

    const activeCount = new Map<string, number>();
    for (const j of s.jobs) if (!j.deleted) activeCount.set(j.employerId, (activeCount.get(j.employerId) ?? 0) + 1);

    return s.jobs
      .filter((j) => {
        if (j.deleted || j.status !== "open" || j.workersHired >= j.workersNeeded) return false;
        const emp = s.users.find((u) => u.id === j.employerId);
        if (!emp || emp.status !== "active") return false;
        if (workerId) {
          if (j.employerId === workerId) return false;
          const applied = s.applications.some(
            (a) => a.jobId === j.id && a.workerId === workerId && !["withdrawn", "declined"].includes(a.status),
          );
          if (applied) return false;
        }
        if (j.startDate) {
          if (j.startDate > nowDate) {
            // future start date — still accepting
          } else if (j.startDate === nowDate) {
            if (j.startTime && j.startTime <= nowTime) return false;
          } else {
            return false;
          }
        }
        if (workerLat != null && workerLng != null && j.latitude != null && j.longitude != null) {
          if (haversineKm(workerLat, workerLng, j.latitude, j.longitude) > hardMaxKm) return false;
        }
        return true;
      })
      .map((j) => ({
        id: j.id,
        employer_id: j.employerId,
        category_id: j.categoryId,
        created_at: j.createdAt.toISOString(),
        employer_active_jobs_count: activeCount.get(j.employerId) ?? 0,
        employer_created_at: (s.users.find((u) => u.id === j.employerId)?.createdAt ?? j.createdAt).toISOString(),
      }));
  }

  // -----------------------------------------------------------------------
  // Source implementations (mirroring E2E verbatim)
  // -----------------------------------------------------------------------

  private sourceGeo(p: readonly SqlParameter[]): EvalRow[] {
    const rows = this.eligibleCandidates(p[0] as string | null, p[1] as number | null, p[2] as number | null, Number(p[3]), String(p[4]));
    const radiusKm = Number(p[7]);
    const categoryIds = p[8] == null ? null : parseUuidArray(String(p[8]));
    const limit = Number(p[9]);
    const lat = Number(p[1]);
    const lng = Number(p[2]);
    const jobIndex = this.jobIndex();
    return rows
      .filter((row) => {
        const j = jobIndex.get(String(row.id))!;
        if (j.latitude == null || j.longitude == null) return false;
        return haversineKm(lat, lng, j.latitude, j.longitude) <= radiusKm;
      })
      .sort((a, b) => {
        const jA = jobIndex.get(String(a.id))!;
        const jB = jobIndex.get(String(b.id))!;
        const aMismatch = categoryIds && jA.categoryId && !categoryIds.has(jA.categoryId) ? 1 : 0;
        const bMismatch = categoryIds && jB.categoryId && !categoryIds.has(jB.categoryId) ? 1 : 0;
        if (aMismatch !== bMismatch) return aMismatch - bMismatch;
        const dA = haversineKm(lat, lng, jA.latitude!, jA.longitude!);
        const dB = haversineKm(lat, lng, jB.latitude!, jB.longitude!);
        if (dA !== dB) return dA - dB;
        return jB.createdAt.getTime() - jA.createdAt.getTime();
      })
      .slice(0, limit);
  }

  private sourcePreferences(p: readonly SqlParameter[]): EvalRow[] {
    const rows = this.eligibleCandidates(p[0] as string | null, p[1] as number | null, p[2] as number | null, Number(p[3]), String(p[4]));
    const categories = p[5] == null ? null : parseUuidArray(String(p[5]));
    const payTypes = p[6] == null ? null : new Set(parseArrayParam(String(p[6])).filter((item): item is string => item != null));
    const min = p[7] == null ? null : Number(p[7]);
    const max = p[8] == null ? null : Number(p[8]);
    const limit = Number(p[9]);
    const jobIndex = this.jobIndex();
    return rows
      .filter((row) => {
        const j = jobIndex.get(String(row.id))!;
        if (categories && j.categoryId && !categories.has(j.categoryId)) return false;
        if (payTypes && !payTypes.has(j.payType)) return false;
        if (min != null && j.payAmount < min) return false;
        if (max != null && j.payAmount > max) return false;
        return true;
      })
      .sort((a, b) => Date.parse(String(b.created_at)) - Date.parse(String(a.created_at)))
      .slice(0, limit);
  }

  private sourceGeneral(p: readonly SqlParameter[]): EvalRow[] {
    const rows = this.eligibleCandidates(p[0] as string | null, p[1] as number | null, p[2] as number | null, Number(p[3]), String(p[4]));
    const radiusKm = Number(p[7]);
    const limit = Number(p[8]);
    const lat = Number(p[1]);
    const lng = Number(p[2]);
    const jobIndex = this.jobIndex();
    return rows
      .filter((row) => {
        const j = jobIndex.get(String(row.id))!;
        if (j.latitude == null || j.longitude == null) return false;
        return haversineKm(lat, lng, j.latitude, j.longitude) <= radiusKm;
      })
      .sort((a, b) => Date.parse(String(b.created_at)) - Date.parse(String(a.created_at)))
      .slice(0, limit);
  }

  private sourceTrending(p: readonly SqlParameter[]): EvalRow[] {
    const rows = this.eligibleCandidates(p[0] as string | null, p[1] as number | null, p[2] as number | null, Number(p[3]), String(p[4]));
    const cutoff = p[5] as Date;
    const minRecent = Number(p[6]);
    const limit = Number(p[7]);
    const recentCounts = new Map<string, number>();
    const lifetimeCounts = new Map<string, number>();
    for (const e of this.dataset.events) {
      if (!["impression", "click", "view"].includes(e.eventType)) continue;
      if (e.occurredAt.getTime() >= cutoff.getTime()) recentCounts.set(e.jobId, (recentCounts.get(e.jobId) ?? 0) + 1);
      lifetimeCounts.set(e.jobId, (lifetimeCounts.get(e.jobId) ?? 0) + 1);
    }
    return rows
      .filter((row) => (recentCounts.get(String(row.id)) ?? 0) >= minRecent)
      .map(
        (row): EvalRow => ({
          ...row,
          trending_velocity: (recentCounts.get(String(row.id)) ?? 0) / Math.max(lifetimeCounts.get(String(row.id)) ?? 1, 1),
        }),
      )
      .sort(
        (a, b) =>
          ((b.trending_velocity as number) ?? 0) - ((a.trending_velocity as number) ?? 0) ||
          Date.parse(String(b.created_at)) - Date.parse(String(a.created_at)),
      )
      .slice(0, limit);
  }

  private sourceExploration(p: readonly SqlParameter[]): EvalRow[] {
    const rows = this.eligibleCandidates(p[0] as string | null, p[1] as number | null, p[2] as number | null, Number(p[3]), String(p[4]));
    const cutoff = p[5] as Date;
    const minEmployerJobs = Number(p[6]);
    const limit = Number(p[7]);
    return rows
      .filter((row) => new Date(String(row.created_at)).getTime() >= cutoff.getTime() || (row.employer_active_jobs_count as number) < minEmployerJobs)
      .sort(
        (a, b) =>
          Date.parse(String(b.created_at)) - Date.parse(String(a.created_at)) ||
          Date.parse(String(b.employer_created_at)) - Date.parse(String(a.employer_created_at)),
      )
      .slice(0, limit);
  }

  // -----------------------------------------------------------------------
  // Indexes
  // -----------------------------------------------------------------------

  private _jobIndex: Map<string, EvalJob> | null = null;
  private jobIndex(): Map<string, EvalJob> {
    if (!this._jobIndex) {
      this._jobIndex = new Map();
      for (const job of this.dataset.jobs) this._jobIndex.set(job.id, job);
    }
    return this._jobIndex;
  }
}

class EvalSQLRouteError extends Error {
  constructor(statement: string) {
    super(`EvalDatabase: unhandled SQL statement: ${statement.slice(0, 140)}`);
    this.name = "EvalSQLRouteError";
  }
}

// -----------------------------------------------------------------------
// Helpers (mirroring E2E utils)
// -----------------------------------------------------------------------

function parseArrayParam(value: string): (string | null)[] {
  const trimmed = value.replace(/^{/, "").replace(/}$/, "");
  if (!trimmed) return [];
  return trimmed.split(",").map((item) => (item === "NULL" ? null : item));
}

function parseUuidArray(value: string): Set<string> {
  return new Set(parseArrayParam(value).filter((item): item is string => item != null));
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}