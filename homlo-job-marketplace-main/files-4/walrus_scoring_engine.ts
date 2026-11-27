/**
 * walrus_scoring_engine.ts
 * Pure functions only: no database, no network, no framework. Everything here is unit-tested.
 */
import type { FeedConfig } from './marmot_tuning_knobs';
import {
  FeedInputError,
  type GlobalRates,
  type JobCandidate,
  type Period,
  type PayPeriod,
  type QuickSearchPrefs,
  type WindowAgg,
} from './finch_shared_shapes';

const MS_PER_DAY = 86_400_000;

export function ageDays(createdAt: Date, now: Date): number {
  return Math.max(0, (now.getTime() - createdAt.getTime()) / MS_PER_DAY);
}

export function decay(days: number, halfLifeDays: number): number {
  return Math.pow(0.5, days / halfLifeDays);
}

/** Global engagement-per-impression for a window, or the configured fallback when the app has too little data. */
export function effectiveGlobalRate(g: WindowAgg | undefined, cfg: FeedConfig): number {
  if (g && g.impressions >= cfg.smoothing.minGlobalImpressions && g.engagement > 0) {
    return g.engagement / g.impressions;
  }
  return cfg.smoothing.fallbackGlobalRate;
}

/** (engagement + m*global) / (impressions + m). Never divides by zero because m > 0. */
export function smoothedRate(agg: WindowAgg, globalRate: number, priorImpressions: number): number {
  return (agg.engagement + priorImpressions * globalRate) / (agg.impressions + priorImpressions);
}

/** In [1 - weight, 1]. 0 impressions => 1 - weight. Lots of impressions => ~1. */
export function confidenceFactor(impressions: number, cfg: FeedConfig): number {
  const c = impressions / (impressions + cfg.confidence.impressions);
  return 1 - cfg.confidence.weight + cfg.confidence.weight * c;
}

export function freshnessFactor(ageInDays: number, cfg: FeedConfig): number {
  const { floor, halfLifeDays } = cfg.freshness;
  return floor + (1 - floor) * decay(ageInDays, halfLifeDays);
}

export function qualityFactor(quality: number | null, cfg: FeedConfig): number {
  if (quality === null || !Number.isFinite(quality)) return 1;
  const q = Math.min(1, Math.max(0, quality));
  return cfg.quality.min + (cfg.quality.max - cfg.quality.min) * q;
}

/** 1 inside the home region, then linear down to floorFactor. No distance (remote / no location) = 1. */
export function regionFactor(distanceKm: number | null, cfg: FeedConfig): number {
  if (distanceKm === null) return 1;
  const { fullScoreWithinKm, falloffKm, floorFactor } = cfg.region;
  if (distanceKm <= fullScoreWithinKm) return 1;
  const t = Math.min(1, (distanceKm - fullScoreWithinKm) / falloffKm);
  return 1 - t * (1 - floorFactor);
}

export function proximityScore(distanceKm: number, cfg: FeedConfig): number {
  return 1 / (1 + Math.max(0, distanceKm) / cfg.near.proximityScaleKm);
}

/**
 * Popularity score for one job in one period:
 *   smoothed rate x confidence x quality x freshness (x region)
 * With zero data everywhere every job gets the same rate, so the order falls back to freshness + quality.
 */
export function popularityScore(
  job: JobCandidate,
  period: Period,
  globals: GlobalRates,
  now: Date,
  cfg: FeedConfig,
  opts: { applyRegion: boolean } = { applyRegion: true },
): number {
  const g = effectiveGlobalRate(globals[period], cfg);
  const agg = job.agg[period];
  const rate = smoothedRate(agg, g, cfg.smoothing.priorImpressions);
  let score =
    rate *
    confidenceFactor(agg.impressions, cfg) *
    qualityFactor(job.employerQuality, cfg) *
    freshnessFactor(ageDays(job.createdAt, now), cfg);
  if (opts.applyRegion) score *= regionFactor(job.distanceKm, cfg);
  return score;
}

/** Mid-rank percentile in (0,1). Equal values get equal percentiles (so a cold start stays neutral). */
export function midRankPercentiles(values: number[]): number[] {
  const n = values.length;
  if (n === 0) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const firstIndex = new Map<number, number>();
  const count = new Map<number, number>();
  sorted.forEach((v, i) => {
    if (!firstIndex.has(v)) firstIndex.set(v, i);
    count.set(v, (count.get(v) ?? 0) + 1);
  });
  return values.map((v) => ((firstIndex.get(v) as number) + 0.5 * (count.get(v) as number)) / n);
}

export interface Ranked<T> {
  job: T;
  score: number;
}

/** score desc, then newer first, then id asc, so the order is fully deterministic. */
export function compareRanked(a: Ranked<JobCandidate>, b: Ranked<JobCandidate>): number {
  if (b.score !== a.score) return b.score - a.score;
  const dt = b.job.createdAt.getTime() - a.job.createdAt.getTime();
  if (dt !== 0) return dt;
  return a.job.id < b.job.id ? -1 : a.job.id > b.job.id ? 1 : 0;
}

/**
 * Stops one employer / one category from filling a whole stretch of the list.
 * Greedy and stable: takes the best remaining job that does not break the run limits.
 * If every remaining job would break a limit, it takes the best one anyway (never drops anything).
 */
export function enforceVariety<T extends { job: { employerId: string; category: string | null } }>(
  sorted: T[],
  maxSameEmployer: number,
  maxSameCategory: number,
): T[] {
  const remaining = sorted.slice();
  const out: T[] = [];
  const trailingRun = (key: (x: T) => string | null, candidate: T): number => {
    const k = key(candidate);
    if (k === null) return 0;
    let run = 0;
    for (let i = out.length - 1; i >= 0 && key(out[i]) === k; i--) run++;
    return run;
  };
  while (remaining.length > 0) {
    let pick = -1;
    for (let i = 0; i < remaining.length; i++) {
      const c = remaining[i];
      if (
        trailingRun((x) => x.job.employerId, c) < maxSameEmployer &&
        trailingRun((x) => x.job.category, c) < maxSameCategory
      ) {
        pick = i;
        break;
      }
    }
    if (pick === -1) pick = 0;
    out.push(remaining.splice(pick, 1)[0]);
  }
  return out;
}

/** Every Nth slot comes from `exploration`; the rest from `ranked`. No duplicates, nothing lost. */
export function interleaveExploration<T extends { job: { id: string } }>(
  ranked: T[],
  exploration: T[],
  everyN: number,
): T[] {
  const used = new Set<string>();
  const out: T[] = [];
  const r = { i: 0 };
  const e = { i: 0 };
  const nextUnused = (list: T[], cursor: { i: number }): T | undefined => {
    while (cursor.i < list.length && used.has(list[cursor.i].job.id)) cursor.i++;
    return cursor.i < list.length ? list[cursor.i++] : undefined;
  };
  let position = 0;
  for (;;) {
    position++;
    let item: T | undefined;
    if (everyN > 0 && position % everyN === 0) item = nextUnused(exploration, e);
    if (!item) item = nextUnused(ranked, r);
    if (!item) item = nextUnused(exploration, e);
    if (!item) break;
    used.add(item.job.id);
    out.push(item);
  }
  return out;
}

/** Deterministic pseudo-random number in [0,1) from (seed, id). FNV-1a. */
export function seededUnit(seed: string, id: string): number {
  let h = 2166136261;
  const s = `${seed}|${id}`;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  }
  return h / 4294967296;
}

// ---------- cursors ----------

export interface CursorState {
  asOf: number;
  offset: number;
  seed?: string;
  period?: Period;
}

function toB64Url(s: string): string {
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64Url(s: string): string {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
}

export function encodeCursor(state: CursorState): string {
  return toB64Url(JSON.stringify(state));
}

export function decodeCursor(cursor: string): CursorState {
  try {
    const parsed = JSON.parse(fromB64Url(cursor)) as CursorState;
    if (
      typeof parsed.asOf !== 'number' ||
      !Number.isFinite(parsed.asOf) ||
      typeof parsed.offset !== 'number' ||
      !Number.isInteger(parsed.offset) ||
      parsed.offset < 0 ||
      (parsed.seed !== undefined && typeof parsed.seed !== 'string')
    ) {
      throw new Error('bad shape');
    }
    return parsed;
  } catch {
    throw new FeedInputError('Invalid cursor');
  }
}

// ---------- optional "fit %" (quick-search only) ----------

export function toMonthlyPay(value: number, period: PayPeriod, cfg: FeedConfig): number {
  return value * cfg.fit.payToMonthly[period];
}

function payFit(job: JobCandidate, prefs: QuickSearchPrefs, cfg: FeedConfig): number | null {
  if (!prefs.payPeriod || job.payPeriod === null) return null;
  const prefLo = prefs.payMin ?? null;
  const prefHi = prefs.payMax ?? null;
  const jobLo = job.payMin ?? job.payMax;
  const jobHi = job.payMax ?? job.payMin;
  if ((prefLo === null && prefHi === null) || jobLo === null || jobHi === null) return null;
  const pLo = toMonthlyPay((prefLo ?? prefHi) as number, prefs.payPeriod, cfg);
  const pHi = toMonthlyPay((prefHi ?? prefLo) as number, prefs.payPeriod, cfg);
  const jLo = toMonthlyPay(jobLo, job.payPeriod, cfg);
  const jHi = toMonthlyPay(jobHi, job.payPeriod, cfg);
  const lo = Math.min(pLo, pHi);
  const hi = Math.max(pLo, pHi);
  const gap = Math.max(0, Math.max(lo - Math.max(jLo, jHi), Math.min(jLo, jHi) - hi));
  if (gap === 0) return 1;
  return Math.max(0, 1 - gap / Math.max(hi, 1));
}

function jobTypeFit(job: JobCandidate, prefs: QuickSearchPrefs): number | null {
  const wanted = prefs.jobTypes;
  if (!wanted || wanted.length === 0) return null;
  if (job.workArrangement === 'remote' && wanted.includes('remote')) return 1;
  if (job.jobType !== null && wanted.includes(job.jobType)) return 1;
  // We only know the job type if the job has one; if neither side can be compared, skip the part.
  if (job.jobType === null && job.workArrangement !== 'remote') return null;
  return 0;
}

function distanceFit(job: JobCandidate, cfg: FeedConfig): number | null {
  if (job.distanceKm === null) return null;
  const { distanceFullFitKm: a, distanceZeroFitKm: b } = cfg.fit;
  if (job.distanceKm <= a) return 1;
  if (job.distanceKm >= b) return 0;
  return 1 - (job.distanceKm - a) / (b - a);
}

/**
 * 55..98, or null. It only exists when the user told us their preferences in quick search,
 * and only counts the parts that can actually be compared. It never reflects popularity.
 */
export function computeFitPercent(
  job: JobCandidate,
  prefs: QuickSearchPrefs | null | undefined,
  cfg: FeedConfig,
): number | null {
  if (!prefs) return null;
  const parts: Array<[number, number]> = [];
  const jt = jobTypeFit(job, prefs);
  if (jt !== null) parts.push([cfg.fit.weights.jobType, jt]);
  const pay = payFit(job, prefs, cfg);
  if (pay !== null) parts.push([cfg.fit.weights.pay, pay]);
  const dist = distanceFit(job, cfg);
  if (dist !== null) parts.push([cfg.fit.weights.distance, dist]);
  if (parts.length < cfg.fit.minComponents) return null;
  const totalW = parts.reduce((s, [w]) => s + w, 0);
  const fit = parts.reduce((s, [w, v]) => s + w * v, 0) / totalW;
  return Math.round(cfg.fit.percentFloor + (cfg.fit.percentCeil - cfg.fit.percentFloor) * fit);
}
