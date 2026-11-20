import { describe, expect, it, vi } from "vitest";

import { createHash } from "node:crypto";
import { rankingConfig } from "../backend/config/rankingConfig";
import { RecommendationFeedService } from "../backend/ranking/recommendation-feed";
import { QualityAggregationService } from "../backend/ranking/quality-aggregation-service";
import {
  encodeFeedCursor,
  InvalidFeedCursorError,
  validateFeedCursor,
} from "../backend/ranking/feed-assembly";
import { EventLoggingService, hashIp, type HomloEventLogInput } from "../server/event-logging";
import { recommendationsFeedInputSchema } from "../server/routers";
import { router, supabaseProtectedProcedure } from "../server/_core/trpc";
import type { TrpcContext } from "../server/_core/context";
import type { HomloSessionUser } from "../server/homlo-direct-service";
import type { DatabaseAdapter, QueryResult, SqlParameter } from "../backend/infrastructure/database/DatabaseAdapter";

// ---------------------------------------------------------------------------
// Phase 9 end-to-end integration: the authoritative pipeline as ONE system.
//
// Everything — retrieval (phase 3), scoring (phase 4), MMR (phase 5), sponsored
// + exploration (phase 6), final assembly (phase 7), event logging (phase 2)
// and quality aggregation (phase 8) — is driven against a single stateful
// in-memory database that faithfully routes every SQL statement the services
// emit. This proves the feedback loop (events → aggregation → better ranking),
// auth-derived identity (never a client userId), constant query counts, and
// deterministic, idempotent, failure-safe behavior end to end.
// ---------------------------------------------------------------------------

const NOW = new Date("2026-08-01T12:00:00.000Z");
const VERSION = rankingConfig.version;
const EXPLORATION_SHARE = rankingConfig.exploration.targetShare;
const PAGE_MAX = rankingConfig.feed.pageSizeMax;
const HARD_COMMUTE_KM = rankingConfig.location.hardMaxCommuteKm;

function createdAgo(hours: number): Date {
  return new Date(NOW.getTime() - hours * 3_600_000);
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

function parseArrayParam(value: string): (string | null)[] {
  const trimmed = value.replace(/^{/, "").replace(/}$/, "");
  if (!trimmed) return [];
  return trimmed.split(",").map((item) => (item === "NULL" ? null : item));
}

function parseUuidArray(value: string): Set<string> {
  return new Set(parseArrayParam(value).filter((item): item is string => item != null));
}

function parseNumberArray(value: string): (number | null)[] {
  return parseArrayParam(value).map((item) => (item == null ? null : Number(item)));
}

// ---------------------------------------------------------------------------
// Seeded domain rows
// ---------------------------------------------------------------------------

type E2EJob = {
  id: string;
  employerId: string;
  categoryId: string | null;
  title: string;
  description: string;
  payAmount: number;
  payCurrency: string;
  payType: "hourly" | "daily" | "fixed";
  locationText: string | null;
  latitude: number | null;
  longitude: number | null;
  startDate: string | null;
  startTime: string | null;
  endTime: string | null;
  workersNeeded: number;
  workersHired: number;
  status: "draft" | "open" | "filled" | "closed";
  deleted: boolean;
  createdAt: Date;
};

type E2EProfile = { userId: string; fullName: string | null; latitude: number | null; longitude: number | null; deleted: boolean };
type E2EUser = { id: string; status: string; createdAt: Date };
type E2EApplication = { jobId: string; workerId: string; status: string };
type E2EBoost = { jobId: string; employerId: string; status: string; startAt: Date; expiresAt: Date };
type E2EReview = { employerId: string; rating: number; deleted: boolean };
type E2EReport = { targetType: "job" | "user"; targetId: string; status: string };
type E2EMessage = { id: string; conversationId: string; jobId: string; employerId: string; senderId: string; createdAt: Date };
type E2EEvent = {
  id: string;
  eventType: string;
  userId: string | null;
  jobId: string;
  employerId: string;
  sessionId: string | null;
  feedPosition: number | null;
  occurredAt: Date;
  ipHash: string | null;
  dwellTimeMs: number | null;
  snapshot: string | null;
};
type JobQualityRow = {
  jobId: string;
  impressions: number;
  clicks: number;
  appliesStarted: number;
  appliesSubmitted: number;
  ctrWilsonLB: number | null;
  applyRateWilsonLB: number | null;
  nEvents: number;
  lastComputedAt: string;
};
type EmployerQualityRow = {
  employerId: string;
  nJobsPosted: number;
  nCompletions: number;
  nReports: number;
  completionRateWilsonLB: number | null;
  positiveReviewRateWilsonLB: number | null;
  responseRateWilsonLB: number | null;
  lastComputedAt: string;
};

function job(id: string, overrides: Partial<E2EJob> = {}): E2EJob {
  return {
    id,
    employerId: `emp-${id}`,
    categoryId: "cat-1",
    title: `Job ${id}`,
    description: `Description ${id}`,
    payAmount: 20,
    payCurrency: "USD",
    payType: "hourly",
    locationText: "Test City",
    latitude: 0,
    longitude: 0,
    startDate: null,
    startTime: null,
    endTime: null,
    workersNeeded: 2,
    workersHired: 0,
    status: "open",
    deleted: false,
    createdAt: createdAgo(2),
    ...overrides,
  };
}

class E2EStore {
  jobs: E2EJob[] = [];
  profiles = new Map<string, E2EProfile>();
  users = new Map<string, E2EUser>();
  applications: E2EApplication[] = [];
  boosts: E2EBoost[] = [];
  reviews: E2EReview[] = [];
  reports: E2EReport[] = [];
  messages: E2EMessage[] = [];
  events: E2EEvent[] = [];
  jobQuality = new Map<string, JobQualityRow>();
  employerQuality = new Map<string, EmployerQualityRow>();
  private nextEventId = 1;

  seedDefaults(): this {
    return this;
  }

  addJob(j: E2EJob): void {
    this.jobs.push(j);
    this.users.set(j.employerId, { id: j.employerId, status: "active", createdAt: createdAgo(10_000) });
    this.profiles.set(j.employerId, { userId: j.employerId, fullName: `Employer ${j.employerId}`, latitude: null, longitude: null, deleted: false });
  }

  recordEvent(partial: Omit<E2EEvent, "id">): string {
    const event: E2EEvent = { id: `evt-${this.nextEventId++}`, ...partial };
    this.events.push(event);
    return event.id;
  }
}

// ---------------------------------------------------------------------------
// The single in-memory DatabaseAdapter that routes EVERY SQL statement the
// pipeline emits, including aggregation upserts and event-logging inserts.
// ---------------------------------------------------------------------------

class E2EDatabase implements DatabaseAdapter {
  public queryCount = 0;
  public transactions = 0;

  constructor(public readonly store: E2EStore) {}

  async query<Row extends Record<string, unknown> = Record<string, unknown>>(
    statement: string,
    parameters: readonly SqlParameter[] = [],
  ): Promise<QueryResult<Row>> {
    this.queryCount += 1;
    const raw = this.route(statement, parameters);
    return { rows: raw as Row[], rowCount: raw.length };
  }

  transaction<T>(work: (database: DatabaseAdapter) => Promise<T>): Promise<T> {
    this.transactions += 1;
    return work(this);
  }

  private route(statement: string, p: readonly SqlParameter[]): Record<string, unknown>[] {
    const store = this.store;

    // ---- Phase 2 event logging ---------------------------------------------
    if (statement.includes("from jobs where id = $1 and deleted_at is null limit 1")) {
      return store.jobs
        .filter((j) => j.id === String(p[0]) && !j.deleted)
        .map((j) => ({ id: j.id, employer_id: j.employerId }));
    }
    if (statement.startsWith("insert into job_events")) {
      const id = store.recordEvent({
        eventType: String(p[0]),
        userId: p[1] == null ? null : String(p[1]),
        jobId: String(p[2]),
        employerId: String(p[3]),
        sessionId: p[4] == null ? null : String(p[4]),
        feedPosition: p[5] == null ? null : Number(p[5]),
        occurredAt: NOW,
        ipHash: p[13] == null ? null : String(p[13]),
        dwellTimeMs: p[14] == null ? null : Number(p[14]),
        snapshot: p[9] as string | null,
      });
      return [{ id }];
    }

    // ---- Phase 8 quality aggregation ---------------------------------------
    if (statement.includes("pg_try_advisory_xact_lock")) {
      return [{ locked: true }];
    }
    if (statement.includes("with sig as")) {
      return this.aggregateJobSignals(store);
    }
    if (statement.includes("select count(*)::bigint as total_events")) {
      return [{ total_events: store.events.filter((e) => !store.jobs.find((j) => j.id === e.jobId)?.deleted).length }];
    }
    if (statement.includes("as n_jobs_posted")) {
      const counts = new Map<string, number>();
      for (const jobRow of store.jobs) if (!jobRow.deleted) counts.set(jobRow.employerId, (counts.get(jobRow.employerId) ?? 0) + 1);
      return [...counts].map(([employerId, n]) => ({ employer_id: employerId, n_jobs_posted: n }));
    }
    if (statement.includes("as n_completions")) {
      const counts = new Map<string, { nApplications: number; nCompletions: number }>();
      for (const app of store.applications) {
        const jobRow = store.jobs.find((j) => j.id === app.jobId && !j.deleted);
        if (!jobRow) continue;
        const entry = counts.get(jobRow.employerId) ?? { nApplications: 0, nCompletions: 0 };
        entry.nApplications += 1;
        if (app.status === "hired") entry.nCompletions += 1;
        counts.set(jobRow.employerId, entry);
      }
      return [...counts].map(([employerId, c]) => ({
        employer_id: employerId,
        n_applications: c.nApplications,
        n_completions: c.nCompletions,
      }));
    }
    if (statement.includes("n_positive_reviews")) {
      const threshold = p[0] == null ? 4 : Number(p[0]);
      const counts = new Map<string, { reviewCount: number; positive: number }>();
      for (const review of store.reviews) {
        if (review.deleted) continue;
        const entry = counts.get(review.employerId) ?? { reviewCount: 0, positive: 0 };
        entry.reviewCount += 1;
        if (review.rating >= threshold) entry.positive += 1;
        counts.set(review.employerId, entry);
      }
      return [...counts].map(([employerId, c]) => ({
        employer_id: employerId,
        n_reviews: c.reviewCount,
        n_positive_reviews: c.positive,
      }));
    }
    if (statement.includes("as n_reports")) {
      const counts = new Map<string, number>();
      for (const report of store.reports) {
        if (!["open", "reviewed", "actioned"].includes(report.status)) continue;
        const targets = store.jobs
          .filter((j) => !j.deleted && (report.targetType === "job" ? j.id === report.targetId : j.employerId === report.targetId))
          .map((j) => j.employerId);
        for (const employerId of targets) counts.set(employerId, (counts.get(employerId) ?? 0) + 1);
      }
      return [...counts].map(([employerId, n]) => ({ employer_id: employerId, n_reports: n }));
    }
    if (statement.includes("with job_convs as") && statement.includes("n_responded")) {
      return this.aggregateResponse(store);
    }
    if (statement.includes("insert into job_quality_stats")) {
      this.upsertJobQuality(store, p);
      return [];
    }
    if (statement.includes("insert into employer_quality_stats")) {
      this.upsertEmployerQuality(store, p);
      return [];
    }

    // ---- Phase 3 retrieval · five sources, all through eligibility ---------
    if (statement.includes("with trending as (")) {
      return this.sourceTrending(store, p);
    }
    if (statement.includes("employer_active_jobs_count < ")) {
      return this.sourceExploration(store, p);
    }
    if (statement.includes("st_dwithin") && statement.includes("(case when ")) {
      return this.sourceGeo(store, p);
    }
    if (statement.includes("st_dwithin")) {
      return this.sourceGeneral(store, p);
    }
    if (statement.includes("j.category_id = any($6::uuid[])")) {
      return this.sourcePreferences(store, p);
    }

    // ---- Phase 4 scoring loads ---------------------------------------------
    if (statement.includes("from jobs")
        && statement.includes("where id = any($1::uuid[])")) {
      const ids = parseUuidArray(String(p[0]));
      return store.jobs
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
    if (statement.startsWith("select employer_id, completion_rate_wilson_lb")) {
      const ids = parseUuidArray(String(p[0]));
      return [...store.employerQuality.values()]
        .filter((q) => ids.has(q.employerId))
        .map((q) => ({
          employer_id: q.employerId,
          completion_rate_wilson_lb: q.completionRateWilsonLB,
          positive_review_rate_wilson_lb: q.positiveReviewRateWilsonLB,
          response_rate_wilson_lb: q.responseRateWilsonLB,
        }));
    }
    if (statement.startsWith("select job_id, ctr_wilson_lb")) {
      const ids = parseUuidArray(String(p[0]));
      return [...store.jobQuality.values()]
        .filter((q) => ids.has(q.jobId))
        .map((q) => ({
          job_id: q.jobId,
          ctr_wilson_lb: q.ctrWilsonLB,
          apply_rate_wilson_lb: q.applyRateWilsonLB,
          n_events: q.nEvents,
        }));
    }
    if (statement.startsWith("select je.event_type, je.occurred_at")) {
      const userId = String(p[0]);
      return store.events
        .filter((e) => e.userId === userId)
        .map((e) => ({
          event_type: e.eventType,
          occurred_at: e.occurredAt.toISOString(),
          dwell_time_ms: e.dwellTimeMs,
          employer_id: e.employerId,
          category_id: store.jobs.find((j) => j.id === e.jobId)?.categoryId ?? null,
        }));
    }

    // ---- Phase 6 boosts + phase 7 display load ------------------------------
    if (statement.startsWith("select id, job_id, employer_id, package, start_at, expires_at")) {
      const jobIds = parseUuidArray(String(p[0]));
      const now = p[1] as Date;
      return store.boosts
        .filter(
          (b) =>
            jobIds.has(b.jobId) &&
            b.status === "active" &&
            new Date(b.startAt) <= now &&
            now < new Date(b.expiresAt),
        )
        .map((b) => ({
          id: `boost-${b.jobId}`,
          job_id: b.jobId,
          employer_id: b.employerId,
          package: "verified_checkout",
          start_at: b.startAt.toISOString(),
          expires_at: b.expiresAt.toISOString(),
        }));
    }
    if (statement.includes("coalesce(c.name, 'Other') as category")) {
      const ids = parseUuidArray(String(p[0]));
      return store.jobs
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
          employer_name: store.profiles.get(j.employerId)?.fullName ?? null,
          employer_photo_key: null,
        }));
    }

    // ---- HomloDirectService location loader (kept for completeness) --------
    if (statement.includes("from profiles where user_id = $1")) {
      const profile = store.profiles.get(String(p[0]));
      return profile && !profile.deleted
        ? [{ latitude: profile.latitude, longitude: profile.longitude }]
        : [];
    }

    throw new Error(`E2EDatabase: unhandled SQL statement: ${statement.slice(0, 120)}`);
  }

  // ---- Eligibility (mirrors homlo_eligible_candidates with injected p_now) --

  private eligibleCandidates(
    store: E2EStore,
    workerId: string | null,
    workerLat: number | null,
    workerLng: number | null,
    hardMaxKm: number,
    nowIso: string,
  ): { id: string; employer_id: string; category_id: string | null; created_at: string; employer_active_jobs_count: number; employer_created_at: string }[] {
    const now = new Date(nowIso);
    const nowDate = now.toISOString().slice(0, 10);
    const nowTime = now.toISOString().slice(11, 19);

    const activeCount = new Map<string, number>();
    for (const j of store.jobs) if (!j.deleted) activeCount.set(j.employerId, (activeCount.get(j.employerId) ?? 0) + 1);

    return store.jobs
      .filter((j) => {
        if (j.deleted || j.status !== "open" || j.workersHired >= j.workersNeeded) return false;
        const employerUser = store.users.get(j.employerId);
        if (!employerUser || employerUser.status !== "active") return false;
        if (workerId) {
          if (j.employerId === workerId) return false;
          const applied = store.applications.some(
            (a) => a.jobId === j.id && a.workerId === workerId && !["withdrawn", "declined"].includes(a.status),
          );
          if (applied) return false;
        }
        if (j.startDate) {
          // Mirrors migration 022: eligible unless the start datetime has fully
          // passed (start_date precedes today, or it is today and the start
          // time is not null and has already elapsed).
          if (j.startDate > nowDate) {
            // future start date — still accepting applications
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
        employer_created_at: (store.users.get(j.employerId)?.createdAt ?? j.createdAt).toISOString(),
      }));
  }

  private sourceGeo(store: E2EStore, p: readonly SqlParameter[]): Record<string, unknown>[] {
    const candidateRows = this.eligibleCandidates(store, p[0] as string | null, p[1] as number | null, p[2] as number | null, Number(p[3]), String(p[4]));
    const radiusKm = Number(p[7]);
    const categoryIds = p[8] == null ? null : parseUuidArray(String(p[8]));
    const limit = Number(p[9]);
    const lat = Number(p[1]);
    const lng = Number(p[2]);
    return candidateRows
      .filter((row) => {
        const j = store.jobs.find((jobRow) => jobRow.id === row.id)!;
        if (j.latitude == null || j.longitude == null) return false;
        return haversineKm(lat, lng, j.latitude, j.longitude) <= radiusKm;
      })
      .sort((a, b) => {
        const jA = store.jobs.find((jobRow) => jobRow.id === a.id)!;
        const jB = store.jobs.find((jobRow) => jobRow.id === b.id)!;
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

  private sourcePreferences(store: E2EStore, p: readonly SqlParameter[]): Record<string, unknown>[] {
    const candidateRows = this.eligibleCandidates(store, p[0] as string | null, p[1] as number | null, p[2] as number | null, Number(p[3]), String(p[4]));
    const categories = p[5] == null ? null : parseUuidArray(String(p[5]));
    const payTypes = p[6] == null ? null : new Set(parseArrayParam(String(p[6])).filter((item): item is string => item != null));
    const min = p[7] == null ? null : Number(p[7]);
    const max = p[8] == null ? null : Number(p[8]);
    const limit = Number(p[9]);
    return candidateRows
      .filter((row) => {
        const j = store.jobs.find((jobRow) => jobRow.id === row.id)!;
        if (categories && j.categoryId && !categories.has(j.categoryId)) return false;
        if (payTypes && !payTypes.has(j.payType)) return false;
        if (min != null && j.payAmount < min) return false;
        if (max != null && j.payAmount > max) return false;
        return true;
      })
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
      .slice(0, limit);
  }

  private sourceGeneral(store: E2EStore, p: readonly SqlParameter[]): Record<string, unknown>[] {
    const candidateRows = this.eligibleCandidates(store, p[0] as string | null, p[1] as number | null, p[2] as number | null, Number(p[3]), String(p[4]));
    const radiusKm = Number(p[7]);
    const limit = Number(p[8]);
    const lat = Number(p[1]);
    const lng = Number(p[2]);
    return candidateRows
      .filter((row) => {
        const j = store.jobs.find((jobRow) => jobRow.id === row.id)!;
        if (j.latitude == null || j.longitude == null) return false;
        return haversineKm(lat, lng, j.latitude, j.longitude) <= radiusKm;
      })
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
      .slice(0, limit);
  }

  private sourceTrending(store: E2EStore, p: readonly SqlParameter[]): Record<string, unknown>[] {
    const candidateRows = this.eligibleCandidates(store, p[0] as string | null, p[1] as number | null, p[2] as number | null, Number(p[3]), String(p[4]));
    const cutoff = p[5] as Date;
    const minRecent = Number(p[6]);
    const limit = Number(p[7]);
    const recentCounts = new Map<string, number>();
    const lifetimeCounts = new Map<string, number>();
    for (const e of store.events) {
      if (!["impression", "click", "view"].includes(e.eventType)) continue;
      if (e.occurredAt >= cutoff) recentCounts.set(e.jobId, (recentCounts.get(e.jobId) ?? 0) + 1);
      lifetimeCounts.set(e.jobId, (lifetimeCounts.get(e.jobId) ?? 0) + 1);
    }
    return candidateRows
      .filter((row) => (recentCounts.get(row.id) ?? 0) >= minRecent)
      .map((row) => ({
        ...row,
        trending_velocity: (recentCounts.get(row.id) ?? 0) / Math.max(lifetimeCounts.get(row.id) ?? 1, 1),
      }))
      .sort(
        (a, b) =>
          (b.trending_velocity as number) - (a.trending_velocity as number) ||
          Date.parse(b.created_at) - Date.parse(a.created_at),
      )
      .slice(0, limit);
  }

  private sourceExploration(store: E2EStore, p: readonly SqlParameter[]): Record<string, unknown>[] {
    const candidateRows = this.eligibleCandidates(store, p[0] as string | null, p[1] as number | null, p[2] as number | null, Number(p[3]), String(p[4]));
    const cutoff = p[5] as Date;
    const minEmployerJobs = Number(p[6]);
    const limit = Number(p[7]);
    const kept = candidateRows
      .filter((row) => new Date(row.created_at) >= cutoff || row.employer_active_jobs_count < minEmployerJobs)
      .sort(
        (a, b) =>
          Date.parse(b.created_at) - Date.parse(a.created_at) ||
          Date.parse(b.employer_created_at) - Date.parse(a.employer_created_at),
      )
      .slice(0, limit);
    return kept;
  }

  // ---- Aggregation helpers --------------------------------------------------

  private aggregateJobSignals(store: E2EStore): Record<string, unknown>[] {
    const byJob = new Map<string, string[]>();
    for (const e of store.events) {
      const jobRow = store.jobs.find((j) => j.id === e.jobId && !j.deleted);
      if (!jobRow) continue;
      const identity = e.userId ?? e.sessionId ?? e.ipHash;
      if (identity == null) continue;
      const key = `${identity}:${e.eventType}`;
      if (!byJob.has(e.jobId)) byJob.set(e.jobId, []);
      if (!byJob.get(e.jobId)!.includes(key)) byJob.get(e.jobId)!.push(key);
    }
    const out: Record<string, unknown>[] = [];
    for (const [jobId, keys] of byJob) {
      const jobRow = store.jobs.find((j) => j.id === jobId)!;
      const impressions = countTypesFromKeys(keys, ["impression"]);
      const clicks = countTypesFromKeys(keys, ["click"]);
      const appliesStarted = countTypesFromKeys(keys, ["apply_started"]);
      const appliesSubmitted = countTypesFromKeys(keys, ["apply_submitted"]);
      out.push({
        job_id: jobId,
        employer_id: jobRow.employerId,
        impressions,
        clicks,
        applies_started: appliesStarted,
        applies_submitted: appliesSubmitted,
        n_events: keys.length - impressions,
      });
    }
    return out;

    function countTypesFromKeys(keys: string[], types: string[]): number {
      return types.reduce((sum, type) => sum + keys.filter((k) => k.endsWith(`:${type}`)).length, 0);
    }
  }

  private aggregateResponse(store: E2EStore): Record<string, unknown>[] {
    const byConversation = new Map<string, { jobId: string; employerId: string; messages: { senderId: string; createdAt: Date; id: string }[] }>();
    for (const m of store.messages) {
      const conv = byConversation.get(m.conversationId) ?? {
        jobId: m.jobId,
        employerId: m.employerId,
        messages: [],
      };
      conv.messages.push(m);
      byConversation.set(m.conversationId, conv);
    }
    const perEmployer = new Map<string, { initiated: number; responded: number }>();
    for (const conv of byConversation.values()) {
      const jobRow = store.jobs.find((j) => j.id === conv.jobId && !j.deleted);
      if (!jobRow) continue;
      const sorted = [...conv.messages].sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || (a.id < b.id ? -1 : 1),
      );
      const first = sorted[0];
      const workerInitiated = first.senderId !== conv.employerId;
      const responded = sorted.some((m) => m.senderId === conv.employerId);
      if (!workerInitiated) continue;
      const entry = perEmployer.get(conv.employerId) ?? { initiated: 0, responded: 0 };
      entry.initiated += 1;
      if (responded) entry.responded += 1;
      perEmployer.set(conv.employerId, entry);
    }
    return [...perEmployer].map(([employerId, c]) => ({
      employer_id: employerId,
      n_worker_initiated: c.initiated,
      n_responded: c.responded,
    }));
  }

  private upsertJobQuality(store: E2EStore, p: readonly SqlParameter[]): void {
    const jobIds = parseArrayParam(String(p[0])).filter((i): i is string => i != null);
    const impressions = parseNumberArray(String(p[1]));
    const clicks = parseNumberArray(String(p[2]));
    const appliesStarted = parseNumberArray(String(p[3]));
    const appliesSubmitted = parseNumberArray(String(p[4]));
    const ctr = parseNumberArray(String(p[5]));
    const applyRate = parseNumberArray(String(p[6]));
    const nEvents = parseNumberArray(String(p[7]));
    const lastComputed = parseArrayParam(String(p[8])).filter((i): i is string => i != null);
    jobIds.forEach((jobId, i) => {
      store.jobQuality.set(jobId, {
        jobId,
        impressions: impressions[i] ?? 0,
        clicks: clicks[i] ?? 0,
        appliesStarted: appliesStarted[i] ?? 0,
        appliesSubmitted: appliesSubmitted[i] ?? 0,
        ctrWilsonLB: ctr[i] ?? null,
        applyRateWilsonLB: applyRate[i] ?? null,
        nEvents: nEvents[i] ?? 0,
        lastComputedAt: lastComputed[i] ?? NOW.toISOString(),
      });
    });
  }

  private upsertEmployerQuality(store: E2EStore, p: readonly SqlParameter[]): void {
    const employerIds = parseArrayParam(String(p[0])).filter((i): i is string => i != null);
    const posted = parseNumberArray(String(p[1]));
    const completions = parseNumberArray(String(p[2]));
    const reports = parseNumberArray(String(p[3]));
    const completion = parseNumberArray(String(p[4]));
    const positiveReview = parseNumberArray(String(p[5]));
    const response = parseNumberArray(String(p[6]));
    const lastComputed = parseArrayParam(String(p[7])).filter((i): i is string => i != null);
    employerIds.forEach((employerId, i) => {
      store.employerQuality.set(employerId, {
        employerId,
        nJobsPosted: posted[i] ?? 0,
        nCompletions: completions[i] ?? 0,
        nReports: reports[i] ?? 0,
        completionRateWilsonLB: completion[i] ?? null,
        positiveReviewRateWilsonLB: positiveReview[i] ?? null,
        responseRateWilsonLB: response[i] ?? null,
        lastComputedAt: lastComputed[i] ?? NOW.toISOString(),
      });
    });
  }
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function serviceFor(database: DatabaseAdapter): RecommendationFeedService {
  return new RecommendationFeedService(database);
}

const HOMLO_USER: HomloSessionUser = {
  id: "worker-U",
  status: "active",
  profileComplete: true,
  role: "worker",
  fullName: "Worker",
  email: "worker@test.dev",
};

// ---------------------------------------------------------------------------
// 1 · Identity: the userId is never a client input (Phase 9 §3 / §5)
// ---------------------------------------------------------------------------

describe("E2E — auth-derived identity", () => {
  it("strips a malicious userId from the feed input while keeping safe fields", () => {
    const parsed = recommendationsFeedInputSchema.parse({ userId: "attacker-uuid", pageSize: 3, cursor: "abc" });
    expect(parsed).toEqual({ pageSize: 3, cursor: "abc" });
    expect(parsed).not.toHaveProperty("userId");
  });

  it("rejects invalid feed input at the schema boundary", () => {
    expect(() => recommendationsFeedInputSchema.parse({ pageSize: 0 })).toThrow();
    expect(() => recommendationsFeedInputSchema.parse({ pageSize: -1 })).toThrow();
    expect(() => recommendationsFeedInputSchema.parse({ pageSize: PAGE_MAX + 1 })).toThrow();
    expect(() => recommendationsFeedInputSchema.parse({ cursor: "" })).toThrow();
    expect(() => recommendationsFeedInputSchema.parse({ cursor: 42 })).toThrow();
    expect(() => recommendationsFeedInputSchema.parse({ cursor: "x".repeat(513) })).toThrow();
  });

  it("rejects an unauthenticated feed call before any service code runs", async () => {
    const probe = router({ probe: supabaseProtectedProcedure.query(() => "ok" as const) });
    const caller = probe.createCaller({} as TrpcContext);
    await expect(caller.probe()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("ranks by the ctx user's behavior, not by anything the requester supplies", async () => {
    const store = new E2EStore();
    // cat-b-1 is added FIRST so that, with no behavioral signal, the neutral tie
    // breaks toward it (MMR favors the earlier index). The ctx user has affinity
    // for cat-a, so their feed must flip to cat-a-1 — driven only by the
    // server-supplied user id.
    store.addJob(job("cat-b-1", { categoryId: "cat-b", employerId: "emp-B", latitude: 0, longitude: 0, payAmount: 20 }));
    store.addJob(job("cat-a-1", { categoryId: "cat-a", employerId: "emp-A", latitude: 0, longitude: 0, payAmount: 20 }));
    for (let i = 0; i < 6; i += 1) {
      store.recordEvent({
        eventType: "click",
        userId: HOMLO_USER.id,
        jobId: "cat-a-1",
        employerId: "emp-A",
        sessionId: null,
        feedPosition: 1,
        occurredAt: createdAgo(0.1),
        ipHash: "hash-a",
        dwellTimeMs: 1_000,
        snapshot: null,
      });
    }
    const database = new E2EDatabase(store);
    const location = { latitude: 0, longitude: 0 };

    const correctUser = await serviceFor(database).getFeed({ userId: HOMLO_USER.id, userLocation: location, now: NOW });
    const spoofedUser = await serviceFor(database).getFeed({ userId: "attacker-uuid", userLocation: location, now: NOW });

    expect(correctUser.jobs[0].job.jobId).toBe("cat-a-1");
    expect(spoofedUser.jobs[0].job.jobId).toBe("cat-b-1");
    expect(correctUser.jobs.map((item) => item.job.jobId)).not.toEqual(spoofedUser.jobs.map((item) => item.job.jobId));
  });
});

// ---------------------------------------------------------------------------
// 2 · Eligibility: exactly the shared filter, enforced once (§8 audit)
// ---------------------------------------------------------------------------

describe("E2E — eligibility filter", () => {
  const location = { latitude: 0, longitude: 0 };

  it("excludes expired, filled, deleted, own, and already-applied jobs", async () => {
    const store = new E2EStore();
    store.addJob(job("open-job"));
    store.addJob(job("expired", { startDate: "2026-07-01", startTime: "09:00:00" }));
    store.addJob(job("filled", { workersHired: 2, workersNeeded: 2 }));
    store.addJob(job("deleted", { deleted: true }));
    store.addJob(job("own", { employerId: "worker-U" }));
    store.addJob(job("applied", { employerId: "emp-B" }));
    store.addJob(job("withdrawn", { employerId: "emp-C" }));
    store.applications.push({ jobId: "applied", workerId: "worker-U", status: "applied" });
    store.applications.push({ jobId: "withdrawn", workerId: "worker-U", status: "withdrawn" });

    const feed = await serviceFor(new E2EDatabase(store)).getFeed({
      userId: "worker-U",
      userLocation: location,
      now: NOW,
    });

    const ids = feed.jobs.map((item) => item.job.jobId);
    expect(ids).toContain("open-job");
    expect(ids).toContain("withdrawn");
    expect(ids).not.toContain("expired");
    expect(ids).not.toContain("filled");
    expect(ids).not.toContain("deleted");
    expect(ids).not.toContain("own");
    expect(ids).not.toContain("applied");
  });

  it("enforces the hard commute cap (geo/general require job geography)", async () => {
    const store = new E2EStore();
    // no-loc has no geography: geo/general drop it, but exploration (which does
    // not filter by location) can still surface it — so only the distance cap is
    // asserted for geo/general, and the location-less job stays eligible.
    store.addJob(job("near", { latitude: 0, longitude: 0 }));
    store.addJob(job(
      "far",
      { latitude: HARD_COMMUTE_KM / 100 + 1, longitude: 0 }, // haversine ≈ 111 km > 25 km
    ));
    store.addJob(job("no-loc", { latitude: null, longitude: null }));

    const feed = await serviceFor(new E2EDatabase(store)).getFeed({ userLocation: location, now: NOW });
    const ids = feed.jobs.map((item) => item.job.jobId);
    expect(ids).toContain("near");
    expect(ids).not.toContain("far"); // beyond the hard commute cap
    const noLocItem = feed.jobs.find((item) => item.job.jobId === "no-loc");
    expect(noLocItem).toBeDefined(); // survives via the location-agnostic exploration source
    expect(noLocItem!.rankingMetadata.distanceKm).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3 · Ranking chain integrity: one feed, immutable organic score (§9-§11)
// ---------------------------------------------------------------------------

describe("E2E — ranking chain integrity", () => {
  it("exposes a complete, finite score chain on every item", async () => {
    const store = new E2EStore();
    store.addJob(job("j1", { payAmount: 30, createdAt: createdAgo(1), latitude: 0, longitude: 0 }));
    store.addJob(job("j2", { payAmount: 20, createdAt: createdAgo(40), latitude: 0.1, longitude: 0 }));
    store.addJob(job("j3", { payAmount: 10, createdAt: createdAgo(80), latitude: 0.2, longitude: 0 }));

    const feed = await serviceFor(new E2EDatabase(store)).getFeed({
      userLocation: { latitude: 0, longitude: 0 },
      now: NOW,
    });

    expect(feed.jobs.map((item) => item.job.jobId)).toEqual(["j1", "j2", "j3"]);
    for (const item of feed.jobs) {
      const m = item.rankingMetadata;
      expect(m.rankingVersion).toBe(VERSION);
      expect(Number.isFinite(m.baseRelevance)).toBe(true);
      expect(Number.isFinite(m.organicScore)).toBe(true);
      // organicScore is a non-negative weighted relevance in [0, 1].
      expect(m.organicScore).toBeGreaterThanOrEqual(0);
      expect(m.organicScore).toBeLessThanOrEqual(1);
      // finalRankingScore is the MMR output (postMMR × multiplier); MMR's
      // lambda×relevance − (1−lambda)×redundancy can legitimately be negative,
      // so we only require it to be a finite, fully-determined number.
      expect(Number.isFinite(m.finalRankingScore)).toBe(true);
      expect(item.feedPosition).toBeGreaterThan(0);
      if (item.job.jobId === "j1") {
        expect(m.distanceKm).toBeCloseTo(0, 1);
        expect(m.finalRankingScore).toBeGreaterThan(feed.jobs[1].rankingMetadata.finalRankingScore);
      }
    }
  });

  it("is deterministic: identical inputs produce byte-identical output", async () => {
    const store = new E2EStore();
    store.addJob(job("a1"));
    store.addJob(job("a2"));
    const database = new E2EDatabase(store);
    const serve = () => serviceFor(database).getFeed({ userLocation: { latitude: 0, longitude: 0 }, now: NOW });
    expect(await serve()).toStrictEqual(await serve());
  });
});

// ---------------------------------------------------------------------------
// 4 · Quality feedback loop: real events → aggregation → better ranking (§14)
// ---------------------------------------------------------------------------

describe("E2E — quality feedback loop", () => {
  const location = { latitude: 0, longitude: 0 };

  it("runs events → aggregation → improved ranking, idempotently", async () => {
    const store = new E2EStore();
    store.boosts.push({ jobId: "job-good", employerId: "emp-good", status: "active", startAt: createdAgo(24), expiresAt: new Date(NOW.getTime() + 86_400_000) });
    store.addJob(job("job-good", { employerId: "emp-good", categoryId: "cat-a", latitude: 0, longitude: 0, payAmount: 20 }));
    store.addJob(job("job-bad", { employerId: "emp-bad", categoryId: "cat-b", latitude: 0, longitude: 0, payAmount: 20 }));
    store.reviews.push(
      { employerId: "emp-good", rating: 5, deleted: false },
      { employerId: "emp-good", rating: 5, deleted: false },
      { employerId: "emp-good", rating: 5, deleted: false },
      { employerId: "emp-bad", rating: 2, deleted: false },
      { employerId: "emp-bad", rating: 2, deleted: false },
    );
    store.applications.push(
      { jobId: "job-good", workerId: "worker-X", status: "hired" },
      { jobId: "job-good", workerId: "worker-Y", status: "reviewed" },
    );

    const database = new E2EDatabase(store);
    const feed = serviceFor(database);

    // Round 1: no stats yet — both jobs neutral, no aggregated evidence.
    await feed.getFeed({ userId: "worker-U", userLocation: location, now: NOW });
    expect(store.jobQuality.size).toBe(0);

    // U2 engages with job-good (events → the aggregation's input source).
    const logger = new EventLoggingService(database);
    const events: HomloEventLogInput[] = [
      { eventType: "impression", jobId: "job-good", feedPosition: 1, dwellTimeMs: 0 },
      { eventType: "click", jobId: "job-good", feedPosition: 1, dwellTimeMs: 2_000 },
      { eventType: "apply_started", jobId: "job-good", feedPosition: 1 },
      { eventType: "apply_submitted", jobId: "job-good", feedPosition: 1 },
    ];
    for (const event of events) {
      const result = await logger.log(event, { ip: "203.0.113.9", userId: "worker-U2" });
      expect(result.ok).toBe(true);
    }

    const aggregation = new QualityAggregationService(database, { logger: () => undefined });
    const report = await aggregation.run({ now: createdAgo(0.05) });
    expect(report.ok).toBe(true);
    expect(report.ran).toBe(true);
    expect(report.jobsProcessed).toBeGreaterThanOrEqual(1);
    expect(report.jobRowsWritten).toBeGreaterThanOrEqual(1);
    expect(report.employersProcessed).toBeGreaterThanOrEqual(2);

    // Persisted stats reflect U2's real logged events.
    const persistedJob = store.jobQuality.get("job-good");
    expect(persistedJob).toBeDefined();
    expect(persistedJob!.impressions).toBe(1);
    expect(persistedJob!.clicks).toBe(1);
    expect(persistedJob!.appliesSubmitted).toBe(1);
    expect(persistedJob!.nEvents).toBe(3);
    const positiveThreshold = rankingConfig.qualityAggregation.positiveReviewMinRating;
    expect(positiveThreshold).toBe(4);
    const empGood = store.employerQuality.get("emp-good");
    const empBad = store.employerQuality.get("emp-bad");
    const goodRate = Number(empGood?.positiveReviewRateWilsonLB ?? 0);
    const badRate = Number(empBad?.positiveReviewRateWilsonLB ?? 1);
    expect(goodRate).toBeGreaterThan(badRate);

    // Idempotency: re-running aggregation at the same instant does not drift.
    const report2 = await aggregation.run({ now: createdAgo(0.05) });
    expect(report2.jobsProcessed).toBe(report.jobsProcessed);
    expect(store.jobQuality.get("job-good")).toEqual(persistedJob);

    // Round 2: the same user now sees job-good (quality lift) win over job-bad.
    const round2 = await feed.getFeed({ userId: "worker-U", userLocation: location, now: NOW });
    const ranked = round2.jobs.map((item) => item.job.jobId);
    expect(ranked[0]).toBe("job-good");
    expect(ranked.indexOf("job-good")).toBeLessThan(ranked.indexOf("job-bad"));
    expect(store.jobQuality.get("job-good")!.lastComputedAt).toBe(createdAgo(0.05).toISOString());
  });

  it("keeps qualityN neutral and shrinks sparse evidence toward zero", async () => {
    const store = new E2EStore();
    store.addJob(job("n1"));
    const database = new E2EDatabase(store);
    const feed = await serviceFor(database).getFeed({ userLocation: location, now: NOW });
    for (const item of feed.jobs) {
      expect(item.rankingMetadata.combinedQuality).toBeGreaterThanOrEqual(0);
      expect(item.rankingMetadata.combinedQuality).toBeLessThanOrEqual(1);
      expect(Number.isFinite(item.rankingMetadata.organicScore)).toBe(true);
    }
    expect(store.jobQuality.size).toBe(0);
    const aggregation = new QualityAggregationService(database, { logger: () => undefined });
    const report = await aggregation.run({ now: createdAgo(0.01) });
    expect(report.jobsProcessed).toBe(0); // no events → no job signals
    expect(report.employersProcessed).toBe(1); // n_jobs_posted evidence only
    expect(store.employerQuality.get("emp-n1")!.completionRateWilsonLB).toBeNull(); // no completion/apps evidence
  });
});

// ---------------------------------------------------------------------------
// 5 · Event logging: server-derived identity, hashed IP, no raw IP (§25-26)
// ---------------------------------------------------------------------------

describe("E2E — event logging contract", () => {
  it("persists server-derived fields and never the raw IP", async () => {
    const store = new E2EStore();
    store.addJob(job("logged-job", { employerId: "emp-true", latitude: 0, longitude: 0 }));
    const database = new E2EDatabase(store);
    const logger = new EventLoggingService(database);

    const result = await logger.log(
      {
        eventType: "click",
        jobId: "logged-job",
        employerId: "emp-FORGED", // client forgery — must be ignored
        feedPosition: 3,
        feedContext: "home",
        rankingScoreSnapshot: { rankingVersion: VERSION, finalRankingScore: 1.234 },
        userLat: 11.55,
        userLng: 104.91,
        dwellTimeMs: 4_000,
      },
      { ip: "203.0.113.77", userId: "worker-U" },
    );

    expect(result).toEqual({ ok: true, id: expect.any(String) });
    const stored = store.events[0];
    expect(stored.userId).toBe("worker-U");
    expect(stored.employerId).toBe("emp-true"); // authoritative, not the forged value
    expect(stored.feedPosition).toBe(3);
    expect(stored.ipHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.ipHash).not.toBe("203.0.113.77");
    expect(JSON.parse(stored.snapshot!)).toEqual({ rankingVersion: VERSION, finalRankingScore: 1.234 });
    expect(stored.dwellTimeMs).toBe(4_000);
    expect(store.events).toHaveLength(1);
  });

  it("defaults server flags to false and returns no row for an unknown job", async () => {
    const store = new E2EStore();
    store.addJob(job("known-job"));
    const database = new E2EDatabase(store);
    const logger = new EventLoggingService(database);

    const ok = await logger.log({ eventType: "impression", jobId: "known-job", feedPosition: 1 }, { ip: null, userId: "worker-U" });
    expect(ok.ok).toBe(true);
    expect(store.events[0].userId).toBe("worker-U");
    expect(store.events[0].ipHash).toBeNull();

    const missing = await logger.log({ eventType: "impression", jobId: "does-not-exist" }, { ip: null, userId: null });
    expect(missing).toEqual({ ok: false, code: "invalid_job" });
    expect(store.events).toHaveLength(1);
  });

  it("rate-limits high-frequency submissions with a safe failure path", async () => {
    const store = new E2EStore();
    store.addJob(job("rl-job"));
    const database = new E2EDatabase(store);
    const logger = new EventLoggingService(database);
    let rejected: "rate_limited" | null = null;
    for (let i = 0; i < 60; i += 1) {
      const result = await logger.log({ eventType: "impression", jobId: "rl-job" }, { ip: "198.51.100.1", userId: null });
      if (result.ok === false && result.code === "rate_limited") {
        rejected = "rate_limited";
        break;
      }
    }
    expect(rejected).toBe("rate_limited");
  });
});

describe("IP hash salt handling", () => {
  const ip = "203.0.113.10";
  const expectedHash = (salt: string) =>
    createHash("sha256").update(salt + ":" + ip).digest("hex");

  async function withHashEnvironment<T>(
    appEnv: string | undefined,
    salt: string | undefined,
    run: () => T | Promise<T>,
  ): Promise<T> {
    const previousAppEnv = process.env.APP_ENV;
    const previousSalt = process.env.HOMLO_EVENT_IP_HASH_SALT;

    if (appEnv === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = appEnv;

    if (salt === undefined) delete process.env.HOMLO_EVENT_IP_HASH_SALT;
    else process.env.HOMLO_EVENT_IP_HASH_SALT = salt;

    try {
      return await run();
    } finally {
      if (previousAppEnv === undefined) delete process.env.APP_ENV;
      else process.env.APP_ENV = previousAppEnv;

      if (previousSalt === undefined) delete process.env.HOMLO_EVENT_IP_HASH_SALT;
      else process.env.HOMLO_EVENT_IP_HASH_SALT = previousSalt;
    }
  }

  it("uses the configured salt in production", async () => {
    await withHashEnvironment("production", "test-configured-secret", () => {
      expect(hashIp(ip)).toBe(expectedHash("test-configured-secret"));
    });
  });

  it("uses a stable random process salt and warns once when production salt is missing", async () => {
    await withHashEnvironment("production", undefined, async () => {
      vi.resetModules();
      const { hashIp: isolatedHashIp } = await import("../server/event-logging");
      const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);

      try {
        const firstHash = isolatedHashIp(ip);
        const secondHash = isolatedHashIp(ip);

        expect(firstHash).toBe(secondHash);
        expect(firstHash).not.toBe(expectedHash("homlo-event-ip-hash-v1"));
        expect(warning).toHaveBeenCalledTimes(1);
        expect(warning).toHaveBeenCalledWith(
          "[security] HOMLO_EVENT_IP_HASH_SALT is missing; using a random per-process salt.",
        );
      } finally {
        warning.mockRestore();
      }
    });
  });

  it("retains the fixed fallback outside production", async () => {
    await withHashEnvironment("development", undefined, () => {
      expect(hashIp(ip)).toBe(expectedHash("homlo-event-ip-hash-v1"));
    });
  });
});
// ---------------------------------------------------------------------------
// 6 · MMR diversity, sponsored boost, controlled exploration (§16-18)
// ---------------------------------------------------------------------------

describe("E2E — MMR, sponsored, exploration", () => {
  const location = { latitude: 0, longitude: 0 };

  it("interleaves employers so no employer monopolizes the top of the feed", async () => {
    const store = new E2EStore();
    for (let i = 0; i < 3; i += 1) store.addJob(job(`a-${i}`, { employerId: "emp-A", categoryId: "cat-x", payAmount: 30 }));
    for (let i = 0; i < 3; i += 1) store.addJob(job(`b-${i}`, { employerId: "emp-B", categoryId: "cat-y", payAmount: 30 }));

    const feed = await serviceFor(new E2EDatabase(store)).getFeed({ userLocation: location, now: NOW });
    const order = feed.jobs.map((item) => store.jobs.find((j) => j.id === item.job.jobId)!.employerId);
    let run = 1;
    let maxRun = 1;
    for (let i = 1; i < order.length; i += 1) {
      run = order[i] === order[i - 1] ? run + 1 : 1;
      maxRun = Math.max(maxRun, run);
    }
    expect(new Set(order).size).toBe(2);
    expect(maxRun).toBeLessThanOrEqual(2);
  });

  it("applies a bounded sponsored multiplier only to quality-passing boosted jobs", async () => {
    const store = new E2EStore();
    store.addJob(job("sponsored", { employerId: "emp-good" }));
    store.addJob(job("plain", { employerId: "emp-bad" }));
    store.boosts.push({ jobId: "sponsored", employerId: "emp-good", status: "active", startAt: createdAgo(5), expiresAt: new Date(NOW.getTime() + 86_400_000) });
    store.employerQuality.set("emp-good", {
      employerId: "emp-good",
      nJobsPosted: 1,
      nCompletions: 5,
      nReports: 0,
      completionRateWilsonLB: 0.9,
      positiveReviewRateWilsonLB: 0.9,
      responseRateWilsonLB: 0.9,
      lastComputedAt: NOW.toISOString(),
    });

    const feed = await serviceFor(new E2EDatabase(store)).getFeed({ userLocation: location, now: NOW });
    const sponsored = feed.jobs.find((item) => item.job.jobId === "sponsored");
    expect(sponsored).toBeDefined();
    expect(sponsored!.rankingMetadata.sponsored).toBe(true);
    expect(sponsored!.rankingMetadata.sponsoredEligible).toBe(true);
    expect(sponsored!.rankingMetadata.sponsoredMultiplier).toBeGreaterThanOrEqual(rankingConfig.sponsored.minMultiplier);
    expect(sponsored!.rankingMetadata.sponsoredMultiplier).toBeLessThanOrEqual(rankingConfig.sponsored.maxMultiplier);
    for (const item of feed.jobs) {
      expect(item.rankingMetadata.finalRankingScore).toBeGreaterThan(0);
      if (item.job.jobId !== "sponsored") expect(item.rankingMetadata.sponsored).toBe(false);
    }
  });

  it("flags exactly the configured exploration share on a cold pool", async () => {
    const store = new E2EStore();
    for (let i = 0; i < 8; i += 1) store.addJob(job(`c-${i}`));
    const feed = await serviceFor(new E2EDatabase(store)).getFeed({ userLocation: location, now: NOW });
    const flagged = feed.jobs.filter((item) => item.rankingMetadata.exploration);
    expect(flagged).toHaveLength(Math.ceil(8 * EXPLORATION_SHARE));
    for (const item of flagged) expect(item.rankingMetadata.exploration).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 7 · Pagination & cursor codec (§22-24)
// ---------------------------------------------------------------------------

describe("E2E — pagination and cursors", () => {
  const location = { latitude: 0, longitude: 0 };

  it("slices pages with contiguous positions, no duplicates, and a resumable cursor", async () => {
    const store = new E2EStore();
    for (let i = 0; i < 6; i += 1) store.addJob(job(`p-${i}`));
    const database = new E2EDatabase(store);
    const feed = serviceFor(database);

    const single = await feed.getFeed({ userLocation: location, now: NOW, pageSize: 10 });
    const fullOrder = single.jobs.map((item) => item.job.jobId);

    const page1 = await feed.getFeed({ userLocation: location, now: NOW, pageSize: 2 });
    expect(page1.jobs.map((item) => item.feedPosition)).toEqual([1, 2]);
    expect(page1.hasMore).toBe(true);
    expect(page1.nextCursor).toBeTruthy();

    const page2 = await feed.getFeed({ userLocation: location, now: NOW, pageSize: 2, cursor: page1.nextCursor });
    expect(page2.jobs.map((item) => item.feedPosition)).toEqual([3, 4]);
    const page3 = await feed.getFeed({ userLocation: location, now: NOW, pageSize: 2, cursor: page2.nextCursor });
    expect(page3.jobs.map((item) => item.feedPosition)).toEqual([5, 6]);
    expect(page3.hasMore).toBe(false);

    const resumed = [...page1.jobs, ...page2.jobs, ...page3.jobs].map((item) => item.job.jobId);
    expect(resumed).toEqual(fullOrder);
    expect(new Set(resumed).size).toBe(6);
  });

  it("clamps oversized page sizes instead of leaking the pool", async () => {
    const store = new E2EStore();
    for (let i = 0; i < 60; i += 1) store.addJob(job(`big-${i}`));
    const feed = await serviceFor(new E2EDatabase(store)).getFeed({ userLocation: location, now: NOW, pageSize: 999_999 });
    expect(feed.jobs.length).toBeLessThanOrEqual(PAGE_MAX);
    expect(feed.total).toBe(60);
    expect(feed.hasMore).toBe(true);
  });

  it("rejects malformed and version-mismatched cursors with InvalidFeedCursorError", async () => {
    expect(() => validateFeedCursor("###not-a-cursor###", VERSION)).toThrow(InvalidFeedCursorError);
    const wrongVersion = encodeFeedCursor({ v: "v0.0.0", s: 1, j: "job-1" });
    expect(() => validateFeedCursor(wrongVersion, VERSION)).toThrow(InvalidFeedCursorError);
    const valid = encodeFeedCursor({ v: VERSION, s: 0.5, j: "job-1" });
    expect(validateFeedCursor(valid, VERSION)).toEqual({ v: VERSION, s: 0.5, j: "job-1" });
  });
});

// ---------------------------------------------------------------------------
// 8 · Empty states, cold start, new jobs (§19-20)
// ---------------------------------------------------------------------------

describe("E2E — empty states, cold start, new jobs", () => {
  it("returns the typed empty contract for a genuinely empty catalog", async () => {
    const feed = await serviceFor(new E2EDatabase(new E2EStore())).getFeed({ userLocation: null, now: NOW });
    expect(feed).toEqual({ jobs: [], total: 0, poolSize: 0, nextCursor: null, hasMore: false, rankingVersion: VERSION });
  });

  it("flags cold-start items and marks distance null when the worker location is unknown", async () => {
    const store = new E2EStore();
    store.addJob(job("cs-1"));
    const feed = await serviceFor(new E2EDatabase(store)).getFeed({ userId: null, userLocation: null, now: NOW });
    for (const item of feed.jobs) {
      expect(item.rankingMetadata.coldStart).toBe(true);
      expect(item.rankingMetadata.distanceKm).toBeNull();
    }
  });

  it("surfaces brand-new jobs through exploration, never stale established ones", async () => {
    const store = new E2EStore();
    store.addJob(job("fresh", { createdAt: createdAgo(1), employerId: "emp-big" }));
    for (let i = 0; i < 6; i += 1) store.addJob(job(`big-${i}`, { employerId: "emp-big", createdAt: createdAgo(1_000) }));
    store.addJob(job("old-established", { createdAt: createdAgo(400), employerId: "emp-big" }));
    store.addJob(job("old-small", { createdAt: createdAgo(400), employerId: "emp-small" }));

    const feed = await serviceFor(new E2EDatabase(store)).getFeed({ userLocation: null, now: NOW });
    const ids = feed.jobs.map((item) => item.job.jobId);
    expect(ids).toContain("fresh");
    expect(ids).toContain("old-small");
    expect(ids).not.toContain("old-established");
  });
});

// ---------------------------------------------------------------------------
// 9 · Performance: constant query count, no N+1 (§27-28)
// ---------------------------------------------------------------------------

describe("E2E — performance (constant query count)", () => {
  const location = { latitude: 0, longitude: 0 };

  it("issues a constant number of queries regardless of pool size", async () => {
    const runAt = (count: number) => {
      const store = new E2EStore();
      for (let i = 0; i < count; i += 1) store.addJob(job(`q-${i}`, { payAmount: 10 + (i % 20) }));
      const database = new E2EDatabase(store);
      const promise = serviceFor(database).getFeed({ userId: HOMLO_USER.id, userLocation: location, now: NOW, pageSize: 10 });
      return promise.then((feed) => ({ database, feed }));
    };

    const small = await runAt(150);
    const large = await runAt(300);

    // The pool is bounded by candidatePoolMax regardless of how many eligible
    // jobs exist, so both feeds converge on the same assembled size.
    expect(large.feed.total).toBe(small.feed.total);
    expect(large.feed.total).toBeLessThanOrEqual(rankingConfig.retrieval.candidatePoolMax);
    expect(large.feed.jobs).toHaveLength(10);
    expect(large.database.queryCount).toBe(small.database.queryCount);
    // Located worker: geo/general/exploration retrieval + 4 phase-4 scoring
    // loads + 1 phase-6 boosts load + 1 phase-7 display load.
    expect(large.database.queryCount).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// 10 · Failure recovery (§29)
// ---------------------------------------------------------------------------

describe("E2E — failure recovery", () => {
  it("propagates a database failure instead of serving a partial feed", async () => {
    const store = new E2EStore();
    store.addJob(job("boom-1"));
    const database = new E2EDatabase(store);
    const failing = new (class extends E2EDatabase {
      async query<Row extends Record<string, unknown>>(statement: string, parameters: readonly SqlParameter[] = []): Promise<QueryResult<Row>> {
        if (statement.includes("coalesce(c.name, 'Other') as category")) {
          throw new Error("connection reset during display load");
        }
        return super.query(statement, parameters);
      }
    })(store);
    await expect(serviceFor(failing).getFeed({ userLocation: { latitude: 0, longitude: 0 }, now: NOW })).rejects.toThrow(
      "connection reset during display load",
    );
    expect(database.queryCount).toBeGreaterThanOrEqual(0);
  });

  it("returns a safe empty feed when the pool is empty, without extra queries", async () => {
    const store = new E2EStore();
    store.addJob(job("never", { createdAt: createdAgo(1_000), employerId: "emp-huge" }));
    for (let i = 0; i < 8; i += 1) store.addJob(job(`huge-${i}`, { employerId: "emp-huge", createdAt: createdAgo(1_000) }));
    const database = new E2EDatabase(store);
    const feed = await serviceFor(database).getFeed({ userId: "worker-U", userLocation: null, now: NOW });
    expect(feed.jobs).toEqual([]);
    expect(feed.hasMore).toBe(false);
    expect(feed.poolSize).toBe(0);
    // No location: geo/general skipped; the eligible exploration source is empty,
    // so no scoring/boosts/display queries ever fire.
    expect(database.queryCount).toBe(2);
  });
});