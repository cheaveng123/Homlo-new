// =========================================================
// Sponsored boost + controlled exploration (phase 6).
//
// Consumes the PHASE 5 MMR-re-ranked ScoredCandidate[] and applies the paid
// sponsorship and controlled-exploration layers without ever mutating the
// input:
//
//   Sponsored: A candidate is sponsored when a `boosts` row (see
//   database/migrations/007_boosts_payments.sql) is ACTIVE for its job id at
//   the ranking instant — status = 'active' and start_at <= now < expires_at —
//   AND its CombinedQuality is at or above quality.sponsoredQualityFloor.
//   Sponsorship can NOT resurrect an ineligible job: boosts are fetched only
//   for the job ids already IN the candidate pool, so an active sponsor only
//   re-ranks a job that already passed eligibility.
//
//   Bounded quality-scaled multiplier (config, never a hardcoded lift):
//     passesFloor = CombinedQuality >= sponsoredQualityFloor
//     multiplier  = minMultiplier + (maxMultiplier - minMultiplier)
//                   × clamp01((CombinedQuality - sponsoredQualityFloor)
//                             / (1 - sponsoredQualityFloor))
//     otherwise  = 1 (no boost)
//   So eligible candidates score minMultiplier at the floor and exactly
//   maxMultiplier at CombinedQuality = 1, with per-configuration bounds.
//
//   finalRankingScore (a.k.a. finalPreAssemblyScore) =
//       postMMRScore × multiplier
//   where postMMRScore = rankingSnapshot.mmr.score, or organicScore when MMR
//   is absent (phase 4 only / MMR-skipped). The snapshot records sponsored,
//   sponsoredEligible, sponsoredMultiplier and finalPreAssemblyScore; the
//   candidate carries sponsored / sponsoredMultiplier / exploration /
//   finalRankingScore. organicScore is NEVER overwritten.
//
//   Exploration: candidates whose phase 3 metadata.sources include the
//   "exploration" source, provided their post-MMR score is at or above
//   exploration.relevanceFloor (config). Soft target: ceil(poolSize ×
//   exploration.targetShare). Selection is deterministic and conservative:
//   non-sponsored candidates first (when available, so paid slots are not
//   double-counted as exploration), then highest post-MMR score, then organic
//   score, then original index, then job id. Never more probes than exist and
//   none are fabricated — an empty exploration source yields zero flagged
//   candidates.
//
// Ordering: the module returns the FINAL deterministic ordered list for phase 7
// assembly — finalRankingScore desc, then post-MMR score desc, then MMR
// relevance (organic when absent) desc, then organic desc, then original index
// asc, then job id asc. Because the pre-boost score is the phase 5 MMR
// selection score (non-increasing across the selection), the phase 5 order is
// preserved exactly for non-sponsored candidates and sponsorship only lifts
// eligible jobs within its bounded range.
//
// Efficiency: exactly ONE batched `boosts` query for the whole pool (no N+1).
// All scoring math is a pure exported function for unit testing.
// =========================================================

import type { DatabaseAdapter } from "../infrastructure/database/DatabaseAdapter";
import { rankingConfig } from "../config/rankingConfig";
import { clamp01 } from "./wilson";
import type { RankingSnapshot, ScoredCandidate } from "./scoring-service";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A sponsorship window whose SQL-side active filter has already run, or a raw
 * boost row handed to the pure function. `startAt`/`expiresAt` may be Date or
 * epoch-ms numbers; non-finite timestamps are treated as missing and ignored.
 */
export type ActiveBoostInput = {
  jobId: string;
  employerId: string;
  package?: string | null;
  startAt: number | Date;
  expiresAt: number | Date;
};

/** Post-MMR source row used by the ranking layer (subset of `boosts`). */
export type BoostRow = {
  id: string;
  job_id: string;
  employer_id: string;
  package: string | null;
  start_at: string | Date;
  expires_at: string | Date;
};

/** Copied candidate after the sponsored + exploration layers. Immutable derivation. */
export type Phase6Candidate = ScoredCandidate & {
  sponsored: boolean;
  sponsoredMultiplier: number;
  exploration: boolean;
  finalRankingScore: number;
};

export type Phase6ServiceOptions = {
  now?: Date;
};

type Entry = {
  candidate: ScoredCandidate;
  index: number;
  postMMR: number;
  multiplier: number;
  sponsored: boolean;
  eligible: boolean;
  finalRankingScore: number;
};

// ---------------------------------------------------------------------------
// Config validation (fail fast on an invalid central configuration)
// ---------------------------------------------------------------------------

export function validatePhase6Config(): void {
  const floor = rankingConfig.quality.sponsoredQualityFloor;
  if (!Number.isFinite(floor) || floor < 0 || floor > 1) {
    throw new Error("rankingConfig: quality.sponsoredQualityFloor must be a finite number in [0, 1]");
  }
  const min = rankingConfig.sponsored.minMultiplier;
  const max = rankingConfig.sponsored.maxMultiplier;
  if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < min) {
    throw new Error("rankingConfig: sponsored.minMultiplier/maxMultiplier must be finite, non-negative and min <= max");
  }
  const targetShare = rankingConfig.exploration.targetShare;
  const relevanceFloor = rankingConfig.exploration.relevanceFloor;
  if (!Number.isFinite(targetShare) || targetShare < 0 || targetShare > 1) {
    throw new Error("rankingConfig: exploration.targetShare must be a finite number in [0, 1]");
  }
  if (!Number.isFinite(relevanceFloor)) {
    throw new Error("rankingConfig: exploration.relevanceFloor must be a finite number");
  }
}

validatePhase6Config();

// ---------------------------------------------------------------------------
// Pure deterministic math (exported for unit testing)
// ---------------------------------------------------------------------------

/**
 * Bounded, quality-scaled sponsored multiplier.
 * - non-finite / below-floor quality ⇒ 1 (no boost)
 * - CombinedQuality = sponsoredQualityFloor ⇒ minMultiplier
 * - CombinedQuality = 1 ⇒ maxMultiplier
 */
export function sponsoredMultiplierFor(combinedQuality: number | null | undefined): number {
  const floor = rankingConfig.quality.sponsoredQualityFloor;
  const min = rankingConfig.sponsored.minMultiplier;
  const max = rankingConfig.sponsored.maxMultiplier;
  if (!(min <= max) || combinedQuality == null || !Number.isFinite(combinedQuality) || combinedQuality < floor) {
    return 1;
  }
  if (floor >= 1) return combinedQuality >= floor ? max : min;
  const span = max - min;
  const normalized = clamp01((combinedQuality - floor) / (1 - floor));
  return min + span * normalized;
}

/** Score the phase 6 layers rank against: MMR score, or organic when MMR is absent. Always finite. */
export function postMMRScore(candidate: ScoredCandidate): number {
  const mmrScore = candidate.rankingSnapshot?.mmr?.score;
  if (mmrScore != null && Number.isFinite(mmrScore)) return mmrScore;
  const organic = candidate.organicScore;
  if (Number.isFinite(organic)) return organic;
  return 0;
}

/** Tie-break relevance: MMR relevance, or organic when MMR is absent. */
export function relevanceKey(candidate: ScoredCandidate): number {
  const relevance = candidate.rankingSnapshot?.mmr?.relevance;
  if (relevance != null && Number.isFinite(relevance)) return relevance;
  const organic = candidate.organicScore;
  return Number.isFinite(organic) ? organic : 0;
}

/**
 * Pure sponsored + exploration pass over a phase 5 pool. Returns a NEW array of
 * NEW candidate copies (snapshots included); the input array and its objects
 * are never mutated. Duplicate job ids are collapsed to their first occurrence.
 */
export function applySponsoredAndExploration(
  candidates: readonly ScoredCandidate[],
  boosts: readonly ActiveBoostInput[],
  options?: { now?: Date },
): Phase6Candidate[] {
  validatePhase6Config();

  const nowMs =
    options?.now instanceof Date && !Number.isNaN(options.now.getTime()) ? options.now.getTime() : null;
  const activeByJob = resolveActiveBoosts(boosts, nowMs);

  const unique: ScoredCandidate[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (candidate == null || typeof candidate.jobId !== "string" || seen.has(candidate.jobId)) continue;
    seen.add(candidate.jobId);
    unique.push(candidate);
  }
  if (unique.length === 0) return [];

  const floor = rankingConfig.quality.sponsoredQualityFloor;
  const entries: Entry[] = unique.map((candidate, index) => {
    const eligible = activeByJob.has(candidate.jobId);
    const quality = candidate.quality?.combinedQuality;
    const passesFloor = quality != null && Number.isFinite(quality) && quality >= floor;
    const multiplier = eligible && passesFloor ? sponsoredMultiplierFor(quality) : 1;
    const postMMR = postMMRScore(candidate);
    return {
      candidate,
      index,
      postMMR,
      multiplier,
      sponsored: eligible && passesFloor,
      eligible,
      finalRankingScore: postMMR * multiplier,
    };
  });

  const explorationJobIds = selectExploration(entries);

  const ordered = [...entries].sort((a, b) => compareFinal(a, b));
  return ordered.map((entry) => withPhase6(entry, explorationJobIds.has(entry.candidate.jobId)));
}

function selectExploration(entries: readonly Entry[]): Set<string> {
  const target = Math.ceil(entries.length * rankingConfig.exploration.targetShare);
  if (target <= 0) return new Set();
  const floor = rankingConfig.exploration.relevanceFloor;
  const pool = entries.filter(
    (entry) => isExplorationCandidate(entry.candidate) && entry.postMMR >= floor,
  );
  pool.sort((a, b) => compareExploration(a, b));
  const chosen = new Set<string>();
  for (const entry of pool) {
    chosen.add(entry.candidate.jobId);
    if (chosen.size >= target) break;
  }
  return chosen;
}

function isExplorationCandidate(candidate: ScoredCandidate): boolean {
  const sources = candidate.metadata?.sources;
  if (!Array.isArray(sources)) return false;
  return sources.some((source) => source === "exploration");
}

// ---------------------------------------------------------------------------
// Boost resolution
// ---------------------------------------------------------------------------

function resolveActiveBoosts(boosts: readonly ActiveBoostInput[], nowMs: number | null): Map<string, ActiveBoostInput> {
  const active = new Map<string, ActiveBoostInput>();
  for (const boost of boosts) {
    if (boost == null || typeof boost.jobId !== "string" || typeof boost.employerId !== "string") continue;
    const startAtMs = toEpochMs(boost.startAt);
    const expiresAtMs = toEpochMs(boost.expiresAt);
    if (startAtMs == null || expiresAtMs == null) continue;
    if (nowMs != null && !(startAtMs <= nowMs && nowMs < expiresAtMs)) continue;
    const existing = active.get(boost.jobId);
    if (existing == null || isBetterBoost(boost, startAtMs, expiresAtMs, existing)) {
      active.set(boost.jobId, boost);
    }
  }
  return active;
}

/** Deterministic duplicate resolution: latest start, then earliest expiry, then employer id. */
function isBetterBoost(
  next: ActiveBoostInput,
  nextStart: number,
  nextExpires: number,
  existing: ActiveBoostInput,
): boolean {
  const existingStart = toEpochMs(existing.startAt) ?? 0;
  const existingExpires = toEpochMs(existing.expiresAt) ?? 0;
  if (nextStart !== existingStart) return nextStart > existingStart;
  if (nextExpires !== existingExpires) return nextExpires < existingExpires;
  return next.employerId < existing.employerId;
}

function toEpochMs(value: number | Date): number | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime();
  return Number.isFinite(value) ? value : null;
}

// ---------------------------------------------------------------------------
// Deterministic comparators
// ---------------------------------------------------------------------------

/** Final feed ordering. Mirrors the phase 5 selection tie-break for non-sponsored candidates. */
function compareFinal(a: Entry, b: Entry): number {
  if (a.finalRankingScore !== b.finalRankingScore) return b.finalRankingScore - a.finalRankingScore;
  if (a.postMMR !== b.postMMR) return b.postMMR - a.postMMR;
  const relevanceDiff = relevanceKey(b.candidate) - relevanceKey(a.candidate);
  if (relevanceDiff !== 0) return relevanceDiff > 0 ? 1 : -1;
  const organicDiff = organicKey(b.candidate) - organicKey(a.candidate);
  if (organicDiff !== 0) return organicDiff > 0 ? 1 : -1;
  if (a.index !== b.index) return a.index - b.index;
  return a.candidate.jobId < b.candidate.jobId ? -1 : a.candidate.jobId > b.candidate.jobId ? 1 : 0;
}

/** Exploration pick order: non-sponsored first (avoid double counting), then relevance. */
function compareExploration(a: Entry, b: Entry): number {
  if (a.sponsored !== b.sponsored) return a.sponsored ? 1 : -1;
  return compareFinal(a, b);
}

function organicKey(candidate: ScoredCandidate): number {
  return Number.isFinite(candidate.organicScore) ? candidate.organicScore : Number.NEGATIVE_INFINITY;
}

// ---------------------------------------------------------------------------
// Immutable derivation of the phase 6 candidate + snapshot
// ---------------------------------------------------------------------------

function withPhase6(entry: Entry, exploration: boolean): Phase6Candidate {
  const { candidate } = entry;
  const snapshot: RankingSnapshot = {
    ...candidate.rankingSnapshot,
    sponsored: entry.sponsored,
    exploration,
    sponsoredMultiplier: entry.multiplier,
    sponsoredEligible: entry.eligible,
    finalPreAssemblyScore: entry.finalRankingScore,
  };
  return {
    ...candidate,
    rankingSnapshot: snapshot,
    sponsored: entry.sponsored,
    sponsoredMultiplier: entry.multiplier,
    exploration,
    finalRankingScore: entry.finalRankingScore,
  };
}

// ---------------------------------------------------------------------------
// Service: one batched boost query for the whole pool
// ---------------------------------------------------------------------------

export class SponsoredExplorationService {
  constructor(private readonly database: DatabaseAdapter) {}

  /**
   * Runs the sponsored + exploration layers over a phase 5 pool. Empty pool ⇒
   * no database access. Always issues exactly ONE `boosts` query otherwise.
   */
  async process(candidates: readonly ScoredCandidate[], options: Phase6ServiceOptions = {}): Promise<Phase6Candidate[]> {
    if (!Array.isArray(candidates) || candidates.length === 0) return [];
    const now = options.now ?? new Date();
    const boosts = await this.loadActiveBoosts(candidates, now);
    return applySponsoredAndExploration(candidates, boosts, { now });
  }

  private async loadActiveBoosts(candidates: readonly ScoredCandidate[], now: Date): Promise<ActiveBoostInput[]> {
    const jobIds = dedupeJobIds(candidates);
    const { rows } = await this.database.query<BoostRow>(
      `select id, job_id, employer_id, package, start_at, expires_at
         from boosts
        where job_id = any($1::uuid[])
          and status = 'active'
          and start_at <= $2
          and expires_at > $2`,
      [arrayParam(jobIds), now],
    );
    return rows.map((row) => ({
      jobId: row.job_id,
      employerId: row.employer_id,
      package: row.package,
      startAt: new Date(row.start_at),
      expiresAt: new Date(row.expires_at),
    }));
  }
}

function dedupeJobIds(candidates: readonly ScoredCandidate[]): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (candidate == null || typeof candidate.jobId !== "string" || seen.has(candidate.jobId)) continue;
    seen.add(candidate.jobId);
    ids.push(candidate.jobId);
  }
  return ids;
}

function arrayParam(ids: readonly string[]): string {
  return `{${ids.join(",")}}`;
}