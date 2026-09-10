import { normalizeQuery } from "./fuzzy-match";

export type SearchHistoryItem = {
  id: string;
  /** The text exactly as the user typed it (used for display). */
  original: string;
  /** The effective search value (may be a fuzzy-corrected/cleaned location). */
  corrected: string;
  /** ISO timestamp when the search was performed. */
  at: string;
};

export const SEARCH_HISTORY_MAX = 20;
const DEFAULT_MAX = 12;

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Pure reducer for adding a search to an existing history list.
 * Dedupes by the normalized original text (so re-searching the same thing
 * moves it to the top), keeps the newest first, and caps the list length.
 * This is a pure function with no storage/React dependencies so it is easy to
 * unit test.
 */
export function addSearchHistory(
  history: SearchHistoryItem[],
  entry: { original: string; corrected: string },
  max: number = DEFAULT_MAX,
): SearchHistoryItem[] {
  const original = entry.original.trim();
  if (!original) return history;

  const key = normalizeQuery(original);
  const next: SearchHistoryItem[] = [
    { id: makeId(), original, corrected: entry.corrected.trim() || original, at: new Date().toISOString() },
    ...history.filter((item) => normalizeQuery(item.original) !== key),
  ];
  return next.slice(0, Math.min(max, SEARCH_HISTORY_MAX));
}

/** Reads persisted search history (JSON) into a list, tolerating corrupt data. */
export function parseSearchHistory(raw: string | null): SearchHistoryItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is SearchHistoryItem =>
          item &&
          typeof item.original === "string" &&
          typeof item.corrected === "string" &&
          (typeof item.at === "string" || typeof item.at === "number"),
      )
      .map((item) => ({
        id: typeof item.id === "string" ? item.id : makeId(),
        original: item.original,
        corrected: item.corrected,
        at: typeof item.at === "string" ? item.at : new Date(item.at).toISOString(),
      }));
  } catch {
    return [];
  }
}
