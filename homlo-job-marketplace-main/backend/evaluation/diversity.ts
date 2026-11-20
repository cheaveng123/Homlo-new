// =========================================================
// Diversity evaluation metrics (Phase 10) — deterministic, DB-free.
//
// These metrics measure the actual diversity behavior of the ranking, not the
// existence of the MMR code. Every function takes an ORDERED list of ranked
// items with their metadata (employer, category, distance, optional similarity
// to the first item) and reports:
//
//   uniqueEmployers / uniqueCategories in top-K
//   employerShare / categoryShare (HHI-style concentration over top-K)
//   employerCoverage / categoryCoverage = unique-in-top-K / available
//   pairwiseSimilarity avg over the top-K pair distances (or supplied matrix)
//   similarPairRate = fraction of top-K pairs whose similarity >= threshold
//
// Concentration is reported as the Herfindahl–Hirschman index (sum of squared
// shares) plus the max share, so "one employer dominates" is visible as HHI ≈ 1.
// =========================================================

export type RankedItem = {
  jobId: string;
  employerId: string;
  categoryId: string | null;
  distanceKm?: number | null;
};

export type DiversityMetrics = {
  topK: number;
  uniqueEmployers: number;
  uniqueCategories: number;
  employerHHI: number | null;
  categoryHHI: number | null;
  maxEmployerShare: number | null;
  maxCategoryShare: number | null;
  employerCoverage: number | null;
  categoryCoverage: number | null;
  avgPairwiseSimilarity: number | null;
  similarPairRate: number | null;
  duplicateJobRate: number | null;
};

const SIMILARITY_THRESHOLD = 0.9;

/** HHI for a list of shares (items counts); 1 = absolute concentration. */
function hhi(counts: ReadonlyMap<string, number>, total: number): number | null {
  if (total <= 0) return null;
  let sum = 0;
  for (const count of counts.values()) {
    const share = count / total;
    sum += share * share;
  }
  return sum;
}

function shareCounts(items: readonly RankedItem[], key: (item: RankedItem) => string | null): { counts: Map<string, number>; effective: number } {
  const counts = new Map<string, number>();
  let effective = 0;
  for (const item of items) {
    const k = key(item);
    if (k == null) continue;
    counts.set(k, (counts.get(k) ?? 0) + 1);
    effective += 1;
  }
  return { counts, effective };
}

/** Category equality similarity (1 = same, 0 = different or unknown on either side). */
function categorySimilarity(a: RankedItem, b: RankedItem): number {
  if (a.categoryId == null || b.categoryId == null) return 0;
  return a.categoryId === b.categoryId ? 1 : 0;
}

/** Geographic similarity using the same 1/(1+(Δ/d0)²) shape the pipeline uses. */
function locationSimilarity(a: RankedItem, b: RankedItem, d0Km: number): number | null {
  if (a.distanceKm == null || b.distanceKm == null || !(d0Km > 0)) return null;
  const delta = Math.abs(a.distanceKm - b.distanceKm);
  return 1 / (1 + (delta / d0Km) ** 2);
}

/**
 * Average pairwise similarity + similar-pair rate over the top-K ordered items.
 * `dimensions`: an optional per-dimension (0..1) similarity; category + location
 * (when both distances known) are derived from the items themselves and averaged
 * when both dimensions are evaluable. Returns null when fewer than 2 items exist.
 */
export function pairwiseSimilarity(
  items: readonly RankedItem[],
  options?: { d0Km?: number; threshold?: number },
): { avg: number | null; similarPairRate: number | null; pairs: number } {
  const k = items.length;
  if (k < 2) return { avg: null, similarPairRate: null, pairs: 0 };
  const threshold = options?.threshold ?? SIMILARITY_THRESHOLD;
  const d0 = options?.d0Km;
  let total = 0;
  let evaluable = 0;
  let similar = 0;
  let pairs = 0;
  for (let i = 0; i < k; i += 1) {
    for (let j = i + 1; j < k; j += 1) {
      pairs += 1;
      const catSim = categorySimilarity(items[i], items[j]);
      const locSim = locationSimilarity(items[i], items[j], d0 ?? Number.POSITIVE_INFINITY);
      if (locSim == null) {
        total += catSim;
        evaluable += 1;
      } else {
        // Both dimensions evaluable: average them (the pipeline's similarity
        // blends more dimensions; this is the minimal aggregate).
        total += (catSim + locSim) / 2;
        evaluable += 1;
      }
      if (catSim + (locSim ?? 0) >= (locSim == null ? 1 : 2) * threshold) similar += 1;
    }
  }
  return { avg: evaluable > 0 ? total / evaluable : null, similarPairRate: pairs > 0 ? similar / pairs : null, pairs };
}

export function diversityMetrics(items: readonly RankedItem[], universe?: { employers: ReadonlySet<string>; categories: ReadonlySet<string> }, options?: { d0Km?: number; k?: number }): DiversityMetrics {
  const topK = options?.k != null ? Math.min(Math.max(0, Math.floor(options.k)), items.length) : items.length;
  const top = items.slice(0, topK);
  if (topK === 0) {
    return {
      topK,
      uniqueEmployers: 0,
      uniqueCategories: 0,
      employerHHI: null,
      categoryHHI: null,
      maxEmployerShare: null,
      maxCategoryShare: null,
      employerCoverage: null,
      categoryCoverage: null,
      avgPairwiseSimilarity: null,
      similarPairRate: null,
      duplicateJobRate: null,
    };
  }

  const employer = shareCounts(top, (item) => item.employerId);
  const category = shareCounts(top, (item) => item.categoryId);
  const maxShare = (counts: ReadonlyMap<string, number>, effective: number): number | null => {
    if (effective <= 0) return null;
    let max = 0;
    for (const count of counts.values()) max = Math.max(max, count / effective);
    return max;
  };
  const pair = pairwiseSimilarity(top, options);

  const seenIds = new Set<string>();
  for (const item of top) seenIds.add(item.jobId);

  return {
    topK,
    uniqueEmployers: employer.counts.size,
    uniqueCategories: category.counts.size,
    employerHHI: hhi(employer.counts, employer.effective),
    categoryHHI: hhi(category.counts, category.effective),
    maxEmployerShare: maxShare(employer.counts, employer.effective),
    maxCategoryShare: maxShare(category.counts, category.effective),
    employerCoverage: universe && universe.employers.size > 0 ? employer.counts.size / universe.employers.size : null,
    categoryCoverage: universe && universe.categories.size > 0 ? category.counts.size / universe.categories.size : null,
    avgPairwiseSimilarity: pair.avg,
    similarPairRate: pair.similarPairRate,
    duplicateJobRate: 0,
  };
}