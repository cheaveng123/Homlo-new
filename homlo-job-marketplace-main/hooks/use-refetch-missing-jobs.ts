import { useEffect } from "react";
import { trpc } from "@/lib/trpc";

/**
 * BUGFIX: feed screens get ranked job IDS from /feed/* and look each one up in
 * the cached `publicJobs` list. A job newer than that cached list (just posted,
 * re-opened, or boosted) silently vanished from the section. When the feed
 * names jobs the list doesn't have, refresh the list once (throttled app-wide
 * so several sections noticing at once cause a single request).
 */
const MIN_GAP_MS = 15_000;
let lastRefetchAt = 0;
/**
 * PERF: ids we already refreshed the list for. A feed id that is still
 * missing afterwards (closed, private, or past the list's limit) used to
 * trigger a full publicJobs refetch every 15s on any re-render — including
 * the re-renders caused by scrolling. Each id now triggers at most one.
 */
const alreadyTried = new Set<string>();

export function useRefetchMissingJobs(
  feedJobIds: readonly string[],
  records: readonly { id?: unknown }[] | undefined,
): void {
  const utils = trpc.useUtils();
  useEffect(() => {
    if (!records || feedJobIds.length === 0) return;
    const known = new Set(records.map((r) => String(r?.id)));
    const missing = feedJobIds.filter((id) => !known.has(id) && !alreadyTried.has(id));
    if (missing.length === 0) return;
    if (Date.now() - lastRefetchAt < MIN_GAP_MS) return;
    lastRefetchAt = Date.now();
    missing.forEach((id) => alreadyTried.add(id));
    if (alreadyTried.size > 2_000) alreadyTried.clear();
    void utils.homlo.publicJobs.invalidate();
  }, [feedJobIds, records, utils]);
}
