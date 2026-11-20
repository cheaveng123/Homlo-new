import { describe, expect, it } from "vitest";
import { feedConfig } from "../backend/feed/marmot_tuning_knobs";
import type { ActiveJobBoost, GlobalRates, JobCandidate, Period } from "../backend/feed/finch_shared_shapes";
import {
  eventContribution,
  isNewcomer,
  locationFactor,
  popularityScore,
} from "../backend/feed/walrus_scoring_engine";
import { rankPopularityFeed } from "../backend/feed/kestrel_ranking_pipeline";
import { BOOST_RANKING, resolveActiveBoost } from "../server/hlBoostRanking";

// Ranking equation from docs/FEED_RANKING.md.

const cfg = feedConfig;
const NOW = new Date("2026-11-20T08:00:00Z");
const DAY = 86_400_000;
const zero = () => ({ engagement: 0, impressions: 0 });
const globals: GlobalRates = {
  today: { engagement: 800, impressions: 10_000 },
  week: { engagement: 800, impressions: 10_000 },
  month: { engagement: 800, impressions: 10_000 },
};

function job(n: number, o: Partial<JobCandidate> = {}): JobCandidate {
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    employerId: `emp-${n}`,
    category: `cat-${n}`,
    workArrangement: "on_site",
    jobType: "part_time",
    payMin: null,
    payMax: null,
    payPeriod: null,
    // Old enough not to be a newcomer, so tests isolate one term at a time.
    createdAt: new Date(NOW.getTime() - 20 * DAY),
    positionsLeft: 3,
    employerQuality: null,
    distanceKm: null,
    agg: { today: zero(), week: zero(), month: zero() },
    ...o,
  };
}

function month(engagement: number, impressions: number) {
  return { today: zero(), week: zero(), month: { engagement, impressions } };
}

function boost(jobId: string, o: Partial<ActiveJobBoost> = {}): ActiveJobBoost {
  return {
    jobId,
    packageId: "maximum",
    multiplier: 1.15,
    startsAt: new Date(NOW.getTime() - DAY),
    endsAt: new Date(NOW.getTime() + DAY),
    status: "active",
    ...o,
  };
}

const rank = (candidates: JobCandidate[], boosts: ActiveJobBoost[] = [], period: Period = "month", now = NOW) =>
  rankPopularityFeed({ candidates, period, globals, now, cfg, boosts });
const ids = (list: { job: { id: string } }[]) => list.map((r) => r.job.id);

describe("interaction signals", () => {
  it("weights applies > saves > dwell > views, and recent events count more than old ones", () => {
    expect(eventContribution("apply", 0, "month", cfg)).toBeGreaterThan(eventContribution("save", 0, "month", cfg));
    expect(eventContribution("save", 0, "month", cfg)).toBeGreaterThan(eventContribution("dwell_15s", 0, "month", cfg));
    expect(eventContribution("dwell_15s", 0, "month", cfg)).toBeGreaterThan(eventContribution("view", 0, "month", cfg));
    expect(eventContribution("apply", 1, "month", cfg)).toBeGreaterThan(eventContribution("apply", 25, "month", cfg));
    expect(eventContribution("view", 10, "month", cfg)).toBeCloseTo(0.5, 10); // one half-life
    expect(eventContribution("view", 31, "month", cfg)).toBe(0); // outside the window
  });

  it("orders by engagement rate at equal exposure, and proven jobs beat lucky tiny samples", () => {
    const strong = job(1, { agg: month(300, 1000) });
    const weak = job(2, { agg: month(50, 1000) });
    const lucky = job(3, { agg: month(3, 3) });
    expect(ids(rank([weak, lucky, strong]))[0]).toBe(strong.id);
    expect(ids(rank([weak, strong]))).toEqual([strong.id, weak.id]);
  });
});

describe("boost term", () => {
  it("clamps any multiplier to [1, maxMultiplier]", () => {
    const window = { startsAt: new Date(NOW.getTime() - DAY), endsAt: new Date(NOW.getTime() + DAY) };
    expect(resolveActiveBoost({ jobId: "a", multiplier: 5, ...window }, NOW)?.multiplier).toBe(BOOST_RANKING.maxMultiplier);
    expect(resolveActiveBoost({ jobId: "a", multiplier: 0.5, ...window }, NOW)?.multiplier).toBe(1);
  });

  it("lifts a close competitor by at most +15%", () => {
    const a = job(1, { agg: month(110, 1000) });
    const b = job(2, { agg: month(100, 1000) });
    const ranked = rank([a, b], [boost(b.id, { multiplier: 10 })]);
    const boosted = ranked.find((r) => r.job.id === b.id)!;
    const organic = popularityScore(b, "month", globals, NOW, cfg);
    expect(boosted.score).toBeCloseTo(organic * 1.15, 10);
    expect(boosted.isBoosted).toBe(true);
  });

  it("never buries a clearly more relevant organic job (relevance gate)", () => {
    // Organic scores: jobs 1..9 strong, job 10 is far weaker (< 0.5x the job it would displace).
    const strong = Array.from({ length: 9 }, (_, i) => job(i + 1, { agg: month(400 - i, 1000) }));
    const weak = job(10, { agg: month(10, 1000) });
    const ranked = rank([...strong, weak], [boost(weak.id)]);
    expect(ranked[1].job.id).not.toBe(weak.id);
    expect(ranked.find((r) => r.job.id === weak.id)?.isSponsoredSlot).toBe(false);
    expect(ids(ranked).slice(0, 9)).toEqual(ids(strong.map((job) => ({ job }))));
  });

  it("gives a reasonably relevant boosted job a sponsored rank", () => {
    const jobs = Array.from({ length: 10 }, (_, i) => job(i + 1, { agg: month(300 - i * 10, 1000) }));
    const target = jobs[9];
    const ranked = rank(jobs, [boost(target.id)]);
    expect(ranked[1]).toMatchObject({ isBoosted: true, isSponsoredSlot: true });
    expect(ranked[1].job.id).toBe(target.id);
  });

  it("allows at most 2 boosted jobs per page of 10, even when many top jobs are boosted", () => {
    const jobs = Array.from({ length: 30 }, (_, i) => job(i + 1, { agg: month(300 - i, 1000) }));
    const ranked = rank(jobs, jobs.slice(0, 6).map((j) => boost(j.id)));
    for (let start = 0; start < 30; start += 10) {
      const page = ranked.slice(start, start + 10);
      expect(page.filter((r) => r.isBoosted).length).toBeLessThanOrEqual(BOOST_RANKING.maxBoostedPerPage);
    }
    // The six boosted jobs are spread over three pages instead of filling the first one.
    expect(ranked.slice(0, 10).filter((r) => r.isBoosted)).toHaveLength(2);
    expect(ranked).toHaveLength(30);
    expect(new Set(ids(ranked)).size).toBe(30);
  });

  it("runs out at expiry: expired, future and inactive boosts have no effect", () => {
    const jobs = Array.from({ length: 10 }, (_, i) => job(i + 1, { agg: month(300 - i * 10, 1000) }));
    const target = jobs[9];
    const organic = ids(rank(jobs));
    for (const b of [
      boost(target.id, { endsAt: NOW }), // half-open: ends exactly now
      boost(target.id, { startsAt: new Date(NOW.getTime() + 1000) }),
      boost(target.id, { status: "cancelled" }),
    ]) {
      const ranked = rank(jobs, [b]);
      expect(ids(ranked)).toEqual(organic);
      expect(ranked.some((r) => r.isBoosted)).toBe(false);
    }
    // One millisecond before the end it still counts.
    const live = rank(jobs, [boost(target.id, { endsAt: new Date(NOW.getTime() + 1) })]);
    expect(live[1].job.id).toBe(target.id);
  });

  it("does not boost jobs below the quality floor", () => {
    const jobs = Array.from({ length: 10 }, (_, i) => job(i + 1, { agg: month(300 - i * 10, 1000) }));
    jobs[9] = { ...jobs[9], employerQuality: 0.1 };
    const ranked = rank(jobs, [boost(jobs[9].id)]);
    expect(ranked.some((r) => r.isBoosted)).toBe(false);
  });
});

describe("location term", () => {
  it("is exactly neutral when distance is unknown and favours closer jobs when known", () => {
    expect(locationFactor(null, cfg)).toBe(1);
    expect(locationFactor(0, cfg)).toBeCloseTo(1.2, 10);
    expect(locationFactor(2, cfg)).toBeGreaterThan(locationFactor(20, cfg));
    expect(locationFactor(20, cfg)).toBeGreaterThan(locationFactor(200, cfg));
    expect(locationFactor(500, cfg)).toBeGreaterThanOrEqual(cfg.region.floorFactor);
  });

  it("closer wins at equal engagement; without a location the order ignores distance", () => {
    const far = job(1, { agg: month(100, 1000), distanceKm: 40 });
    const near = job(2, { agg: month(100, 1000), distanceKm: 1 });
    expect(ids(rank([far, near]))).toEqual([near.id, far.id]);

    const strip = (j: JobCandidate) => ({ ...j, distanceKm: null });
    const a = job(3, { agg: month(150, 1000) });
    const b = job(4, { agg: month(120, 1000) });
    const noLoc = rank([a, b].map(strip));
    expect(ids(noLoc)).toEqual([a.id, b.id]);
    for (const r of noLoc) {
      expect(r.score).toBe(popularityScore(r.job, "month", globals, NOW, cfg, { applyRegion: false }));
    }
  });

  it("does not let proximity rescue a clearly weaker job", () => {
    const good = job(1, { agg: month(400, 1000), distanceKm: 30 });
    const poor = job(2, { agg: month(40, 1000), distanceKm: 0.5 });
    expect(ids(rank([poor, good]))[0]).toBe(good.id);
  });
});

describe("cold start", () => {
  it("treats young, under-exposed jobs as newcomers only", () => {
    expect(isNewcomer(job(1, { createdAt: new Date(NOW.getTime() - DAY) }), "month", NOW, cfg)).toBe(true);
    expect(isNewcomer(job(2), "month", NOW, cfg)).toBe(false); // 20 days old
    expect(isNewcomer(job(3, { createdAt: NOW, agg: month(50, 500) }), "month", NOW, cfg)).toBe(false);
  });

  it("guarantees a new job with no views a slot on the first page", () => {
    const proven = Array.from({ length: 12 }, (_, i) => job(i + 1, { agg: month(300 - i, 1000) }));
    const fresh = job(99, { createdAt: new Date(NOW.getTime() - DAY) });
    const ranked = rank([...proven, fresh]);
    const pos = ids(ranked).indexOf(fresh.id);
    expect(pos).toBeGreaterThanOrEqual(0);
    expect(pos).toBeLessThan(cfg.newcomer.everyN);
    expect(ranked).toHaveLength(13);
  });

  it("gives every score a finite value when nothing has data yet", () => {
    const empty: GlobalRates = { today: zero(), week: zero(), month: zero() };
    const jobs = [job(1), job(2, { createdAt: NOW }), job(3, { distanceKm: 5 })];
    const ranked = rankPopularityFeed({ candidates: jobs, period: "week", globals: empty, now: NOW, cfg });
    expect(ranked).toHaveLength(3);
    for (const r of ranked) expect(Number.isFinite(r.score)).toBe(true);
  });
});
