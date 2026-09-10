// =========================================================
// Deterministic replay (Phase 10).
//
// The entire pipeline is deterministic (fixed `now`, no RNG). "Replay" therefore
// means: run the SAME evaluation twice and require byte-identical results.
// Because ranking-aware tests must also prove snapshot-consistency (the pool
// served by buildFinalPool and the feed served by getFeed agree on order and
// composition), this module exposes helpers to assert those invariants around a
// single run as well as full rerun-equality.
// =========================================================

import { RecommendationFeedService } from "../ranking/recommendation-feed";
import { EvalDatabase } from "./in-memory";
import { truncateDataset, type EvalDataset } from "./dataset";
import type { EvalSampleInput } from "./evaluator";

export type ReplayKey =
  | "reflexive-positions"
  | "pool-feeds-agree"
  | "rerun-identical";

/** Run `buildFinalPool` and assert pool order == full-feed order (positions agree). */
export async function assertPoolFeedAgree(dataset: EvalDataset, input: EvalSampleInput): Promise<{ poolIds: string[]; feedIds: string[]; equal: boolean }> {
  const view = truncateDataset(dataset, input.evalAt.getTime());
  const database = new EvalDatabase(view);
  const service = new RecommendationFeedService(database);
  const pool = await service.buildFinalPool({
    userId: input.userId,
    userLocation: input.location ?? null,
    preferences: input.preferences ?? null,
    now: input.evalAt,
  });
  const poolIds = pool.map((candidate) => candidate.jobId);
  const feed = await service.getFeed({
    userId: input.userId,
    userLocation: input.location ?? null,
    preferences: input.preferences ?? null,
    pageSize: Math.max(pool.length, 1),
    now: input.evalAt,
  });
  const feedIds = feed.jobs.map((item) => item.job.jobId);
  return {
    poolIds,
    feedIds,
    equal: poolIds.length === feedIds.length && poolIds.every((id, i) => id === feedIds[i]),
  };
}

/** Run the full pipeline twice and require identical ranked orders + query counts. */
export async function assertRerunIdentical(dataset: EvalDataset, input: EvalSampleInput): Promise<{ first: string[]; second: string[]; q1: number; q2: number; identical: boolean }> {
  const run = async (): Promise<{ ids: string[]; queries: number }> => {
    const view = truncateDataset(dataset, input.evalAt.getTime());
    const database = new EvalDatabase(view);
    const service = new RecommendationFeedService(database);
    const pool = await service.buildFinalPool({
      userId: input.userId,
      userLocation: input.location ?? null,
      preferences: input.preferences ?? null,
      now: input.evalAt,
    });
    const feed = await service.getFeed({
      userId: input.userId,
      userLocation: input.location ?? null,
      preferences: input.preferences ?? null,
      pageSize: Math.max(pool.length, 1),
      now: input.evalAt,
    });
    return { ids: feed.jobs.map((item) => item.job.jobId), queries: database.queryCount };
  };
  const first = await run();
  const second = await run();
  const identical =
    first.ids.length === second.ids.length &&
    first.ids.every((id, i) => id === second.ids[i]) &&
    first.queries === second.queries;
  return { first: first.ids, second: second.ids, q1: first.queries, q2: second.queries, identical };
}