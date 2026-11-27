import { dehydrate, hydrate, type Query, type QueryClient } from "@tanstack/react-query";
import superjson from "superjson";
import { getLocalValue, getLocalValueSync, removeLocalValue, setLocalValue } from "@/lib/local-persistence";

/**
 * PERF: persists the public, non-personal part of the React Query cache
 * (job list, categories, home feed, search pages, employer about text) to
 * AsyncStorage (native) / localStorage (web). A cold start then paints Home,
 * Explore and job details from the last session instantly and re-validates
 * in the background, instead of a blank screen while the API wakes up.
 *
 * User-specific queries (profile, applications, messages…) are never written.
 */
const STORAGE_KEY = "homlo.query-cache.v1";
const MAX_AGE_MS = 24 * 60 * 60_000;
const MAX_BYTES = 2_000_000;
const WRITE_DELAY_MS = 1_500;
const PERSISTED_PROCEDURES = new Set(["publicJobs", "categories", "homeFeed", "searchJobs", "employerProfile"]);

type Stored = { savedAt: number; state: string };

function isPersistable(query: Query): boolean {
  if (query.state.status !== "success" || query.state.data === undefined) return false;
  const path = query.queryKey[0];
  return Array.isArray(path) && path[0] === "homlo" && PERSISTED_PROCEDURES.has(String(path[1]));
}

function restoreFrom(client: QueryClient, raw: string | null): void {
  if (!raw) return;
  try {
    const stored = JSON.parse(raw) as Stored;
    if (!stored?.state || Date.now() - stored.savedAt > MAX_AGE_MS) return;
    // hydrate() never overwrites a query that already has newer data.
    hydrate(client, superjson.parse(stored.state));
  } catch {
    // A corrupt or old-format entry is simply ignored.
  }
}

let writeTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleWrite(client: QueryClient): void {
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    writeTimer = null;
    try {
      const state = superjson.stringify(dehydrate(client, { shouldDehydrateQuery: isPersistable }));
      if (state.length > MAX_BYTES) return;
      void setLocalValue(STORAGE_KEY, JSON.stringify({ savedAt: Date.now(), state } satisfies Stored)).catch(() => undefined);
    } catch {
      // Persisting is best-effort.
    }
  }, WRITE_DELAY_MS);
}

/**
 * Restores the persisted cache (synchronously on web, as soon as storage
 * answers on native) and keeps it saved as queries succeed.
 */
export function setupQueryPersistence(client: QueryClient): void {
  const syncRaw = getLocalValueSync(STORAGE_KEY);
  if (syncRaw) {
    restoreFrom(client, syncRaw);
  } else {
    void getLocalValue(STORAGE_KEY).then((raw) => restoreFrom(client, raw)).catch(() => undefined);
  }
  client.getQueryCache().subscribe((event) => {
    if (event.type === "updated" && event.action.type === "success" && isPersistable(event.query)) {
      scheduleWrite(client);
    }
  });
}

/** Forget the persisted cache (sign-out / account switch). */
export function clearPersistedQueries(): void {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = null;
  void removeLocalValue(STORAGE_KEY).catch(() => undefined);
}
