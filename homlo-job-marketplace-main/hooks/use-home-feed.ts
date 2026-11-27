import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { clearFeedClientCache, useFeedClient } from "@/lib/feed-client";
import { normalizePublishedJob } from "@/lib/job-record";
import { HOME_FEED_SPECIALIZED_COUNT, pickSpecializedFields } from "@/lib/home-feed-rotation";
import {
  fieldCategoryNames,
  specializedFields,
  type SpecializedField,
} from "@/lib/specialized-fields";
import type { Job } from "@/components/job-store";
import { trpc } from "@/lib/trpc";
import { useRefetchMissingJobs } from "@/hooks/use-refetch-missing-jobs";
import { VOLUNTEER_PATTERN } from "@/lib/job-types";
import { jobsJoinSettled } from "@/lib/useFirstLoadSkeletonFlag";

/** Default radius for "Jobs near you" (mirrors the server default). */
export const HOME_FEED_RADIUS_KM = 50;

export type HomeFeedSection = {
  field: SpecializedField;
  jobs: Job[];
};

type HomeFeedOptions = {
  latitude?: number | null;
  longitude?: number | null;
  radiusKm?: number;
};

type HomeFeedResponse = {
  recommended: { items: { jobId: string }[]; nextCursor: string | null; status: string };
  popular: { items: { jobId: string }[]; nextCursor: string | null; status: string };
  near: { items: { jobId: string }[]; nextCursor: string | null; status: string };
  explore: { items: { jobId: string }[]; nextCursor: string | null; status: string };
};

/**
 * Server-composed homepage feed using the new anonymous popularity-based backend.
 */
/** Feed items -> normalized Jobs, in feed order (skips ids with no record). */
function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function itemsToJobs(items: { jobId: string }[], jobMap: Map<string, Job>): Job[] {
  return items.map((item) => jobMap.get(item.jobId)).filter((j): j is Job => !!j);
}

/** React Query key for the client-composed home feed (under tRPC's homeFeed path). */
export function homeFeedQueryKey(lat: number | null, lng: number | null) {
  return [["homlo", "homeFeed"], { input: { source: "feed-client", lat, lng }, type: "query" }] as const;
}

let lastSpecialized: HomeFeedSection[] | null = null;

export function useHomeFeed(options: HomeFeedOptions = {}) {
  const client = useFeedClient();

  // PERF: the ranked feed used to live in useState + useEffect, so every Home
  // mount started empty (skeleton) and waited for the network again. It now
  // lives in React Query under the ["homlo","homeFeed"] key: revisits render
  // the cached feed instantly and re-validate in the background, the cache is
  // persisted across cold starts, and the existing
  // utils.homlo.homeFeed.invalidate() calls after post/edit/apply/boost
  // refresh it at once.
  const lat = options.latitude ?? null;
  const lng = options.longitude ?? null;
  const feedQuery = useQuery({
    queryKey: homeFeedQueryKey(lat, lng),
    queryFn: () => client.home({ lat, lng, prefs: null }) as unknown as Promise<HomeFeedResponse>,
    // Keep the last feed on screen while a new location's feed loads.
    placeholderData: keepPreviousData,
    // feed-client already retries network/5xx failures with backoff.
    retry: false,
  });
  const remoteFeed = feedQuery.data ?? null;
  const loading = feedQuery.isPending;
  const error = (feedQuery.error as Error | null) ?? null;

  // Fetch job details for all sections
  const allJobIds = useMemo(() => {
    const feedData = remoteFeed;
    if (!feedData) return [];
    const ids = new Set<string>();
    feedData.recommended.items.forEach((i) => ids.add(i.jobId));
    feedData.popular.items.forEach((i) => ids.add(i.jobId));
    feedData.near.items.forEach((i) => ids.add(i.jobId));
    feedData.explore.items.forEach((i) => ids.add(i.jobId));
    return Array.from(ids);
  }, [remoteFeed]);

  const { data: jobRecords } = trpc.homlo.publicJobs.useQuery(undefined, {
    // Also load when the feed failed, so the fallback below has jobs to show.
    enabled: allJobIds.length > 0 || error !== null,
  });
  useRefetchMissingJobs(allJobIds, (jobRecords as any)?.jobs);

  // Map jobId -> normalized Job
  const jobMap = useMemo(() => {
    const map = new Map<string, Job>();
    const records = (jobRecords as any)?.jobs ?? [];
    if (Array.isArray(records)) {
      for (const record of records) {
        try {
          const job = normalizePublishedJob(record);
          map.set(job.id, job);
        } catch (cause) {
          console.warn("[HomeFeed] normalizePublishedJob failed", cause);
        }
      }
    }
    return map;
  }, [jobRecords]);

  // BUGFIX: if the ranked feed is unavailable (offline, timeout, server error
  // after retries), build the sections from the public job list instead of
  // rendering every job section empty. Boosted jobs first, then list order.
  const fallbackFeed = useMemo<HomeFeedResponse | null>(() => {
    if (remoteFeed || !error) return null;
    const records = (jobRecords as any)?.jobs;
    if (!Array.isArray(records) || records.length === 0) return null;
    const ordered = [...records].sort((a, b) => Number(!!b?.boosted) - Number(!!a?.boosted));
    const items = ordered.map((r) => ({ jobId: String(r.id) }));
    const lat = options.latitude;
    const lng = options.longitude;
    const radius = options.radiusKm ?? HOME_FEED_RADIUS_KM;
    const near =
      typeof lat === "number" && typeof lng === "number"
        ? ordered
            .filter((r) => Number.isFinite(Number(r?.latitude)) && Number.isFinite(Number(r?.longitude)))
            .map((r) => ({ id: String(r.id), d: distanceKm(lat, lng, Number(r.latitude), Number(r.longitude)) }))
            .filter((r) => r.d <= radius)
            .sort((a, b) => a.d - b.d)
            .map((r) => ({ jobId: r.id }))
        : [];
    const page = (list: { jobId: string }[]) => ({ items: list.slice(0, 10), nextCursor: null, status: "fallback" });
    return { recommended: page(items), popular: page(items), near: page(near), explore: { items, nextCursor: null, status: "fallback" } };
  }, [remoteFeed, error, jobRecords, options.latitude, options.longitude, options.radiusKm]);
  const feedData = remoteFeed ?? fallbackFeed;
  // True once the sections hold real results: the feed (or its fallback) is in
  // and its job records have loaded. Sign-in clears the query cache, so the
  // feed's ids can be on screen (kept as placeholder data) while the records
  // reload; sections must read that as "loading", not "zero jobs".
  // A failed records query keeps this false, so sections hold their skeleton.
  const ready = jobsJoinSettled({
    idsSettled: feedData !== null,
    idCount: allJobIds.length,
    recordsLoaded: jobRecords !== undefined,
  });

  const nearby = useMemo(() => (feedData ? itemsToJobs(feedData.near.items, jobMap) : []), [feedData, jobMap]);
  const recommended = useMemo(() => (feedData ? itemsToJobs(feedData.recommended.items, jobMap) : []), [feedData, jobMap]);
  const featured = useMemo(() => (feedData ? itemsToJobs(feedData.popular.items, jobMap) : []), [feedData, jobMap]);
  const explore = useMemo(() => (feedData ? itemsToJobs(feedData.explore.items, jobMap) : []), [feedData, jobMap]);

  // For remote/weekend/more, we'll use explore as the pool
  const remote = useMemo(() => explore.filter((j) => j.arrangement === "Remote"), [explore]);
  const weekend = useMemo(
    () =>
      explore.filter(
        (j) =>
          /weekend|saturday|sunday/i.test(j.title) || /weekend|saturday|sunday/i.test(j.description)
      ),
    [explore]
  );
  // Volunteer: no volunteer field exists, so match the wording (or an unpaid $0 listing).
  const volunteer = useMemo(
    () =>
      explore.filter(
        (j) =>
          VOLUNTEER_PATTERN.test(`${j.title} ${j.description} ${j.category}`) ||
          (/\d/.test(String(j.pay)) && Number(String(j.pay).replace(/[^0-9.]/g, "")) === 0)
      ),
    [explore]
  );
  const more = useMemo(() => explore, [explore]);

  // Specialized sections (using explore pool)
  // PERF: start from the last computed sections so a remount doesn't flash
  // the specialized skeleton while the (async) rotation is re-read.
  const [specialized, setSpecializedState] = useState<HomeFeedSection[] | null>(() => lastSpecialized);
  const setSpecialized = (next: HomeFeedSection[] | null | ((current: HomeFeedSection[] | null) => HomeFeedSection[] | null)) =>
    setSpecializedState((current) => {
      const value = typeof next === "function" ? next(current) : next;
      lastSpecialized = value;
      return value;
    });
  useEffect(() => {
    if (!feedData) {
      return;
    }
    let active = true;
    const rawSections = specializedFields
      .map((field) => {
        const names = new Set(
          fieldCategoryNames(field).map((name) => name.trim().toLowerCase()),
        );
        return {
          field,
          jobs: explore.filter((job) => names.has(job.category.trim().toLowerCase())),
        };
      })
      .filter((section) => section.jobs.length > 0);
    pickSpecializedFields(
      rawSections.map((section) => section.field),
      HOME_FEED_SPECIALIZED_COUNT,
    )
      .then((fields) => {
        if (!active) return;
        const jobsByField = new Map(rawSections.map((section) => [section.field.id, section.jobs]));
        setSpecialized(
          fields.map((field) => ({
            field,
            jobs: jobsByField.get(field.id) ?? [],
          })),
        );
      })
      .catch((cause) => {
        console.warn("[HomeFeed] Specialized rotation failed", cause);
        if (active) setSpecialized((current) => current ?? []);
      });
    return () => {
      active = false;
    };
  }, [feedData, explore]);

  const specializedSections = feedData ? specialized : null;

  return {
    nearby,
    recommended,
    featured,
    specialized: specializedSections,
    specializedLoading: specializedSections === null,
    remote,
    weekend,
    volunteer,
    more,
    loading,
    ready,
    error,
    refetch: () => {
      clearFeedClientCache();
      void feedQuery.refetch();
    },
  };
}