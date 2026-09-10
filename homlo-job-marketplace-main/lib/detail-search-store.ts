import { useEffect, useState } from "react";

import type { SearchFilters } from "@/lib/search-filters";

export type DetailSearchPayload = {
  query: string;
  filters: SearchFilters;
};

let snapshot: DetailSearchPayload | null = null;
let applied: DetailSearchPayload | null = null;

const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

/** Records the current main-search state so the detail page can pre-fill. */
export function publishDetailSnapshot(payload: DetailSearchPayload | null) {
  snapshot = payload;
}

export function getDetailSnapshot(): DetailSearchPayload | null {
  return snapshot;
}

/** Applies the filters chosen on the detail page; consumed by the main search on focus. */
export function publishAppliedFilters(payload: DetailSearchPayload) {
  applied = payload;
  notify();
}

export function consumeAppliedFilters(): DetailSearchPayload | null {
  const value = applied;
  applied = null;
  notify();
  return value;
}

/**
 * Subscribes a component to the store. Any applied filters are exposed so the
 * main search page can react the moment it regains focus.
 */
export function useDetailSearchStore() {
  const [state, setState] = useState<{ snapshot: DetailSearchPayload | null; applied: DetailSearchPayload | null }>(() => ({ snapshot, applied }));

  useEffect(() => {
    const listener = () => setState({ snapshot, applied });
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return state;
}