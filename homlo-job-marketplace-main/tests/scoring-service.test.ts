import { describe, expect, it } from "vitest";

import type { DatabaseAdapter, QueryResult, SqlParameter } from "../backend/infrastructure/database/DatabaseAdapter";
import { haversineKm } from "../backend/ranking/distance";
import type { RetrievalCandidate } from "../backend/ranking/candidate-retrieval";
import {
  type ScoredCandidate,
  type ScoringPreferences,
  baseRelevance,
  combinedQuality,
  decayFactor,
  effectiveBaseWeights,
  freshnessDecay,
  hourlyEquivalent,
  jobQualityEffective,
  locationScore,
  payPercentile,
  qualityMultiplier,
  RankingScoringService,
  urgencyBoost,
} from "../backend/ranking/scoring-service";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const NOW = new Date("2026-08-01T12:00:00.000Z");
const NOW_MS = NOW.getTime();

function hoursAgoMs(hours: number): string {
  return new Date(NOW_MS - hours * 3_600_000).toISOString();
}

function makeJob(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: "job-a",
    employer_id: "11111111-1111-4111-8111-111111111111",
    category_id: "cat-1",
    pay_amount: 10,
    pay_currency: "USD",
    pay_type: "hourly",
    location_text: "Downtown",
    latitude: 0,
    longitude: 0,
    start_date: null,
    start_time: null,
    end_time: null,
    created_at: hoursAgoMs(96),
    ...overrides,
  };
}

function makeCandidate(overrides: Partial<RetrievalCandidate> = {}): RetrievalCandidate {
  return {
    jobId: "job-a",
    employerId: "11111111-1111-4111-8111-111111111111",
    categoryId: "cat-1",
    createdAt: hoursAgoMs(96),
    sources: ["general"],
    ...overrides,
  };
}

function makeQualityRow(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    employer_id: "11111111-1111-4111-8111-111111111111",
    completion_rate_wilson_lb: null,
    positive_review_rate_wilson_lb: null,
    response_rate_wilson_lb: null,
    ...overrides,
  };
}

function makeJobQualityRow(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    job_id: "job-a",
    ctr_wilson_lb: null,
    apply_rate_wilson_lb: null,
    n_events: null,
    ...overrides,
  };
}

function makeEvent(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    event_type: "click",
    occurred_at: new Date(NOW_MS - 3_600_000).toISOString(),
    dwell_time_ms: null,
    employer_id: "11111111-1111-4111-8111-111111111111",
    category_id: "cat-1",
    ...overrides,
  };
}

type FakeRowSets = {
  jobs?: Record<string, unknown>[];
  employerQuality?: Record<string, unknown>[];
  jobQuality?: Record<string, unknown>[];
  events?: Record<string, unknown>[];
};

class InMemoryRankingDatabase implements DatabaseAdapter {
  public queryCount = 0;
  constructor(private readonly rows: FakeRowSets) {}

  async query<Row extends Record<string, unknown> = Record<string, unknown>>(statement: string, _parameters: readonly SqlParameter[] = []): Promise<QueryResult<Row>> {
    this.queryCount += 1;
    let raw: Record<string, unknown>[] = [];
    if (statement.startsWith("select id, employer_id, category_id, pay_amount")) {
      raw = this.rows.jobs ?? [];
    } else if (statement.startsWith("select employer_id, completion_rate_wilson_lb")) {
      raw = this.rows.employerQuality ?? [];
    } else if (statement.startsWith("select job_id, ctr_wilson_lb")) {
      raw = this.rows.jobQuality ?? [];
    } else if (statement.startsWith("select je.event_type")) {
      raw = this.rows.events ?? [];
    }
    return { rows: raw as Row[], rowCount: raw.length };
  }

  transaction<T>(work: (database: DatabaseAdapter) => Promise<T>): Promise<T> {
    return work(this);
  }
}

function score(input: {
  candidates: RetrievalCandidate[];
  jobs: Record<string, unknown>[];
  userId?: string | null;
  userLocation?: { latitude: number; longitude: number } | null;
  preferences?: ScoringPreferences | null;
  employerQuality?: Record<string, unknown>[];
  jobQuality?: Record<string, unknown>[];
  events?: Record<string, unknown>[];
  database?: InMemoryRankingDatabase;
  now?: Date;
}) {
  const database = input.database ?? new InMemoryRankingDatabase({
    jobs: input.jobs,
    employerQuality: input.employerQuality,
    jobQuality: input.jobQuality,
    events: input.events,
  });
  const service = new RankingScoringService(database);
  const result = service.scoreCandidates({
    userId: input.userId ?? null,
    userLocation: input.userLocation ?? null,
    candidates: input.candidates,
    preferences: input.preferences ?? null,
    now: input.now ?? NOW,
  });
  return { database, result };
}

function scoredByJobId(scored: Promise<ScoredCandidate[]>): Promise<Map<string, ScoredCandidate>> {
  return scored.then((list) => new Map(list.map((candidate) => [candidate.jobId, candidate])));
}

// ---------------------------------------------------------------------------
// Pure math: distance + location
// ---------------------------------------------------------------------------

describe("haversineKm", () => {
  it("returns null for unusable coordinates", () => {
    expect(haversineKm(null, { latitude: 0, longitude: 0 })).toBeNull();
    expect(haversineKm({ latitude: 91, longitude: 0 }, { latitude: 0, longitude: 0 })).toBeNull();
    expect(haversineKm({ latitude: 0, longitude: 181 }, { latitude: 0, longitude: 0 })).toBeNull();
  });

  it("returns 0 for identical points and ~111km for one degree of longitude at the equator", () => {
    expect(haversineKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0 })).toBe(0);
    expect(haversineKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 })).toBeCloseTo(111.19, 1);
  });

  it("is symmetric and rejects NaN", () => {
    const a = { latitude: 32.4, longitude: -90.1 };
    const b = { latitude: 40.7, longitude: -74.0 };
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a) as number, 6);
    expect(haversineKm({ latitude: Number.NaN, longitude: 0 }, a)).toBeNull();
  });
});

describe("locationScore", () => {
  it("uses a nonlinear decay bounded to [0, 1]", () => {
    expect(locationScore(0, 3, 0.5)).toBe(1);
    expect(locationScore(3, 3, 0.5)).toBe(0.5);
    expect(locationScore(6, 3, 0.5)).toBeCloseTo(0.2, 5);
    expect(locationScore(1000, 3, 0.5)).toBeCloseTo(0, 3);
  });

  it("falls back to the neutral value when distance or d0 is unavailable", () => {
    expect(locationScore(null, 3, 0.5)).toBe(0.5);
    expect(locationScore(5, 0, 0.5)).toBe(0.5);
  });

  it("accepts negative distances as zero distance", () => {
    expect(locationScore(-5, 3, 0.5)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Pure math: pay
// ---------------------------------------------------------------------------

describe("hourlyEquivalent", () => {
  const opts = { hoursPerDay: 8, shiftHours: 8 } as const;
  it("passes hourly amounts through unchanged", () => {
    expect(hourlyEquivalent(10, "hourly", opts)).toBe(10);
    expect(hourlyEquivalent(12, "hourly", opts)).toBe(12);
  });

  it("divides daily by the assumed hours per day", () => {
    expect(hourlyEquivalent(80, "daily", opts)).toBe(10);
  });

  it("divides fixed by the known shift hours and rejects unknown shifts", () => {
    expect(hourlyEquivalent(160, "fixed", { hoursPerDay: 8, shiftHours: 8 })).toBe(20);
    expect(hourlyEquivalent(160, "fixed", { hoursPerDay: 8, shiftHours: null })).toBeNull();
  });

  it("returns null for non-positive or invalid amounts and unknown pay types", () => {
    expect(hourlyEquivalent(0, "hourly", opts)).toBeNull();
    expect(hourlyEquivalent(-5, "hourly", opts)).toBeNull();
    expect(hourlyEquivalent(Number.NaN, "hourly", opts)).toBeNull();
    expect(hourlyEquivalent(10, "weekly", opts)).toBeNull();
  });
});

describe("payPercentile", () => {
  it("returns the fraction of strictly-lower comparable jobs", () => {
    expect(payPercentile([10, 20, 30], 20)).toBe(0.5);
    expect(payPercentile([10, 20, 30], 30)).toBe(1);
    expect(payPercentile([10, 20, 30], 5)).toBe(0);
  });

  it("resolves ties deterministically by position", () => {
    expect(payPercentile([20, 20, 30], 20)).toBe(0.5);
  });

  it("returns null when the comparison pool is too small", () => {
    expect(payPercentile([10], 10)).toBeNull();
    expect(payPercentile([], 10)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Pure math: decay / freshness / urgency
// ---------------------------------------------------------------------------

describe("decayFactor", () => {
  it("equals 1 now and 0.5 after one half-life", () => {
    expect(decayFactor(0, 30)).toBe(1);
    expect(decayFactor(30 * 86_400_000, 30)).toBeCloseTo(0.5, 5);
  });

  it("is neutral for invalid inputs", () => {
    expect(decayFactor(-1000, 30)).toBe(1);
    expect(decayFactor(Number.NaN, 30)).toBe(1);
    expect(decayFactor(1000, 0)).toBe(1);
  });
});

describe("freshnessDecay", () => {
  it("is 1 when posting time is unknown or now", () => {
    expect(freshnessDecay(null, 60)).toBe(1);
    expect(freshnessDecay(0, 60)).toBe(1);
    expect(freshnessDecay(-5, 60)).toBe(1);
  });

  it("uses exp(-hoursSincePosted / tau)", () => {
    expect(freshnessDecay(60, 60)).toBeCloseTo(Math.exp(-1), 5);
    expect(freshnessDecay(10, 0)).toBe(1);
  });
});

describe("urgencyBoost", () => {
  it("is neutral when start is unknown, started, or beyond spec", () => {
    expect(urgencyBoost(null, 48, 1.5)).toBe(1);
    expect(urgencyBoost(0, 48, 1.5)).toBe(1);
    expect(urgencyBoost(-10, 48, 1.5)).toBe(1);
  });

  it("ramps inside the window and caps at maxBoost", () => {
    expect(urgencyBoost(24, 48, 1.5)).toBeCloseTo(1.25, 5);
    expect(urgencyBoost(1, 48, 1.5)).toBeCloseTo(1 + (47 / 48) * 0.5, 5);
    expect(urgencyBoost(48, 48, 1.5)).toBe(1);
    expect(urgencyBoost(100, 48, 1.5)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Pure math: quality
// ---------------------------------------------------------------------------

describe("quality math", () => {
  it("jobQualityEffective shrinks toward the employer quality with n=0 and toward observed as n grows", () => {
    expect(jobQualityEffective(0, 0.9, 0.3, 50)).toBe(0.3);
    expect(jobQualityEffective(50, 0.9, 0.3, 50)).toBeCloseTo(0.6, 5);
    expect(jobQualityEffective(5000, 0.9, 0.3, 50)).toBeCloseTo(0.8941, 3);
  });

  it("clamps observed quality into [0, 1]", () => {
    expect(jobQualityEffective(50, 2, 0.3, 50)).toBe(0.65);
  });

  it("combines employer and job quality with the configured 0.75/0.25 split", () => {
    expect(combinedQuality(0.8, 0.4, 0.75, 0.25)).toBeCloseTo(0.7, 5);
    expect(combinedQuality(2, 1, 0.75, 0.25)).toBe(1);
  });

  it("maps CombinedQuality to a penalty-only multiplier in [floor, 1]", () => {
    expect(qualityMultiplier(0.5, 0.5, 0.5)).toBe(0.75);
    expect(qualityMultiplier(1, 0.5, 0.5)).toBe(1);
    expect(qualityMultiplier(0, 0.5, 0.5)).toBe(0.5);
    expect(qualityMultiplier(2, 0.5, 0.5)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Pure math: cold-start weights + relevance
// ---------------------------------------------------------------------------

describe("effectiveBaseWeights / baseRelevance", () => {
  it("leaves the configured weights untouched when behavior is available", () => {
    const weights = effectiveBaseWeights(true);
    expect(weights.behavioralAffinity).toBe(0.1);
    expect(weights.location).toBe(0.3);
  });

  it("redistributes the behavioral weight proportionally on cold start and stays normalized", () => {
    const weights = effectiveBaseWeights(false);
    const sum = weights.location + weights.pay + weights.schedule + weights.categoryPreference + weights.jobType + weights.behavioralAffinity;
    expect(sum).toBeCloseTo(1, 5);
    expect(weights.behavioralAffinity).toBe(0);
    expect(weights.location).toBeCloseTo(0.3 / 0.9, 5);
    expect(weights.pay).toBeCloseTo(0.2 / 0.9, 5);
  });

  it("returns the weights unchanged when behavior was already zero", () => {
    const base = { location: 0.5, pay: 0.2, schedule: 0.1, categoryPreference: 0.1, jobType: 0.1, behavioralAffinity: 0 };
    expect(effectiveBaseWeights(false, base)).toEqual(base);
  });

  it("computes the weighted BaseRelevance", () => {
    const components = { location: 1, pay: 0.5, schedule: 0, categoryPreference: 1, jobType: 1, behavioralAffinity: 0 };
    expect(baseRelevance(components, effectiveBaseWeights(true))).toBeCloseTo(0.65, 5);
    expect(baseRelevance(components, effectiveBaseWeights(false))).toBeCloseTo(0.72222, 5);
  });
});

// ---------------------------------------------------------------------------
// Integration: service behaviour
// ---------------------------------------------------------------------------

describe("RankingScoringService", () => {
  it("returns an empty result without hitting the database for an empty pool", async () => {
    const database = new InMemoryRankingDatabase({});
    const service = new RankingScoringService(database);
    await expect(service.scoreCandidates({ candidates: [], now: NOW })).resolves.toEqual([]);
    expect(database.queryCount).toBe(0);
  });

  it("issues a constant number of batch queries (jobs, employer quality, job quality) and drops vanished jobs", async () => {
    const candidates = [
      makeCandidate({ jobId: "job-a" }),
      makeCandidate({ jobId: "job-b" }),
      makeCandidate({ jobId: "job-vanished" }),
    ];
    const { database, result } = score({
      candidates,
      jobs: [makeJob({ id: "job-a" }), makeJob({ id: "job-b" })],
    });
    const scored = await result;
    expect(scored).toHaveLength(2);
    expect(scored.map((candidate) => candidate.jobId).sort()).toEqual(["job-a", "job-b"]);
    expect(database.queryCount).toBe(3);
  });

  it("issues a fourth query for the behavioral load when a user id is present", async () => {
    const { database, result } = score({
      candidates: [makeCandidate()],
      jobs: [makeJob()],
      userId: "22222222-2222-4222-8222-222222222222",
    });
    await result;
    expect(database.queryCount).toBe(4);
  });

  it("cold starts with neutral priors, redistributed weights, and neutral missing-data values", async () => {
    const { result } = score({
      candidates: [makeCandidate()],
      jobs: [makeJob()],
      userLocation: { latitude: 0, longitude: 0 },
    });
    const scored = await scoredByJobId(result);
    const candidate = scored.get("job-a")!;

    expect(candidate.rankingSnapshot.coldStart).toBe(true);
    expect(candidate.rankingSnapshot.sponsored).toBe(false);
    expect(candidate.rankingSnapshot.exploration).toBe(false);
    expect(candidate.rankingSnapshot.rankingVersion).toBe("v1.0.0");

    // distance is zero ⇒ location 1; missing pay sample ⇒ neutral 0.5.
    expect(candidate.components.location).toBe(1);
    expect(candidate.components.pay).toBe(0.5);
    expect(candidate.components.schedule).toBe(1);
    expect(candidate.components.categoryPreference).toBe(0.5);
    expect(candidate.components.jobType).toBe(1);
    expect(candidate.components.behavioralAffinity).toBe(0);

    // Redistributed base weights: behavioral weight split across the other five.
    const coldWeights = effectiveBaseWeights(false);
    expect(candidate.baseRelevance).toBeCloseTo(
      coldWeights.location * 1 + coldWeights.pay * 0.5 + coldWeights.schedule * 1 + coldWeights.categoryPreference * 0.5 + coldWeights.jobType * 1,
      5,
    );

    // Missing quality rows ⇒ neutral prior on both axes, multiplier at floor+scale*0.5.
    expect(candidate.rankingSnapshot.employerQuality).toBe(0.5);
    expect(candidate.rankingSnapshot.jobObservedQuality).toBe(0.5);
    expect(candidate.rankingSnapshot.jobQualityEffective).toBe(0.5);
    expect(candidate.quality.qualityMultiplier).toBe(0.75);

    // Freshness from 96 h posting age; urgency neutral (no start date).
    expect(candidate.rankingSnapshot.freshnessDecay).toBeCloseTo(Math.exp(-96 / 60), 5);
    expect(candidate.rankingSnapshot.urgencyBoost).toBe(1);
    expect(candidate.rankingSnapshot.organicScore).toBeCloseTo(
      candidate.baseRelevance * candidate.quality.qualityMultiplier * candidate.freshnessDecay * candidate.urgencyBoost,
      8,
    );
  });

  it("combines employer and observed job quality with continuous shrinkage", async () => {
    const { result } = score({
      candidates: [makeCandidate(), makeCandidate({ jobId: "job-c" })],
      jobs: [
        makeJob(),
        makeJob({ id: "job-c", created_at: hoursAgoMs(24) }), // older posted job with no job quality row
      ],
      employerQuality: [makeQualityRow({ completion_rate_wilson_lb: 0.9, response_rate_wilson_lb: 0.5 })],
      jobQuality: [makeJobQualityRow({ ctr_wilson_lb: 0.8, apply_rate_wilson_lb: 0.4, n_events: 50 })],
    });
    const scored = await scoredByJobId(result);

    const employerQ = (0.5 * 0.9 + 0.2 * 0.5) / 0.7; // missing positive_review ⇒ renormalized weights
    expect(employerQ).toBeCloseTo(0.7857, 3);

    // job-a: observed (0.5*0.8 + 0.5*0.4) with w=50/100 ⇒ shrink halfway to employer.
    const observed = 0.6;
    const effective = jobQualityEffective(50, observed, employerQ, 50);
    expect(effective).toBeCloseTo(0.6929, 3);
    const combined = combinedQuality(employerQ, effective, 0.75, 0.25);
    expect(combined).toBeCloseTo(0.7625, 3);
    expect(scored.get("job-a")!.quality.qualityMultiplier).toBeCloseTo(qualityMultiplier(combined, 0.5, 0.5), 5);
    expect(scored.get("job-a")!.quality.jobEventCount).toBe(50);

    // job-c: no job_quality row ⇒ employer quality dominates (w=0), freshness 24h.
    expect(scored.get("job-c")!.quality.jobObservedQuality).toBe(0.5);
    expect(scored.get("job-c")!.quality.jobQualityEffective).toBeCloseTo(employerQ, 5);
    expect(scored.get("job-c")!.rankingSnapshot.freshnessDecay).toBeCloseTo(Math.exp(-24 / 60), 5);
  });

  it("computes pay percentiles within the pool's category subset and stays neutral below the sample floor", async () => {
    const low = makeCandidate({ jobId: "job-low" });
    const mid = makeCandidate({ jobId: "job-mid" });
    const high = makeCandidate({ jobId: "job-high" });
    const lone = makeCandidate({ jobId: "job-lone", categoryId: "cat-2" });
    const { result } = score({
      userLocation: { latitude: 0, longitude: 0 },
      candidates: [low, mid, high, lone],
      jobs: [
        makeJob({ id: "job-low", pay_amount: 10 }),
        makeJob({ id: "job-mid", pay_amount: 20 }),
        makeJob({ id: "job-high", pay_amount: 30 }),
        makeJob({ id: "job-lone", category_id: "cat-2", pay_amount: 15 }),
      ],
    });
    const scored = await scoredByJobId(result);
    expect(scored.get("job-low")!.components.pay).toBe(0);
    expect(scored.get("job-mid")!.components.pay).toBe(0.5);
    expect(scored.get("job-high")!.components.pay).toBe(1);
    expect(scored.get("job-lone")!.components.pay).toBe(0.5); // single job in cat-2 bucket
  });

  it("infers job type from deterministic fields (remote, part-time, full-time, weekend)", async () => {
    const preferences: ScoringPreferences = { jobTypes: ["Part-time", "Full-time", "Weekend", "Internship", "Remote"] };
    const candidates = [
      makeCandidate({ jobId: "remote", employerId: "emp-r" }),
      makeCandidate({ jobId: "part-time", employerId: "emp-p" }),
      makeCandidate({ jobId: "full-time", employerId: "emp-f" }),
      makeCandidate({ jobId: "weekend", employerId: "emp-w" }),
      makeCandidate({ jobId: "internship", employerId: "emp-i" }),
    ];
    const { result } = score({
      candidates,
      preferences,
      jobs: [
        makeJob({ id: "remote", employer_id: "emp-r", location_text: "Remote — worldwide", start_time: null, end_time: null }),
        makeJob({ id: "part-time", employer_id: "emp-p", start_time: "09:00", end_time: "13:00" }), // 4 h shift
        makeJob({ id: "full-time", employer_id: "emp-f", start_time: "09:00", end_time: "18:00" }), // 9 h shift
        makeJob({ id: "weekend", employer_id: "emp-w", start_date: "2026-08-01", start_time: "10:00", end_time: "14:00" }), // Saturday
        makeJob({ id: "internship", employer_id: "emp-i", start_time: null, end_time: null }),
      ],
    });
    const scored = await scoredByJobId(result);
    // matched/preferred-inferable: the remote signal is matched, but the other
    // three inferable preferences (part-time, full-time, weekend) are not.
    expect(scored.get("remote")!.components.jobType).toBeCloseTo(1 / 4, 5);
    expect(scored.get("part-time")!.components.jobType).toBeCloseTo(1 / 4, 5); // Part-time matched, others not
    expect(scored.get("full-time")!.components.jobType).toBeCloseTo(1 / 4, 5);
    // The weekend job is also a 4 h shift, so it matches Part-time too ⇒ 2/4.
    expect(scored.get("weekend")!.components.jobType).toBeCloseTo(1 / 2, 5);

    // Internship is not inferable: absence is unknown, never a mismatch.
    const withInternship = await scoredByJobId(score({
      candidates: [makeCandidate({ jobId: "internship", employerId: "emp-i" })],
      preferences: { jobTypes: ["Internship"] },
      jobs: [makeJob({ id: "internship", employer_id: "emp-i", start_time: null, end_time: null })],
    }).result);
    expect(withInternship.get("internship")!.components.jobType).toBe(1);
  });

  it("scores schedule from day + time when both are evaluable and stays neutral otherwise", async () => {
    const job = makeJob({ start_date: "2026-08-01", start_time: "10:00" }); // Saturday morning
    const { result } = score({
      candidates: [makeCandidate()],
      preferences: { availabilityDays: ["Sat", "Sun"], availabilityTime: "Morning" },
      jobs: [job],
    });
    const scored = await scoredByJobId(result);
    expect(scored.get("job-a")!.components.schedule).toBe(1);

    const mismatched = await scoredByJobId(score({
      candidates: [makeCandidate()],
      preferences: { availabilityDays: ["Mon"], availabilityTime: "Night" },
      jobs: [job],
    }).result);
    expect(mismatched.get("job-a")!.components.schedule).toBe(0);

    const partial = await scoredByJobId(score({
      candidates: [makeCandidate()],
      preferences: { availabilityDays: ["Mon"] },
      jobs: [job], // day evaluable (0), time not stated
    }).result);
    expect(partial.get("job-a")!.components.schedule).toBe(0);

    const noStart = await scoredByJobId(score({
      candidates: [makeCandidate()],
      preferences: { availabilityDays: ["Mon"], availabilityTime: "Night" },
      jobs: [makeJob({ start_date: null, start_time: null })],
    }).result);
    expect(noStart.get("job-a")!.components.schedule).toBe(1); // nothing evaluable ⇒ neutral
  });

  it("resolves category preference with explicit matches, mismatches, and affinity blends", async () => {
    const explicit = await scoredByJobId(score({
      candidates: [
        makeCandidate({ jobId: "match" }),
        makeCandidate({ jobId: "mismatch" }),
      ],
      preferences: { categoryIds: ["cat-1"] },
      jobs: [
        makeJob({ id: "match", category_id: "cat-1" }),
        makeJob({ id: "mismatch", category_id: "cat-2" }),
      ],
    }).result);
    expect(explicit.get("match")!.components.categoryPreference).toBe(1);
    expect(explicit.get("mismatch")!.components.categoryPreference).toBe(0.2);

    // Affinity in the job's OWN category blends the explicit mismatch part-way
    // toward that counter-evidence: 0.5*0.2 + 0.5*affinity.
    const blended = await scoredByJobId(score({
      userId: "22222222-2222-4222-8222-222222222222",
      candidates: [makeCandidate({ jobId: "mismatch" })],
      preferences: { categoryIds: ["cat-1"] },
      events: [
        makeEvent({ event_type: "save", category_id: "cat-2" }),
        makeEvent({ event_type: "save", category_id: "cat-2" }),
        makeEvent({ event_type: "save", category_id: "cat-2" }),
        makeEvent({ event_type: "save", category_id: "cat-2" }),
        makeEvent({ event_type: "save", category_id: "cat-2" }),
      ],
      jobs: [makeJob({ id: "mismatch", category_id: "cat-2" })],
    }).result);
    expect(blended.get("mismatch")!.rankingSnapshot.categoryPreferenceScore).toBeCloseTo(0.6, 5);
  });

  it("builds behavioral affinity by feature with the configured hierarchy and excludes reports", async () => {
    const baseEvents = [
      makeEvent({ event_type: "click" }), // cat-1
      makeEvent({ event_type: "share" }), // cat-1
      makeEvent({ event_type: "impression" }), // cat-1
      makeEvent({
        event_type: "view",
        dwell_time_ms: 40_000,
        employer_id: "emp-2",
        category_id: "cat-2",
      }),
      makeEvent({
        event_type: "view",
        dwell_time_ms: 45_000,
        employer_id: "emp-2",
        category_id: "cat-2",
      }),
      makeEvent({ event_type: "save", employer_id: "emp-2", category_id: "cat-2" }),
    ];
    const run = (events: Record<string, unknown>[]) => score({
      userId: "22222222-2222-4222-8222-222222222222",
      candidates: [
        makeCandidate({ jobId: "cat1" }),
        makeCandidate({ jobId: "cat2", employerId: "emp-2", categoryId: "cat-2" }),
      ],
      events,
      jobs: [makeJob({ id: "cat1" }), makeJob({ id: "cat2", employer_id: "emp-2", category_id: "cat-2" })],
    }).result;

    const withoutReport = await scoredByJobId(run(baseEvents));
    // cat-1 raw = click .75 + share .75 + impression .1 = 1.6; cat-2 raw = 3 + 2 + 2 = 7 ⇒ max 7.
    const cat1Affinity = 1.6 / 7;
    expect(withoutReport.get("cat1")!.rankingSnapshot.behavioralAffinity).toBeCloseTo(cat1Affinity, 5);
    expect(withoutReport.get("cat2")!.rankingSnapshot.behavioralAffinity).toBe(1);
    expect(withoutReport.get("cat2")!.rankingSnapshot.coldStart).toBe(false);

    // A report is trust/moderation: it changes neither affinity nor availability.
    const withReport = await scoredByJobId(run([
      ...baseEvents,
      makeEvent({ event_type: "report", employer_id: "emp-2", category_id: "cat-2" }),
    ]));
    expect(withReport.get("cat1")!.rankingSnapshot).toEqual(withoutReport.get("cat1")!.rankingSnapshot);
    expect(withReport.get("cat2")!.rankingSnapshot).toEqual(withoutReport.get("cat2")!.rankingSnapshot);
  });

  it("stays on cold start until enough engagement evidence exists", async () => {
    const { result } = score({
      userId: "22222222-2222-4222-8222-222222222222",
      candidates: [makeCandidate()],
      events: [
        makeEvent({ event_type: "save" }),
        makeEvent({ event_type: "save" }),
        makeEvent({ event_type: "impression" }),
        makeEvent({ event_type: "impression" }),
        makeEvent({ event_type: "impression" }),
      ], // 2 engagements < minEvidenceEvents
      jobs: [makeJob()],
    });
    const scored = await scoredByJobId(result);
    expect(scored.get("job-a")!.rankingSnapshot.coldStart).toBe(true);
    expect(scored.get("job-a")!.components.behavioralAffinity).toBe(0);
    const weights = effectiveBaseWeights(false);
    expect(scored.get("job-a")!.baseRelevance).toBeCloseTo(
      weights.location * scored.get("job-a")!.components.location +
        weights.pay * scored.get("job-a")!.components.pay +
        weights.schedule * scored.get("job-a")!.components.schedule +
        weights.categoryPreference * scored.get("job-a")!.components.categoryPreference +
        weights.jobType * scored.get("job-a")!.components.jobType,
      5,
    );
  });

  it("decays behavioral signals over time", async () => {
    const recent = hoursAgoMs(1);
    const ancient = new Date(NOW_MS - 300 * 86_400_000).toISOString();
    const { result } = score({
      userId: "22222222-2222-4222-8222-222222222222",
      candidates: [
        makeCandidate({ jobId: "recent" }),
        makeCandidate({ jobId: "ancient", employerId: "emp-old", categoryId: "cat-old" }),
      ],
      events: [
        makeEvent({ event_type: "click", occurred_at: recent }),
        makeEvent({ event_type: "click", occurred_at: recent }),
        makeEvent({ event_type: "click", occurred_at: recent }),
        makeEvent({ event_type: "click", occurred_at: ancient, employer_id: "emp-old", category_id: "cat-old" }),
        makeEvent({ event_type: "click", occurred_at: ancient, employer_id: "emp-old", category_id: "cat-old" }),
      ],
      jobs: [
        makeJob({ id: "recent" }),
        makeJob({ id: "ancient", employer_id: "emp-old", category_id: "cat-old" }),
      ],
    });
    const scored = await scoredByJobId(result);
    const recentAffinity = scored.get("recent")!.rankingSnapshot.behavioralAffinity;
    const ancientAffinity = scored.get("ancient")!.rankingSnapshot.behavioralAffinity;
    expect(recentAffinity).toBeGreaterThan(0.9);
    expect(ancientAffinity).toBeLessThan(0.005);
  });

  it("lets a strong negative (hide) offset saved affinity for the same feature", async () => {
    const events = (hide: boolean) => [
      makeEvent({ event_type: "save", employer_id: "emp-1", category_id: "cat-1" }),
      makeEvent({ event_type: "save", employer_id: "emp-2", category_id: "cat-2" }),
      makeEvent({ event_type: "click", employer_id: "emp-1", category_id: "cat-1" }),
      makeEvent({ event_type: "click", employer_id: "emp-2", category_id: "cat-2" }),
      makeEvent({ event_type: "click", employer_id: "emp-2", category_id: "cat-2" }),
      ...(hide ? [makeEvent({ event_type: "hide", employer_id: "emp-1", category_id: "cat-1" })] : []),
    ];
    const run = (hide: boolean) => score({
      userId: "22222222-2222-4222-8222-222222222222",
      candidates: [makeCandidate({ jobId: "cat1", categoryId: "cat-1" })],
      events: events(hide),
      jobs: [makeJob({ id: "cat1", category_id: "cat-1" })],
    }).result.then((list) => list[0]);

    const withoutHide = await run(false);
    const withHide = await run(true);
    expect(withoutHide.rankingSnapshot.coldStart).toBe(false);
    expect(withHide.rankingSnapshot.behavioralAffinity).toBeLessThan(withoutHide.rankingSnapshot.behavioralAffinity);
  });

  it("is deterministic for identical inputs and time-sensitive otherwise", async () => {
    const input = {
      userId: "22222222-2222-4222-8222-222222222222",
      candidates: [makeCandidate(), makeCandidate({ jobId: "job-b" })],
      events: [makeEvent({ event_type: "save" })],
      jobs: [makeJob(), makeJob({ id: "job-b" })],
    };
    const first = await score({ ...input, now: NOW }).result;
    const second = await score({ ...input, now: NOW }).result;
    expect(second).toEqual(first);

    const later = await score({ ...input, now: new Date(NOW_MS + 12 * 3_600_000) }).result;
    expect(later[0].components).toEqual(first[0].components);
    expect(later[0].freshnessDecay).not.toBe(first[0].freshnessDecay);
  });
});