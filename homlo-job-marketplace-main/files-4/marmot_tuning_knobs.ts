/**
 * marmot_tuning_knobs.ts
 * EVERY tunable number for the Homlo Jobs feed backend lives here. Nothing is hardcoded elsewhere.
 * Bump `version` whenever you change a number so you can tell which settings produced which results.
 */
import type { PayPeriod, Period } from './finch_shared_shapes';

export const PERIODS: readonly Period[] = ['today', 'week', 'month'];

export const feedConfig = {
  version: 1,

  /** How much each kind of event is worth. Impressions are the denominator, not a "reward". */
  eventWeights: { view: 1, dwell_15s: 2, save: 4, apply: 8 },

  /**
   * Time windows. Each event is counted with exponential decay (half-life) inside its window.
   * today/week/month also map to the three period chips on the Popular detail page
   * (align the chip labels with these keys).
   */
  periods: {
    today: { windowDays: 1, halfLifeDays: 0.5 },
    week: { windowDays: 7, halfLifeDays: 3 },
    month: { windowDays: 30, halfLifeDays: 10 },
  } as Record<Period, { windowDays: number; halfLifeDays: number }>,

  /** Raw events older than this are deleted by the refresh job. */
  retentionDays: 90,

  /**
   * Bayesian smoothing: a job's rate is pulled toward the global rate until it has real exposure.
   * rate = (engagement + m * globalRate) / (impressions + m),  m = priorImpressions.
   * With little data in the whole app (e.g. only you testing) the global rate is unreliable, so we fall
   * back to fallbackGlobalRate until the app has minGlobalImpressions in that window.
   */
  smoothing: { priorImpressions: 60, fallbackGlobalRate: 0.08, minGlobalImpressions: 200 },

  /** Small bonus for jobs with proven exposure so a lucky 3-impression job can't beat a proven one. */
  confidence: { impressions: 50, weight: 0.25 },

  /** Newer jobs score slightly higher. factor = floor + (1 - floor) * 0.5^(ageDays / halfLifeDays). */
  freshness: { halfLifeDays: 14, floor: 0.8 },

  /** employerQuality (0..1) maps to a multiplier in [min, max]. Unknown quality = neutral 1.0. */
  quality: { min: 0.85, max: 1.1 },

  /** Used by Recommended / Popular / Explore: on-site jobs far from the viewer are damped, never removed. */
  region: { fullScoreWithinKm: 60, falloffKm: 60, floorFactor: 0.25 },

  recommended: { period: 'month' as Period },

  popular: { homePeriod: 'week' as Period, defaultDetailPeriod: 'week' as Period },

  near: {
    radiusKm: 25,
    widenToKm: 60,
    /** If fewer than this many jobs are inside radiusKm, widen once to widenToKm. */
    minResults: 6,
    /** proximity = 1 / (1 + km / proximityScaleKm) */
    proximityScaleKm: 5,
    proximityWeight: 0.6,
    popularityWeight: 0.4,
    period: 'week' as Period,
  },

  explore: {
    period: 'month' as Period,
    popularityWeight: 0.6,
    freshnessWeight: 0.4,
    /** Every Nth slot is given to an under-exposed job so new postings can earn data. */
    explorationEveryN: 5,
    underexposedImpressions: 20,
  },

  variety: { maxConsecutiveSameEmployer: 2, maxConsecutiveSameCategory: 3 },

  home: { recommendedCount: 10, popularCount: 10, nearCount: 10, exploreCount: 12 },

  paging: { defaultPageSize: 20, maxPageSize: 50, maxListItems: 300 },

  /** Max jobs pulled from the database per request before ranking. */
  candidateLimit: 5000,

  /** Optional "fit %" shown ONLY when the user completed quick search. Never based on popularity. */
  fit: {
    weights: { jobType: 0.35, pay: 0.35, distance: 0.3 },
    percentFloor: 55,
    percentCeil: 98,
    /** Need at least this many comparable parts, otherwise fitPercent is null (UI hides the badge). */
    minComponents: 2,
    distanceFullFitKm: 3,
    distanceZeroFitKm: 25,
    payToMonthly: { hourly: 160, daily: 22, weekly: 4.33, monthly: 1, yearly: 1 / 12 } as Record<PayPeriod, number>,
  },
};

export type FeedConfig = typeof feedConfig;

/**
 * The subset the SQL refresh function needs. Paste the output of `refreshJobStatsSql()` into pg_cron
 * (or any scheduler) so the database and the TypeScript use the same numbers.
 */
export function refreshConfigJson(cfg: FeedConfig = feedConfig): string {
  return JSON.stringify({
    eventWeights: cfg.eventWeights,
    periods: cfg.periods,
    retentionDays: cfg.retentionDays,
  });
}

export function refreshJobStatsSql(cfg: FeedConfig = feedConfig): string {
  const json = refreshConfigJson(cfg).replace(/'/g, "''");
  return `select refresh_job_stats('${json}'::jsonb);`;
}
