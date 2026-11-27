export type QueryLike =
  | { isLoading?: boolean; data?: unknown; error?: unknown; isFetching?: boolean }
  | { loading?: boolean; data?: unknown; error?: unknown };

function getLoading(q: QueryLike): boolean {
  const s = q as { isLoading?: boolean; loading?: boolean };
  return Boolean(s.isLoading ?? s.loading);
}

/**
 * The query's data, with an empty array treated as "nothing yet". List hooks
 * usually hand back `[]` while their first request is in flight, and `[]` is
 * truthy, so without this the skeleton never showed and the empty state
 * flashed instead (this hid the Job type page skeleton).
 */
function getData(q: QueryLike): unknown {
  const data = 'data' in q ? q.data : (q as { jobs?: unknown }).jobs;
  return Array.isArray(data) && data.length === 0 ? undefined : data;
}

function getError(q: QueryLike): unknown {
  if ('error' in q) return q.error;
  return q.error;
}

export function useFirstLoadSkeletonFlag(q: QueryLike): boolean {
  return getLoading(q) && !getData(q);
}

export function canShowEmptyState(q: QueryLike): boolean {
  return !getLoading(q) && !getData(q) && !getError(q);
}

/**
 * True until a query has produced data or an error.
 *
 * Don't use TanStack v5's `isLoading` for this: it is `isPending && isFetching`,
 * so it is false for a query that has no data but isn't fetching right now —
 * disabled, paused offline, or rebuilt empty after `queryClient.clear()` on
 * sign-in. Screens read that as "loaded, zero items" and drew nothing.
 */
export function isAwaitingData(q: { data?: unknown; isError?: boolean }): boolean {
  return q.data === undefined && !q.isError;
}

/**
 * Ranked feeds return job ids first; the cards need the matching public job
 * records. The list is settled only when the ids are in and, if there are any,
 * the records are too. Ids without records is "not ready", never "empty".
 */
export function jobsJoinSettled(s: { idsSettled: boolean; idCount: number; recordsLoaded: boolean }): boolean {
  return s.idsSettled && (s.idCount === 0 || s.recordsLoaded);
}

export type SectionLoadState = 'loading' | 'ready' | 'empty';

/**
 * What a section should draw. Items on hand always render (stale cards beat a
 * skeleton during a refetch). With no items, the section shows a skeleton
 * until its data has genuinely settled; only a settled, zero-item section is
 * "empty" (hidden, or an empty state where one fits). An errored or skipped
 * query never settles, so it keeps the skeleton instead of vanishing.
 */
export function sectionLoadState(s: { settled: boolean; count: number }): SectionLoadState {
  if (s.count > 0) return 'ready';
  return s.settled ? 'empty' : 'loading';
}
