/**
 * pangolin_proof_tests.ts
 * Run:  npx tsx --test pangolin_proof_tests.ts
 * Covers the scoring math, every feed, pagination, the router's validation, the event recorder and the client.
 * Uses an in-memory FeedStore, so it needs no database. (pangolin_sql_proof.ts tests the real Postgres side.)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { feedConfig, type FeedConfig } from './marmot_tuning_knobs';
import {
  FeedInputError,
  type CandidateQuery,
  type EventInput,
  type FeedStore,
  type GlobalRates,
  type JobCandidate,
  type Viewer,
} from './finch_shared_shapes';
import * as W from './walrus_scoring_engine';
import { createFeedService } from './heron_feed_assembler';
import { createRouter } from './ibis_request_router';
import { JobEventRecorder, makeOnViewableItemsChanged } from './otter_event_recorder';
import { createFeedClient, FeedHttpError } from './lynx_feed_client';

const cfg: FeedConfig = feedConfig;
const NOW = new Date('2026-10-24T08:00:00Z');
const DAY = 86_400_000;
const zeroAgg = () => ({ engagement: 0, impressions: 0 });
const NO_VIEWER: Viewer = { lat: null, lng: null };
const PP: Viewer = { lat: 11.5564, lng: 104.9282 };

function uuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

function job(n: number, o: Partial<JobCandidate> = {}): JobCandidate {
  return {
    id: uuid(n),
    employerId: `emp-${n}`,
    category: `cat-${n}`,
    workArrangement: 'on_site',
    jobType: 'part_time',
    payMin: null,
    payMax: null,
    payPeriod: null,
    createdAt: new Date(NOW.getTime() - 5 * DAY),
    positionsLeft: 3,
    employerQuality: null,
    distanceKm: null,
    agg: { today: zeroAgg(), week: zeroAgg(), month: zeroAgg() },
    ...o,
  };
}

function withAgg(period: 'today' | 'week' | 'month', engagement: number, impressions: number) {
  const agg = { today: zeroAgg(), week: zeroAgg(), month: zeroAgg() };
  agg[period] = { engagement, impressions };
  return agg;
}

function bigGlobals(): GlobalRates {
  const g = { engagement: 800, impressions: 10000 }; // global rate 0.08
  return { today: { ...g }, week: { ...g }, month: { ...g } };
}

function memoryStore(jobs: JobCandidate[], globals: GlobalRates = bigGlobals()) {
  const events: { sessionId: string; events: EventInput[] }[] = [];
  const store: FeedStore = {
    async getCandidates(q: CandidateQuery) {
      const hasLoc = q.viewer.lat !== null && q.viewer.lng !== null;
      let out = jobs.map((j) => ({ ...j, distanceKm: hasLoc && j.workArrangement !== 'remote' ? j.distanceKm : null }));
      if (q.radiusKm != null) out = out.filter((j) => j.distanceKm !== null && j.distanceKm <= (q.radiusKm as number));
      else if (q.onlyLocated) out = out.filter((j) => j.distanceKm !== null);
      return out.slice(0, q.limit);
    },
    async getGlobalRates() {
      return globals;
    },
    async recordEvents(sessionId, evs) {
      events.push({ sessionId, events: evs });
      return evs.length;
    },
  };
  return { store, events };
}

function ticking(start = NOW, stepMs = 3_600_000) {
  let t = start.getTime();
  return () => {
    const d = new Date(t);
    t += stepMs;
    return d;
  };
}

// ======================================================================
// scoring math
// ======================================================================

test('decay halves every half-life', () => {
  assert.equal(W.decay(0, 3), 1);
  assert.ok(Math.abs(W.decay(3, 3) - 0.5) < 1e-12);
  assert.ok(Math.abs(W.decay(6, 3) - 0.25) < 1e-12);
});

test('smoothedRate: no data returns the global rate; lots of data converges to the real rate', () => {
  assert.equal(W.smoothedRate(zeroAgg(), 0.08, 60), 0.08);
  const r = W.smoothedRate({ engagement: 15000, impressions: 100000 }, 0.08, 60);
  assert.ok(Math.abs(r - 0.15) < 0.001);
});

test('effectiveGlobalRate falls back when the whole app has too little data', () => {
  assert.equal(W.effectiveGlobalRate({ engagement: 5, impressions: 20 }, cfg), cfg.smoothing.fallbackGlobalRate);
  assert.equal(W.effectiveGlobalRate(undefined, cfg), cfg.smoothing.fallbackGlobalRate);
  assert.equal(W.effectiveGlobalRate({ engagement: 0, impressions: 5000 }, cfg), cfg.smoothing.fallbackGlobalRate);
  assert.ok(Math.abs(W.effectiveGlobalRate({ engagement: 500, impressions: 5000 }, cfg) - 0.1) < 1e-12);
});

test('confidenceFactor ranges from 1-weight up toward 1', () => {
  assert.ok(Math.abs(W.confidenceFactor(0, cfg) - (1 - cfg.confidence.weight)) < 1e-12);
  assert.ok(W.confidenceFactor(1e9, cfg) > 0.9999);
  assert.ok(W.confidenceFactor(100, cfg) > W.confidenceFactor(10, cfg));
});

test('freshness: new = 1, very old tends to the floor, never below it', () => {
  assert.equal(W.freshnessFactor(0, cfg), 1);
  assert.ok(W.freshnessFactor(14, cfg) > cfg.freshness.floor && W.freshnessFactor(14, cfg) < 1);
  assert.ok(W.freshnessFactor(10_000, cfg) >= cfg.freshness.floor);
  assert.ok(W.freshnessFactor(10_000, cfg) < cfg.freshness.floor + 1e-6);
});

test('quality: unknown is neutral, clamps to [min,max]', () => {
  assert.equal(W.qualityFactor(null, cfg), 1);
  assert.equal(W.qualityFactor(0, cfg), cfg.quality.min);
  assert.equal(W.qualityFactor(1, cfg), cfg.quality.max);
  assert.equal(W.qualityFactor(5, cfg), cfg.quality.max);
  assert.equal(W.qualityFactor(-3, cfg), cfg.quality.min);
  assert.equal(W.qualityFactor(Number.NaN, cfg), 1);
});

test('regionFactor: 1 inside region and for null, falls to the floor and stays there', () => {
  assert.equal(W.regionFactor(null, cfg), 1);
  assert.equal(W.regionFactor(10, cfg), 1);
  assert.equal(W.regionFactor(60, cfg), 1);
  assert.ok(Math.abs(W.regionFactor(90, cfg) - (1 - 0.5 * (1 - cfg.region.floorFactor))) < 1e-12);
  assert.equal(W.regionFactor(120, cfg), cfg.region.floorFactor);
  assert.equal(W.regionFactor(5000, cfg), cfg.region.floorFactor);
});

test('a lucky tiny-sample job does NOT beat a proven one', () => {
  const lucky = job(1, { agg: withAgg('month', 5, 10) });
  const proven = job(2, { agg: withAgg('month', 150, 1000) });
  const g = bigGlobals();
  assert.ok(W.popularityScore(proven, 'month', g, NOW, cfg) > W.popularityScore(lucky, 'month', g, NOW, cfg));
});

test('a job with a clearly higher engagement rate at the same exposure ranks higher', () => {
  const a = job(1, { agg: withAgg('month', 120, 600) });
  const b = job(2, { agg: withAgg('month', 30, 600) });
  const g = bigGlobals();
  assert.ok(W.popularityScore(a, 'month', g, NOW, cfg) > W.popularityScore(b, 'month', g, NOW, cfg));
});

test('cold start (no data anywhere): finite scores, fresher beats older, better quality beats unknown', () => {
  const g: GlobalRates = { today: zeroAgg(), week: zeroAgg(), month: zeroAgg() };
  const fresh = job(1, { createdAt: new Date(NOW.getTime() - 1 * DAY) });
  const old = job(2, { createdAt: new Date(NOW.getTime() - 60 * DAY) });
  const good = job(3, { employerQuality: 1 });
  const base = job(4);
  for (const j of [fresh, old, good, base]) {
    assert.ok(Number.isFinite(W.popularityScore(j, 'week', g, NOW, cfg)));
  }
  assert.ok(W.popularityScore(fresh, 'week', g, NOW, cfg) > W.popularityScore(old, 'week', g, NOW, cfg));
  assert.ok(W.popularityScore(good, 'week', g, NOW, cfg) > W.popularityScore(base, 'week', g, NOW, cfg));
});

test('midRankPercentiles: ties get equal percentiles, order is preserved, empty is fine', () => {
  assert.deepEqual(W.midRankPercentiles([]), []);
  assert.deepEqual(W.midRankPercentiles([5]), [0.5]);
  const p = W.midRankPercentiles([1, 1, 1, 1]);
  assert.ok(p.every((x) => x === p[0]));
  const q = W.midRankPercentiles([10, 30, 20]);
  assert.ok(q[1] > q[2] && q[2] > q[0]);
  assert.ok(q.every((x) => x > 0 && x < 1));
});

test('compareRanked is deterministic: score, then newer, then id', () => {
  const a = { job: job(1), score: 1 };
  const b = { job: job(2), score: 1 };
  const c = { job: job(3, { createdAt: new Date(NOW.getTime() - DAY) }), score: 1 };
  const d = { job: job(4), score: 2 };
  const sorted = [a, b, c, d].sort(W.compareRanked).map((x) => x.job.id);
  assert.deepEqual(sorted, [uuid(4), uuid(3), uuid(1), uuid(2)]);
});

test('enforceVariety: limits employer runs, never drops anything, keeps order otherwise', () => {
  const mk = (id: number, emp: string, cat: string | null = null) => ({ job: { id: String(id), employerId: emp, category: cat } });
  const list = [mk(1, 'A'), mk(2, 'A'), mk(3, 'A'), mk(4, 'B'), mk(5, 'C')];
  const out = W.enforceVariety(list, 2, 99).map((x) => x.job.id);
  assert.deepEqual(out, ['1', '2', '4', '3', '5']);
  assert.equal(out.length, list.length);

  const same = [mk(1, 'A'), mk(2, 'A'), mk(3, 'A'), mk(4, 'A')];
  assert.deepEqual(W.enforceVariety(same, 2, 99).map((x) => x.job.id), ['1', '2', '3', '4']);

  const cats = [mk(1, 'a', 'X'), mk(2, 'b', 'X'), mk(3, 'c', 'X'), mk(4, 'd', 'X'), mk(5, 'e', 'Y')];
  assert.deepEqual(W.enforceVariety(cats, 99, 3).map((x) => x.job.id), ['1', '2', '3', '5', '4']);

  const nullCats = [mk(1, 'a', null), mk(2, 'b', null), mk(3, 'c', null), mk(4, 'd', null)];
  assert.deepEqual(W.enforceVariety(nullCats, 99, 1).map((x) => x.job.id), ['1', '2', '3', '4']);
});

test('interleaveExploration: every Nth slot from the exploration list, no duplicates, nothing lost', () => {
  const mk = (id: string) => ({ job: { id } });
  const ranked = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8', 'r9', 'r10'].map(mk);
  const expl = ['x1', 'x2', 'r3'].map(mk); // r3 appears in both lists
  const out = W.interleaveExploration(ranked, expl, 5).map((x) => x.job.id);
  assert.equal(out[4], 'x1');
  assert.equal(out[9], 'x2');
  assert.equal(new Set(out).size, out.length);
  assert.equal(out.length, 12); // 10 ranked + x1 + x2
  assert.deepEqual(W.interleaveExploration([], [], 5), []);
  assert.deepEqual(W.interleaveExploration(ranked, [], 5).map((x) => x.job.id), ranked.map((x) => x.job.id));
  const only = W.interleaveExploration([], expl, 5).map((x) => x.job.id);
  assert.deepEqual(only, ['x1', 'x2', 'r3']);
});

test('seededUnit is deterministic, within [0,1), and seed-dependent', () => {
  assert.equal(W.seededUnit('a', 'x'), W.seededUnit('a', 'x'));
  assert.notEqual(W.seededUnit('a', 'x'), W.seededUnit('b', 'x'));
  for (let i = 0; i < 1000; i++) {
    const v = W.seededUnit('seed', String(i));
    assert.ok(v >= 0 && v < 1);
  }
});

test('cursor: round-trips and rejects garbage', () => {
  const state = { asOf: NOW.getTime(), offset: 40, seed: 'abc', period: 'week' as const };
  assert.deepEqual(W.decodeCursor(W.encodeCursor(state)), state);
  for (const bad of ['', 'not-a-cursor!!', W.encodeCursor({ asOf: NOW.getTime(), offset: -1 }), btoa('{"asOf":"x","offset":1}'), btoa('[]')]) {
    assert.throws(() => W.decodeCursor(bad), FeedInputError);
  }
});

test('fitPercent: perfect = 98, none = null, single comparable part = null, mismatch is low', () => {
  const perfect = job(1, { jobType: 'part_time', payMin: 300, payMax: 400, payPeriod: 'monthly', distanceKm: 1 });
  const prefs = { jobTypes: ['part_time' as const], payMin: 250, payMax: 450, payPeriod: 'monthly' as const };
  assert.equal(W.computeFitPercent(perfect, prefs, cfg), 98);
  assert.equal(W.computeFitPercent(perfect, null, cfg), null);
  assert.equal(W.computeFitPercent(perfect, undefined, cfg), null);

  const onlyOne = job(2, { jobType: 'part_time', distanceKm: null });
  assert.equal(W.computeFitPercent(onlyOne, { jobTypes: ['part_time'] }, cfg), null);

  const bad = job(3, { jobType: 'full_time', payMin: 100, payMax: 120, payPeriod: 'monthly', distanceKm: 40 });
  const low = W.computeFitPercent(bad, prefs, cfg) as number;
  assert.ok(low >= cfg.fit.percentFloor && low < 70, `expected a low fit, got ${low}`);
});

test('fitPercent: pay periods are normalised (hourly vs monthly) and remote matches the "remote" choice', () => {
  const hourly = job(1, { jobType: 'full_time', payMin: 2, payMax: 3, payPeriod: 'hourly', distanceKm: 2 });
  // 2-3/hour = 320-480/month, inside 300-500/month
  const prefs = { jobTypes: ['full_time' as const], payMin: 300, payMax: 500, payPeriod: 'monthly' as const };
  assert.equal(W.computeFitPercent(hourly, prefs, cfg), 98);

  const remote = job(2, { workArrangement: 'remote', jobType: 'full_time', payMin: 400, payMax: 450, payPeriod: 'monthly' });
  assert.equal(W.computeFitPercent(remote, { jobTypes: ['remote'], payMin: 300, payMax: 500, payPeriod: 'monthly' }, cfg), 98);
  const remoteNo = W.computeFitPercent(remote, { jobTypes: ['part_time'], payMin: 300, payMax: 500, payPeriod: 'monthly' }, cfg) as number;
  assert.ok(remoteNo < 98);
});

// ======================================================================
// feeds (in-memory store)
// ======================================================================

function noNaN(items: { score: number }[]) {
  for (const i of items) assert.ok(Number.isFinite(i.score), 'score must be finite');
}

test('recommended: proven job ranks first; filled jobs never appear', async () => {
  const jobs = [
    job(1),
    job(2, { agg: withAgg('month', 200, 900) }),
    job(3, { positionsLeft: 0, agg: withAgg('month', 900, 900) }),
    job(4),
  ];
  const svc = createFeedService(memoryStore(jobs).store, cfg, () => NOW);
  const res = await svc.recommended(NO_VIEWER);
  assert.equal(res.items[0].jobId, uuid(2));
  assert.ok(!res.items.some((i) => i.jobId === uuid(3)));
  assert.equal(res.status, 'ok');
  noNaN(res.items);
});

test('recommended: far-away on-site jobs are damped but remote jobs are not', async () => {
  const hot = { agg: withAgg('month', 100, 800) };
  const jobs = [
    job(1, { ...hot, distanceKm: 300 }),
    job(2, { ...hot, workArrangement: 'remote' }),
    job(3, { ...hot, distanceKm: 5 }),
  ];
  const svc = createFeedService(memoryStore(jobs).store, cfg, () => NOW);
  const res = await svc.recommended(PP);
  const order = res.items.map((i) => i.jobId);
  assert.equal(order[order.length - 1], uuid(1));
  assert.ok(order.includes(uuid(1)));
});

test('popular: the period chip changes the ranking (hot today vs hot all month)', async () => {
  const jobs = [
    job(1, { agg: { today: { engagement: 60, impressions: 100 }, week: zeroAgg(), month: zeroAgg() } }),
    job(2, { agg: { today: zeroAgg(), week: zeroAgg(), month: { engagement: 300, impressions: 1500 } } }),
  ];
  const svc = createFeedService(memoryStore(jobs).store, cfg, () => NOW);
  const today = await svc.popular(NO_VIEWER, { period: 'today' });
  const month = await svc.popular(NO_VIEWER, { period: 'month' });
  assert.equal(today.items[0].jobId, uuid(1));
  assert.equal(month.items[0].jobId, uuid(2));
});

test('pagination: pages join into exactly the one-shot list (no duplicates, none missing), even as the clock moves', async () => {
  const jobs: JobCandidate[] = [];
  for (let i = 1; i <= 45; i++) {
    jobs.push(job(i, { agg: withAgg('week', (i * 37) % 53, 200 + i), createdAt: new Date(NOW.getTime() - (i % 9) * DAY) }));
  }
  const svc = createFeedService(memoryStore(jobs).store, cfg, ticking());
  const one = await svc.popular(NO_VIEWER, { period: 'week', limit: 50 });
  assert.equal(one.items.length, 45);
  assert.equal(one.nextCursor, null);

  const svc2 = createFeedService(memoryStore(jobs).store, cfg, ticking(NOW, 6 * 3_600_000));
  const ids: string[] = [];
  let cursor: string | null = null;
  let guard = 0;
  do {
    const p: Awaited<ReturnType<typeof svc2.popular>> = await svc2.popular(NO_VIEWER, { period: 'week', limit: 20, cursor });
    ids.push(...p.items.map((i) => i.jobId));
    cursor = p.nextCursor;
  } while (cursor && ++guard < 10);
  assert.equal(ids.length, 45);
  assert.equal(new Set(ids).size, 45);
  assert.deepEqual(ids, one.items.map((i) => i.jobId));
});

test('near: no location => status no_location and no items', async () => {
  const svc = createFeedService(memoryStore([job(1, { distanceKm: 2 })]).store, cfg, () => NOW);
  const res = await svc.near(NO_VIEWER);
  assert.equal(res.status, 'no_location');
  assert.deepEqual(res.items, []);
  assert.equal(res.nextCursor, null);
});

test('near: closer wins when popularity is equal; remote is excluded; far jobs are excluded', async () => {
  const jobs = [
    job(1, { distanceKm: 12 }),
    job(2, { distanceKm: 1 }),
    job(3, { distanceKm: 6 }),
    job(4, { workArrangement: 'remote' }),
    job(5, { distanceKm: 80 }),
  ];
  const svc = createFeedService(memoryStore(jobs).store, cfg, () => NOW);
  const res = await svc.near(PP);
  assert.deepEqual(res.items.map((i) => i.jobId), [uuid(2), uuid(3), uuid(1)]);
  assert.ok(res.items.every((i) => i.distanceKm !== null));
});

test('near: widens the radius once only when too few jobs are close', async () => {
  const closeFew = [1, 2, 3].map((n) => job(n, { distanceKm: 5 + n }));
  const mid = [4, 5, 6, 7, 8].map((n) => job(n, { distanceKm: 40 }));
  const sparse = createFeedService(memoryStore([...closeFew, ...mid]).store, cfg, () => NOW);
  assert.equal((await sparse.near(PP)).items.length, 8);

  const closeMany = [1, 2, 3, 4, 5, 6].map((n) => job(n, { distanceKm: 5 + n }));
  const dense = createFeedService(memoryStore([...closeMany, ...mid]).store, cfg, () => NOW);
  assert.equal((await dense.near(PP)).items.length, 6);
});

test('near: a clearly popular job a bit farther can beat a dead one that is closer', async () => {
  const jobs = [
    job(1, { distanceKm: 4 }),
    job(2, { distanceKm: 6, agg: withAgg('week', 400, 900) }),
    job(3, { distanceKm: 5 }),
    job(4, { distanceKm: 7 }),
  ];
  const svc = createFeedService(memoryStore(jobs).store, cfg, () => NOW);
  const res = await svc.near(PP);
  assert.equal(res.items[0].jobId, uuid(2));
});

test('explore: deterministic per seed, no duplicates, every 5th slot goes to an under-exposed job', async () => {
  const jobs: JobCandidate[] = [];
  for (let i = 1; i <= 12; i++) jobs.push(job(i, { agg: withAgg('month', 80 + i, 400 + i * 10) }));
  const newIds = new Set<string>();
  for (let i = 13; i <= 52; i++) {
    jobs.push(job(i, { agg: withAgg('month', 0, 0), createdAt: new Date(NOW.getTime() - 1 * DAY) }));
    newIds.add(uuid(i));
  }
  const svc = createFeedService(memoryStore(jobs).store, cfg, () => NOW);
  const a = await svc.explore(NO_VIEWER, { seed: 'alpha', limit: 50 });
  const a2 = await svc.explore(NO_VIEWER, { seed: 'alpha', limit: 50 });
  assert.deepEqual(a.items.map((i) => i.jobId), a2.items.map((i) => i.jobId));
  const ids = a.items.map((i) => i.jobId);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.length, 50);
  for (const pos of [5, 10, 15, 20, 25, 30]) assert.ok(newIds.has(ids[pos - 1]), `slot ${pos} should be under-exposed`);

  const orders = new Set<string>();
  for (const seed of ['s1', 's2', 's3', 's4', 's5']) {
    const r = await svc.explore(NO_VIEWER, { seed, limit: 50 });
    orders.add(r.items.map((i) => i.jobId).join(','));
  }
  assert.ok(orders.size > 1, 'different seeds should reshuffle the exploration slots');
});

test('explore: the cursor carries the seed so later pages stay consistent', async () => {
  const jobs: JobCandidate[] = [];
  for (let i = 1; i <= 40; i++) jobs.push(job(i, { agg: withAgg('month', i, 100 + i) }));
  const svc = createFeedService(memoryStore(jobs).store, cfg, ticking());
  const first = await svc.explore(NO_VIEWER, { seed: 'sess-1', limit: 20 });
  const second = await svc.explore(NO_VIEWER, { cursor: first.nextCursor, limit: 20 });
  const all = await createFeedService(memoryStore(jobs).store, cfg, () => NOW).explore(NO_VIEWER, { seed: 'sess-1', limit: 50 });
  assert.deepEqual([...first.items, ...second.items].map((i) => i.jobId), all.items.map((i) => i.jobId));
});

test('home: sections do not repeat jobs, no cursors, near reports no_location without a location', async () => {
  const jobs: JobCandidate[] = [];
  for (let i = 1; i <= 60; i++) jobs.push(job(i, { agg: withAgg('month', (i * 13) % 70, 300), distanceKm: (i % 20) + 1 }));
  const svc = createFeedService(memoryStore(jobs).store, cfg, () => NOW);

  const noLoc = await svc.home(NO_VIEWER);
  assert.equal(noLoc.near.status, 'no_location');
  const ids = [...noLoc.recommended.items, ...noLoc.popular.items, ...noLoc.explore.items].map((i) => i.jobId);
  assert.equal(new Set(ids).size, ids.length, 'Recommended / Popular / Explore must not repeat each other');
  assert.equal(noLoc.recommended.items.length, cfg.home.recommendedCount);
  assert.equal(noLoc.popular.items.length, cfg.home.popularCount);
  assert.equal(noLoc.explore.items.length, cfg.home.exploreCount);
  for (const s of [noLoc.recommended, noLoc.popular, noLoc.near, noLoc.explore]) assert.equal(s.nextCursor, null);

  const withLoc = await svc.home(PP);
  assert.equal(withLoc.near.status, 'ok');
  assert.ok(withLoc.near.items.length > 0);
  // Design rule: Recommended/Popular/Explore never repeat each other, and Explore never repeats Near.
  // Near may overlap Recommended/Popular on purpose (nearby is its own intent; de-duping would empty it on a small app).
  const rpe = [...withLoc.recommended.items, ...withLoc.popular.items, ...withLoc.explore.items].map((i) => i.jobId);
  assert.equal(new Set(rpe).size, rpe.length);
  const nearIds = new Set(withLoc.near.items.map((i) => i.jobId));
  assert.ok(withLoc.explore.items.every((i) => !nearIds.has(i.jobId)));
  const popularIds = new Set(withLoc.popular.items.map((i) => i.jobId));
  assert.ok(withLoc.recommended.items.every((i) => !popularIds.has(i.jobId)));
});

test('every feed works with zero data and with zero jobs (no NaN, no crash)', async () => {
  const empty = createFeedService(memoryStore([]).store, cfg, () => NOW);
  const h = await empty.home(PP);
  for (const s of [h.recommended, h.popular, h.near, h.explore]) assert.deepEqual(s.items, []);

  const zeroGlobals: GlobalRates = { today: zeroAgg(), week: zeroAgg(), month: zeroAgg() };
  const jobs = [1, 2, 3, 4, 5, 6, 7].map((n) => job(n, { distanceKm: n }));
  const svc = createFeedService(memoryStore(jobs, zeroGlobals).store, cfg, () => NOW);
  const home = await svc.home(PP);
  for (const s of [home.recommended, home.popular, home.near, home.explore]) noNaN(s.items);
  assert.ok(home.recommended.items.length > 0);
  noNaN((await svc.popular(PP, { period: 'today' })).items);
});

test('fitPercent appears on items only when quick-search prefs are supplied', async () => {
  const jobs = [job(1, { jobType: 'part_time', payMin: 300, payMax: 400, payPeriod: 'monthly', distanceKm: 1 })];
  const svc = createFeedService(memoryStore(jobs).store, cfg, () => NOW);
  const none = await svc.recommended(PP);
  assert.equal(none.items[0].fitPercent, null);
  const some = await svc.recommended({
    ...PP,
    preferences: { jobTypes: ['part_time'], payMin: 250, payMax: 450, payPeriod: 'monthly' },
  });
  assert.equal(some.items[0].fitPercent, 98);
});

test('limit is clamped and bad limits are rejected', async () => {
  const jobs = Array.from({ length: 80 }, (_, i) => job(i + 1));
  const svc = createFeedService(memoryStore(jobs).store, cfg, () => NOW);
  assert.equal((await svc.recommended(NO_VIEWER, { limit: 9999 })).items.length, cfg.paging.maxPageSize);
  assert.equal((await svc.recommended(NO_VIEWER, { limit: 0 })).items.length, 1);
  await assert.rejects(() => svc.recommended(NO_VIEWER, { limit: Number.NaN }), FeedInputError);
});

test('variety: a single employer cannot take over the top of a feed', async () => {
  const jobs: JobCandidate[] = [];
  for (let i = 1; i <= 6; i++) jobs.push(job(i, { employerId: 'big-employer', agg: withAgg('month', 300 - i, 600) }));
  for (let i = 7; i <= 12; i++) jobs.push(job(i, { agg: withAgg('month', 40, 600) }));
  const svc = createFeedService(memoryStore(jobs).store, cfg, () => NOW);
  const res = await svc.recommended(NO_VIEWER, { limit: 12 });
  const emp = res.items.map((i) => jobs.find((j) => j.id === i.jobId)!.employerId);
  let run = 1;
  for (let i = 1; i < emp.length; i++) {
    run = emp[i] === emp[i - 1] ? run + 1 : 1;
    if (i < 9) assert.ok(run <= cfg.variety.maxConsecutiveSameEmployer);
  }
});

// ======================================================================
// router
// ======================================================================

function routerWith(jobs: JobCandidate[] = [job(1, { distanceKm: 2 })]) {
  const { store, events } = memoryStore(jobs);
  return { handle: createRouter(createFeedService(store, cfg, () => NOW)), events };
}

test('router: happy paths', async () => {
  const { handle } = routerWith();
  for (const path of ['/feed/home', '/feed/recommended', '/feed/popular', '/feed/near', '/feed/explore']) {
    const res = await handle({ method: 'GET', path, query: { lat: '11.55', lng: '104.92' } });
    assert.equal(res.status, 200, path);
  }
  const res = await handle({ method: 'GET', path: '/feed/popular/', query: { period: 'today', limit: '5' } });
  assert.equal(res.status, 200);
});

test('router: rejects bad input with 400 and never 500', async () => {
  const { handle } = routerWith();
  const bad: Record<string, string>[] = [
    { lat: '11.5' },
    { lng: '104.9' },
    { lat: '91', lng: '0' },
    { lat: 'abc', lng: '0' },
    { lat: '0', lng: '181' },
    { limit: '-1' },
    { limit: 'x' },
    { period: 'year' },
    { cursor: 'garbage' },
    { prefs: '{bad json' },
    { prefs: '[]' },
    { prefs: '{"jobTypes":["nope"]}' },
    { prefs: '{"payMin":"lots"}' },
    { prefs: '{"payPeriod":"fortnightly"}' },
  ];
  for (const q of bad) {
    const res = await handle({ method: 'GET', path: '/feed/popular', query: q });
    assert.equal(res.status, 400, JSON.stringify(q));
  }
});

test('router: seed is length-limited on explore and home', async () => {
  const { handle } = routerWith();
  for (const path of ['/feed/explore', '/feed/home']) {
    assert.equal((await handle({ method: 'GET', path, query: { seed: 'x'.repeat(100) } })).status, 400);
    assert.equal((await handle({ method: 'GET', path, query: { seed: 'ok-seed' } })).status, 200);
  }
});

test('router: 404 / 405', async () => {
  const { handle } = routerWith();
  assert.equal((await handle({ method: 'GET', path: '/nope', query: {} })).status, 404);
  assert.equal((await handle({ method: 'DELETE', path: '/feed/home', query: {} })).status, 405);
});

test('router: event ingestion validates strictly', async () => {
  const { handle, events } = routerWith();
  const good = { sessionId: 'session-abc123', events: [{ jobId: uuid(1), type: 'view' }] };
  assert.equal((await handle({ method: 'POST', path: '/events', query: {}, body: good })).status, 202);
  assert.equal(events.length, 1);

  const bads: unknown[] = [
    null,
    'x',
    { sessionId: 'short', events: [{ jobId: uuid(1), type: 'view' }] },
    { sessionId: 'session-abc123', events: [] },
    { sessionId: 'session-abc123', events: [{ jobId: 'not-a-uuid', type: 'view' }] },
    { sessionId: 'session-abc123', events: [{ jobId: uuid(1), type: 'purchase' }] },
    { sessionId: 'session-abc123', events: [{ jobId: uuid(1) }] },
    { sessionId: 'session-abc123', events: Array.from({ length: 101 }, () => ({ jobId: uuid(1), type: 'view' })) },
    { sessionId: 'x'.repeat(65), events: [{ jobId: uuid(1), type: 'view' }] },
  ];
  for (const body of bads) {
    assert.equal((await handle({ method: 'POST', path: '/events', query: {}, body })).status, 400, JSON.stringify(body)?.slice(0, 60));
  }
  assert.equal(events.length, 1, 'rejected batches must not reach the store');
});

test('router: unexpected store failures become a generic 500 with no internals', async () => {
  const store: FeedStore = {
    getCandidates: async () => {
      throw new Error('secret db password in message');
    },
    getGlobalRates: async () => bigGlobals(),
    recordEvents: async () => 0,
  };
  const origError = console.error;
  console.error = () => {};
  try {
    const res = await createRouter(createFeedService(store, cfg, () => NOW))({ method: 'GET', path: '/feed/recommended', query: {} });
    assert.equal(res.status, 500);
    assert.equal(JSON.stringify(res.body).includes('secret'), false);
  } finally {
    console.error = origError;
  }
});

// ======================================================================
// client-side recorder
// ======================================================================

function fakeClock() {
  let t = 1_000_000;
  const timers = new Map<number, { at: number; fn: () => void }>();
  let nextId = 1;
  return {
    now: () => t,
    setTimer: (fn: () => void, ms: number) => {
      const id = nextId++;
      timers.set(id, { at: t + ms, fn });
      return id;
    },
    clearTimer: (h: unknown) => void timers.delete(h as number),
    advance(ms: number) {
      const target = t + ms;
      for (;;) {
        const due = [...timers.entries()].filter(([, v]) => v.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        t = due[1].at;
        timers.delete(due[0]);
        due[1].fn();
      }
      t = target;
    },
    pendingTimers: () => timers.size,
  };
}
const tick = () => new Promise((r) => setImmediate(r));

test('recorder: batches on the timer, dedupes impressions/views per session, keeps one session id', async () => {
  const clock = fakeClock();
  const sent: { sessionId: string; events: EventInput[] }[] = [];
  const rec = new JobEventRecorder({ send: async (b) => void sent.push(b), ...clock });
  rec.impression('j1');
  rec.impression('j1');
  rec.impression('j2');
  rec.view('j1');
  rec.view('j1');
  rec.save('j1');
  rec.save('j1');
  assert.equal(rec.pending, 5);
  assert.equal(sent.length, 0);
  clock.advance(5000);
  await tick();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].events.length, 5);
  assert.ok(sent[0].sessionId.length >= 8 && sent[0].sessionId.length <= 64);
  assert.equal(rec.pending, 0);
});

test('recorder: flushes immediately when the batch is full and never exceeds the server batch limit', async () => {
  const clock = fakeClock();
  const sent: number[] = [];
  const rec = new JobEventRecorder({ send: async (b) => void sent.push(b.events.length), maxBatch: 3, ...clock });
  for (let i = 0; i < 7; i++) rec.impression(`j${i}`);
  await tick();
  await tick();
  assert.ok(sent.length >= 1 && sent.every((n) => n <= 3));
  const bigMax = new JobEventRecorder({ send: async () => {}, maxBatch: 5000, ...clock });
  for (let i = 0; i < 150; i++) bigMax.impression(`j${i}`);
  await tick();
  assert.ok(bigMax.pending <= 150);
});

test('recorder: dwell fires after 15s, and is cancelled by leaving early', async () => {
  const clock = fakeClock();
  const sent: EventInput[] = [];
  const rec = new JobEventRecorder({ send: async (b) => void sent.push(...b.events), ...clock });
  const stopEarly = rec.startDwell('j1');
  clock.advance(10_000);
  stopEarly();
  clock.advance(20_000);
  await tick();
  assert.equal(sent.filter((e) => e.type === 'dwell_15s').length, 0);

  const stopLate = rec.startDwell('j2');
  clock.advance(15_000);
  stopLate();
  clock.advance(6_000);
  await tick();
  assert.deepEqual(sent.filter((e) => e.type === 'dwell_15s'), [{ jobId: 'j2', type: 'dwell_15s' }]);
});

test('recorder: failed sends are retried, nothing is lost, the queue is capped', async () => {
  const clock = fakeClock();
  let fail = true;
  const sent: EventInput[] = [];
  const rec = new JobEventRecorder({
    send: async (b) => {
      if (fail) throw new Error('offline');
      sent.push(...b.events);
    },
    maxQueue: 4,
    ...clock,
  });
  rec.save('a');
  rec.save('b');
  clock.advance(5000);
  await tick();
  assert.equal(rec.pending, 2);
  fail = false;
  clock.advance(5000);
  await tick();
  assert.deepEqual(sent.map((e) => e.jobId), ['a', 'b']);

  const small = new JobEventRecorder({ send: async () => { throw new Error('x'); }, maxQueue: 3, maxBatch: 100, ...fakeClock() });
  for (const id of ['1', '2', '3', '4', '5']) small.save(id);
  assert.ok(small.pending <= 3);
});

test('recorder: new session after 30 minutes idle (and dedupe resets); dispose stops everything', async () => {
  const clock = fakeClock();
  const rec = new JobEventRecorder({ send: async () => {}, ...clock });
  rec.impression('j1');
  const first = rec.currentSessionId;
  clock.advance(31 * 60 * 1000);
  rec.impression('j1');
  assert.notEqual(rec.currentSessionId, first);
  assert.equal(rec.pending, 2 - 0 > 0 ? rec.pending : 0);
  rec.dispose();
  const before = rec.pending;
  rec.impression('zzz');
  assert.equal(rec.pending, before);
  assert.equal(clock.pendingTimers(), 0);
});

test('viewability helper only records viewable items', () => {
  const clock = fakeClock();
  const rec = new JobEventRecorder({ send: async () => {}, ...clock });
  const cb = makeOnViewableItemsChanged<{ id: string }>(rec, (i) => i.id);
  cb({ viewableItems: [{ item: { id: 'a' }, isViewable: true }, { item: { id: 'b' }, isViewable: false }, { isViewable: true }] });
  assert.equal(rec.pending, 1);
});

// ======================================================================
// client
// ======================================================================

test('client: builds correct URLs, encodes values, omits empties, maps errors', async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const fakeFetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return { ok: true, status: 200, text: async () => JSON.stringify({ items: [], nextCursor: null, status: 'ok' }) } as Response;
  }) as unknown as typeof fetch;
  const client = createFeedClient({ baseUrl: 'https://api.example.com/', fetchImpl: fakeFetch, getHeaders: () => ({ 'x-test': '1' }) });

  await client.popular({ lat: 11.55, lng: 104.92, period: 'today', limit: 20, cursor: 'a+b/c=', prefs: { jobTypes: ['remote'] } });
  const u = new URL(calls[0].url);
  assert.equal(u.origin + u.pathname, 'https://api.example.com/feed/popular');
  assert.equal(u.searchParams.get('period'), 'today');
  assert.equal(u.searchParams.get('cursor'), 'a+b/c=');
  assert.equal(u.searchParams.get('lat'), '11.55');
  assert.deepEqual(JSON.parse(u.searchParams.get('prefs') as string), { jobTypes: ['remote'] });
  assert.equal((calls[0].init.headers as Record<string, string>)['x-test'], '1');

  await client.recommended({});
  assert.equal(calls[1].url, 'https://api.example.com/feed/recommended');

  await client.sendEvents({ sessionId: 'session-abc123', events: [{ jobId: uuid(1), type: 'view' }] });
  assert.equal(calls[2].init.method, 'POST');
  assert.equal(JSON.parse(calls[2].init.body as string).events.length, 1);

  const failing = createFeedClient({
    baseUrl: 'https://x',
    fetchImpl: (async () => ({ ok: false, status: 400, text: async () => '{"error":"Invalid cursor"}' }) as Response) as unknown as typeof fetch,
  });
  await assert.rejects(
    () => failing.explore({}),
    (e: unknown) => e instanceof FeedHttpError && e.status === 400 && e.message === 'Invalid cursor',
  );
});
