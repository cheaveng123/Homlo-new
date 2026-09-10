import { useMemo } from "react";

import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { resolveJobImage } from "@/lib/job-banner";
import { type Job } from "@/components/job-store";

// Phase 9: the "Recommended for you" section renders the AUTHORITATIVE server
// ranking (homlo.recommendations.feed) verbatim. No local scoring, no re-sort:
// the client displays the server's order, exactly as phase 6 assembled it.
// A minimal subset type is used here instead of the backend FeedItem so the
// mobile bundle stays decoupled from server modules.

type RecommendedFeedJob = {
  jobId: string;
  title: string;
  description: string;
  payAmount: number;
  payCurrency: string;
  payType: "hourly" | "daily" | "fixed";
  locationText: string | null;
  createdAt: string;
  category: string;
  employerName: string | null;
  bannerImage: string | null;
};

type RecommendedFeedItem = {
  job: RecommendedFeedJob;
  feedPosition: number;
};

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=600&q=80";

function money(amount: number, currency: string, type: RecommendedFeedJob["payType"]) {
  const formatted = Number.isFinite(amount) ? amount.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(amount);
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

function normalizeFeedJob(item: RecommendedFeedItem): Job {
  const job = item.job;
  const location = job.locationText?.trim() || "Location to be confirmed";
  const remote = location.toLowerCase().includes("remote");
  return {
    id: job.jobId,
    title: job.title,
    company: job.employerName?.trim() || "Homlo employer",
    location,
    schedule: job.payType === "hourly" ? "Flexible hours" : "Schedule set by employer",
    pay: money(job.payAmount, job.payCurrency, job.payType),
    tag: "Recommended",
    category: job.category || "Other",
    image: resolveJobImage(job.bannerImage),
    description: job.description,
    arrangement: remote ? "Remote" : "On-site",
    experience: "Experience not specified",
    posted: postedAt(job.createdAt),
    status: "New",
  };
}

export function useRecommendedJobs(pageSize = 4) {
  const { isAuthenticated } = useAuth();
  const query = trpc.homlo.recommendations.feed.useQuery(
    { pageSize },
    {
      enabled: isAuthenticated,
      staleTime: 60_000,
      retry: false,
    },
  );
  const jobs = useMemo(() => (query.data?.jobs ?? []).map(normalizeFeedJob), [query.data?.jobs]);
  return { jobs, loading: query.isLoading, error: query.error, refetch: query.refetch };
}