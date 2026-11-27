import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { isAwaitingData } from "@/lib/useFirstLoadSkeletonFlag";
import { resolveSearchTypos } from "@/lib/fuzzy-match";
import { resolveJobImage } from "@/lib/job-banner";
import { computePositionsLeft } from "@/lib/positions";

export type SearchJobRecord = {
  id: string;
  title: string;
  description: string;
  pay_amount: number | string;
  pay_currency: string;
  pay_type: "hourly" | "daily" | "fixed";
  location_text: string | null;
  latitude: number | null;
  longitude: number | null;
  workers_needed: number;
  workers_hired?: number | null;
  created_at: string;
  category: string;
  employer_name: string | null;
  employer_photo_key: string | null;
  banner_image: string | null;
  relevance_score: number;
};

export type JobSearchParams = {
  query?: string;
  category?: string;
  employmentType?: string;
  arrangement?: string;
  experience?: string;
  location?: string;
  salaryMin?: number;
  salaryMax?: number;
  posted?: string;
  sort?: "recommended" | "newest" | "salary_high_to_low" | "closest";
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  bbox?: string;
  limit?: number;
  offset?: number;
};

function money(amount: number | string, currency: string, type: SearchJobRecord["pay_type"]) {
  const numeric = Number(amount);
  const formatted = Number.isFinite(numeric) ? numeric.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(amount);
  const symbol = currency.toUpperCase() === "USD" ? "$" : `${currency.toUpperCase()} `;
  const suffix = type === "hourly" ? " / hour" : type === "daily" ? " / day" : "";
  return `${symbol}${formatted}${suffix}`;
}

function postedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Posted recently";
  const ageHours = Math.max(0, Math.floor((Date.now() - date.getTime()) / 3_600_000));
  if (ageHours < 1) return "Posted just now";
  if (ageHours < 24) return `Posted ${ageHours}h ago`;
  const ageDays = Math.floor(ageHours / 24);
  return ageDays === 1 ? "Posted yesterday" : `Posted ${ageDays} days ago`;
}

function normalizeSearchJob(record: SearchJobRecord) {
  const location = record.location_text?.trim() || "Location to be confirmed";
  const remote = location.toLowerCase().includes("remote");
  const arrangement: "On-site" | "Hybrid" | "Remote" = remote ? "Remote" : "On-site";
  const workersNeeded = Number(record.workers_needed) || 0;
  const workersHired = Number(record.workers_hired ?? 0);
  return {
    id: record.id,
    title: record.title,
    company: record.employer_name?.trim() || "Homlo employer",
    location,
    schedule: record.pay_type === "hourly" ? "Flexible hours" : "Schedule set by employer",
    pay: money(record.pay_amount, record.pay_currency, record.pay_type),
    tag: "Open role",
    category: record.category || "Other",
    image: resolveJobImage(record.banner_image),
    description: record.description,
    arrangement,
    experience: "Experience not specified",
    posted: postedAt(record.created_at),
    status: "New" as const,
    relevanceScore: record.relevance_score,
    positionsAvailable: computePositionsLeft(workersNeeded, workersHired),
    positionsTotal: workersNeeded,
    positionsFilled: workersHired,
  };
}

export function useJobSearch(params: JobSearchParams, options?: { enabled?: boolean }) {
  // Resolve typos in the query/location before hitting the backend so a
  // slightly-wrong location still finds the closest meaningful results. We
  // only send the corrected values; the UI keeps the user's original text.
  const resolvedParams = useMemo<JobSearchParams>(() => {
    if (!params.query && !params.location) return params;
    return {
      ...params,
      ...(params.query ? { query: resolveSearchTypos(params.query).corrected } : {}),
      ...(params.location ? { location: resolveSearchTypos(params.location).corrected } : {}),
    };
  }, [params]);

  const enabled = options?.enabled ?? true;

  const query = trpc.homlo.searchJobs.useQuery(resolvedParams, {
    enabled,
    staleTime: 30_000,
    placeholderData: (previousData) => previousData,
  });

  const jobs = useMemo(() => (query.data?.jobs ?? []).map(normalizeSearchJob), [query.data?.jobs]);

  return {
    jobs,
    // Loading until results (or an error) arrive. `isLoading` alone is false
    // for a pending query that isn't fetching yet, which screens read as "no
    // results". A disabled search is idle, not loading.
    loading: enabled && isAwaitingData(query),
    error: query.error,
    refetch: query.refetch,
    isFetching: query.isFetching,
    resolvedQuery: resolvedParams.query ?? "",
  };
}