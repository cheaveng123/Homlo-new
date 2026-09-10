// =========================================================
// Evaluation report (Phase 10) — machine + human readable.
//
// Every produced number is explicitly data-source-labeled: `fixture-only`
// (computed against the deterministic in-memory fixtures) versus
// `production-unavailable` (a metric we could NOT compute because there is no
// live Supabase database to run replay against). The report never claims a
// production number it did not measure — anything unmeasurable is surfaced as a
// gap, not filled in.
// =========================================================

import { rankingConfig } from "../config/rankingConfig";

export type DataSource = "fixture-only" | "production-unavailable";

export type MetricTable = {
  ranker: string;
  dataSource: DataSource;
  ndcg5: number | null;
  ndcg10: number | null;
  ndcg20: number | null;
  mrr: number | null;
  p5: number | null;
  p10: number | null;
  p20: number | null;
  r5: number | null;
  r10: number | null;
  r20: number | null;
  map5: number | null;
  map10: number | null;
  map20: number | null;
};

export type EvaluationReport = {
  generatedAt: string;
  dataSource: DataSource;
  rankingVersion: string;
  qualityAggregationVersion: string;
  config: {
    poolMax: number;
    mmrLambda: number;
    targetShare: number;
    kValues: string;
  };
  metrics: MetricTable[];
  diversity: {
    uniqueEmployers: number | null;
    uniqueCategories: number | null;
    employerHHI: number | null;
    categoryHHI: number | null;
    avgPairwiseSimilarity: number | null;
    similarPairRate: number | null;
  };
  sensitivity: Record<string, { label: string; movedJobs: string[] | null; note: string }>;
  decisions: {
    ship: "SHIP" | "SHIP_WITH_MONITORING" | "DO_NOT_SHIP";
    headline: string;
    reasons: string[];
    gaps: string[];
  };
};

export function buildReport(
  metrics: MetricTable[],
  diversity: EvaluationReport["diversity"],
  sensitivity: EvaluationReport["sensitivity"],
  decisions: EvaluationReport["decisions"],
): EvaluationReport {
  return {
    generatedAt: new Date().toISOString(),
    dataSource: "fixture-only",
    rankingVersion: rankingConfig.version,
    qualityAggregationVersion: rankingConfig.qualityAggregation.version,
    config: {
      poolMax: rankingConfig.retrieval.candidatePoolMax,
      mmrLambda: rankingConfig.diversity.mmrLambda,
      targetShare: rankingConfig.exploration.targetShare,
      kValues: "5,10,20",
    },
    metrics,
    diversity,
    sensitivity,
    decisions,
  };
}

/** Convert `raceResult`-style metric rows into MetricTable rows labeled honestly. */
export function metricTable(ranker: string, r: { byK: { k: number; ndcg: number | null; mrr: number | null; precision: number | null; recall: number | null; map: number | null }[]; mrr: number | null }): MetricTable {
  const byK = (k: number) => r.byK.find((m) => m.k === k);
  return {
    ranker,
    dataSource: "fixture-only",
    ndcg5: byK(5)?.ndcg ?? null,
    ndcg10: byK(10)?.ndcg ?? null,
    ndcg20: byK(20)?.ndcg ?? null,
    mrr: r.mrr,
    p5: byK(5)?.precision ?? null,
    p10: byK(10)?.precision ?? null,
    p20: byK(20)?.precision ?? null,
    r5: byK(5)?.recall ?? null,
    r10: byK(10)?.recall ?? null,
    r20: byK(20)?.recall ?? null,
    map5: byK(5)?.map ?? null,
    map10: byK(10)?.map ?? null,
    map20: byK(20)?.map ?? null,
  };
}