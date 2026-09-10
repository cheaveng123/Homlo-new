import { describe, expect, it } from "vitest";

import type { DatabaseAdapter, QueryResult, SqlParameter } from "../backend/infrastructure/database/DatabaseAdapter";
import { rankingConfig } from "../backend/config/rankingConfig";
import type { RetrievalCandidate } from "../backend/ranking/candidate-retrieval";
import { rerankWithMMR } from "../backend/ranking/mmr";
import { RankingScoringService, type RankingSnapshot, type ScoredCandidate } from "../backend/ranking/scoring-service";
import {
  applySponsoredAndExploration,
  postMMRScore,
  SponsoredExplorationService,
  sponsoredMultiplierFor,
  type ActiveBoostInput,
} from "../backend/ranking/sponsored-exploration";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = new Date("2026-08-01T12:00:00.000Z");

const FLOOR = rankingConfig.quality.sponsoredQualityFloor;
const MIN_MULTIPLIER = rankingConfig.sponsored.minMultiplier;
const MAX_MULTIPLIER = rankingConfig.sponsored.maxMultiplier;
const TARGET_SHARE = rankingConfig.exploration.targetShare;
const EXPLORATION_SOURCE = ["exploration"];

function hoursAgoMs(hours: number): string {
  return new Date(NOW.getTime() - hours * 3_600_000).toISOString();
}

function makeScored(overrides: Partial<ScoredCandidate> = {}): ScoredCandidate {
  const base = {
    jobId: "job-a",
    employerId: "emp-1",
    components: { location: 1, pay: 0.5, schedule: 1, categoryPreference: 0.5, jobType: 1, behavioralAffinity: 0 },
    baseRelevance: 0.8,
    quality: { employerQuality: 0.5, jobObservedQuality: 0.5, jobQualityEffective: 0.5, combinedQuality: 0.5, qualityMultiplier: 0.75, jobEventCount: 0 },
    freshnessDecay: 1,
    urgencyBoost: 1,
    organicScore: 0.5,
    rankingVersion: "v1.0.0",
    distanceKm: 0,
    features: { categoryId: "cat-1", jobTypes: [] },
    metadata: { coldStart: true, sources: ["general"], trendingVelocity: undefined },
  };
  const merged = { ...base, ...overrides };
  return {
    ...merged,
    rankingSnapshot: {
      rankingVersion: merged.rankingVersion,
      baseRelevance: merged.baseRelevance,
      locationScore: merged.components.location,
      payScore: merged.components.pay,
      scheduleScore: merged.components.schedule,
      categoryPreferenceScore: merged.components.categoryPreference,
      jobTypeScore: merged.components.jobType,
      behavioralAffinity: merged.components.behavioralAffinity,
      employerQuality: merged.quality.employerQuality,
      jobObservedQuality: merged.quality.jobObservedQuality,
      jobQualityEffective: merged.quality.jobQualityEffective,
      combinedQuality: merged.quality.combinedQuality,
      qualityMultiplier: merged.quality.qualityMultiplier,
      freshnessDecay: merged.freshnessDecay,
      urgencyBoost: merged.urgencyBoost,
      organicScore: merged.organicScore,
      distanceKm: merged.distanceKm,
      sponsored: false,
      exploration: false,
      coldStart: true,
    },
  } as ScoredCandidate;
}

function withSources(candidate: ScoredCandidate, sources: string[]): ScoredCandidate {
  return { ...candidate, metadata: { ...candidate.metadata, sources } };
}

function withMMR(candidate: ScoredCandidate, score: number, relevance = score, redundancy = 0, selectedRank = 1): ScoredCandidate {
  const snapshot: RankingSnapshot = {
    ...candidate.rankingSnapshot,
    mmr: { relevance, redundancy, score, selectedRank },
  };
  return { ...candidate, rankingSnapshot: snapshot };
}

function withQuality(candidate: ScoredCandidate, combinedQuality: number): ScoredCandidate {
  return {
    ...candidate,
    quality: { ...candidate.quality, combinedQuality },
    rankingSnapshot: { ...candidate.rankingSnapshot, combinedQuality },
  };
}

function withOrganic(candidate: ScoredCandidate, organicScore: number): ScoredCandidate {
  return {
    ...candidate,
    organicScore,
    rankingSnapshot: { ...candidate.rankingSnapshot, organicScore },
  };
}

function makeBoost(overrides: Partial<ActiveBoostInput> = {}): ActiveBoostInput {
  return {
    jobId: "job-a",
    employerId: "emp-1",
    package: "verified_checkout",
    startAt: new Date(NOW.getTime() - 1_000),
    expiresAt: new Date(NOW.getTime() + 86_400_000),
    ...overrides,
  };
}

function explorationPool(count: number, organicScore: (i: number) => number, mmrScore: (i: number) => number): ScoredCandidate[] {
  return Array.from({ length: count }, (_, i) => {
    const base = makeScored({ jobId: `job-${i}`, employerId: `emp-${i}`, organicScore: organicScore(i) });
    return withMMR(withSources(base, EXPLORATION_SOURCE), mmrScore(i), mmrScore(i), 0, i + 1);
  });
}

// ---------------------------------------------------------------------------
// Sponsored multiplier
// ---------------------------------------------------------------------------

describe("sponsoredMultiplierFor", () => {
  it("returns 1 (no boost) below the quality floor", () => {
    expect(sponsoredMultiplierFor(FLOOR - 0.01)).toBe(1);
    expect(sponsoredMultiplierFor(0)).toBe(1);
    expect(sponsoredMultiplierFor(Number.NaN)).toBe(1);
    expect(sponsoredMultiplierFor(null)).toBe(1);
    expect(sponsoredMultiplierFor(undefined)).toBe(1);
    expect(sponsoredMultiplierFor(Number.POSITIVE_INFINITY)).toBe(1);
  });

  it("equals minMultiplier exactly at the floor and maxMultiplier at quality 1", () => {
    expect(sponsoredMultiplierFor(FLOOR)).toBeCloseTo(MIN_MULTIPLIER, 6);
    expect(sponsoredMultiplierFor(1)).toBeCloseTo(MAX_MULTIPLIER, 6);
  });

  it("interpolates between min and max between the floor and 1", () => {
    const mid = FLOOR + (1 - FLOOR) / 2;
    const expected = MIN_MULTIPLIER + (MAX_MULTIPLIER - MIN_MULTIPLIER) * 0.5;
    expect(sponsoredMultiplierFor(mid)).toBeCloseTo(expected, 6);
  });

  it("never exceeds maxMultiplier even for out-of-range quality", () => {
    for (const quality of [0.5, 0.6, 0.75, 0.9, 1, 2, 10]) {
      const multiplier = sponsoredMultiplierFor(quality);
      expect(multiplier).toBeGreaterThanOrEqual(MIN_MULTIPLIER - 1e-9);
      expect(multiplier).toBeLessThanOrEqual(MAX_MULTIPLIER + 1e-9);
    }
  });
});

// ---------------------------------------------------------------------------
// Sponsored boost — pure layer
// ---------------------------------------------------------------------------

describe("sponsored boost (applySponsoredAndExploration)", () => {
  it("leaves a non-sponsored candidate untouched (multiplier 1, no flags)", () => {
    const candidate = withMMR(withQuality(makeScored(), 0.9), 0.7, 0.9);
    const [out] = applySponsoredAndExploration([candidate], [], { now: NOW });
    expect(out.sponsored).toBe(false);
    expect(out.rankingSnapshot.sponsoredEligible).toBe(false);
    expect(out.sponsoredMultiplier).toBe(1);
    expect(out.exploration).toBe(false);
    expect(out.finalRankingScore).toBeCloseTo(0.7, 6);
    expect(out.rankingSnapshot.sponsored).toBe(false);
    expect(out.rankingSnapshot.finalPreAssemblyScore).toBeCloseTo(0.7, 6);
  });

  it("applies the configured multiplier to a sponsored pass-the-floor candidate", () => {
    const candidate = withMMR(withQuality(makeScored(), 1), 0.7, 0.9);
    const [out] = applySponsoredAndExploration([candidate], [makeBoost()], { now: NOW });
    expect(out.sponsored).toBe(true);
    expect(out.rankingSnapshot.sponsoredEligible).toBe(true);
    expect(out.sponsoredMultiplier).toBeCloseTo(MAX_MULTIPLIER, 6);
    expect(out.finalRankingScore).toBeCloseTo(0.7 * MAX_MULTIPLIER, 6);
    expect(out.rankingSnapshot.sponsored).toBe(true);
    expect(out.rankingSnapshot.sponsoredEligible).toBe(true);
    expect(out.rankingSnapshot.sponsoredMultiplier).toBeCloseTo(MAX_MULTIPLIER, 6);
    expect(out.rankingSnapshot.finalPreAssemblyScore).toBeCloseTo(0.7 * MAX_MULTIPLIER, 6);
  });

  it("does NOT overwrite organicScore or the snapshot organicScore for a boosted candidate", () => {
    const candidate = withMMR(withQuality(withOrganic(makeScored(), 0.42), 1), 0.7, 0.9);
    const [out] = applySponsoredAndExploration([candidate], [makeBoost()], { now: NOW });
    expect(out.organicScore).toBe(0.42);
    expect(out.rankingSnapshot.organicScore).toBe(0.42);
  });

  it("gates a boost below the quality floor: no lift, but the boost is registered", () => {
    const candidate = withMMR(withQuality(makeScored(), FLOOR - 0.1), 0.7, 0.9);
    const [out] = applySponsoredAndExploration([candidate], [makeBoost()], { now: NOW });
    expect(out.sponsored).toBe(false);
    expect(out.rankingSnapshot.sponsoredEligible).toBe(true);
    expect(out.sponsoredMultiplier).toBe(1);
    expect(out.finalRankingScore).toBeCloseTo(0.7, 6);
  });

  it("does not sponsor when the boost window has already expired at `now`", () => {
    const expired = makeBoost({ startAt: NOW.getTime() - 86_400_000, expiresAt: NOW.getTime() - 3_600_000 });
    const candidate = withMMR(withQuality(makeScored(), 1), 0.7, 0.9);
    const [out] = applySponsoredAndExploration([candidate], [expired], { now: NOW });
    expect(out.sponsored).toBe(false);
    expect(out.rankingSnapshot.sponsoredEligible).toBe(false);
    expect(out.sponsoredMultiplier).toBe(1);
  });

  it("does not sponsor before the boost starts, even with a future expiry", () => {
    const future = makeBoost({ startAt: NOW.getTime() + 3_600_000, expiresAt: NOW.getTime() + 86_400_000 });
    const candidate = withMMR(withQuality(makeScored(), 1), 0.7, 0.9);
    const [out] = applySponsoredAndExploration([candidate], [future], { now: NOW });
    expect(out.sponsored).toBe(false);
  });

  it("sponsors only when `now` falls inside the boost window", () => {
    const booster = makeBoost({ startAt: NOW.getTime() - 3_600_000, expiresAt: NOW.getTime() + 3_600_000 });
    const candidate = withMMR(withQuality(makeScored(), 1), 0.7, 0.9);
    const inside = applySponsoredAndExploration([candidate], [booster], { now: NOW })[0];
    expect(inside.sponsored).toBe(true);
    const before = applySponsoredAndExploration([candidate], [booster], { now: new Date(NOW.getTime() - 7_200_000) })[0];
    expect(before.sponsored).toBe(false);
    const after = applySponsoredAndExploration([candidate], [booster], { now: new Date(NOW.getTime() + 7_200_000) })[0];
    expect(after.sponsored).toBe(false);
  });

  it("cannot resurrect a job that is not in the candidate pool", () => {
    const candidate = withMMR(withQuality(makeScored(), 1), 0.7, 0.9);
    const phantomBoost = makeBoost({ jobId: "not-in-pool", employerId: "emp-x" });
    const [out] = applySponsoredAndExploration([candidate], [phantomBoost], { now: NOW });
    expect(out.sponsored).toBe(false);
    expect(out.rankingSnapshot.sponsoredEligible).toBe(false);
  });

  it("ignores malformed boost rows (bad timestamps / foreign job) deterministically", () => {
    const candidate = withMMR(withQuality(makeScored(), 1), 0.7, 0.9);
    const [out] = applySponsoredAndExploration([candidate], [
      makeBoost({ startAt: Number.NaN, expiresAt: new Date(NOW.getTime() + 1_000) }),
      makeBoost({ jobId: "other", employerId: "emp-x" }),
    ], { now: NOW });
    expect(out.sponsored).toBe(false);
  });

  it("resolves duplicate boosts for one job deterministically (latest start wins)", () => {
    const older = makeBoost({ employerId: "emp-old", startAt: NOW.getTime() - 7_200_000, expiresAt: NOW.getTime() + 86_400_000 });
    const newer = makeBoost({ employerId: "emp-new", startAt: NOW.getTime() - 3_600_000, expiresAt: NOW.getTime() + 48 * 3_600_000 });
    const candidate = withMMR(withQuality(makeScored(), 1), 0.7, 0.9);
    const [out] = applySponsoredAndExploration([candidate], [older, newer], { now: NOW });
    expect(out.sponsored).toBe(true);
    expect(out.rankingSnapshot.sponsoredEligible).toBe(true);
  });

  it("uses the post-MMR score (mmr.score) as the final scoring base", () => {
    const candidate = withMMR(withQuality(makeScored(), 1), 0.65, 0.85);
    const [out] = applySponsoredAndExploration([candidate], [makeBoost()], { now: NOW });
    expect(out.finalRankingScore).toBeCloseTo(0.65 * MAX_MULTIPLIER, 6);
    expect(postMMRScore(candidate)).toBe(0.65);
  });

  it("falls back to organicScore when MMR is absent", () => {
    const candidate = withQuality(makeScored(), 1);
    const [out] = applySponsoredAndExploration([candidate], [makeBoost()], { now: NOW });
    expect(postMMRScore(candidate)).toBe(candidate.organicScore);
    expect(out.finalRankingScore).toBeCloseTo(candidate.organicScore * MAX_MULTIPLIER, 6);
  });
});

// ---------------------------------------------------------------------------
// Ordering
// ---------------------------------------------------------------------------

describe("sponsored ranking (ordering)", () => {
  it("preserves the phase 5 order exactly when nothing is sponsored", () => {
    const pool = [
      withMMR(withSources(makeScored({ jobId: "a", organicScore: 0.9 }), ["general"]), 0.9, 0.9, 0, 1),
      withMMR(withSources(makeScored({ jobId: "b", organicScore: 0.8, employerId: "emp-2", components: { ...makeScored().components, pay: 0.5, categoryPreference: 0.5 } }), ["general"]), 0.8, 0.8, 0.1, 2),
      withMMR(withSources(makeScored({ jobId: "c", organicScore: 0.5, employerId: "emp-3", features: { categoryId: "cat-3", jobTypes: [] } }), ["exploration"]), 0.5, 0.5, 0, 3),
    ];
    const expected = pool.map((candidate) => candidate.jobId);
    const out = applySponsoredAndExploration(pool, [], { now: NOW });
    expect(out.map((candidate) => candidate.jobId)).toEqual(expected);
  });

  it("lifts a sponsored candidate within its bounded range but cannot exceed a higher final score", () => {
    const organicA = withMMR(withQuality(withSources(makeScored({ jobId: "a", organicScore: 0.9 }), ["general"]), 0.75), 0.9, 0.9, 0, 1);
    const sponsoredB = withMMR(withQuality(withSources(makeScored({ jobId: "b", organicScore: 0.88, employerId: "emp-2", features: { categoryId: "cat-2", jobTypes: [] } }), ["general"]), 1), 0.88, 0.88, 0.1, 2);
    const lowC = withMMR(withQuality(withSources(makeScored({ jobId: "c", organicScore: 0.5, employerId: "emp-3", features: { categoryId: "cat-3", jobTypes: [] } }), ["general"]), 1), 0.5, 0.5, 0, 3);
    const boosted = makeBoost({ jobId: "b", employerId: "emp-2" });

    const out = applySponsoredAndExploration([organicA, sponsoredB, lowC], [boosted], { now: NOW });

    // B: 0.88 × 1.15 = 1.012 > A: 0.9 ⇒ B climbs to the top; C stays last.
    expect(out.map((candidate) => candidate.jobId)).toEqual(["b", "a", "c"]);
    expect(out[0].finalRankingScore).toBeCloseTo(0.88 * MAX_MULTIPLIER, 6);
    // non-sponsored relative order A > C is untouched.
    expect(out[1].finalRankingScore).toBeCloseTo(0.9, 6);
  });

  it("keeps sponsorship within its bounded range: cannot outrank a higher non-sponsored score", () => {
    const topA = withMMR(withQuality(withSources(makeScored({ jobId: "a", organicScore: 0.9 }), ["general"]), 0.75), 0.9, 0.9, 0, 1);
    // B boosted to 0.7 × 1.15 = 0.805 — below genuinely higher non-sponsored C (0.85).
    const boostedB = withMMR(withQuality(withSources(makeScored({ jobId: "b", organicScore: 0.7, employerId: "emp-2", features: { categoryId: "cat-2", jobTypes: [] } }), ["general"]), 1), 0.7, 0.7, 0, 2);
    const headC = withMMR(withQuality(withSources(makeScored({ jobId: "c", organicScore: 0.85, employerId: "emp-3", features: { categoryId: "cat-3", jobTypes: [] } }), ["general"]), 0.9), 0.85, 0.85, 0.2, 3);
    const tailD = withMMR(withQuality(withSources(makeScored({ jobId: "d", organicScore: 0.3, employerId: "emp-4", features: { categoryId: "cat-4", jobTypes: [] } }), ["general"]), 1), 0.3, 0.3, 0, 4);

    const out = applySponsoredAndExploration([topA, boostedB, headC, tailD], [makeBoost({ jobId: "b", employerId: "emp-2" })], { now: NOW });
    // A 0.9 > C 0.85 > B 0.805 > D 0.3 ⇒ the sponsored climb only reaches its own bound.
    expect(out[0].jobId).toBe("a");
    expect(out[1].jobId).toBe("c");
    expect(out[2].jobId).toBe("b");
    expect(out[3].jobId).toBe("d");
    expect(out[2].sponsored).toBe(true);
    expect(out[2].finalRankingScore).toBeCloseTo(0.7 * MAX_MULTIPLIER, 6);
  });
});

// ---------------------------------------------------------------------------
// Exploration selection
// ---------------------------------------------------------------------------

describe("controlled exploration", () => {
  it("returns [] for an empty pool", () => {
    expect(applySponsoredAndExploration([], [], { now: NOW })).toEqual([]);
  });

  it("flags no candidates when none carry the exploration source", () => {
    const pool = [withMMR(makeScored({ jobId: "a", organicScore: 0.9 }), 0.9, 0.9, 0, 1)];
    const out = applySponsoredAndExploration(pool, [], { now: NOW });
    expect(out[0].exploration).toBe(false);
    expect(out[0].rankingSnapshot.exploration).toBe(false);
  });

  it("flags every eligible exploration candidate when fewer than the target share exist", () => {
    const pool = [
      withMMR(withSources(makeScored({ jobId: "a", organicScore: 0.9 }), EXPLORATION_SOURCE), 0.9, 0.9, 0, 1),
      withMMR(withSources(makeScored({ jobId: "b", organicScore: 0.7, employerId: "emp-2", features: { categoryId: "cat-2", jobTypes: [] } }), EXPLORATION_SOURCE), 0.7, 0.7, 0, 2),
      withMMR(makeScored({ jobId: "c", organicScore: 0.2, employerId: "emp-3", features: { categoryId: "cat-3", jobTypes: [] } }), 0.2, 0.2, 0, 3),
    ];
    const target = Math.ceil(3 * TARGET_SHARE); // ceil(0.375) = 1
    expect(target).toBe(1);
    const out = applySponsoredAndExploration(pool, [], { now: NOW });
    expect(out.filter((candidate) => candidate.exploration)).toHaveLength(1);
    expect(out.map((candidate) => candidate.jobId)).toEqual(["a", "b", "c"]);
  });

  it("marks exactly the configured share, largest-first, when the universe is large", () => {
    const count = Math.ceil(1 / TARGET_SHARE) + 1; // 9 with targetShare 0.125
    const pool = explorationPool(count, (i) => 1 - i * 0.05, (i) => 1 - i * 0.05);
    const target = Math.ceil(count * TARGET_SHARE);
    expect(target).toBe(2);
    const out = applySponsoredAndExploration(pool, [], { now: NOW });
    const flagged = out.filter((candidate) => candidate.exploration);
    expect(flagged).toHaveLength(target);
    // relevance-first selection within the floor: the two highest post-MMR scores.
    expect(flagged.map((candidate) => candidate.jobId)).toEqual(["job-0", "job-1"]);
    expect(out.map((candidate) => candidate.jobId)).toEqual(pool.map((candidate) => candidate.jobId));
  });

  it("never marks an exploration candidate below the relevance floor", () => {
    const low = withMMR(withSources(makeScored({ jobId: "low", organicScore: 0.2 }), EXPLORATION_SOURCE), -0.3, 0.2, 0, 1);
    const out = applySponsoredAndExploration([low], [], { now: NOW });
    expect(out[0].exploration).toBe(false);
  });

  it("selects deterministically and does not depend on random order", () => {
    const pool = explorationPool(9, (i) => 1 - i * 0.05, (i) => 1 - i * 0.05);
    const first = applySponsoredAndExploration(pool, [], { now: NOW });
    const second = applySponsoredAndExploration(pool, [], { now: NOW });
    expect(first.map((candidate) => candidate.jobId)).toEqual(second.map((candidate) => candidate.jobId));
    expect(first.map((candidate) => candidate.exploration)).toEqual(second.map((candidate) => candidate.exploration));
  });

  it("needs no exploration candidates to fabricate slots — zero stays zero", () => {
    const pool = explorationPool(9, (i) => 1 - i * 0.05, (i) => 1 - i * 0.05).map((candidate) => withSources(candidate, ["general"]));
    const out = applySponsoredAndExploration(pool, [], { now: NOW });
    expect(out.every((candidate) => candidate.exploration === false)).toBe(true);
  });

  it("counts the flag on snapshot and candidate identically", () => {
    const pool = [
      withMMR(withSources(makeScored({ jobId: "a", organicScore: 0.9 }), EXPLORATION_SOURCE), 0.9, 0.9, 0, 1),
      withMMR(makeScored({ jobId: "b", organicScore: 0.5, employerId: "emp-2", features: { categoryId: "cat-2", jobTypes: [] } }), 0.5, 0.5, 0, 2),
    ];
    const out = applySponsoredAndExploration(pool, [], { now: NOW });
    for (const candidate of out) {
      expect(candidate.exploration).toBe(candidate.rankingSnapshot.exploration);
      expect(candidate.sponsored).toBe(candidate.rankingSnapshot.sponsored);
    }
  });
});

// ---------------------------------------------------------------------------
// Sponsored × exploration interaction
// ---------------------------------------------------------------------------

describe("sponsored × exploration interaction", () => {
  it("keeps both flags on a candidate that is simultaneously sponsored and high-quality/exploration", () => {
    const candidate = withMMR(withQuality(withSources(makeScored({ jobId: "a", organicScore: 0.9 }), EXPLORATION_SOURCE), 1), 0.9, 0.9, 0, 1);
    const [out] = applySponsoredAndExploration([candidate], [makeBoost({ jobId: "a" })], { now: NOW });
    expect(out.exploration).toBe(true);
    expect(out.sponsored).toBe(true);
    expect(out.rankingSnapshot.exploration).toBe(true);
    expect(out.rankingSnapshot.sponsored).toBe(true);
  });

  it("prefers non-sponsored exploration candidates when alternatives exist", () => {
    // E1 (exploration, not sponsored), S (exploration + sponsored), E2 (exploration, not sponsored).
    const e1 = withMMR(withQuality(withSources(makeScored({ jobId: "e1", organicScore: 0.6 }), EXPLORATION_SOURCE), 0.9), 0.6, 0.6, 0, 1);
    const s = withMMR(withQuality(withSources(makeScored({ jobId: "s", organicScore: 0.5, employerId: "emp-s", features: { categoryId: "cat-s", jobTypes: [] } }), EXPLORATION_SOURCE), 1), 0.5, 0.5, 0, 2);
    const e2 = withMMR(withQuality(withSources(makeScored({ jobId: "e2", organicScore: 0.4, employerId: "emp-e2", features: { categoryId: "cat-e2", jobTypes: [] } }), EXPLORATION_SOURCE), 0.9), 0.4, 0.4, 0, 3);
    const target = Math.ceil(3 * TARGET_SHARE); // 1
    expect(target).toBe(1);

    const out = applySponsoredAndExploration([e1, s, e2], [makeBoost({ jobId: "s", employerId: "emp-s" })], { now: NOW });
    const flagged = out.filter((candidate) => candidate.exploration);
    expect(flagged).toHaveLength(1);
    expect(flagged[0].jobId).toBe("e1"); // highest post-MMR non-sponsored exploration candidate
    expect(out.find((candidate) => candidate.jobId === "s")!.sponsored).toBe(true);
    expect(out.find((candidate) => candidate.jobId === "s")!.exploration).toBe(false);
  });

  it("keeps finalRankingScore identical for a flagged exploration candidate (no synthetic boost)", () => {
    const candidate = withMMR(withQuality(withSources(makeScored({ jobId: "a", organicScore: 0.9 }), EXPLORATION_SOURCE), 0.9), 0.9, 0.9, 0, 1);
    const pure = applySponsoredAndExploration([candidate], [], { now: NOW })[0];
    expect(pure.sponsored).toBe(false);
    expect(pure.sponsoredMultiplier).toBe(1);
    expect(pure.exploration).toBe(true);
    expect(pure.finalRankingScore).toBeCloseTo(postMMRScore(candidate), 6);
  });

  it("does not reshuffle the feed when only exploration is active", () => {
    const pool = [
      withMMR(makeScored({ jobId: "a", organicScore: 0.9 }), 0.9, 0.9, 0, 1),
      withMMR(withSources(makeScored({ jobId: "b", organicScore: 0.7, employerId: "emp-2", features: { categoryId: "cat-2", jobTypes: [] } }), EXPLORATION_SOURCE), 0.7, 0.7, 0, 2),
      withMMR(makeScored({ jobId: "c", organicScore: 0.4, employerId: "emp-3", features: { categoryId: "cat-3", jobTypes: [] } }), 0.4, 0.4, 0, 3),
    ];
    const out = applySponsoredAndExploration(pool, [], { now: NOW });
    expect(out.map((candidate) => candidate.jobId)).toEqual(["a", "b", "c"]);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("edge cases", () => {
  it("deduplicates repeated job ids, keeping the first occurrence", () => {
    const first = withMMR(withQuality(makeScored({ jobId: "dup", organicScore: 0.9 }), 1), 0.9, 0.9, 0, 1);
    const dup = withMMR(withQuality(makeScored({ jobId: "dup", organicScore: 0.1, employerId: "emp-2" }), 1), 0.1, 0.1, 0, 2);
    const out = applySponsoredAndExploration([first, dup], [makeBoost({ jobId: "dup" })], { now: NOW });
    expect(out).toHaveLength(1);
    expect(out[0].jobId).toBe("dup");
    expect(out[0].organicScore).toBe(0.9);
  });

  it("renders NaN/infinite organic and MMR scores into finite final scores", () => {
    const pool = [
      withMMR(makeScored({ jobId: "nan", organicScore: Number.NaN }), Number.NaN, Number.NaN),
      withMMR(makeScored({ jobId: "inf", organicScore: Number.POSITIVE_INFINITY, features: { categoryId: null, jobTypes: [] }, distanceKm: null }), Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY),
    ];
    const out = applySponsoredAndExploration(pool, [], { now: NOW });
    for (const candidate of out) {
      expect(Number.isFinite(candidate.finalRankingScore)).toBe(true);
      expect(Number.isFinite(candidate.sponsoredMultiplier)).toBe(true);
    }
  });

  it("flags all sponsored candidates within bounds when the whole pool is boosted", () => {
    const pool = [
      withMMR(withQuality(makeScored({ jobId: "a", organicScore: 0.9 }), 1), 0.9, 0.9, 0, 1),
      withMMR(withQuality(makeScored({ jobId: "b", organicScore: 0.8, employerId: "emp-2", features: { categoryId: "cat-2", jobTypes: [] } }), 1), 0.8, 0.8, 0, 2),
      withMMR(withQuality(makeScored({ jobId: "c", organicScore: 0.5, employerId: "emp-3", features: { categoryId: "cat-3", jobTypes: [] } }), 1), 0.5, 0.5, 0, 3),
    ];
    const boosts = pool.map((candidate) => makeBoost({ jobId: candidate.jobId, employerId: candidate.employerId }));
    const out = applySponsoredAndExploration(pool, boosts, { now: NOW });
    expect(out.every((candidate) => candidate.sponsored)).toBe(true);
    for (const candidate of out) {
      expect(candidate.sponsoredMultiplier).toBeLessThanOrEqual(MAX_MULTIPLIER + 1e-9);
      expect(candidate.sponsoredMultiplier).toBeGreaterThanOrEqual(MIN_MULTIPLIER - 1e-9);
      expect(candidate.finalRankingScore).toBeLessThanOrEqual(MAX_MULTIPLIER * 1 + 1e-9);
    }
  });

  it("never mutates the input array or its candidate objects", () => {
    const input = [
      withMMR(withQuality(makeScored({ jobId: "a", organicScore: 0.9 }), 1), 0.9, 0.9, 0, 1),
      withMMR(withQuality(makeScored({ jobId: "b", organicScore: 0.8, employerId: "emp-2", features: { categoryId: "cat-2", jobTypes: [] } }), 1), 0.8, 0.8, 0, 2),
    ];
    const before = JSON.stringify(input);
    const out = applySponsoredAndExploration(input, [
      makeBoost({ jobId: "a" }),
      makeBoost({ jobId: "b", employerId: "emp-2" }),
    ], { now: NOW });

    expect(out).not.toBe(input);
    expect(out[0]).not.toBe(input[0]);
    expect(out[0].rankingSnapshot).not.toBe(input[0].rankingSnapshot);
    expect(JSON.stringify(input)).toBe(before);
    expect(input.every((candidate) => candidate.rankingSnapshot.sponsored === false && candidate.rankingSnapshot.exploration === false)).toBe(true);
  });

  it("preserves every phase 4/5 field on the flagged copies", () => {
    const original = withMMR(withQuality(withSources(makeScored({ jobId: "a", organicScore: 0.9 }), EXPLORATION_SOURCE), 1), 0.9, 0.9, 0, 1);
    const [out] = applySponsoredAndExploration([original], [makeBoost()], { now: NOW });
    expect(out.rankingSnapshot).not.toBe(original.rankingSnapshot);
    expect(out.jobId).toBe("a");
    expect(out.employerId).toBe(original.employerId);
    expect(out.features).toEqual(original.features);
    expect(out.components).toEqual(original.components);
    expect(out.metadata).toEqual(original.metadata);
    expect(out.quality).toEqual(original.quality);
    expect(out.organicScore).toBe(original.organicScore);
    expect(out.rankingSnapshot.qualityMultiplier).toBe(original.rankingSnapshot.qualityMultiplier);
    expect(out.rankingSnapshot.mmr).toEqual(original.rankingSnapshot.mmr);
    expect(out.rankingSnapshot.coldStart).toBe(original.rankingSnapshot.coldStart);
    expect(out.rankingSnapshot.rankingVersion).toBe("v1.0.0");
  });
});

// ---------------------------------------------------------------------------
// Service layer: batched boost loading + SQL filter semantics
// ---------------------------------------------------------------------------

class InMemoryPhase6Database implements DatabaseAdapter {
  public boostQueries = 0;
  public scoringQueries = 0;

  constructor(
    private readonly jobs: Record<string, unknown>[],
    private readonly boosts: Record<string, unknown>[],
  ) {}

  async query<Row extends Record<string, unknown> = Record<string, unknown>>(
    statement: string,
    parameters: readonly SqlParameter[] = [],
  ): Promise<QueryResult<Row>> {
    let raw: Record<string, unknown>[] = [];
    if (statement.startsWith("select id, job_id, employer_id, package, start_at, expires_at")) {
      this.boostQueries += 1;
      const jobIds = parseArrayParam(String(parameters[0]));
      const now = parameters[1] as Date;
      raw = this.boosts.filter((row) =>
        jobIds.has(String(row.job_id)) &&
        row.status === "active" &&
        new Date(String(row.start_at)) <= now &&
        now < new Date(String(row.expires_at)),
      );
    } else if (statement.startsWith("select id, employer_id, category_id, pay_amount")) {
      this.scoringQueries += 1;
      raw = this.jobs;
    }
    return { rows: raw as Row[], rowCount: raw.length };
  }

  transaction<T>(work: (database: DatabaseAdapter) => Promise<T>): Promise<T> {
    return work(this);
  }
}

function parseArrayParam(value: string): Set<string> {
  const trimmed = value.replace(/^{/, "").replace(/}$/, "");
  if (!trimmed) return new Set();
  return new Set(trimmed.split(","));
}

function boostRow(jobId: string, employerId: string, status: string, startAt: string, expiresAt: string): Record<string, unknown> {
  return { id: `boost-${jobId}`, job_id: jobId, employer_id: employerId, package: "verified_checkout", start_at: startAt, expires_at: expiresAt, status };
}

describe("SponsoredExplorationService", () => {
  it("runs zero boost queries for an empty pool", async () => {
    const database = new InMemoryPhase6Database([], []);
    await new SponsoredExplorationService(database).process([]);
    expect(database.boostQueries).toBe(0);
  });

  it("runs exactly one batched boost query for a non-empty pool", async () => {
    const database = new InMemoryPhase6Database([], []);
    const pool = [
      withMMR(makeScored({ jobId: "a", organicScore: 0.9 }), 0.9, 0.9, 0, 1),
      withMMR(makeScored({ jobId: "b", organicScore: 0.8, employerId: "emp-2", features: { categoryId: "cat-2", jobTypes: [] } }), 0.8, 0.8, 0, 2),
    ];
    await new SponsoredExplorationService(database).process(pool, { now: NOW });
    expect(database.boostQueries).toBe(1);
  });

  it("sponsors a candidate when a boost row is active and in-window", async () => {
    const database = new InMemoryPhase6Database([], [
      boostRow("a", "emp-1", "active", hoursAgoMs(1), new Date(NOW.getTime() + 86_400_000).toISOString()),
    ]);
    const pool = [
      withMMR(withQuality(makeScored({ jobId: "a", organicScore: 0.9 }), 1), 0.9, 0.9, 0, 1),
    ];
    const [out] = await new SponsoredExplorationService(database).process(pool, { now: NOW });
    expect(out.sponsored).toBe(true);
    expect(out.rankingSnapshot.sponsoredEligible).toBe(true);
    expect(out.sponsoredMultiplier).toBeCloseTo(MAX_MULTIPLIER, 6);
  });

  it("does not sponsor an expired boost (expiry before now)", async () => {
    const database = new InMemoryPhase6Database([], [
      boostRow("a", "emp-1", "active", hoursAgoMs(48), hoursAgoMs(1)),
    ]);
    const pool = [
      withMMR(withQuality(makeScored({ jobId: "a", organicScore: 0.9 }), 1), 0.9, 0.9, 0, 1),
    ];
    const [out] = await new SponsoredExplorationService(database).process(pool, { now: NOW });
    expect(out.sponsored).toBe(false);
    expect(out.rankingSnapshot.sponsoredEligible).toBe(false);
  });

  it("does not sponsor a cancelled or inactive boost row", async () => {
    const database = new InMemoryPhase6Database([], [
      boostRow("a", "emp-1", "cancelled", hoursAgoMs(48), new Date(NOW.getTime() + 86_400_000).toISOString()),
      boostRow("b", "emp-2", "expired", hoursAgoMs(48), hoursAgoMs(1)),
    ]);
    const pool = [
      withMMR(withQuality(makeScored({ jobId: "a", organicScore: 0.9 }), 1), 0.9, 0.9, 0, 1),
      withMMR(withQuality(makeScored({ jobId: "b", organicScore: 0.8, employerId: "emp-2", features: { categoryId: "cat-2", jobTypes: [] } }), 1), 0.8, 0.8, 0, 2),
    ];
    const [a, b] = await new SponsoredExplorationService(database).process(pool, { now: NOW });
    expect(a.sponsored).toBe(false);
    expect(b.sponsored).toBe(false);
  });

  it("ignores boost rows for jobs outside the pool", async () => {
    const database = new InMemoryPhase6Database([], [
      boostRow("phantom", "emp-9", "active", hoursAgoMs(1), new Date(NOW.getTime() + 86_400_000).toISOString()),
    ]);
    const pool = [
      withMMR(withQuality(makeScored({ jobId: "a", organicScore: 0.9 }), 1), 0.9, 0.9, 0, 1),
    ];
    const [out] = await new SponsoredExplorationService(database).process(pool, { now: NOW });
    expect(out.sponsored).toBe(false);
  });

  it("handles a pool with duplicate ids (single query, single output row)", async () => {
    const database = new InMemoryPhase6Database([], [
      boostRow("a", "emp-1", "active", hoursAgoMs(1), new Date(NOW.getTime() + 86_400_000).toISOString()),
    ]);
    const first = withMMR(withQuality(makeScored({ jobId: "a", organicScore: 0.9 }), 1), 0.9, 0.9, 0, 1);
    const dup = withMMR(withQuality(makeScored({ jobId: "a", organicScore: 0.1, employerId: "emp-2" }), 1), 0.1, 0.1, 0, 2);
    const out = await new SponsoredExplorationService(database).process([first, dup], { now: NOW });
    expect(database.boostQueries).toBe(1);
    expect(out).toHaveLength(1);
    expect(out[0].jobId).toBe("a");
    expect(out[0].sponsored).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Integration: phase 4 → phase 5 → phase 6 handoff
// ---------------------------------------------------------------------------

class InMemoryPipelineDatabase extends InMemoryPhase6Database {}

describe("phase 4 → phase 5 → phase 6 handoff", () => {
  it("produces spot/promoted/exploration fields across the full pipeline", async () => {
    const jobs = [
      {
        id: "top", employer_id: "emp-1", category_id: "cat-1", pay_amount: 20, pay_currency: "USD", pay_type: "hourly",
        location_text: "Remote — worldwide", latitude: 0, longitude: 0, start_date: null, start_time: null, end_time: null,
        created_at: hoursAgoMs(1),
      },
      {
        id: "promoted", employer_id: "emp-2", category_id: "cat-2", pay_amount: 10, pay_currency: "USD", pay_type: "hourly",
        location_text: "Downtown", latitude: 0, longitude: 30, start_date: null, start_time: "09:00", end_time: "18:00",
        created_at: hoursAgoMs(1),
      },
      {
        id: "explored", employer_id: "emp-3", category_id: "cat-3", pay_amount: 8, pay_currency: "USD", pay_type: "hourly",
        location_text: "Elsewhere", latitude: 0, longitude: 60, start_date: null, start_time: null, end_time: null,
        created_at: hoursAgoMs(10),
      },
    ];
    const database = new InMemoryPipelineDatabase(
      jobs,
      [boostRow("promoted", "emp-2", "active", hoursAgoMs(1), new Date(NOW.getTime() + 86_400_000).toISOString())],
    );
    const candidates: RetrievalCandidate[] = [
      { jobId: "top", employerId: "emp-1", categoryId: "cat-1", createdAt: hoursAgoMs(1), sources: ["general"] },
      { jobId: "promoted", employerId: "emp-2", categoryId: "cat-2", createdAt: hoursAgoMs(1), sources: ["general"] },
      { jobId: "explored", employerId: "emp-3", categoryId: "cat-3", createdAt: hoursAgoMs(10), sources: ["exploration"] },
    ];

    const scored = await new RankingScoringService(database).scoreCandidates({
      userId: null,
      userLocation: { latitude: 0, longitude: 0 },
      candidates,
      now: NOW,
    });
    expect(scored).toHaveLength(3);

    const reranked = rerankWithMMR(scored);
    expect(reranked).toHaveLength(3);

    const rerankedPromoted = reranked.find((candidate) => candidate.jobId === "promoted")!;

    const pipeline = await new SponsoredExplorationService(database).process(reranked, { now: NOW });
    expect(pipeline).toHaveLength(3);
    expect(database.boostQueries).toBeGreaterThanOrEqual(1);

    const byId = new Map(pipeline.map((candidate) => [candidate.jobId, candidate]));
    const promoted = byId.get("promoted")!;
    // No quality stats exist ⇒ combinedQuality = neutral prior 0.5 = the floor ⇒ sponsored with the floor multiplier.
    expect(promoted.sponsored).toBe(true);
    expect(promoted.sponsoredMultiplier).toBeCloseTo(MIN_MULTIPLIER, 6);
    expect(promoted.rankingSnapshot.sponsoredEligible).toBe(true);
    expect(Number.isFinite(promoted.finalRankingScore)).toBe(true);
    expect(promoted.rankingSnapshot.sponsored).toBe(true);
    expect(promoted.organicScore).toBe(rerankedPromoted.organicScore);
    expect(promoted.rankingSnapshot.organicScore).toBe(rerankedPromoted.rankingSnapshot.organicScore);
    expect(promoted.rankingSnapshot.mmr).toBeDefined();

    const explored = byId.get("explored")!;
    expect(explored.exploration).toBe(true);
    expect(explored.exploration).toBe(explored.rankingSnapshot.exploration);
    expect(explored.sponsored).toBe(false);
    expect(explored.rankingSnapshot.sponsoredMultiplier).toBe(1);
    expect(explored.finalRankingScore).toBeCloseTo(postMMRScore(explored), 6);

    const top = byId.get("top")!;
    expect(top.sponsored).toBe(false);
    expect(top.exploration).toBe(false);
    expect(top.rankingSnapshot.mmr?.selectedRank).toBe(1);
    expect(pipeline[0].jobId).toBe("top");
  });
});