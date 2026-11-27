/**
 * heron_feed_assembler.ts
 * Builds every feed from anonymous, popularity-based signals. Framework-agnostic: needs only a FeedStore.
 *
 * Sections:  recommended | popular (home + detail with period chips) | near | explore | home (all at once)
 * Nothing here knows who the user is. The only per-viewer inputs are coarse location and (optionally)
 * the quick-search answers, used only for the optional fitPercent badge.
 */
import { feedConfig, type FeedConfig } from './marmot_tuning_knobs';
import {
  FeedInputError,
  type EventInput,
  type FeedItem,
  type FeedPage,
  type FeedStore,
  type GlobalRates,
  type HomeFeed,
  type JobCandidate,
  type Period,
  type Viewer,
} from './finch_shared_shapes';
import { rerankFeedWithBoosts } from '../../server/hlBoostRanking';
import { rankPopularityFeed } from './kestrel_ranking_pipeline';
import type { ActiveJobBoost } from './finch_shared_shapes';
import {
  compareRanked,
  computeFitPercent,
  decodeCursor,
  encodeCursor,
  enforceVariety,
  freshnessFactor,
  ageDays,
  interleaveExploration,
  midRankPercentiles,
  popularityScore,
  proximityScore,
  seededUnit,
  type Ranked,
} from './walrus_scoring_engine';

export interface PageOpts {
  cursor?: string | null;
  limit?: number;
  /** Internal use by home(): jobs already shown in another section. */
  excludeIds?: ReadonlySet<string>;
}

export interface FeedService {
  home(viewer: Viewer, opts?: { seed?: string }): Promise<HomeFeed>;
  recommended(viewer: Viewer, opts?: PageOpts): Promise<FeedPage>;
  popular(viewer: Viewer, opts?: PageOpts & { period?: Period }): Promise<FeedPage>;
  near(viewer: Viewer, opts?: PageOpts): Promise<FeedPage>;
  explore(viewer: Viewer, opts?: PageOpts & { seed?: string }): Promise<FeedPage>;
  recordEvents(sessionId: string, events: EventInput[]): Promise<number>;
}

interface Context {
  now: Date;
  globals: GlobalRates;
  /** Region-aware candidates for Recommended / Popular / Explore. */
  general: JobCandidate[];
  /** Active boosts for `general`, loaded once so the boost term can shape the ranking itself. */
  boosts: ActiveJobBoost[];
}

export function createFeedService(
  store: FeedStore,
  cfg: FeedConfig = feedConfig,
  clock: () => Date = () => new Date(),
): FeedService {
  // ---------- helpers ----------

  const clampLimit = (limit: number | undefined, fallback: number): number => {
    const l = limit ?? fallback;
    if (!Number.isFinite(l)) throw new FeedInputError('Invalid limit');
    return Math.min(cfg.paging.maxPageSize, Math.max(1, Math.floor(l)));
  };

  const startState = (cursor: string | null | undefined) => {
    if (cursor) {
      const c = decodeCursor(cursor);
      return { now: new Date(c.asOf), offset: c.offset, seed: c.seed };
    }
    return { now: clock(), offset: 0, seed: undefined as string | undefined };
  };

  const loadBoosts = async (ids: string[], now: Date): Promise<ActiveJobBoost[]> => {
    const getActiveBoosts = store.getActiveBoosts;
    if (!getActiveBoosts || ids.length === 0) return [];
    try {
      return await getActiveBoosts.call(store, ids, now);
    } catch (error) {
      console.error('[feed] boost lookup failed; serving organic order', error);
      return [];
    }
  };

  const isShowable = (j: JobCandidate): boolean => j.positionsLeft === null || j.positionsLeft > 0;

  const loadContext = async (viewer: Viewer, now: Date): Promise<Context> => {
    const [general, globals] = await Promise.all([
      store.getCandidates({ viewer, limit: cfg.candidateLimit }),
      store.getGlobalRates(),
    ]);
    const showable = general.filter(isShowable);
    return { now, globals, general: showable, boosts: await loadBoosts(showable.map((j) => j.id), now) };
  };

  const toItem = (r: Ranked<JobCandidate>, viewer: Viewer): FeedItem => ({
    jobId: r.job.id,
    score: r.score,
    distanceKm: r.job.distanceKm,
    fitPercent: computeFitPercent(r.job, viewer.preferences, cfg),
    ...(r.isBoosted === true ? { isBoosted: true, boost: { isSponsored: true as const } } : {}),
    ...(r.isSponsoredSlot === true ? { isSponsoredSlot: true } : {}),
    ...(r.boostPackage !== undefined ? { boostPackage: r.boostPackage } : {}),
    ...(r.boostMultiplier !== undefined ? { boostMultiplier: r.boostMultiplier } : {}),
  });

  const withBoosts = async (
    list: Ranked<JobCandidate>[],
    now: Date,
  ): Promise<Ranked<JobCandidate>[]> => {
    const getActiveBoosts = store.getActiveBoosts;
    if (!getActiveBoosts || list.length === 0) return list;
    try {
      const active = await getActiveBoosts.call(
        store,
        list.map((r) => r.job.id),
        now,
      );
      if (active.length === 0) return list;
      const byId = new Map(list.map((r) => [r.job.id, r]));
      const candidates = list.map((r) => ({
        jobId: r.job.id,
        baseScore: r.score,
        quality: r.job.employerQuality,
      }));
      // Near / Explore keep their own order; boosts only get the sponsored ranks and the per-page cap.
      return rerankFeedWithBoosts(candidates, active, now, { preserveOrder: true }).flatMap((r) => {
        const original = byId.get(r.jobId);
        if (!original) return [];
        return [{
          job: original.job,
          score: original.score,
          isBoosted: r.isBoosted,
          isSponsoredSlot: r.isSponsoredSlot,
          boostPackage: r.boostPackage,
          boostMultiplier: r.boostMultiplier,
        }];
      });
    } catch (error) {
      console.error('[feed] boost rerank failed; serving organic order', error);
      return list;
    }
  };

  const page = (
    list: Ranked<JobCandidate>[],
    viewer: Viewer,
    offset: number,
    limit: number,
    now: Date,
    cursorExtras: { seed?: string; period?: Period } = {},
  ): FeedPage => {
    const slice = list.slice(offset, offset + limit);
    const nextOffset = offset + slice.length;
    const hasMore = nextOffset < list.length && slice.length > 0;
    return {
      items: slice.map((r) => toItem(r, viewer)),
      nextCursor: hasMore ? encodeCursor({ asOf: now.getTime(), offset: nextOffset, ...cursorExtras }) : null,
      status: 'ok',
    };
  };

  const capAndMix = (sorted: Ranked<JobCandidate>[], exclude?: ReadonlySet<string>): Ranked<JobCandidate>[] => {
    const filtered = exclude ? sorted.filter((r) => !exclude.has(r.job.id)) : sorted;
    return enforceVariety(
      filtered.slice(0, cfg.paging.maxListItems),
      cfg.variety.maxConsecutiveSameEmployer,
      cfg.variety.maxConsecutiveSameCategory,
    );
  };

  // ---------- list builders (take a Context so home() can share one database read) ----------

  /** Recommended + Popular: the documented equation, cold-start slots, variety and boost placement. */
  const buildPopularityList = (ctx: Context, period: Period, exclude?: ReadonlySet<string>) =>
    rankPopularityFeed({
      candidates: ctx.general,
      period,
      globals: ctx.globals,
      now: ctx.now,
      cfg,
      boosts: ctx.boosts,
      exclude,
    });

  const buildExploreList = (ctx: Context, seed: string, exclude?: ReadonlySet<string>) => {
    const pool = exclude ? ctx.general.filter((j) => !exclude.has(j.id)) : ctx.general;
    const period = cfg.explore.period;
    const pop = pool.map((j) => popularityScore(j, period, ctx.globals, ctx.now, cfg));
    const fresh = pool.map((j) => freshnessFactor(ageDays(j.createdAt, ctx.now), cfg));
    const popPct = midRankPercentiles(pop);
    const freshPct = midRankPercentiles(fresh);
    const ranked: Ranked<JobCandidate>[] = pool
      .map((job, i) => ({
        job,
        score: cfg.explore.popularityWeight * popPct[i] + cfg.explore.freshnessWeight * freshPct[i],
      }))
      .sort(compareRanked);
    const exploration = ranked
      .filter((r) => r.job.agg[period].impressions < cfg.explore.underexposedImpressions)
      .sort((a, b) => seededUnit(seed, a.job.id) - seededUnit(seed, b.job.id) || compareRanked(a, b));
    const mixed = interleaveExploration(ranked, exploration, cfg.explore.explorationEveryN).slice(
      0,
      cfg.paging.maxListItems,
    );
    return enforceVariety(mixed, cfg.variety.maxConsecutiveSameEmployer, cfg.variety.maxConsecutiveSameCategory);
  };

  const buildNearList = async (viewer: Viewer, now: Date): Promise<Ranked<JobCandidate>[] | null> => {
    if (viewer.lat === null || viewer.lng === null) return null;
    const globals = await store.getGlobalRates();
    let cands = await store.getCandidates({ viewer, limit: cfg.candidateLimit, radiusKm: cfg.near.radiusKm });
    if (cands.length < cfg.near.minResults && cfg.near.widenToKm > cfg.near.radiusKm) {
      cands = await store.getCandidates({ viewer, limit: cfg.candidateLimit, radiusKm: cfg.near.widenToKm });
    }
    const pool = cands.filter((j) => isShowable(j) && j.distanceKm !== null);
    const pop = pool.map((j) => popularityScore(j, cfg.near.period, globals, now, cfg, { applyRegion: false }));
    const popPct = midRankPercentiles(pop);
    const ranked: Ranked<JobCandidate>[] = pool
      .map((job, i) => ({
        job,
        score:
          cfg.near.proximityWeight * proximityScore(job.distanceKm as number, cfg) +
          cfg.near.popularityWeight * popPct[i],
      }))
      .sort(compareRanked);
    return ranked;
  };

  const defaultSeed = (now: Date) => now.toISOString().slice(0, 10);

  // ---------- public API ----------

  const recommended: FeedService['recommended'] = async (viewer, opts = {}) => {
    const st = startState(opts.cursor);
    const limit = clampLimit(opts.limit, cfg.paging.defaultPageSize);
    const ctx = await loadContext(viewer, st.now);
    const list = buildPopularityList(ctx, cfg.recommended.period, opts.excludeIds);
    return page(list, viewer, st.offset, limit, st.now);
  };

  const popular: FeedService['popular'] = async (viewer, opts = {}) => {
    const st = startState(opts.cursor);
    const limit = clampLimit(opts.limit, cfg.paging.defaultPageSize);
    const period = opts.period ?? cfg.popular.defaultDetailPeriod;
    const ctx = await loadContext(viewer, st.now);
    const list = buildPopularityList(ctx, period, opts.excludeIds);
    return page(list, viewer, st.offset, limit, st.now, { period });
  };

  const near: FeedService['near'] = async (viewer, opts = {}) => {
    const st = startState(opts.cursor);
    const limit = clampLimit(opts.limit, cfg.paging.defaultPageSize);
    const ranked = await buildNearList(viewer, st.now);
    if (ranked === null) return { items: [], nextCursor: null, status: 'no_location' };
    const list = await withBoosts(capAndMix(ranked, opts.excludeIds), st.now);
    return page(list, viewer, st.offset, limit, st.now);
  };

  const explore: FeedService['explore'] = async (viewer, opts = {}) => {
    const st = startState(opts.cursor);
    const limit = clampLimit(opts.limit, cfg.paging.defaultPageSize);
    const seed = st.seed ?? opts.seed ?? defaultSeed(st.now);
    const ctx = await loadContext(viewer, st.now);
    const list = await withBoosts(buildExploreList(ctx, seed, opts.excludeIds), st.now);
    return page(list, viewer, st.offset, limit, st.now, { seed });
  };

  const home: FeedService['home'] = async (viewer, opts = {}) => {
    const now = clock();
    const seed = opts.seed ?? defaultSeed(now);
    const ctx = await loadContext(viewer, now);
    const nearRanked = await buildNearList(viewer, now);

    // Home previews never hand out cursors: each "view all" screen starts its own fresh, consistent list.
    const preview = (list: Ranked<JobCandidate>[], count: number): FeedPage => ({
      items: list.slice(0, count).map((r) => toItem(r, viewer)),
      nextCursor: null,
      status: 'ok',
    });

    const shown = new Set<string>();
    const take = (p: FeedPage) => p.items.forEach((i) => shown.add(i.jobId));

    const recPage = preview(
      buildPopularityList(ctx, cfg.recommended.period),
      cfg.home.recommendedCount,
    );
    take(recPage);
    const popPage = preview(
      buildPopularityList(ctx, cfg.popular.homePeriod, new Set(shown)),
      cfg.home.popularCount,
    );
    take(popPage);
    const nearPage: FeedPage =
      nearRanked === null
        ? { items: [], nextCursor: null, status: 'no_location' }
        : preview(await withBoosts(capAndMix(nearRanked), now), cfg.home.nearCount);
    take(nearPage);
    const explorePage = preview(
      await withBoosts(buildExploreList(ctx, seed, new Set(shown)), now),
      cfg.home.exploreCount,
    );

    return { recommended: recPage, popular: popPage, near: nearPage, explore: explorePage };
  };

  return {
    home,
    recommended,
    popular,
    near,
    explore,
    recordEvents: (sessionId, events) => store.recordEvents(sessionId, events),
  };
}
