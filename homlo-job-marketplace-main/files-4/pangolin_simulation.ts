/**
 * pangolin_simulation.ts
 * Run:  npx tsx pangolin_simulation.ts
 * Since the app has almost no real traffic yet, this fakes it: 150 jobs with a hidden "true appeal",
 * wildly uneven exposure (some jobs seen 5 times, some 600 times), noisy clicks/saves/applies.
 * Then it checks how well each ranking method recovers the truly best jobs, and prints the result.
 * Use it to sanity-check any change to marmot_tuning_knobs.ts before shipping it.
 */
import { feedConfig } from './marmot_tuning_knobs';
import { popularityScore } from './walrus_scoring_engine';
import type { GlobalRates, JobCandidate } from './finch_shared_shapes';

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NOW = new Date('2026-10-24T08:00:00Z');
const w = feedConfig.eventWeights;
const N = 150;

function spearman(a: number[], b: number[]): number {
  const rank = (v: number[]) => {
    const idx = v.map((x, i) => [x, i] as const).sort((p, q) => p[0] - q[0]);
    const r = new Array<number>(v.length);
    idx.forEach(([, i], pos) => (r[i] = pos));
    return r;
  };
  const ra = rank(a);
  const rb = rank(b);
  const n = a.length;
  const d2 = ra.reduce((s, x, i) => s + (x - rb[i]) ** 2, 0);
  return 1 - (6 * d2) / (n * (n * n - 1));
}

function topKOverlap(score: number[], truth: number[], k: number): number {
  const top = (v: number[]) => new Set(v.map((x, i) => [x, i] as const).sort((p, q) => q[0] - p[0]).slice(0, k).map(([, i]) => i));
  const a = top(score);
  const b = top(truth);
  let hit = 0;
  for (const i of a) if (b.has(i)) hit++;
  return hit / k;
}

function trial(seed: number) {
  const rnd = mulberry32(seed);
  const trueValue: number[] = [];
  const jobs: JobCandidate[] = [];
  let totalE = 0;
  let totalI = 0;
  for (let i = 0; i < N; i++) {
    const appeal = 0.03 + rnd() * 0.3; // chance an impression turns into a view
    const exposure = Math.floor(5 + rnd() ** 3 * 600); // heavily skewed: most jobs get little exposure
    let e = 0;
    for (let k = 0; k < exposure; k++) {
      if (rnd() < appeal) {
        e += w.view;
        if (rnd() < 0.5) e += w.dwell_15s;
        if (rnd() < 0.1) e += w.save;
        if (rnd() < 0.05) e += w.apply;
      }
    }
    totalE += e;
    totalI += exposure;
    trueValue.push(appeal);
    jobs.push({
      id: String(i),
      employerId: `e${i}`,
      category: null,
      workArrangement: 'on_site',
      jobType: null,
      payMin: null,
      payMax: null,
      payPeriod: null,
      createdAt: new Date(NOW.getTime() - 5 * 86_400_000),
      positionsLeft: 1,
      employerQuality: null,
      distanceKm: null,
      agg: {
        today: { engagement: 0, impressions: 0 },
        week: { engagement: 0, impressions: 0 },
        month: { engagement: e, impressions: exposure },
      },
    });
  }
  const globals: GlobalRates = {
    today: { engagement: 0, impressions: 0 },
    week: { engagement: 0, impressions: 0 },
    month: { engagement: totalE, impressions: totalI },
  };
  const rawCount = jobs.map((j) => j.agg.month.engagement);
  const rawRate = jobs.map((j) => j.agg.month.engagement / j.agg.month.impressions);
  const ours = jobs.map((j) => popularityScore(j, 'month', globals, NOW, feedConfig));
  return {
    rawCount: [spearman(rawCount, trueValue), topKOverlap(rawCount, trueValue, 10)],
    rawRate: [spearman(rawRate, trueValue), topKOverlap(rawRate, trueValue, 10)],
    ours: [spearman(ours, trueValue), topKOverlap(ours, trueValue, 10)],
  };
}

const T = 40;
const acc = { rawCount: [0, 0], rawRate: [0, 0], ours: [0, 0] };
for (let s = 1; s <= T; s++) {
  const r = trial(s);
  for (const k of ['rawCount', 'rawRate', 'ours'] as const) {
    acc[k][0] += r[k][0] / T;
    acc[k][1] += r[k][1] / T;
  }
}
const row = (name: string, v: number[]) => `${name.padEnd(34)} rank-correlation ${v[0].toFixed(3)}   top-10 hit-rate ${(v[1] * 100).toFixed(0)}%`;
console.log(`Average over ${T} simulated worlds, ${N} jobs each (higher = better, 1.0 = perfect)\n`);
console.log(row('Naive: most engagement (raw count)', acc.rawCount));
console.log(row('Naive: best raw rate', acc.rawRate));
console.log(row('This algorithm (smoothed rate)', acc.ours));
