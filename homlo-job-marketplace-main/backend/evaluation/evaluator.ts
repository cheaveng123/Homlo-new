// =========================================================
// Evaluator (Phase 10) — run the REAL pipeline with a leakage-safe timeline.
//
// For each (user, evalAt) sample the evaluator:
//   1. Truncates the dataset to evidence strictly <= evalAt (see dataset.ts).
//   2. Runs the REAL RecommendationFeedService.buildFinalPool + getFeed at `evalAt`,
//      against the in-memory adapter, capturing the full phase 3→7 trace.
//   3. Extracts labels ONLY from events AFTER evalAt (the label window).
//   4. Computes every ranking metric against those labels.
//
// Nothing here re-implements ranking: it reuses the single canonical service so
// the evaluated numbers are produced by the code that ships. The only "fixture"
// logic is the SQL routing (in-memory.ts), the eligibility mirror
// (022 semantics in in-memory.ts) and the label extraction (temporal.ts) — each
// independently unit-tested for correctness.
// =========================================================

import { RecommendationFeedService } from "../ranking/recommendation-feed";
import { EvalDatabase } from "./in-memory";
import { truncateDataset } from "./dataset";
import { gradedLabels, gradesToRecord, labelUniverse } from "./temporal";
import { evaluateRanking } from "./metrics";
import { diversityMetrics, type RankedItem } from "./diversity";
import type { EvalDataset, EvalEvent } from "./dataset";
import type { Phase6Candidate } from "../ranking/sponsored-exploration";
import type { RetrievalPreferences } from "../ranking/candidate-retrieval";

export type EvalSampleInput = {
  userId: string;
  evalAt: Date;
  location?: { latitude: number; longitude: number } | null;
  preferences?: RetrievalPreferences | null;
};

export type RankingTrace = {
  userId: string;
  evalAt: string;
  poolSize: number;
  candidates: RankedCandidateTrace[];
  queryCount: number;
  durationMs: number;
};

export type RankedCandidateTrace = {
  position: number;
  jobId: string;
  employerId: string;
  categoryId: string | null;
  organicScore: number;
  finalRankingScore: number;
  sponsored: boolean;
  sponsoredMultiplier: number;
  exploration: boolean;
  coldStart: boolean;
  mmrScore: number | null;
  mmrRelevance: number | null;
  sources: string[];
};

export type EvalRunResult = {
  sample: EvalSampleInput;
  evalAt: string;
  trace: RankingTrace | null;
  poolJobIds: string[];
  rankedJobIds: string[];
  labels: Record<string, number>;
  labelUniverseJobs: string[];
  labelWindowStart: string;
  labelWindowEnd: string;
  metrics: ReturnType<typeof evaluateRanking>;
  diversity: ReturnType<typeof diversityMetrics> | null;
  insufficientLabels: boolean;
};

/** The label window is everything strictly after evalAt in the fixture. */
export function labelWindowFor(
  events: readonly EvalEvent[],
  userId: string,
  evalAt: Date,
): readonly EvalEvent[] {
  const afterEval = events.filter((e) => e.occurredAt.getTime() > evalAt.getTime());
  return afterEval.filter((e) => e.userId === userId);
}

/**
 * Run one deterministic evaluation sample. The dataset is truncated to `evalAt`,
 * the real pipeline runs at `evalAt`, and labels derive ONLY from post-evalAt
 * events — so no score can be influenced by the very engagement being measured.
 */
export async function runEvaluationSample(
  dataset: EvalDataset,
  input: EvalSampleInput,
): Promise<EvalRunResult> {
  const evalAtMs = input.evalAt.getTime();
  const view = truncateDataset(dataset, evalAtMs);

  const database = new EvalDatabase(view);
  const service = new RecommendationFeedService(database);
  const started = performance.now();
  const pool = await service.buildFinalPool({
    userId: input.userId,
    userLocation: input.location ?? null,
    preferences: input.preferences ?? null,
    now: input.evalAt,
  });
  const durationMs = performance.now() - started;

  const trace: RankingTrace = {
    userId: input.userId,
    evalAt: input.evalAt.toISOString(),
    poolSize: pool.length,
    candidates: pool.map((candidate, index) => toTrace(candidate, index + 1)),
    queryCount: database.queryCount,
    durationMs,
  };

  // Full feed (positions over the whole pool, not just page 1).
  const feed = await service.getFeed({
    userId: input.userId,
    userLocation: input.location ?? null,
    preferences: input.preferences ?? null,
    pageSize: Math.max(pool.length, 1),
    now: input.evalAt,
  });
  const rankedJobIds = feed.jobs.map((item) => item.job.jobId);

  // Labels exclusively from the post-evalAt window of the ORIGINAL (untruncated)
  // dataset. The pipeline ran on the truncated `view`, so no label event could
  // have influenced any score. This is the heart of the leakage guarantee.
  const postEvalEvents = dataset.events.filter((e) => e.occurredAt.getTime() > evalAtMs);
  const grades = gradedLabels(
    postEvalEvents.map(toTemporalEvent),
    input.userId,
  );
  const labelRecords = gradesToRecord(grades);
  const universeJobs = [...labelUniverse(grades)];

  const labelsPresent = rankedJobIds.some((id) => Object.prototype.hasOwnProperty.call(labelRecords, id));

  const metrics = evaluateRanking(rankedJobIds, labelRecords, {
    kValues: [5, 10, 20],
    universe: new Set(universeJobs),
  });

  const diversity = diversityMetrics(
    rankedJobIds.map((id) => toRankedItem(view, pool, id)).filter((item): item is NonNullable<typeof item> => item != null),
    {
      employers: new Set(view.jobs.map((j) => j.employerId)),
      categories: new Set(view.jobs.map((j) => j.categoryId).filter((c): c is string => c != null)),
    },
  );

  return {
    sample: input,
    evalAt: input.evalAt.toISOString(),
    trace,
    poolJobIds: pool.map((candidate) => candidate.jobId),
    rankedJobIds,
    labels: labelRecords,
    labelUniverseJobs: universeJobs,
    labelWindowStart: new Date(evalAtMs + 1).toISOString(),
    labelWindowEnd: new Date(dataset.events.length > 0 ? Math.max(...dataset.events.map((e) => e.occurredAt.getTime())) : evalAtMs).toISOString(),
    metrics,
    diversity,
    insufficientLabels: !labelsPresent,
  };
}

function toTemporalEvent(
  e: { userId: string | null; jobId: string; eventType: string; occurredAt: Date },
): { userId: string | null; jobId: string; eventType: string; occurredAt: Date } {
  return e;
}

function toTrace(candidate: Phase6Candidate, position: number): RankedCandidateTrace {
  const snapshot = candidate.rankingSnapshot;
  return {
    position,
    jobId: candidate.jobId,
    employerId: candidate.employerId,
    categoryId: candidate.features?.categoryId ?? null,
    organicScore: candidate.organicScore,
    finalRankingScore: candidate.finalRankingScore,
    sponsored: candidate.sponsored,
    sponsoredMultiplier: candidate.sponsoredMultiplier,
    exploration: candidate.exploration,
    coldStart: snapshot.coldStart,
    mmrScore: snapshot.mmr?.score ?? null,
    mmrRelevance: snapshot.mmr?.relevance ?? null,
    sources: (candidate.metadata?.sources as string[] | undefined) ?? [],
  };
}

function toRankedItem(
  view: EvalDataset,
  pool: readonly Phase6Candidate[],
  jobId: string,
): RankedItem | null {
  const job = view.jobs.find((j) => j.id === jobId);
  const candidate = pool.find((c) => c.jobId === jobId);
  if (!job || !candidate) return null;
  return {
    jobId,
    employerId: job.employerId,
    categoryId: job.categoryId ?? null,
    distanceKm: candidate.distanceKm,
  };
}