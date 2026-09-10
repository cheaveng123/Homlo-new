import { useCallback, useEffect, useState } from "react";
import { getLocalValue, setLocalValue } from "./local-persistence";
import {
  addSearchHistory,
  parseSearchHistory,
  type SearchHistoryItem,
} from "./search-history-core";

const STORAGE_KEY = "homlo.searchHistory.v1";

export type { SearchHistoryItem };
export { addSearchHistory, parseSearchHistory, SEARCH_HISTORY_MAX } from "./search-history-core";

/**
 * React hook for reading and writing search history with local persistence.
 *
 * History survives app restarts (AsyncStorage on native, localStorage on web).
 * The same hook can be used from multiple screens; each instance loads the
 * persisted history on mount.
 */
export function useSearchHistory() {
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    getLocalValue(STORAGE_KEY)
      .then((raw) => parseSearchHistory(raw))
      .then((loaded) => {
        if (cancelled) return;
        setHistory(loaded);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Record a new search. Keeps the user's exact text for display while
   *  storing the effective (possibly corrected) value used to search. */
  const addSearch = useCallback((entry: { original: string; corrected: string }) => {
    setHistory((current) => {
      const next = addSearchHistory(current, entry);
      void setLocalValue(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    void setLocalValue(STORAGE_KEY, JSON.stringify([]));
  }, []);

  const removeSearch = useCallback((id: string) => {
    setHistory((current) => {
      const next = current.filter((item) => item.id !== id);
      void setLocalValue(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { history, addSearch, clearHistory, removeSearch };
}
