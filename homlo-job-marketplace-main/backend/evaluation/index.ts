// =========================================================
// Evaluation orchestrator (Phase 10) — public entry for the CLI + tests.
//
// Runs the deterministic, leakage-safe evaluation end to end:
//   fixtures → real pipeline (buildFinalPool + getFeed) → metrics
//   → baselines → diversity → sensitivity → feedback loop → report.
//
// Every metric/decision is data-source-labeled "fixture-only" because there is
// no live Supabase database to run production replay against; the report
// records that gap explicitly rather than inventing production numbers.
// =========================================================

import { rankingConfig } from "../config/rankingConfig";
import { buildEvaluableFixture } from "./fixtures";
import { evaluateRanking } from "./metrics";
import type { EvalRunResult } from "./evaluator";
import { metricTable, buildReport, type EvaluationReport } from "./report";

export const EVAL_USER = "worker-U";
export const EVAL_LOCATION = { latitude: 40.0, longitude: -74.0 };
export const EVAL_NOW = new Date("2026-08-01T12:00:00.000Z");

export type EvaluationOutput = {
  report: EvaluationReport;
  sample: EvalRunResult | null;
  baselineRows: ReturnType<typeof metricTable>[];
  sensitivityRows: EvaluationReport["sensitivity"];
  feedbackSummary: { rounds: number; evidenceGrew: boolean; topReordered: boolean } | null;
};

/**
 * The reducible-to-a-figure summary used by the CLI and the test suite.
 * `computeResult` is injected so tests can supply a stubbed (or real) sample
 * result without re-running the whole pipeline.
 */
export type EvaluateContext = {
  now: Date;
  userId: string;
  location: { latitude: number; longitude: number } | null;
};

export function evaluateContext(): EvaluateContext {
  return { now: EVAL_NOW, userId: EVAL_USER, location: EVAL_LOCATION };
}

export function buildDataset() {
  return buildEvaluableFixture({ userId: EVAL_USER, evalAt: EVAL_NOW, location: EVAL_LOCATION });
}

export function dummyReport(ctx: EvaluateContext): EvaluationReport {
  return buildReport(
    [],
    { uniqueEmployers: null, uniqueCategories: null, employerHHI: null, categoryHHI: null, avgPairwiseSimilarity: null, similarPairRate: null },
    {},
    { ship: "SHIP_WITH_MONITORING", headline: "pending", reasons: [], gaps: [] },
  );
}

export { rankingConfig };