import { describe, expect, it } from "vitest";

import type { DatabaseAdapter, QueryResult, SqlParameter } from "../backend/infrastructure/database/DatabaseAdapter";
import type { RetrievalCandidate } from "../backend/ranking/candidate-retrieval";
import { normalizedRelevance, mmrScore, rerankWithMMR, similarityBetween } from "../backend/ranking/mmr";
import { RankingScoringService, type ScoredCandidate } from "../backend/ranking/scoring-service";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = new Date("2026-08-01T12:00:00.000Z");

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
    features: { categoryId: "cat-1", jobTypes: ["part-time"] },
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

// ---------------------------------------------------------------------------
// Similarity
// ---------------------------------------------------------------------------

describe("similarityBetween", () => {
  it("is 1 for identical candidates", () => {
    const a = makeScored();
    expect(similarityBetween(a, { ...a })).toBe(1);
  });

  it("penalizes a different category while keeping the rest", () => {
    const a = makeScored();
    const b = makeScored({ jobId: "job-b", features: { categoryId: "cat-2", jobTypes: ["part-time"] } });
    // category 0.35·0 + jobType 0.2·1 + employer 0.25·1 + location 0.2·1 = 0.65
    expect(similarityBetween(a, b)).toBeCloseTo(0.65, 5);
  });

  it("treats a different employer as a significant (but soft) hit", () => {
    const a = makeScored();
    const b = makeScored({ jobId: "job-b", employerId: "emp-2" });
    expect(similarityBetween(a, b)).toBeCloseTo(0.75, 5);
  });

  it("uses Jaccard over inferred job-type signals", () => {
    const a = makeScored();
    const b = makeScored({ jobId: "job-b", features: { categoryId: "cat-1", jobTypes: ["part-time", "weekend"] } });
    // Jaccard = 1/2 ⇒ 0.35·1 + 0.2·0.5 + 0.25·1 + 0.2·1 = 0.90
    expect(similarityBetween(a, b)).toBeCloseTo(0.9, 5);
  });

  it("decays location similarity with the same band as scoring", () => {
    const a = makeScored({ distanceKm: 3 });
    const b = makeScored({ jobId: "job-b", distanceKm: 6 });
    // Δ = 3km, d0 = 3 ⇒ 1/(1+1) = 0.5; total = 0.35+0.2+0.25+0.2·0.5 = 0.90
    expect(similarityBetween(a, b)).toBeCloseTo(0.9, 5);
  });

  it("renormalizes weights when a dimension is unknown, never counting absence as a mismatch", () => {
    const a = makeScored({ features: { categoryId: null, jobTypes: ["part-time"] } });
    const b = makeScored({ jobId: "job-b", features: { categoryId: "cat-2", jobTypes: ["part-time"] } });
    // category unknown on a ⇒ excluded; remaining dims (jobType, employer, location) all agree ⇒ 1
    expect(similarityBetween(a, b)).toBe(1);
  });

  it("drops the empty job-type side and missing distances from the similarity", () => {
    const a = makeScored({ features: { categoryId: null, jobTypes: [] }, distanceKm: null });
    const b = makeScored({ jobId: "job-b", employerId: "emp-2", features: { categoryId: "cat-2", jobTypes: [] }, distanceKm: null });
    // only employer is evaluable (different) ⇒ weighted total 0.25 ⇒ similarity 0
    expect(similarityBetween(a, b)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Relevance normalization
// ---------------------------------------------------------------------------

describe("normalizedRelevance", () => {
  it("normalizes to the pool maximum", () => {
    expect(normalizedRelevance(0.9, 0.9)).toBe(1);
    expect(normalizedRelevance(0.45, 0.9)).toBe(0.5);
    expect(normalizedRelevance(0.0, 0.9)).toBe(0);
  });

  it("maps an all-equal or all-zero pool to 1 for every candidate", () => {
    expect(normalizedRelevance(0.5, 0)).toBe(1);
    expect(normalizedRelevance(0, 0)).toBe(1);
  });

  it("sanitizes non-finite and negative organic scores to 0 relevance", () => {
    expect(normalizedRelevance(Number.NaN, 1)).toBe(0);
    expect(normalizedRelevance(Number.POSITIVE_INFINITY, 1)).toBe(0);
    expect(normalizedRelevance(-0.4, 0.5)).toBe(0);
  });
});

describe("mmrScore", () => {
  it("combines relevance and redundancy with λ", () => {
    expect(mmrScore(1, 0, 0.8)).toBeCloseTo(0.8, 5);
    expect(mmrScore(0.8, 1, 0.8)).toBeCloseTo(0.44, 5);
    expect(mmrScore(0.5, 0.25, 0.8)).toBeCloseTo(0.35, 5);
    expect(mmrScore(0, 1, 0.5)).toBeCloseTo(-0.5, 5);
  });

  it("never returns NaN/undefined even for degenerate inputs", () => {
    expect(Number.isFinite(mmrScore(Number.NaN, Number.NaN, 0.8))).toBe(true);
    expect(Number.isFinite(mmrScore(Number.POSITIVE_INFINITY, 2, 0.8))).toBe(true);
    expect(Number.isFinite(mmrScore(0.5, 0.2, Number.NaN))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Re-ranking
// ---------------------------------------------------------------------------

describe("rerankWithMMR", () => {
  it("returns an empty list for an empty pool", () => {
    expect(rerankWithMMR([])).toEqual([]);
  });

  it("returns the single candidate with its MMR block", () => {
    const [only] = rerankWithMMR([makeScored()]);
    expect(only.rankingSnapshot.mmr).toEqual({ relevance: 1, redundancy: 0, score: 0.8, selectedRank: 1 });
    expect(only.rankingSnapshot.mmr?.redundancy).toBe(0);
  });

  it("orders by relevance first when candidates are dissimilar", () => {
    const a = makeScored({ jobId: "a", organicScore: 0.5, employerId: "emp-1", features: { categoryId: "cat-1", jobTypes: [] }, distanceKm: 3 });
    const x = makeScored({ jobId: "x", organicScore: 0.7, employerId: "emp-3", features: { categoryId: "cat-3", jobTypes: [] }, distanceKm: 12 });
    const y = makeScored({ jobId: "y", organicScore: 0.9, employerId: "emp-4", features: { categoryId: "cat-4", jobTypes: [] }, distanceKm: 20 });
    expect(rerankWithMMR([a, x, y]).map((candidate) => candidate.jobId)).toEqual(["y", "x", "a"]);
  });

  it("reshapes the order for a redundancy trade-off: [A, C, B] not [A, B, C]", () => {
    const a = makeScored({ jobId: "a", organicScore: 0.9, features: { categoryId: "cat-1", jobTypes: [] }, distanceKm: 3 });
    const b = makeScored({ jobId: "b", organicScore: 0.85, features: { categoryId: "cat-1", jobTypes: [] }, distanceKm: 3 });
    const c = makeScored({ jobId: "c", organicScore: 0.8, employerId: "emp-2", features: { categoryId: "cat-2", jobTypes: [] }, distanceKm: 3 });
    const result = rerankWithMMR([a, b, c]);

    expect(result.map((candidate) => candidate.jobId)).toEqual(["a", "c", "b"]);

    // A: pure relevance leader (redundancy 0).
    expect(result[0].rankingSnapshot.mmr).toMatchObject({ relevance: 1, redundancy: 0, selectedRank: 1 });
    // C: relevance 0.8/0.9 ≈ 0.8889, redundancy = similarity(A, C) = (0.2·1)/0.8 = 0.25.
    expect(result[1].rankingSnapshot.mmr?.relevance).toBeCloseTo(0.8 / 0.9, 5);
    expect(result[1].rankingSnapshot.mmr?.redundancy).toBeCloseTo(0.25, 5);
    expect(result[1].rankingSnapshot.mmr?.selectedRank).toBe(2);
    // B: identical to A on every similarity dimension ⇒ full redundancy.
    expect(result[2].rankingSnapshot.mmr?.redundancy).toBe(1);
    expect(result[2].rankingSnapshot.mmr?.selectedRank).toBe(3);
    expect(result[2].rankingSnapshot.mmr?.score).toBeCloseTo(0.8 * (0.85 / 0.9) - 0.2 * 1, 5);
  });

  it("applies the same-employer penalty as a soft bias, never a hard block", () => {
    const a = makeScored({ jobId: "a", organicScore: 0.9 });
    const b = makeScored({ jobId: "b", organicScore: 0.89 }); // same employer/category/distance as a
    const c = makeScored({ jobId: "c", organicScore: 0.5, employerId: "emp-2", features: { categoryId: "cat-2", jobTypes: [] }, distanceKm: null });
    const result = rerankWithMMR([a, b, c]);
    expect(result.map((candidate) => candidate.jobId)).toEqual(["a", "b", "c"]);
    expect(result[1].rankingSnapshot.mmr?.redundancy).toBe(1); // full similarity to a, yet kept 2nd
  });

  it("is deterministic for identical inputs", () => {
    const pool = [
      makeScored({ jobId: "a", organicScore: 0.9 }),
      makeScored({ jobId: "b", organicScore: 0.85 }),
      makeScored({ jobId: "c", organicScore: 0.8, employerId: "emp-2", features: { categoryId: "cat-2", jobTypes: [] } }),
    ];
    expect(rerankWithMMR(pool)).toEqual(rerankWithMMR(pool));
  });

  it("never mutates the input array or its candidate objects", () => {
    const input = [
      makeScored({ jobId: "a", organicScore: 0.9 }),
      makeScored({ jobId: "b", organicScore: 0.85 }),
    ];
    const before = JSON.stringify(input);
    const output = rerankWithMMR(input);

    expect(output).not.toBe(input);
    expect(output[0]).not.toBe(input[0]);
    expect(output[0].rankingSnapshot).not.toBe(input[0].rankingSnapshot);
    expect(JSON.stringify(input)).toBe(before);
    expect(input.every((candidate) => candidate.rankingSnapshot.mmr == null)).toBe(true);
  });

  it("handles degenerate organic scores without producing NaN/infinite outputs", () => {
    const pool = [
      makeScored({ jobId: "nan", organicScore: Number.NaN }),
      makeScored({ jobId: "inf", organicScore: Number.POSITIVE_INFINITY, features: { categoryId: null, jobTypes: [] }, distanceKm: null }),
      makeScored({ jobId: "neg", organicScore: -0.5, employerId: "emp-2", features: { categoryId: null, jobTypes: [] }, distanceKm: null }),
      makeScored({ jobId: "ok", organicScore: 0.4 }),
    ];
    const result = rerankWithMMR(pool);
    expect(result).toHaveLength(4);
    for (const candidate of result) {
      const mmr = candidate.rankingSnapshot.mmr!;
      expect(Number.isFinite(mmr.relevance)).toBe(true);
      expect(mmr.relevance).toBeGreaterThanOrEqual(0);
      expect(mmr.relevance).toBeLessThanOrEqual(1);
      expect(Number.isFinite(mmr.redundancy)).toBe(true);
      expect(Number.isFinite(mmr.score)).toBe(true);
      expect(mmr.selectedRank).toBeGreaterThan(0);
    }
    // Only the finite positive organic score has nonzero relevance ⇒ it leads.
    expect(result[0].jobId).toBe("ok");
  });

  it("keeps identical-input ties stable in original order", () => {
    const pool = [
      makeScored({ jobId: "a", organicScore: 0.4 }),
      makeScored({ jobId: "b", organicScore: 0.4 }),
      makeScored({ jobId: "c", organicScore: 0.4 }),
    ];
    expect(rerankWithMMR(pool).map((candidate) => candidate.jobId)).toEqual(["a", "b", "c"]);
  });

  it("preserves every phase 4 field and appends the mmr block", () => {
    const input = makeScored({ jobId: "a", organicScore: 0.9 });
    const [output] = rerankWithMMR([input]);
    const mmr = output.rankingSnapshot.mmr!;
    expect(mmr.selectedRank).toBe(1);
    const { mmr: _removed, ...rest } = output.rankingSnapshot;
    expect(rest).toEqual(input.rankingSnapshot);
    expect(output.organicScore).toBe(input.organicScore);
    expect(output.quality).toEqual(input.quality);
    expect(output.components).toEqual(input.components);
    expect(output.rankingVersion).toBe("v1.0.0");
  });

  describe("limit handling", () => {
    const pool = [
      makeScored({ jobId: "a", organicScore: 0.9 }),
      makeScored({ jobId: "b", organicScore: 0.85 }),
      makeScored({ jobId: "c", organicScore: 0.8, employerId: "emp-2", features: { categoryId: "cat-2", jobTypes: [] } }),
    ];

    it("truncates to the limit (selection is incremental, so the head equals the full run)", () => {
      const full = rerankWithMMR(pool);
      const head = rerankWithMMR(pool, { limit: 2 });
      expect(head).toHaveLength(2);
      expect(head).toEqual(full.slice(0, 2));
      expect(head[1].rankingSnapshot.mmr?.selectedRank).toBe(2);
    });

    it("returns everything when the limit is missing or exceeds the pool", () => {
      expect(rerankWithMMR(pool)).toHaveLength(3);
      expect(rerankWithMMR(pool, { limit: 10 })).toEqual(rerankWithMMR(pool));
    });

    it("treats 0, negative and NaN limits as empty / full results", () => {
      expect(rerankWithMMR(pool, { limit: 0 })).toEqual([]);
      expect(rerankWithMMR(pool, { limit: -1 })).toEqual([]);
      expect(rerankWithMMR(pool, { limit: Number.NaN })).toEqual(rerankWithMMR(pool));
    });

    it("floors fractional limits", () => {
      expect(rerankWithMMR(pool, { limit: 2.7 })).toHaveLength(2);
    });
  });
});

// ---------------------------------------------------------------------------
// Integration: phase 4 → phase 5 handoff
// ---------------------------------------------------------------------------

class InMemoryRankingDatabase implements DatabaseAdapter {
  constructor(private readonly jobs: Record<string, unknown>[]) {}

  async query<Row extends Record<string, unknown> = Record<string, unknown>>(
    statement: string,
    _parameters: readonly SqlParameter[] = [],
  ): Promise<QueryResult<Row>> {
    let raw: Record<string, unknown>[] = [];
    if (statement.startsWith("select id, employer_id, category_id, pay_amount")) {
      raw = this.jobs;
    }
    return { rows: raw as Row[], rowCount: raw.length };
  }

  transaction<T>(work: (database: DatabaseAdapter) => Promise<T>): Promise<T> {
    return work(this);
  }
}

describe("phase 4 → phase 5 handoff", () => {
  it("scoring emits the features MMR needs and re-ranking preserves the pipeline contract", async () => {
    const jobs = [
      {
        id: "top", employer_id: "emp-1", category_id: "cat-1", pay_amount: 20, pay_currency: "USD", pay_type: "hourly",
        location_text: "Remote — worldwide", latitude: 0, longitude: 0, start_date: null, start_time: null, end_time: null,
        created_at: hoursAgoMs(96),
      },
      {
        id: "alt", employer_id: "emp-2", category_id: "cat-2", pay_amount: 10, pay_currency: "USD", pay_type: "hourly",
        location_text: "Downtown", latitude: 0, longitude: 30, start_date: null, start_time: "09:00", end_time: "18:00",
        created_at: hoursAgoMs(96),
      },
    ];
    const candidates: RetrievalCandidate[] = [
      { jobId: "top", employerId: "emp-1", categoryId: "cat-1", createdAt: hoursAgoMs(96), sources: ["general"] },
      { jobId: "alt", employerId: "emp-2", categoryId: "cat-2", createdAt: hoursAgoMs(96), sources: ["general"] },
    ];

    const scored = await new RankingScoringService(new InMemoryRankingDatabase(jobs)).scoreCandidates({
      userId: null,
      userLocation: { latitude: 0, longitude: 0 },
      candidates,
      now: NOW,
    });
    expect(scored).toHaveLength(2);

    const byId = new Map(scored.map((candidate) => [candidate.jobId, candidate]));
    expect(byId.get("top")!.features.categoryId).toBe("cat-1");
    expect(byId.get("top")!.features.jobTypes).toContain("remote");
    expect(byId.get("alt")!.features.jobTypes).toEqual(["full-time"]);

    const reranked = rerankWithMMR(scored);
    expect(reranked).toHaveLength(2);
    expect(reranked[0].jobId).toBe("top");
    expect(reranked[1].jobId).toBe("alt");

    const top = reranked.find((candidate) => candidate.jobId === "top")!;
    const originalTop = byId.get("top")!;
    expect(top.rankingSnapshot.mmr?.selectedRank).toBe(1);
    expect(top.rankingSnapshot.organicScore).toBe(originalTop.rankingSnapshot.organicScore);
    expect(top.rankingSnapshot.sponsored).toBe(false);
    expect(top.quality).toEqual(originalTop.quality);
    expect(top.components).toEqual(originalTop.components);
    expect(top.rankingSnapshot.rankingVersion).toBe("v1.0.0");
  });
});