// lib/repositories/popularJobsRepository.ts
//
// Data-access layer for the home page's "Popular" section. Screens call this
// and never a data source directly.
//
// Data strategy (mock-first, live merge) — mirrors
// lib/repositories/employerRepository.ts:
//
//   * There is no real popularity signal yet. `job_events` (views/clicks/
//     applications) and `job_quality_stats` exist in SQL, but no read model
//     selects or aggregates them, and migration 020 notes the aggregation is
//     not implemented. So this repository cannot honestly rank by views or
//     applies.
//   * Until that aggregate ships, ranking falls back to the curated
//     `MOCK_JOBS` list, which is ordered by hand and stands in for a
//     popularity ranking. Live published jobs are merged in behind the curated
//     entries, deduped by id, so the section fills out on a real backend
//     without the screen knowing where anything came from.
//   * When `TRPC_POPULAR_JOBS` is set the live feed wins outright.
//
// Replacing the mock rank with a real one means changing `rankCurated()` and
// swapping `loadLivePopular()` onto a view/apply aggregate — nothing in the
// screen or the job container changes.

import { normalizePublishedJob, type JobRecord } from "@/lib/job-record";
import { trpcDirect } from "@/lib/trpc";
import { MOCK_EMPLOYERS, MOCK_JOBS } from "@/lib/mock/employerMockData";
import type { Job } from "@/components/job-store";

const DEFAULT_LIMIT = 6;
const LIVE_FALLBACK_LIMIT = 12;

/** Stands in for `requestAnimationFrame`/`setTimeout(0)` on the way back from a fetch. */
function simulateNetwork<T>(value: T, delayMs = 150): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), delayMs));
}

/**
 * The curated seed order, restricted to listings that are still live. MOCK_JOBS
 * is already hand-ordered by the mock data author; keeping that order (rather
 * than re-sorting by date) is what makes it a stand-in for popularity.
 */
function rankCurated(): Job[] {
  return MOCK_JOBS.filter((listing) => listing.status === "live").map((listing) => {
    const employer = MOCK_EMPLOYERS[listing.employerId];
    const unit = listing.priceUnit === "hr" ? "hour" : "month";
    return {
      id: listing.id,
      employerId: listing.employerId,
      title: listing.title,
      company: employer?.name ?? listing.employerId,
      location: listing.location,
      latitude: listing.latitude ?? null,
      longitude: listing.longitude ?? null,
      isCurated: true,
      schedule: "Schedule set by employer",
      pay: `$${listing.price} / ${unit}`,
      tag: listing.type === "remote" ? "Remote" : listing.type === "weekends" ? "Weekend" : "Full-time",
      category: employer?.industry ?? "Job",
      image: listing.photoUrl ?? "",
      description: listing.title,
      arrangement: listing.workArrangement ?? (listing.type === "remote" ? "Remote" : "On-site"),
      experience: "Entry level",
      posted: "Posted recently",
      positionsAvailable: listing.spotsRemaining,
      positionsTotal: listing.spotsRemaining,
    } satisfies Job;
  });
}

let liveCache: JobRecord[] | null = null;

async function loadLivePopular(): Promise<Job[]> {
  if (liveCache) return liveCache.map(normalizePublishedJob);
  try {
    const response = await trpcDirect.homlo.publicJobs.query();
    liveCache = response?.jobs ?? [];
  } catch {
    liveCache = [];
  }
  // Newest first: with no engagement data, recency is the one real signal
  // available for the jobs that aren't in the curated set.
  return [...liveCache]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, LIVE_FALLBACK_LIMIT)
    .map(normalizePublishedJob);
}

export async function getPopularJobs(limit = DEFAULT_LIMIT): Promise<Job[]> {
  const [curated, live] = await Promise.all([simulateNetwork(rankCurated()), loadLivePopular()]);

  // Curated first so the section looks deliberate while the live feed is cold;
  // live-only jobs fill the remainder.
  const seen = new Set<string>();
  const merged = [...curated, ...live].filter((job) => {
    if (seen.has(job.id)) return false;
    seen.add(job.id);
    return true;
  });

  return merged.slice(0, limit);
}