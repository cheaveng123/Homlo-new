export type QueryLike =
  | { isLoading?: boolean; data?: unknown; error?: unknown; isFetching?: boolean }
  | { loading?: boolean; data?: unknown; error?: unknown };

function getLoading(q: QueryLike): boolean {
  const s = q as { isLoading?: boolean; loading?: boolean };
  return Boolean(s.isLoading ?? s.loading);
}

function getData(q: QueryLike): unknown {
  if ('data' in q) return q.data;
  return (q as { jobs?: unknown }).jobs;
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
