// =========================================================
// Ranking evaluation metrics (Phase 10) — pure, deterministic.
//
// All functions run on an ORDERED list of item ids plus relevance labels, and
// never touch a database or a clock. Relevance can be graded (event-strength
// sums, for NDCG/MAP) or binary (any meaningful engagement, for
// Precision/Recall). Metric definitions:
//
//   DCG@K    = Σ rel_i / log2(i + 2) over the first K ranks
//   NDCG@K   = DCG@K / IDCG@K            (IDCG = DCG of the ideal ordering)
//   MRR      = 1 / first rank that has a relevant item
//   P@K      = (# relevant in first K) / K
//   Recall@K = (# relevant in first K) / |relevant universe|
//   MAP@K    = avg over relevant items of precision at those ranks (within K)
//
// Determinism: every metric uses only the supplied arrays; ties in relevance
// between items at the same rank are resolved by the ranking position already
// implied by the input order (first occurrence wins). K is clamped to
// [1, list.length]. Empty/invalid inputs return null rather than fabricated
// numbers — a caller MUST treat null as "not computable", not as zero.
// =========================================================

/** Graded relevance per item id (0 = irrelevant, > 0 = gain). Infinity/NaN stripped. */
export type GradedLabels = Readonly<Record<string, number>>;

export type RankingMetrics<K extends number = number> = {
  k: K;
  ndcg: number | null;
  mrr: number | null;
  precision: number | null;
  recall: number | null;
  map: number | null;
  /** Number of relevant items inside the ranked list (the Recall denominator is computed over the labels map, not just the list). */
  relevantRanked: number;
};

/** Deterministic gain at rank `position` (1-based): rel / log2(position + 1). */
export function gainAt(rel: number, position: number): number {
  const value = Number.isFinite(rel) ? Math.max(0, rel) : 0;
  return value / Math.log2(position + 1);
}

/** DCG at K for a list of graded gains in rank order. */
export function dcg(gains: readonly number[], k: number): number {
  const cutoff = clampK(k, gains.length);
  let total = 0;
  for (let i = 0; i < cutoff; i += 1) total += gainAt(gains[i], i + 1);
  return total;
}

/** IDCG: DCG under the ideal ordering (labels descending, ties arbitrary). */
export function idcg(labels: readonly number[], k: number): number {
  const sorted = labels.filter((value) => value > 0).slice().sort((a, b) => b - a);
  return dcg(sorted, k);
}

/** NDCG@K in [0, 1], or null when the list is empty or there is nothing relevant. */
export function ndcgAt(items: readonly string[], labels: GradedLabels, k: number): number | null {
  if (items.length === 0) return null;
  const cutoff = clampK(k, items.length);
  const gains: number[] = [];
  for (let i = 0; i < items.length; i += 1) gains.push(labelFor(items[i], labels));
  if (gains.every((value) => value <= 0)) return null;
  const d = dcg(gains, cutoff);
  const ideal = idcg(gains, cutoff);
  return ideal > 0 ? d / ideal : null;
}

/** MRR: reciprocal of the first rank holding a relevant item; null when none. */
export function mrr(items: readonly string[], labels: GradedLabels): number | null {
  for (let i = 0; i < items.length; i += 1) {
    if (relevantLabel(labelFor(items[i], labels))) return 1 / (i + 1);
  }
  return null;
}

/** Precision@K: relevant items in the top K over K; null on an empty list. */
export function precisionAt(items: readonly string[], labels: GradedLabels, k: number): number | null {
  if (items.length === 0) return null;
  const cutoff = clampK(k, items.length);
  if (cutoff === 0) return null;
  let relevant = 0;
  for (let i = 0; i < cutoff; i += 1) if (relevantLabel(labelFor(items[i], labels))) relevant += 1;
  return relevant / cutoff;
}

/** Recall@K: relevant items in top K over the total relevant universe; null when the universe is empty. */
export function recallAt(items: readonly string[], labels: GradedLabels, k: number, universe?: ReadonlySet<string>): number | null {
  const relevantUniverse = relevanceUniverse(labels, universe);
  if (relevantUniverse.length === 0) return null;
  const cutoff = clampK(k, items.length);
  let found = 0;
  for (let i = 0; i < cutoff; i += 1) {
    if (relevantLabel(labelFor(items[i], labels)) && relevantUniverse.includes(items[i])) found += 1;
  }
  return found / relevantUniverse.length;
}

/**
 * MAP@K: average precision, averaged over every relevant item whose rank is
 * within K. Mean-average-precision semantics: precision at each relevant rank,
 * divided by the number of relevant items in the list's top K. Returns null
 * when no relevant item appears inside the top K.
 */
export function mapAt(items: readonly string[], labels: GradedLabels, k: number): number | null {
  const cutoff = clampK(k, items.length);
  let seen = 0;
  let sum = 0;
  let relevantInK = 0;
  for (let i = 0; i < cutoff; i += 1) {
    if (relevantLabel(labelFor(items[i], labels))) {
      seen += 1;
      relevantInK += 1;
      sum += seen / (i + 1);
    }
  }
  return relevantInK > 0 ? sum / relevantInK : null;
}

/** Evaluate all standard metrics at one K. */
export function evaluateAt(items: readonly string[], labels: GradedLabels, k: number, universe?: ReadonlySet<string>): RankingMetrics<number> {
  const rankedRelevant = items.filter((id) => relevantLabel(labelFor(id, labels))).length;
  return {
    k,
    ndcg: ndcgAt(items, labels, k),
    mrr: mrr(items, labels),
    precision: precisionAt(items, labels, k),
    recall: recallAt(items, labels, k, universe),
    map: mapAt(items, labels, k),
    relevantRanked: rankedRelevant,
  };
}

/** Standard evaluation sweep over the configured K values. */
export const DEFAULT_K_VALUES = [5, 10, 20] as const;

export function evaluateRanking(
  items: readonly string[],
  labels: GradedLabels,
  options?: { kValues?: readonly number[]; universe?: ReadonlySet<string> },
): { kValues: number[]; byK: RankingMetrics<number>[]; mrr: number | null } {
  const kValues = options?.kValues ?? DEFAULT_K_VALUES;
  const universe = options?.universe;
  const byK = kValues.map((k) => evaluateAt(items, labels, k, universe));
  return { kValues: [...kValues], byK, mrr: mrr(items, labels) };
}

/** True when the graded label is above the binary-relevance threshold. */
export function relevantLabel(label: number, threshold = 0): boolean {
  return Number.isFinite(label) && label > threshold;
}

function labelFor(id: string, labels: GradedLabels): number {
  const value = labels[id];
  return Number.isFinite(value as number) ? (value as number) : 0;
}

function relevanceUniverse(labels: GradedLabels, universe?: ReadonlySet<string>): string[] {
  const ids = Object.keys(labels).filter((id) => relevantLabel(labels[id]));
  if (!universe) return ids;
  return ids.filter((id) => universe.has(id));
}

function clampK(k: number, length: number): number {
  if (!Number.isFinite(k)) return length;
  return Math.min(length, Math.max(0, Math.floor(k)));
}