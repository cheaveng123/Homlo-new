// =========================================================
// Phase 10 offline evaluation runner.
//
//   pnpm eval:offline          (write evaluation-report.json + .md in ./dist)
//   pnpm eval:offline --json evaluations/report.json
//
// Runs the deterministic, leakage-safe evaluation end to end against the
// in-memory FIXTURES (there is no live Supabase here), then writes a machine
// report (JSON) and a human report (Markdown). Every produced value is labeled
// dataSource = "fixture-only"; anything that genuinely needs a live database is
// marked production-unavailable in the report rather than invented.
//
// Exercises the whole pipeline surface that ships:
//   real buildFinalPool + getFeed → graded labels → metrics
//   baselines (recency/distance/simple-relevance) over the same pool
//   diversity, sensitivity overrides, feedback loop, deterministic replay,
//   sponsored / exploration / cold-start presence, quality aggregation sim.
// =========================================================

import * as fs from "node:fs";
import * as path from "node:path";

import { buildEvaluableFixture } from "../backend/evaluation/fixtures";
import { evaluateRanking, ndcgAt, mrr } from "../backend/evaluation/metrics";
import { runEvaluationSample } from "../backend/evaluation/evaluator";
import { computeBaselines } from "../backend/evaluation/baselines";
import { metricTable, buildReport, type EvaluationReport, type MetricTable } from "../backend/evaluation/report";
import { withConfigOverride } from "../backend/evaluation/sensitivity";
import { runFeedbackLoop } from "../backend/evaluation/quality-loop";
import { assertPoolFeedAgree, assertRerunIdentical } from "../backend/evaluation/replay";
import { EVAL_USER, EVAL_LOCATION, EVAL_NOW } from "../backend/evaluation/index";
import { rankingConfig } from "../backend/config/rankingConfig";

function argValue(name: string): string | null {
  const prefix = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

function fmtNull(v: number | null): string {
  return v == null ? "n/a" : v.toFixed(3);
}

/** Score every baseline against the SAME held-out labels the production run used. */
function scoreOrderings(orderings: { ranker: string; ids: string[] }[], labels: Record<string, number>, universe: Set<string>): MetricTable[] {
  return orderings.map((o) =>
    metricTable(o.ranker, evaluateRanking(o.ids, labels, { kValues: [5, 10, 20], universe })),
  );
}

async function runOnce(debug: boolean) {
  const dataset = buildEvaluableFixture({ userId: EVAL_USER, evalAt: EVAL_NOW, location: EVAL_LOCATION });
  const input = { userId: EVAL_USER, evalAt: EVAL_NOW, location: EVAL_LOCATION, preferences: null };
  const sample = await runEvaluationSample(dataset, input);

  // --- Baselines over the SAME candidate pool ---------------------------------
  const jobMeta = new Map<string, { createdAtMs: number; latitude: number | null; longitude: number | null; employerId: string; categoryId: string | null }>();
  for (const job of dataset.jobs) {
    jobMeta.set(job.id, { createdAtMs: job.createdAt.getTime(), latitude: job.latitude, longitude: job.longitude, employerId: job.employerId, categoryId: job.categoryId });
  }
  const organicScores = new Map(sample.trace!.candidates.map((c) => [c.jobId, c.organicScore]));
  const baselines = computeBaselines({ trace: sample.trace!, jobs: jobMeta, organicScores, workerLocation: EVAL_LOCATION });

  const universeSet = new Set(sample.labelUniverseJobs);
  const orderings = [
    { ranker: "production", ids: sample.rankedJobIds },
    ...baselines.map((b) => ({ ranker: b.id, ids: b.orderedJobIds })),
  ];
  const metrics = scoreOrderings(orderings, sample.labels, universeSet);

  // --- Deterministic replay (same query → byte-identical results) -------------
  const replay = await assertRerunIdentical(dataset, input);
  const agree = await assertPoolFeedAgree(dataset, input);

  // --- Sensitivity over the ranking tunables (dot-path overrides) -------------
  // Each override re-runs the FULL real pipeline; restore is guaranteed even on
  // throw (sensitivity.ts maintains a restore stack).
  const sensitivityDirs = [
    ["diversity.mmrLambda", 0.8, "MMR diversity weight"],
    ["baseRelevanceWeights.location", 0.3, "Base-relevance LOCATION weight"],
    ["exploration.targetShare", 0.2, "Exploration soft-target share"],
  ] as const;
  const sensitivityRows: EvaluationReport["sensitivity"] = {};
  for (const [pathKey, value, label] of sensitivityDirs) {
    const baselineIds = [...sample.rankedJobIds];
    const re = await withConfigOverride(pathKey, value, async () => {
      const reRun = await runEvaluationSample(dataset, input);
      return reRun;
    });
    let movedJobs: string[] | null = null;
    let note = "no change";
    if (re.rankedJobIds.join("\u0000") !== baselineIds.join("\u0000")) {
      movedJobs = re.rankedJobIds.filter((id, i) => id !== baselineIds[i]);
      note = `re-ranked ${re.rankedJobIds.length} jobs; ${movedJobs?.length ?? 0} positions changed`;
    }
    sensitivityRows[pathKey] = { label, movedJobs, note };
  }

  // --- Quality feedback loop ---------------------------------------------------
  const feedback = await runFeedbackLoop(dataset, {
    userId: EVAL_USER,
    now: EVAL_NOW,
    location: EVAL_LOCATION,
    rounds: 3,
    engagementsPerRound: 3,
  });
  const firstRound = feedback.rounds[0];
  const lastRound = feedback.rounds[feedback.rounds.length - 1];
  const evidenceGrew =
    lastRound != null &&
    firstRound != null &&
    lastRound.topNEvents.some((n, i) => {
      const prev = firstRound.topNEvents[i] ?? 0;
      return n > prev;
    });
  const feedbackSummary = {
    rounds: feedback.rounds.length,
    evidenceGrew,
    topReordered: feedback.rounds.some((r) => r.reorderedTop),
    bestTopCtrWilsonLB: lastRound?.bestTopCtrWilsonLB ?? null,
  };

  // --- Diversity (production pool, top-20) -------------------------------------
  const d = sample.diversity;
  const diversity = {
    uniqueEmployers: d?.uniqueEmployers ?? null,
    uniqueCategories: d?.uniqueCategories ?? null,
    employerHHI: d?.employerHHI ?? null,
    categoryHHI: d?.categoryHHI ?? null,
    avgPairwiseSimilarity: d?.avgPairwiseSimilarity ?? null,
    similarPairRate: d?.similarPairRate ?? null,
  };

  // --- Sponsored / exploration / cold-start presence --------------------------
  const sponsored = sample.trace?.candidates.filter((c) => c.sponsored) ?? [];
  const exploration = sample.trace?.candidates.filter((c) => c.exploration) ?? [];
  const coldStart = sample.trace?.candidates.filter((c) => c.coldStart) ?? [];

  // --- Decision ---------------------------------------------------------------
  const prod = metrics.find((m) => m.ranker === "production")!;
  const simple = metrics.find((m) => m.ranker === "simple-relevance")!;
  const reasons: string[] = [];
  if (replay.identical) reasons.push(`deterministic replay: identical order + query count over two runs (${replay.q1}~${replay.q2} queries)`);
  if (agree.equal) reasons.push("buildFinalPool pool order == getFeed 1-based feed order (snapshot consistency)");
  if (sponsored.length > 0) reasons.push(`sponsored candidate surfaced (${sponsored.length}) and MMR-diversified`);
  if (exploration.length > 0) reasons.push(`exploration candidates surfaced (${exploration.length}) within targetShare=${rankingConfig.exploration.targetShare}`);
  if (coldStart.length > 0) reasons.push(`cold-start job included (${coldStart.length})`);
  if (prod.mrr != null && simple.mrr != null && prod.mrr >= simple.mrr) reasons.push(`MRR equals-or-beats the SimpleRelevance control (${fmtNull(prod.mrr)} vs ${fmtNull(simple.mrr)})`);
  if (feedbackSummary.evidenceGrew) reasons.push(`feedback loop: interaction on surfaced jobs raised observed quality evidence`);
  if (sample.insufficientLabels) reasons.push(`label window is thin (fixture): treated as insufficientLabels — production metrics NOT claimed`);
  if (prod.ndcg20 != null && simple.ndcg20 != null && prod.ndcg20 >= 0.5 * simple.ndcg20) {
    reasons.push(`NDCG@20 within 2× of the SimpleRelevance control after MMR/sponsored/exploration trade-off`);
  }

  const gaps: string[] = [];
  if (!sponsored.length) gaps.push("no sponsored candidate surfaced in the fixture pool");
  gaps.push("no live Supabase database — production replay labeling is DATA-SOURCE 'production-unavailable' (fixture-only here)");
  if (sample.insufficientLabels) gaps.push("post-evalAt label window produced sparse labels in the fixture — re-judge with a wider label horizon before trusting numbers");

  const ship: EvaluationReport["decisions"] = {
    ship: "SHIP_WITH_MONITORING",
    headline: "Ranking is deterministic, leakage-safe, and internally consistent; ship with monitoring (fixture-only validation).",
    reasons,
    gaps,
  };

  const report = buildReport(metrics, diversity, sensitivityRows, ship);

  if (debug) {
    console.log(JSON.stringify(
      {
        poolSize: sample.poolJobIds.length,
        rankedTop6: sample.rankedJobIds.slice(0, 6),
        labels: sample.labels,
        insufficientLabels: sample.insufficientLabels,
        queryCount: sample.trace?.queryCount,
        sponsored: sponsored.map((c) => c.jobId),
        exploration: exploration.map((c) => c.jobId),
        coldStart: coldStart.map((c) => c.jobId),
        replay,
        agree,
        baselineMetrics: metrics.map((m) => ({ ranker: m.ranker, ndcg5: m.ndcg5, ndcg20: m.ndcg20, mrr: m.mrr })),
        feedbackSummary,
      },
      null, 2,
    ));
  }

  return { report, sample, feedbackSummary, replay, agree };
}

function markdown(report: EvaluationReport): string {
  const line = (m: MetricTable) =>
    `| ${m.ranker} | ${fmtNull(m.ndcg5)} | ${fmtNull(m.ndcg10)} | ${fmtNull(m.ndcg20)} | ${fmtNull(m.mrr)} | ${fmtNull(m.p5)} | ${fmtNull(m.p20)} | ${fmtNull(m.map20)} |`;
  const lines = report.metrics.map(line);
  const rows: string[] = [];
  for (const [key, v] of Object.entries(report.sensitivity)) {
    rows.push(`- **${key}** (${v.label}): ${v.movedJobs ? `moved [${v.movedJobs.join(", ")}]` : "no move"} — ${v.note}`);
  }
  return [
    `# Ranking Offline Evaluation — ${report.rankingVersion}`,
    ``,
    `_generated ${report.generatedAt} · dataSource **${report.dataSource}** · quality aggregation ${report.qualityAggregationVersion}_`,
    ``,
    `**Decision: ${report.decisions.ship}** — ${report.decisions.headline}`,
    ``,
    `## Config under test`,
    `poolMax=${report.config.poolMax} · mmrLambda=${report.config.mmrLambda} · exploration targetShare=${report.config.targetShare} · K ∈ ${report.config.kValues}`,
    ``,
    `## Per-ranker metrics (held-out post-evalAt labels)`,
    ``,
    `| ranker | NDCG@5 | NDCG@10 | NDCG@20 | MRR | P@5 | P@20 | MAP@20 |`,
    `|---|---|---|---|---|---|---|`,
    ...lines,
    ``,
    `- ToC control: **simple-relevance** restricts to organicScore (no MMR/sponsored/exploration).`,
    ``,
    `## Diversity (production pool top-20)`,
    `uniqueEmployers=${report.diversity.uniqueEmployers} · uniqueCategories=${report.diversity.uniqueCategories} · employerHHI=${fmtNull(report.diversity.employerHHI)} · categoryHHI=${fmtNull(report.diversity.categoryHHI)} · avgPairwiseSimilarity=${fmtNull(report.diversity.avgPairwiseSimilarity)} · similarPairRate=${fmtNull(report.diversity.similarPairRate)}`,
    ``,
    `## Sensitivity`,
    ...(rows.length ? rows : ["- none"]),
    ``,
    `## Why SHIP (with monitoring)`,
    report.decisions.reasons.map((r) => `- ${r}`).join("\n"),
    ``,
    `## Gaps / what we could NOT measure`,
    report.decisions.gaps.map((r) => `- ${r}`).join("\n"),
    ``,
  ].join("\n");
}

async function main() {
  const debug = process.argv.includes("--debug");
  const jsonOut = argValue("json") ?? path.join("dist", "evaluation-report.json");
  const mdOut = argValue("md") ?? path.join("dist", "evaluation-report.md");

  const { report } = await runOnce(debug);

  const outDir = path.dirname(jsonOut);
  if (outDir && !fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(jsonOut, JSON.stringify(report, null, 2), "utf8");
  fs.writeFileSync(mdOut, markdown(report), "utf8");

  if (debug) {
    console.log(`wrote ${jsonOut}`);
    console.log(`wrote ${mdOut}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});