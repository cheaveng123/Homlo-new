import { describe, expect, it } from "vitest";

import { rankingConfig } from "../backend/config/rankingConfig";
import {
  encodeFeedCursor,
  finalFeedAssembly,
  InvalidFeedCursorError,
  parseFeedCursor,
  sanitizePageSize,
  toFeedMetadata,
  validateFeedCursor,
  type FeedCursorPayload,
  type FeedJobDisplay,
} from "../backend/ranking/feed-assembly";
import type { Phase6Candidate } from "../backend/ranking/sponsored-exploration";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VERSION = rankingConfig.version;
const MAX = rankingConfig.feed.pageSizeMax;
const DEFAULT = rankingConfig.feed.pageSizeDefault;

function makePhase6(overrides: Partial<Phase6Candidate> = {}): Phase6Candidate {
  const base = {
    jobId: "job-1",
    employerId: "emp-1",
    components: { location: 1, pay: 0.5, schedule: 1, categoryPreference: 0.5, jobType: 1, behavioralAffinity: 0 },
    baseRelevance: 0.8,
    quality: { employerQuality: 0.5, jobObservedQuality: 0.5, jobQualityEffective: 0.5, combinedQuality: 0.5, qualityMultiplier: 0.75, jobEventCount: 0 },
    freshnessDecay: 1,
    urgencyBoost: 1,
    organicScore: 0.5,
    rankingVersion: VERSION,
    distanceKm: 0,
    features: { categoryId: "cat-1", jobTypes: [] },
    metadata: { coldStart: true, sources: ["general"], trendingVelocity: undefined },
    sponsored: false,
    sponsoredMultiplier: 1,
    exploration: false,
    finalRankingScore: 0.5,
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
      sponsored: merged.sponsored,
      sponsoredEligible: false,
      sponsoredMultiplier: merged.sponsoredMultiplier,
      exploration: merged.exploration,
      coldStart: true,
      finalPreAssemblyScore: merged.finalRankingScore,
      mmr: { relevance: merged.organicScore, redundancy: 0, score: merged.organicScore, selectedRank: 1 },
    },
  } as unknown as Phase6Candidate;
}

function withFinalScore(candidate: Phase6Candidate, score: number): Phase6Candidate {
  return {
    ...candidate,
    finalRankingScore: score,
    rankingSnapshot: { ...candidate.rankingSnapshot, finalPreAssemblyScore: score },
  } as unknown as Phase6Candidate;
}

function withMMR(candidate: Phase6Candidate, score: number, selectedRank: number): Phase6Candidate {
  return {
    ...candidate,
    finalRankingScore: score,
    rankingSnapshot: {
      ...candidate.rankingSnapshot,
      finalPreAssemblyScore: score,
      mmr: { relevance: score, redundancy: 0, score, selectedRank },
    },
  } as unknown as Phase6Candidate;
}

function withSponsored(candidate: Phase6Candidate, multiplier = rankingConfig.sponsored.maxMultiplier): Phase6Candidate {
  return {
    ...candidate,
    sponsored: true,
    sponsoredMultiplier: multiplier,
    finalRankingScore: candidate.finalRankingScore * multiplier,
    rankingSnapshot: { ...candidate.rankingSnapshot, sponsored: true, sponsoredEligible: true, sponsoredMultiplier: multiplier },
  } as unknown as Phase6Candidate;
}

function withoutMMR(candidate: Phase6Candidate): Phase6Candidate {
  return {
    ...candidate,
    finalRankingScore: candidate.organicScore,
    rankingSnapshot: { ...candidate.rankingSnapshot, mmr: undefined, finalPreAssemblyScore: candidate.organicScore },
  } as unknown as Phase6Candidate;
}

function display(id: string, overrides: Partial<FeedJobDisplay> = {}): FeedJobDisplay {
  return {
    jobId: id,
    title: `Title ${id}`,
    description: `Description ${id}`,
    payAmount: 20,
    payCurrency: "USD",
    payType: "hourly",
    locationText: "Remote — worldwide",
    workArrangement: null,
    latitude: 0,
    longitude: 0,
    workersNeeded: 1,
    createdAt: "2026-08-01T00:00:00.000Z",
    category: "Other",
    employerName: null,
    employerPhotoKey: null,
    bannerImage: null,
    ...overrides,
  };
}

function displayMap(ids: readonly string[]): Map<string, FeedJobDisplay> {
  return new Map(ids.map((id, index) => [id, display(id, { jobId: id, title: `Title ${id}`, description: `Description ${index + 1}` })]));
}

function pool(count: number, scoreFor: (index: number) => number): Phase6Candidate[] {
  return Array.from({ length: count }, (_, index) =>
    withMMR(makePhase6({ jobId: `job-${index}`, employerId: `emp-${index}` }), scoreFor(index), index + 1),
  );
}

// ---------------------------------------------------------------------------
// Page-size policy
// ---------------------------------------------------------------------------

describe("sanitizePageSize", () => {
  it("returns the configured default for null, undefined, NaN and non-finite input", () => {
    expect(sanitizePageSize(undefined)).toBe(DEFAULT);
    expect(sanitizePageSize(null)).toBe(DEFAULT);
    expect(sanitizePageSize(Number.NaN)).toBe(DEFAULT);
    expect(sanitizePageSize(Number.POSITIVE_INFINITY)).toBe(DEFAULT);
  });

  it("floors non-integer sizes before bounding", () => {
    expect(sanitizePageSize(5.9)).toBe(5);
    expect(sanitizePageSize(MAX + 0.5)).toBe(MAX);
  });

  it("clamps below 1 to 1 and above the max to the max", () => {
    expect(sanitizePageSize(0)).toBe(1);
    expect(sanitizePageSize(-3)).toBe(1);
    expect(sanitizePageSize(MAX + 100)).toBe(MAX);
    expect(sanitizePageSize(MAX)).toBe(MAX);
  });
});

// ---------------------------------------------------------------------------
// Cursor codec + validation
// ---------------------------------------------------------------------------

describe("cursor codec", () => {
  const payload: FeedCursorPayload = { v: VERSION, s: 0.731, j: "job-7" };

  it("round-trips a payload through encode then parse", () => {
    const cursor = encodeFeedCursor(payload);
    expect(parseFeedCursor(cursor)).toEqual(payload);
  });

  it("emits a URL-safe base64url string (no padding, no +/-/)", () => {
    const cursor = encodeFeedCursor(payload);
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(cursor).not.toContain("=");
    expect(cursor).not.toContain("/");
    expect(cursor).not.toContain("+");
  });

  it("rejects malformed, oversized, padded and non-object payloads", () => {
    expect(parseFeedCursor("")).toBeNull();
    expect(parseFeedCursor("abc")).toBeNull();
    expect(parseFeedCursor("eyJ2IjoiIn0=")).toBeNull(); // base64url with padding '='
    expect(parseFeedCursor("not base64!!")).toBeNull();
    expect(parseFeedCursor("x".repeat(1025))).toBeNull();
    const array = encodeFeedCursor(payload);
    expect(parseFeedCursor(`"${array}"`)).toBeNull();
    expect(parseFeedCursor(encodeFeedCursor({ ...payload, v: "" }))).toBeNull();
    expect(parseFeedCursor(encodeFeedCursor({ ...payload, j: "" }))).toBeNull();
    expect(parseFeedCursor(encodeFeedCursor({ ...payload, s: Number.NaN }))).toBeNull();
    expect(parseFeedCursor(encodeFeedCursor({ ...payload, s: Number.POSITIVE_INFINITY }))).toBeNull();
  });

  it("trims surrounding whitespace before decoding", () => {
    const cursor = encodeFeedCursor(payload);
    expect(parseFeedCursor(`  ${cursor}  `)).toEqual(payload);
  });

  it("validateFeedCursor accepts a valid current-version cursor", () => {
    expect(validateFeedCursor(encodeFeedCursor(payload), VERSION)).toEqual(payload);
  });

  it("validateFeedCursor throws InvalidFeedCursorError on malformed or wrong-version input", () => {
    expect(() => validateFeedCursor("garbage", VERSION)).toThrow(InvalidFeedCursorError);
    expect(() => validateFeedCursor(encodeFeedCursor(payload), "v9.9.9")).toThrow(InvalidFeedCursorError);
    expect(() => validateFeedCursor(encodeFeedCursor({ ...payload, s: Number.NaN }), VERSION)).toThrow(InvalidFeedCursorError);
  });
});

// ---------------------------------------------------------------------------
// Final assembly shape
// ---------------------------------------------------------------------------

describe("finalFeedAssembly — shape", () => {
  it("returns the typed empty contract for an empty pool", () => {
    const result = finalFeedAssembly([]);
    expect(result).toEqual({
      jobs: [],
      total: 0,
      poolSize: 0,
      nextCursor: null,
      hasMore: false,
      rankingVersion: VERSION,
    });
  });

  it("preserves the phase 6 order exactly (never re-sorts by score)", () => {
    const candidates = [
      withMMR(makePhase6({ jobId: "low", organicScore: 0.2 }), 0.2, 1),
      withMMR(makePhase6({ jobId: "high", organicScore: 0.9 }), 0.9, 2),
      withMMR(makePhase6({ jobId: "mid", organicScore: 0.5 }), 0.5, 3),
    ];
    const result = finalFeedAssembly(candidates, { display: displayMap(["low", "high", "mid"]) });
    expect(result.jobs.map((item) => item.job.jobId)).toEqual(["low", "high", "mid"]);
    expect(result.total).toBe(3);
    expect(result.poolSize).toBe(3);
    expect(result.rankingVersion).toBe(VERSION);
  });

  it("assigns contiguous 1-based feed positions over the assembled pool", () => {
    const result = finalFeedAssembly(pool(5, (i) => 1 - i * 0.1), { display: displayMap(["job-0", "job-1", "job-2", "job-3", "job-4"]) });
    expect(result.jobs.map((item) => item.feedPosition)).toEqual([1, 2, 3, 4, 5]);
    for (const item of result.jobs) {
      expect(item.feedPosition).toBe(item.job.jobId === "job-1" ? 2 : item.feedPosition);
      expect(Number.isInteger(item.feedPosition)).toBe(true);
    }
  });

  it("skips candidates whose display row vanished, and renumbers positions contiguously", () => {
    const candidates = pool(4, (i) => 1 - i * 0.1);
    const result = finalFeedAssembly(candidates, { display: displayMap(["job-0", "job-2", "job-3"]) });
    expect(result.total).toBe(3);
    expect(result.poolSize).toBe(4);
    expect(result.jobs.map((item) => item.job.jobId)).toEqual(["job-0", "job-2", "job-3"]);
    expect(result.jobs.map((item) => item.feedPosition)).toEqual([1, 2, 3]);
  });

  it("deduplicates repeated job ids keeping the first occurrence (matching phase 6)", () => {
    const first = withMMR(makePhase6({ jobId: "dup", organicScore: 0.9 }), 0.9, 1);
    const second = withMMR(makePhase6({ jobId: "dup", organicScore: 0.1, employerId: "emp-other" }), 0.1, 2);
    const result = finalFeedAssembly([first, second], { display: displayMap(["dup"]) });
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0].job.jobId).toBe("dup");
    expect(result.jobs[0].rankingMetadata.organicScore).toBe(0.9);
    expect(result.total).toBe(1);
  });

  it("skips null/garbage pool entries defensively", () => {
    const candidates: Phase6Candidate[] = [
      null as unknown as Phase6Candidate,
      makePhase6({ jobId: "a" }) as Phase6Candidate,
      undefined as unknown as Phase6Candidate,
    ];
    const result = finalFeedAssembly(candidates, { display: displayMap(["a"]) });
    expect(result.jobs.map((item) => item.job.jobId)).toEqual(["a"]);
    expect(result.total).toBe(1);
  });

  it("never mutates the input pool or the display map", () => {
    const candidates = pool(3, (i) => 0.9 - i * 0.1);
    const map = displayMap(["job-0", "job-1", "job-2"]);
    const before = JSON.stringify(candidates);
    const mapBefore = JSON.stringify([...map.entries()]);
    const result = finalFeedAssembly(candidates, { display: map });
    expect(result.jobs).not.toBe(candidates);
    expect(result.jobs[0]).not.toBe(candidates[0]);
    expect(JSON.stringify(candidates)).toBe(before);
    expect(JSON.stringify([...map.entries()])).toBe(mapBefore);
  });
});

// ---------------------------------------------------------------------------
// Ranking metadata
// ---------------------------------------------------------------------------

describe("finalFeedAssembly — ranking metadata", () => {
  it("exposes the curated snapshot fields on every item", () => {
    const candidate = withSponsored(withMMR(makePhase6({ jobId: "s", organicScore: 0.7, distanceKm: null }), 0.7, 3), rankingConfig.sponsored.maxMultiplier);
    const result = finalFeedAssembly([candidate], { display: displayMap(["s"]) });
    const metadata = result.jobs[0].rankingMetadata;
    expect(metadata.rankingVersion).toBe(VERSION);
    expect(metadata.sponsored).toBe(true);
    expect(metadata.sponsoredEligible).toBe(true);
    expect(metadata.sponsoredMultiplier).toBeCloseTo(rankingConfig.sponsored.maxMultiplier, 6);
    expect(metadata.exploration).toBe(false);
    expect(metadata.mmrScore).toBe(0.7);
    expect(metadata.mmrSelectedRank).toBe(3);
    expect(metadata.finalRankingScore).toBeCloseTo(0.7 * rankingConfig.sponsored.maxMultiplier, 6);
    expect(metadata.distanceKm).toBeNull();
    expect(metadata.combinedQuality).toBe(0.5);
    expect(metadata.coldStart).toBe(true);
  });

  it("reflects null MMR fields when MMR is absent", () => {
    const candidate = withoutMMR(makePhase6({ jobId: "no-mmr", organicScore: 0.4, distanceKm: 5 }));
    const result = finalFeedAssembly([candidate], { display: displayMap(["no-mmr"]) });
    const metadata = result.jobs[0].rankingMetadata;
    expect(metadata.mmrScore).toBeNull();
    expect(metadata.mmrSelectedRank).toBeNull();
    expect(metadata.finalRankingScore).toBe(candidate.finalRankingScore);
    expect(metadata.distanceKm).toBe(5);
  });

  it("toFeedMetadata never throws on a non-sponsored candidate without sponsoredEligible", () => {
    const candidate = makePhase6({ jobId: "plain", exploration: true });
    const metadata = toFeedMetadata(candidate);
    expect(metadata.sponsored).toBe(false);
    expect(metadata.sponsoredEligible).toBe(false);
    expect(metadata.exploration).toBe(true);
    expect(metadata.sponsoredMultiplier).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

describe("finalFeedAssembly — pagination", () => {
  it("slices one page and emits a nextCursor when more items exist", () => {
    const result = finalFeedAssembly(pool(8, (i) => 1 - i * 0.05), { display: displayMap(["job-0", "job-1", "job-2", "job-3", "job-4", "job-5", "job-6", "job-7"]), pageSize: 3 });
    expect(result.jobs).toHaveLength(3);
    expect(result.jobs[0].feedPosition).toBe(1);
    expect(result.jobs[2].feedPosition).toBe(3);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).not.toBeNull();
    const last = result.jobs[result.jobs.length - 1];
    expect(parseFeedCursor(result.nextCursor!)).toEqual({
      v: VERSION,
      s: last.rankingMetadata.finalRankingScore,
      j: last.job.jobId,
    });
  });

  it("walks a multi-page feed with no duplicates and contiguous positions", async () => {
    const ids = Array.from({ length: 8 }, (_, i) => `job-${i}`);
    const candidates = pool(8, (i) => 1 - i * 0.05);
    const displayMapFor = displayMap(ids);

    const seen: FeedJobDisplay[] = [];
    let cursor: string | null = null;
    do {
      const page = finalFeedAssembly(candidates, { display: displayMapFor, pageSize: 3, cursor: cursor ? validateFeedCursor(cursor, VERSION) : null });
      seen.push(...page.jobs.map((item) => item.job));
      cursor = page.nextCursor;
      expect(page.hasMore).toBe(cursor !== null);
      if (!page.hasMore) break;
    } while (cursor);

    expect(seen).toHaveLength(8);
    expect(new Set(seen.map((job) => job.jobId)).size).toBe(8);
    expect(seen.map((job) => job.jobId)).toEqual(ids);
  });

  it("returns an empty page with hasMore false when the cursor points at the very last item", () => {
    const candidates = pool(4, (i) => 0.8 - i * 0.1);
    const map = displayMap(["job-0", "job-1", "job-2", "job-3"]);
    // Cursor anchored to the last assembled item derived from an earlier page.
    const first = finalFeedAssembly(candidates, { display: map, pageSize: 4 });
    expect(first.hasMore).toBe(false);
    const lastItem = first.jobs[first.jobs.length - 1];
    const lastCursor = encodeFeedCursor({ v: VERSION, s: lastItem.rankingMetadata.finalRankingScore, j: lastItem.job.jobId });
    const final = finalFeedAssembly(candidates, { display: map, pageSize: 2, cursor: validateFeedCursor(lastCursor, VERSION) });
    expect(final.jobs).toHaveLength(0);
    expect(final.hasMore).toBe(false);
    expect(final.nextCursor).toBeNull();
  });

  it("anchors resumption on the exact (score, jobId) pair", () => {
    const candidates = pool(5, () => 0.7); // all tied
    const map = displayMap(["job-0", "job-1", "job-2", "job-3", "job-4"]);
    const first = finalFeedAssembly(candidates, { display: map, pageSize: 2 });
    expect(first.hasMore).toBe(true);
    const second = finalFeedAssembly(candidates, { display: map, pageSize: 2, cursor: validateFeedCursor(first.nextCursor!, VERSION) });
    expect(second.jobs.map((item) => item.job.jobId)).toEqual(["job-2", "job-3"]);
    expect(second.jobs.map((item) => item.feedPosition)).toEqual([3, 4]);
  });

  it("rejects a stale cursor that names an unknown job", () => {
    const candidates = pool(3, (i) => 0.8 - i * 0.1);
    const cursor = encodeFeedCursor({ v: VERSION, s: 0.8, j: "ghost-job" });
    expect(() => finalFeedAssembly(candidates, { display: displayMap(["job-0", "job-1", "job-2"]), cursor: validateFeedCursor(cursor, VERSION) }))
      .toThrow(InvalidFeedCursorError);
  });

  it("rejects a stale cursor whose job no longer carries the anchored score", () => {
    const candidates = pool(3, (i) => 0.8 - i * 0.1);
    const cursor = encodeFeedCursor({ v: VERSION, s: 0.42, j: "job-0" }); // job-0 now scores 0.8
    expect(() => finalFeedAssembly(candidates, { display: displayMap(["job-0", "job-1", "job-2"]), cursor: validateFeedCursor(cursor, VERSION) }))
      .toThrow(InvalidFeedCursorError);
  });

  it("rejects a version-mismatched cursor even when the score/job pair is otherwise valid", () => {
    const candidates = pool(3, (i) => 0.8 - i * 0.1);
    const cursor = encodeFeedCursor({ v: "v9.9.9", s: 0.8, j: "job-0" });
    expect(() => finalFeedAssembly(candidates, { display: displayMap(["job-0", "job-1", "job-2"]), cursor: validateFeedCursor(cursor, VERSION) }))
      .toThrow(InvalidFeedCursorError);
  });

  it("serves the whole pool on a single page when pageSize exceeds it", () => {
    const result = finalFeedAssembly(pool(3, (i) => 0.9 - i * 0.1), { display: displayMap(["job-0", "job-1", "job-2"]), pageSize: 50 });
    expect(result.jobs).toHaveLength(3);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it("is deterministic: identical inputs produce identical output", () => {
    const candidates = pool(6, (i) => 0.9 - i * 0.07);
    const map = displayMap(["job-0", "job-1", "job-2", "job-3", "job-4", "job-5"]);
    const a = finalFeedAssembly(candidates, { display: map, pageSize: 4 });
    const b = finalFeedAssembly(candidates, { display: map, pageSize: 4 });
    expect(a).toEqual(b);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("finalFeedAssembly — edge cases", () => {
  it("sanitizes the page size before slicing (0 → 1, NaN → default)", () => {
    const candidates = pool(2, (i) => 0.9 - i * 0.1);
    const map = displayMap(["job-0", "job-1"]);
    expect(finalFeedAssembly(candidates, { display: map, pageSize: 0 }).jobs).toHaveLength(1);
    expect(finalFeedAssembly(candidates, { display: map, pageSize: Number.NaN }).hasMore).toBe(false);
  });

  it("keeps positions exact when display rows come back in a different order than the pool", () => {
    const candidates = pool(3, (i) => 0.9 - i * 0.1);
    // Deliberately inserted in reverse map insertion order.
    const map = displayMap(["job-2", "job-0", "job-1"]);
    const result = finalFeedAssembly(candidates, { display: map });
    expect(result.jobs.map((item) => item.job.jobId)).toEqual(["job-0", "job-1", "job-2"]);
    expect(result.jobs.map((item) => item.feedPosition)).toEqual([1, 2, 3]);
  });
});