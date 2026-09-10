// =========================================================
// Ranking baselines (Phase 10) — the same candidate pool, simpler orderings.
//
// A baseline consumes the SAME bounded candidate pool the production pipeline
// retrieved (so it measures ranking quality, not retrieval), and re-orders it
// with a single deterministic key:
//
//   Recency          — newest created_at first (job.age-based, no scoring)
//   Distance         — nearest to the worker first (requires job + worker coords)
//   SimpleRelevance  — organicScore desc (phase 4 relevance ONLY, pre-MMR,
//                      with deterministic index + jobId tie-breaks). This is the
//                      "no diversity, no sponsored, no exploration" control and
//                      the most important comparison: it isolates the marginal
//                      value of MMR/sponsored/exploration.
//
// These produce plain ordered job-id lists that the metric layer scores against
// the same held-out labels, so the production feed can be compared head-to-head
// against each baseline on identical relevance and diversity terms.
// =========================================================

import { haversineKm } from "../ranking/distance";
import type { RankingTrace } from "./evaluator";

export type BaselineId = "recency" | "distance" | "simple-relevance";

export type BaselineResult = {
  id: BaselineId;
  orderedJobIds: string[];
};

type JobPoint = {
  jobId: string;
  employerId: string;
  categoryId: string | null;
  createdAtMs: number;
  latitude: number | null;
  longitude: number | null;
  organicScore: number;
};

export type BaselineInput = {
  trace: RankingTrace;
  jobs: Map<string, { createdAtMs: number; latitude: number | null; longitude: number | null; employerId: string; categoryId: string | null }>;
  organicScores: Map<string, number>;
  workerLocation?: { latitude: number; longitude: number } | null;
};

/**
 * Compute all baselines over the production trace's candidate pool. `jobMeta`
 * supplies the small per-job facts baselines need; organicScores carry the
 * phase 4 relevance for the simple-relevance control.
 */
export function computeBaselines(input: BaselineInput): BaselineResult[] {
  const points: JobPoint[] = [];
  for (const candidate of input.trace.candidates) {
    const job = input.jobs.get(candidate.jobId);
    if (!job) continue;
    points.push({
      jobId: candidate.jobId,
      employerId: job.employerId,
      categoryId: job.categoryId,
      createdAtMs: job.createdAtMs,
      latitude: job.latitude,
      longitude: job.longitude,
      organicScore: input.organicScores.get(candidate.jobId) ?? 0,
    });
  }
  return [
    {
      id: "recency",
      orderedJobIds: orderRecency(points),
    },
    {
      id: "distance",
      orderedJobIds: orderDistance(points, input.workerLocation),
    },
    {
      id: "simple-relevance",
      orderedJobIds: orderSimpleRelevance(points, input.trace.candidates),
    },
  ];
}

function orderRecency(points: readonly JobPoint[]): string[] {
  return points
    .slice()
    .sort((a, b) => b.createdAtMs - a.createdAtMs || (a.jobId < b.jobId ? -1 : a.jobId > b.jobId ? 1 : 0))
    .map((point) => point.jobId);
}

function orderDistance(points: readonly JobPoint[], worker?: { latitude: number; longitude: number } | null): string[] {
  if (!worker || !Number.isFinite(worker.latitude) || !Number.isFinite(worker.longitude)) {
    // No worker location ⇒ distance is undefined for every job; fall back to a
    // stable order (recency tie-break) rather than inventing coordinates.
    return orderRecency(points);
  }
  return points
    .slice()
    .sort((a, b) => {
      const dA = distKm(a, worker);
      const dB = distKm(b, worker);
      if (dA == null && dB == null) return a.createdAtMs < b.createdAtMs ? 1 : a.createdAtMs > b.createdAtMs ? -1 : a.jobId < b.jobId ? -1 : 1;
      if (dA == null) return 1; // unknown distance sorts last
      if (dB == null) return -1;
      return dA - dB || b.createdAtMs - a.createdAtMs || (a.jobId < b.jobId ? -1 : 1);
    })
    .map((point) => point.jobId);
}

function orderSimpleRelevance(points: readonly JobPoint[], traceCandidates: RankingTrace["candidates"]): string[] {
  // organicScore desc, then original pool index asc (deterministic, mirrors the
  // phase 4→5 first-pick), then jobId asc.
  return points
    .slice()
    .sort((a, b) => {
      if (b.organicScore !== a.organicScore) return b.organicScore - a.organicScore;
      const idxA = traceCandidates.findIndex((candidate) => candidate.jobId === a.jobId);
      const idxB = traceCandidates.findIndex((candidate) => candidate.jobId === b.jobId);
      if (idxA !== idxB) return idxA - idxB;
      return a.jobId < b.jobId ? -1 : 1;
    })
    .map((point) => point.jobId);
}

function distKm(point: { latitude: number | null; longitude: number | null }, worker: { latitude: number; longitude: number }): number | null {
  if (point.latitude == null || point.longitude == null) return null;
  return haversineKm({ latitude: worker.latitude, longitude: worker.longitude }, { latitude: point.latitude, longitude: point.longitude });
}