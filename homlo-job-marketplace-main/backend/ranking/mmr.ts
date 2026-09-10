// =========================================================
// MMR re-ranking (phase 5) — soft diversity layer.
//
// Consumes the PHASE 4 ScoredCandidate[] and deterministically re-orders it so
// consecutive slots diversify without throwing away relevance:
//
//   score(candidate) = λ·relevance − (1−λ)·redundancy
//   redundancy(candidate) = max similarity to the already-selected candidates
//
//   relevance  = organicScore normalized to its pool (pool max ⇒ 1), so the
//                underlying order is preserved and MMR only reshapes it.
//   similarity = weighted blend of category, inferred job type (Jaccard),
//                employer and geographic distance — all derived from data
//                already on the ScoredCandidate. No database access here.
//                Pay/schedule are intentionally excluded: their neutral
//                fallback values are indistinguishable from real mid/perfect
//                values and would fabricate redundancy.
//
// Selection is greedy (the first pick is the pure relevance leader),
// deterministic (no randomness), O(N²·K) with each unordered pair's similarity
// computed exactly once, and NEVER mutates its input: selected candidates are
// copied with an `mmr` block appended to their ranking snapshot. This is the
// counterpart of the phase 4 scoring service — sponsored boost, exploration
// injection and final feed assembly happen OUTSIDE this module.
// =========================================================

import { rankingConfig } from "../config/rankingConfig";
import { clamp01 } from "./wilson";
import type { CandidateFeatures, RankingMMRInfo, RankingSnapshot, ScoredCandidate } from "./scoring-service";

export type RerankOptions = {
  /** Keep at most this many candidates; defaults to the full input length. */
  limit?: number;
};

type Best = {
  index: number;
  jobId: string;
  score: number;
  relevance: number;
  organic: number;
};

export function validateMMRConfig(): void {
  const mmrLambda = rankingConfig.diversity.mmrLambda;
  if (!Number.isFinite(mmrLambda) || mmrLambda < 0 || mmrLambda > 1) {
    throw new Error("rankingConfig: diversity.mmrLambda must be a finite number in [0, 1]");
  }
  const weights = Object.values(rankingConfig.diversity.similarityWeights);
  if (!weights.every((weight) => Number.isFinite(weight) && weight >= 0) || weights.reduce((sum, weight) => sum + weight, 0) <= 0) {
    throw new Error("rankingConfig: diversity.similarityWeights must be non-negative finite numbers with a positive total");
  }
}

validateMMRConfig();

/**
 * Deterministic greedy MMR selection over a phase 4 pool. Returns a new array;
 * neither the input array nor its candidate objects are mutated.
 */
export function rerankWithMMR(candidates: readonly ScoredCandidate[], options?: RerankOptions): ScoredCandidate[] {
  validateMMRConfig();
  const count = candidates.length;
  if (count === 0) return [];

  const limit = sanitizeLimit(options?.limit, count);
  if (limit === 0) return [];

  const lambda = rankingConfig.diversity.mmrLambda;
  const poolMax = maxFiniteOrganic(candidates);
  const relevance = candidates.map((candidate) => normalizedRelevance(candidate.organicScore, poolMax));

  const redundancy = new Array<number>(count).fill(0);
  const taken = new Array<boolean>(count).fill(false);
  const output: ScoredCandidate[] = [];

  while (output.length < limit) {
    let best: Best | null = null;
    for (let i = 0; i < count; i++) {
      if (taken[i]) continue;
      const next: Best = {
        index: i,
        jobId: candidates[i].jobId,
        score: mmrScore(relevance[i], redundancy[i], lambda),
        relevance: relevance[i],
        organic: finiteOrNegInfinity(candidates[i].organicScore),
      };
      if (best == null || isBetter(best, next)) best = next;
    }
    if (best == null) break;

    const selected = candidates[best.index];
    output.push(withMMR(selected, {
      relevance: relevance[best.index],
      redundancy: redundancy[best.index],
      score: best.score,
      selectedRank: output.length + 1,
    }));
    taken[best.index] = true;

    // The selected candidate becomes the diversity anchor: each unordered pair
    // is (implicitly) evaluated exactly once across the whole pass.
    for (let i = 0; i < count; i++) {
      if (taken[i]) continue;
      const similarity = similarityBetween(candidates[i], selected);
      if (similarity > redundancy[i]) redundancy[i] = similarity;
    }
  }
  return output;
}

// ---------------------------------------------------------------------------
// Pure deterministic similarity + relevance math (exported for unit testing)
// ---------------------------------------------------------------------------

/** λ·relevance − (1−λ)·redundancy; inputs are clamped so the result is always finite in [−1, 1]. */
export function mmrScore(relevance: number, redundancy: number, lambda: number): number {
  const validLambda = Number.isFinite(lambda) ? Math.min(1, Math.max(0, lambda)) : rankingConfig.diversity.mmrLambda;
  return validLambda * clamp01(relevance) - (1 - validLambda) * clamp01(redundancy);
}

/**
 * Organic score normalized to the pool maximum (pool max ⇒ 1), so the highest
 * value is always 1 and relative order is preserved. Non-finite/negative
 * organic scores sanitize to 0 relevance; an all-zero / all-equal pool maps to
 * every relevance = 1 (those candidates then differ only by tie-breaks).
 */
export function normalizedRelevance(organicScore: number, poolMax: number): number {
  const value = Number.isFinite(organicScore) && organicScore > 0 ? organicScore : 0;
  if (!(poolMax > 0)) return 1;
  return clamp01(value / poolMax);
}

/**
 * Weighted similarity in [0, 1] between two scored candidates. Dimensions whose
 * signals are unavailable on either side are excluded and the remaining weights
 * are renormalized, so absence never counts as a mismatch.
 */
export function similarityBetween(a: ScoredCandidate, b: ScoredCandidate): number {
  const weights = rankingConfig.diversity.similarityWeights;
  const featuresA = featuresOf(a);
  const featuresB = featuresOf(b);
  let weightSum = 0;
  let weighted = 0;

  if (featuresA.categoryId != null && featuresB.categoryId != null) {
    weightSum += weights.category;
    weighted += weights.category * (featuresA.categoryId === featuresB.categoryId ? 1 : 0);
  }
  if (featuresA.jobTypes.length > 0 && featuresB.jobTypes.length > 0) {
    weightSum += weights.jobType;
    weighted += weights.jobType * jaccard(new Set(featuresA.jobTypes), new Set(featuresB.jobTypes));
  }
  weightSum += weights.employer;
  weighted += weights.employer * (a.employerId === b.employerId ? 1 : 0);
  if (a.distanceKm != null && b.distanceKm != null && rankingConfig.location.referenceDistanceKm > 0) {
    weightSum += weights.location;
    weighted += weights.location * locationSimilarity(Math.abs(a.distanceKm - b.distanceKm), rankingConfig.location.referenceDistanceKm);
  }
  return weightSum > 0 ? clamp01(weighted / weightSum) : 0;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function maxFiniteOrganic(candidates: readonly ScoredCandidate[]): number {
  let max = Number.NEGATIVE_INFINITY;
  for (const candidate of candidates) {
    const score = candidate.organicScore;
    if (Number.isFinite(score) && score > max) max = score;
  }
  return Number.isFinite(max) ? max : 0;
}

function sanitizeLimit(limit: number | undefined, count: number): number {
  if (limit == null || !Number.isFinite(limit)) return count;
  return Math.min(count, Math.max(0, Math.floor(limit)));
}

function isBetter(current: Best, next: Best): boolean {
  if (next.score !== current.score) return next.score > current.score;
  if (next.relevance !== current.relevance) return next.relevance > current.relevance;
  if (next.organic !== current.organic) return next.organic > current.organic;
  if (next.index !== current.index) return next.index < current.index;
  return next.jobId < current.jobId;
}

function finiteOrNegInfinity(value: number): number {
  return Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
}

function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  let intersection = 0;
  for (const value of a) if (b.has(value)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union > 0 ? intersection / union : 0;
}

function locationSimilarity(deltaKm: number, d0Km: number): number {
  return clamp01(1 / (1 + (deltaKm / d0Km) ** 2));
}

function featuresOf(candidate: ScoredCandidate): CandidateFeatures {
  return candidate.features ?? { categoryId: null, jobTypes: [] };
}

function withMMR(candidate: ScoredCandidate, mmr: RankingMMRInfo): ScoredCandidate {
  const snapshot: RankingSnapshot = { ...candidate.rankingSnapshot, mmr };
  return { ...candidate, rankingSnapshot: snapshot };
}