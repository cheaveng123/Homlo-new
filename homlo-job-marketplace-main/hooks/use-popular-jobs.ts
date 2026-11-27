import { useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useFeedClient } from "@/lib/feed-client";
import { useSearchLocation } from "@/hooks/use-search-location";
import { normalizePublishedJob } from "@/lib/job-record";
import type { Job } from "@/components/job-store";
import { trpc } from "@/lib/trpc";
import { useRefetchMissingJobs } from "@/hooks/use-refetch-missing-jobs";
import { isAwaitingData } from "@/lib/useFirstLoadSkeletonFlag";

type Options = {
  limit?: number;
  period?: "today" | "week" | "month";
};

type State = {
  jobs: Job[];
  loading: boolean;
  error: boolean;
};

const EMPTY_IDS: string[] = [];

/**
 * "Popular" jobs from the new anonymous popularity-based backend.
 * Supports period chips: today | week | month
 */
export function usePopularJobs({ limit, period = "week" }: Options = {}): State {
  const client = useFeedClient();
  const { coordinates } = useSearchLocation({ requestOnMount: false });
  // PERF: the ranked page used to be useState + useEffect (empty on every
  // mount). React Query keeps it cached, persisted and invalidated together
  // with the home feed (same ["homlo","homeFeed"] path).
  const lat = coordinates.latitude;
  const lng = coordinates.longitude;
  const pageLimit = limit ?? 20;
  const pageQuery = useQuery({
    queryKey: [["homlo", "homeFeed"], { input: { source: "feed-client-popular", lat, lng, limit: pageLimit, period }, type: "query" }],
    queryFn: async () => {
      const result = await client.popular({ lat, lng, prefs: null, limit: pageLimit, period });
      return result.items.map((item) => item.jobId);
    },
    placeholderData: keepPreviousData,
    retry: false,
  });
  const current = useMemo(
    () => (pageQuery.data ? { ids: pageQuery.data, error: false } : pageQuery.isError ? { ids: EMPTY_IDS, error: true } : null),
    [pageQuery.data, pageQuery.isError],
  );
  const jobIds = current?.ids ?? EMPTY_IDS;

  const jobsQuery = trpc.homlo.publicJobs.useQuery(undefined, {
    // Also load when the popularity feed failed, for the fallback below.
    enabled: jobIds.length > 0 || current?.error === true,
  });
  const jobRecords = jobsQuery.data;
  const jobsError = jobsQuery.isError && jobRecords === undefined;
  // Not `isLoading`: that is false for a query with no data that isn't
  // fetching yet (e.g. rebuilt empty after sign-in clears the cache), which
  // made Popular report "loaded, zero jobs" and disappear.
  const jobsLoading = isAwaitingData(jobsQuery);
  useRefetchMissingJobs(jobIds, (jobRecords as { jobs?: { id?: unknown }[] } | undefined)?.jobs);

  const jobMap = useMemo(() => {
    const map = new Map<string, Job>();
    const records = (jobRecords as { jobs?: unknown[] } | undefined)?.jobs ?? [];
    if (Array.isArray(records)) {
      for (const record of records) {
        try {
          const job = normalizePublishedJob(record as never);
          map.set(job.id, job);
        } catch (cause) {
          console.warn("[PopularJobs] normalizePublishedJob failed", cause);
        }
      }
    }
    return map;
  }, [jobRecords]);

  return useMemo<State>(() => {
    if (!current) return { jobs: [], loading: true, error: false };
    if (current.error) {
      // BUGFIX: the popularity feed failed even after retries. Show the public
      // job list (boosted first) instead of an empty "Popular" section.
      if (jobsLoading) return { jobs: [], loading: true, error: false };
      const fallback = [...jobMap.values()]
        .sort((a, b) => Number(!!b.boosted) - Number(!!a.boosted))
        .slice(0, limit ?? 20);
      return { jobs: fallback, loading: false, error: fallback.length === 0 };
    }
    if (jobIds.length === 0) return { jobs: [], loading: false, error: false };
    if (jobsLoading) return { jobs: [], loading: true, error: false };
    if (jobsError) return { jobs: [], loading: false, error: true };
    const jobs = jobIds.map((id) => jobMap.get(id)).filter((j): j is Job => !!j);
    return { jobs, loading: false, error: false };
  }, [current, jobIds, jobMap, jobsError, jobsLoading, limit]);
}
