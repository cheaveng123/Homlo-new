import { useEffect, useMemo, useState } from "react";
import { useFeedClient } from "@/lib/feed-client";
import { useSearchLocation } from "@/hooks/use-search-location";
import { normalizePublishedJob } from "@/lib/job-record";
import type { Job } from "@/components/job-store";
import { trpc } from "@/lib/trpc";

type Options = {
  limit?: number;
  period?: "today" | "week" | "month";
};

type State = {
  jobs: Job[];
  loading: boolean;
  error: boolean;
};

const INITIAL_STATE: State = { jobs: [], loading: true, error: false };

/**
 * "Popular" jobs from the new anonymous popularity-based backend.
 * Supports period chips: today | week | month
 */
export function usePopularJobs({ limit, period = "week" }: Options = {}) {
  const [state, setState] = useState<State>(INITIAL_STATE);
  const [jobIds, setJobIds] = useState<string[]>([]);
  const client = useFeedClient();
  const { coordinates } = useSearchLocation({ requestOnMount: false });

  useEffect(() => {
    let active = true;
    setState(INITIAL_STATE);
    setJobIds([]);

    client
      .popular({
        lat: coordinates.latitude,
        lng: coordinates.longitude,
        prefs: null,
        limit: limit ?? 20,
        period,
      })
      .then((page) => {
        if (!active) return;
        const ids = page.items.map((item) => item.jobId);
        if (ids.length === 0) {
          setState({ jobs: [], loading: false, error: false });
          return;
        }
        setJobIds(ids);
      })
      .catch(() => {
        if (active) setState((current) => ({ ...current, loading: false, error: true }));
      });

    return () => {
      active = false;
    };
  }, [client, coordinates.latitude, coordinates.longitude, limit, period]);

  const {
    data: jobRecords,
    isLoading: jobsLoading,
    isError: jobsError,
  } = trpc.homlo.publicJobs.useQuery(undefined, {
    enabled: jobIds.length > 0,
  });

  const jobMap = useMemo(() => {
    const map = new Map<string, Job>();
    const records = (jobRecords as any)?.jobs ?? [];
    if (Array.isArray(records)) {
      for (const record of records) {
        try {
          const job = normalizePublishedJob(record);
          map.set(job.id, job);
        } catch (cause) {
          console.warn("[PopularJobs] normalizePublishedJob failed", cause);
        }
      }
    }
    return map;
  }, [jobRecords]);

  useEffect(() => {
    if (jobIds.length === 0) return;
    if (jobsLoading) return;
    if (jobsError) {
      setState({ jobs: [], loading: false, error: true });
      return;
    }
    const jobs = jobIds.map((id) => jobMap.get(id)).filter((j): j is Job => !!j);
    setState({ jobs, loading: false, error: false });
  }, [jobIds, jobMap, jobsError, jobsLoading]);

  return state;
}
