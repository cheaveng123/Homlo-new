// =========================================================
// Quality feedback-loop harness (Phase 10).
//
// Tests the closed loop the product depends on:
//   expose (feed ranks a job) → engage (worker clicks/saves)
//   → quality aggregation (phase 8) → better ranking (phase 4 reads stats)
//
// The harness performs a deterministic number of "rounds". Each round:
//   1. optionally injects NEW engagement events driven by the previous ranking,
//   2. re-runs the quality aggregation simulation (the SAME pure phase 8 math),
//   3. re-ranks with the real pipeline at a fixed `now`.
//
// The metric it tracks is QUALITY EVIDENCE, not circular rank labels: each round
// we record the Wilson bounds and n_events of the previously top-ranked jobs,
// plus whether the pipeline reorders them. This demonstrates that observable
// interaction translates into improved (higher-confidence, higher-quality)
// scoring signals for the jobs the feed already surfaced — the mechanism behind
// "engagement → better ranking" — without fabricating a self-appointed label.
// =========================================================

import { RecommendationFeedService } from "../ranking/recommendation-feed";
import { EvalDatabase } from "./in-memory";
import { truncateDataset, simulateAggregation, type EvalDataset } from "./dataset";
import type { EvalEvent } from "./dataset";

export type FeedbackLoopOptions = {
  userId: string;
  now: Date;
  location?: { latitude: number; longitude: number } | null;
  rounds: number;
  /** Per round, how many of the top-ranked jobs the worker "clicks" to create new evidence. */
  engagementsPerRound?: number;
};

export type FeedbackRound = {
  round: number;
  poolSize: number;
  topJobIds: string[];
  /** n_events for the top-ranked jobs this round (higher = more evidence). */
  topNEvents: number[];
  /** Highest Wilson lower-bound among the top-ranked jobs (higher = stronger observed quality). */
  bestTopCtrWilsonLB: number | null;
  /** Whether the top job changed relative to the previous round. */
  reorderedTop: boolean;
};

/**
 * Runs the feedback loop. `baseline` is the fully-populated dataset (with stats);
 * each round builds a NEW truncated+re-aggregated snapshot so later rounds only
 * see round-appropriate evidence (leakage-safe).
 */
export async function runFeedbackLoop(
  baseline: EvalDataset,
  options: FeedbackLoopOptions,
): Promise<{ rounds: FeedbackRound[] }> {
  const engagementsPerRound = options.engagementsPerRound ?? 3;
  const events: EvalEvent[] = baseline.events.slice();
  let seed = baseline.events.length;
  let previousTop: string[] = [];

  const rounds: FeedbackRound[] = [];

  for (let round = 1; round <= options.rounds; round += 1) {
    const fresh = simulateAggregation({ ...baseline, events });
    const view = truncateDataset(fresh, options.now.getTime());
    const database = new EvalDatabase(view);
    const service = new RecommendationFeedService(database);
    const pool = await service.buildFinalPool({
      userId: options.userId,
      userLocation: options.location ?? null,
      preferences: null,
      now: options.now,
    });

    const top = pool.slice(0, engagementsPerRound);
    const topJobIds = top.map((candidate) => candidate.jobId);
    const topNEvents = top.map((candidate) => qualityEvidenceFor(view, candidate.jobId).nEvents);
    const bestTopCtrWilsonLB = top.reduce<number | null>((best, candidate) => {
      const lb = qualityEvidenceFor(view, candidate.jobId).ctrWilsonLB;
      if (lb == null) return best;
      return best == null ? lb : Math.max(best, lb);
    }, null);

    const reorderedTop = previousTop.length > 0 && topJobIds[0] !== previousTop[0];

    rounds.push({
      round,
      poolSize: pool.length,
      topJobIds,
      topNEvents,
      bestTopCtrWilsonLB,
      reorderedTop,
    });

    if (round < options.rounds) {
      for (const jobId of topJobIds) {
        const job = view.jobs.find((j) => j.id === jobId);
        if (!job) continue;
        events.push({
          id: `loop-ev-${seed++}`,
          eventType: "click",
          userId: options.userId,
          jobId,
          employerId: job.employerId,
          sessionId: null,
          feedPosition: 1,
          occurredAt: options.now,
          ipHash: `loop-ip-${jobId}`,
          dwellTimeMs: 1_000,
          snapshot: null,
        });
      }
      // A strong save on the very best (category-preferred) job, so a clearly
      // good candidate accumulates the strongest positive evidence.
      const bestJob = view.jobs.find((j) => j.id === "job-best-a");
      if (bestJob) {
        events.push({
          id: `loop-ev-${seed++}`,
          eventType: "save",
          userId: options.userId,
          jobId: bestJob.id,
          employerId: bestJob.employerId,
          sessionId: null,
          feedPosition: 1,
          occurredAt: options.now,
          ipHash: `loop-ip-${bestJob.id}`,
          dwellTimeMs: 1_000,
          snapshot: null,
        });
      }
    }
    previousTop = topJobIds;
  }
  return { rounds };
}

function qualityEvidenceFor(view: EvalDataset, jobId: string): { nEvents: number; ctrWilsonLB: number | null } {
  const jobStats = view.jobQuality.get(jobId);
  if (!jobStats) return { nEvents: 0, ctrWilsonLB: null };
  return { nEvents: jobStats.nEvents, ctrWilsonLB: jobStats.ctrWilsonLB };
}