import { getLocalValue, setLocalValue } from "@/lib/local-persistence";

const QUICK_SEARCH_KEY = "homlo.quick-search";

export type QuickSearchAnswers = {
  /** True once the wizard has been completed at least once. */
  hasCompletedQuickSearch: boolean;
  /** The params the last wizard run sent to /search-results. */
  params: Record<string, string>;
};

/**
 * Reads the persisted quick-search answers. Returns null when the user has
 * never finished the wizard (or storage is unavailable), so the home button
 * knows whether to open the wizard or jump straight to results.
 */
export async function getQuickSearchAnswers(): Promise<QuickSearchAnswers | null> {
  try {
    const raw = await getLocalValue(QUICK_SEARCH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as QuickSearchAnswers;
    return parsed && parsed.hasCompletedQuickSearch ? parsed : null;
  } catch {
    return null;
  }
}

/** Persists a completed wizard run so the home button skips the wizard next time. */
export async function saveQuickSearchAnswers(params: Record<string, string>): Promise<void> {
  const payload: QuickSearchAnswers = { hasCompletedQuickSearch: true, params };
  await setLocalValue(QUICK_SEARCH_KEY, JSON.stringify(payload));
}