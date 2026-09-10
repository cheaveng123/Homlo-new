// =========================================================
// Temporal evaluation helpers (Phase 10) — leakage-safe splits.
//
// The core rule: at every evaluation time T the system may ONLY see evidence
// with occurred_at <= T (plus jobs/quality rows that existed by then). Label
// extraction uses ONLY events strictly after T. This module builds those two
// disjoint views over an evaluation dataset and derives graded relevance labels
// from post-T engagement. Nothing here performs ranking; it only truncates and
// labels.
//
// All functions are deterministic and DB-free. Any requested metric whose label
// window produced no observations is reported as insufficient (null) rather
// than fabricated.
// =========================================================

import { behavioralEventWeights } from "./weights";

export type EvalTimestamp = Date | number | string;

export function epochOf(value: EvalTimestamp): number {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? Number.NaN : value.getTime();
  if (typeof value === "number") return Number.isFinite(value) ? value : Number.NaN;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export type SpannedEvent<Row> = {
  occurredAtMs: number;
  row: Row;
};

/** Events with a usable timestamp strictly <= `untilMs` (the evidence window). */
export function evidenceBefore<Row>(events: readonly Row[], occurredAt: (row: Row) => EvalTimestamp, untilMs: number): Row[] {
  return events.filter((row) => {
    const ms = epochOf(occurredAt(row));
    return Number.isFinite(ms) && ms <= untilMs;
  });
}

/** Events with a usable timestamp strictly > `fromMs` and <= `toMs` (the label window). */
export function labelsAfter<Row>(events: readonly Row[], occurredAt: (row: Row) => EvalTimestamp, fromMs: number, toMs: number): Row[] {
  return events.filter((row) => {
    const ms = epochOf(occurredAt(row));
    return Number.isFinite(ms) && ms > fromMs && ms <= toMs;
  });
}

export type EngagementLabelOptions = {
  /** Events with this event type are excluded from labels (e.g. 'impression' — exposure, not preference). */
  exclude?: readonly string[];
};

/**
 * Graded relevance for a user from engagement events in the label window.
 * Grade = Σ eventWeights × decay(age) in the window. Impression/report are
 * excluded by default (near-neutral exposure / trust signal). Returns an empty
 * map when there is no meaningful label coverage — callers should then mark
 * the metric "insufficient data", not "no relevance".
 */
export function gradedLabels(
  events: readonly { userId: string | null; jobId: string; eventType: string; occurredAt: EvalTimestamp }[],
  userId: string,
  options?: EngagementLabelOptions,
): Map<string, number> {
  const exclude = new Set(options?.exclude ?? ["impression", "report"]);
  const weights = behavioralEventWeights();
  const grades = new Map<string, number>();
  for (const event of events) {
    if (event.userId !== userId) continue;
    if (exclude.has(event.eventType)) continue;
    const weight = weights[event.eventType];
    if (weight == null || weight === 0 || !Number.isFinite(weight)) continue;
    const ageMs = epochOf(event.occurredAt);
    if (!Number.isFinite(ageMs)) continue;
    // Strength decays with age within the label window so a fresh signal weighs
    // slightly more than an old one — deterministic, no randomness.
    const grade = weight / (1 + Math.max(0, ageMs) / 86_400_000);
    grades.set(event.jobId, (grades.get(event.jobId) ?? 0) + grade);
  }
  return grades;
}

/** Binary relevance from the graded map (any positive grade counts). */
export function binaryLabels(grades: ReadonlyMap<string, number>): Map<string, number> {
  const labels = new Map<string, number>();
  for (const [jobId, grade] of grades) if (Number.isFinite(grade) && grade > 0) labels.set(jobId, 1);
  return labels;
}

/** The set of jobs in the graded label map (the "relevance universe"). */
export function labelUniverse(grades: ReadonlyMap<string, number>): Set<string> {
  return new Set(grades.keys());
}

export function gradesToRecord(grades: ReadonlyMap<string, number>): Record<string, number> {
  const record: Record<string, number> = {};
  for (const [jobId, grade] of grades) record[jobId] = grade;
  return record;
}