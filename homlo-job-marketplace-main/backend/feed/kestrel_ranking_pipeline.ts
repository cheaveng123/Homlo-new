/**
 * kestrel_ranking_pipeline.ts
 * The Recommended / Popular ranking, as documented in docs/FEED_RANKING.md. Pure: no database, no clock.
 *
 *   final(j) = S(j) x B(j)
 *   S(j)     = R x C x Q x F x L          (walrus_scoring_engine.popularityScore)
 *   B(j)     = clamp(package multiplier, 1, 1.15) while the boost window is open, else 1
 *
 * Order of operations:
 *   1. sort by final score (ties: newer, then id)
 *   2. cold start: every cfg.newcomer.everyN-th slot goes to the best newcomer not already placed
 *   3. cap the list (cfg.paging.maxListItems) and enforce employer / category variety
 *   4. boost placement (server/hlBoostRanking): sponsored ranks 2 and 6 per page of 10, at most
 *      2 boosted jobs per page, relevance gate against the organic job being pushed down
 */
import type { FeedConfig } from './marmot_tuning_knobs';
import type { ActiveJobBoost, GlobalRates, JobCandidate, Period } from './finch_shared_shapes';
import {
  activeBoostsByJob,
  passesBoostQuality,
  rerankFeedWithBoosts,
} from '../../server/hlBoostRanking';
import {
  compareRanked,
  enforceVariety,
  interleaveExploration,
  isNewcomer,
  popularityScore,
  type Ranked,
} from './walrus_scoring_engine';

export interface RankFeedInput {
  candidates: readonly JobCandidate[];
  period: Period;
  globals: GlobalRates;
  now: Date;
  cfg: FeedConfig;
  /** Boost rows for (a superset of) the candidates. Inactive / expired ones are ignored. */
  boosts?: readonly ActiveJobBoost[];
  exclude?: ReadonlySet<string>;
}

interface Scored extends Ranked<JobCandidate> {
  organic: number;
}

export function rankPopularityFeed(input: RankFeedInput): Ranked<JobCandidate>[] {
  const { period, globals, now, cfg } = input;
  const pool = input.exclude ? input.candidates.filter((j) => !input.exclude!.has(j.id)) : input.candidates;
  const active = activeBoostsByJob(input.boosts ?? [], now);

  const scored: Scored[] = pool.map((job) => {
    const organic = popularityScore(job, period, globals, now, cfg);
    const boost = active.get(job.id);
    const multiplier = boost && passesBoostQuality(job.employerQuality) ? boost.multiplier : 1;
    return { job, organic, score: organic * multiplier };
  });
  scored.sort(compareRanked);

  const everyN = cfg.newcomer.everyN;
  const newcomers = everyN > 0 ? scored.filter((r) => isNewcomer(r.job, period, now, cfg)) : [];
  const mixed = newcomers.length > 0 ? interleaveExploration(scored, newcomers, everyN) : scored;
  const varied = enforceVariety(
    mixed.slice(0, cfg.paging.maxListItems),
    cfg.variety.maxConsecutiveSameEmployer,
    cfg.variety.maxConsecutiveSameCategory,
  );

  const ids = new Set(varied.map((r) => r.job.id));
  if (![...active.keys()].some((id) => ids.has(id))) {
    return varied.map(({ job, score }) => ({ job, score }));
  }

  const byId = new Map(varied.map((r) => [r.job.id, r]));
  const placed = rerankFeedWithBoosts(
    varied.map((r) => ({ jobId: r.job.id, baseScore: r.organic, quality: r.job.employerQuality })),
    (input.boosts ?? []).filter((b) => ids.has(b.jobId)),
    now,
    { preserveOrder: true },
  );
  return placed.flatMap((r) => {
    const original = byId.get(r.jobId);
    if (!original) return [];
    return [{
      job: original.job,
      score: original.organic * r.boostMultiplier,
      isBoosted: r.isBoosted,
      isSponsoredSlot: r.isSponsoredSlot,
      boostPackage: r.boostPackage,
      boostMultiplier: r.boostMultiplier,
    }];
  });
}
