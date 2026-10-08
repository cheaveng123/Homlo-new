/**
 * Normalises a job-type label to one of the `JOB_TYPE_IMAGES` keys
 * (components/shared/jobTypeImage.ts).
 *
 * Deliberately asset-free so the mapping can be unit tested — the module that
 * holds the `require()` handles cannot be imported outside Metro.
 *
 * The data layer is inconsistent here for real reasons — the posting wizard
 * writes "Full-time"/"Part-time" (lib/job-posting.ts), search filters use the
 * singular "Weekend" (lib/search-filters.ts), the home category route uses
 * "weekend" (constants/jobCategories.ts), and employer records use snake_case
 * "full_time"/"weekends". Matched by prefix so "Full-time (Permanent)" resolves.
 *
 * Returns null when there is no matching artwork, so callers decide whether to
 * fall back or simply omit the image.
 */
export function jobTypeImageKey(label: string | null | undefined): string | null {
  if (!label) return null;
  const normalized = label.trim().toLowerCase().replace(/[\s_]+/g, '-');
  if (normalized.startsWith('full')) return 'full-time';
  if (normalized.startsWith('part')) return 'part-time';
  if (normalized.startsWith('remote')) return 'remote';
  if (normalized.startsWith('weekend')) return 'weekends';
  return null;
}
