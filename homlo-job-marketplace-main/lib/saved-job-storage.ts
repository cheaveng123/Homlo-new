/**
 * Decodes the persisted saved-job list.
 *
 * Returns only the recoverable ids. A corrupt, truncated or wrongly-typed
 * payload degrades to an empty list and reports why, so the caller can log it.
 * The stored value is never rewritten here, so a later write can still recover
 * the valid ids a partially-corrupt payload contains.
 */
export function parseSavedJobIds(raw: string | null | undefined): { ids: string[]; corrupted: boolean } {
  if (raw == null || raw === "") return { ids: [], corrupted: false };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ids: [], corrupted: true };
  }

  if (!Array.isArray(parsed)) return { ids: [], corrupted: true };

  const ids: string[] = [];
  const seen = new Set<string>();
  let dropped = 0;
  for (const value of parsed) {
    if (typeof value !== "string" || !value) {
      dropped += 1;
      continue;
    }
    if (seen.has(value)) continue;
    seen.add(value);
    ids.push(value);
  }
  return { ids, corrupted: dropped > 0 };
}
