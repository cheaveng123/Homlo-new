import { useMemo } from "react";

import { jobs as curatedJobs } from "@/components/job-store";
import { trpc } from "@/lib/trpc";
import { normalizePublishedJob, type JobRecord } from "@/lib/job-record";

type PublishedRecord = Omit<JobRecord, "workers_needed" | "banner_image"> & {
  workers_needed?: number;
  banner_image?: string | null;
};

function toJobRecord(record: PublishedRecord): JobRecord {
  return {
    id: record.id,
    title: record.title,
    description: record.description,
    pay_amount: record.pay_amount,
    pay_currency: record.pay_currency,
    pay_type: record.pay_type,
    location_text: record.location_text,
    workers_needed: record.workers_needed ?? 1,
    created_at: record.created_at,
    category: record.category,
    employer_name: record.employer_name,
    banner_image: record.banner_image,
  };
}

export function usePublishedJobs() {
  const query = trpc.homlo.publicJobs.useQuery(undefined, {
    // Home mounts its queries on every tab visit; render fresh data instantly
    // from the client cache and only re-validate in the background once the
    // window is stale, instead of refetching on every mount.
    staleTime: 30_000,
    placeholderData: (previousData) => previousData,
  });
  const liveJobs = useMemo(
    () => (query.data?.jobs ?? []).map((job) => normalizePublishedJob(toJobRecord(job))),
    [query.data?.jobs],
  );
  const allJobs = useMemo(() => {
    const seen = new Set<string>();
    return [...liveJobs, ...curatedJobs].filter((job) => {
      if (seen.has(job.id)) return false;
      seen.add(job.id);
      return true;
    });
  }, [liveJobs]);
  return { jobs: allJobs, liveJobs, loading: query.isLoading, error: query.error, refetch: query.refetch };
}