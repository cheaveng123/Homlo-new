import { useEffect, useMemo, useState } from "react";
import { useFeedClient } from "@/lib/feed-client";
import { normalizePublishedJob } from "@/lib/job-record";
import { HOME_FEED_SPECIALIZED_COUNT, pickSpecializedFields } from "@/lib/home-feed-rotation";
import {
  fieldCategoryNames,
  specializedFields,
  type SpecializedField,
} from "@/lib/specialized-fields";
import type { Job } from "@/components/job-store";
import { trpc } from "@/lib/trpc";

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
  recommended: { items: Array<{ jobId: string }>; nextCursor: string | null; status: string };
  popular: { items: Array<{ jobId: string }>; nextCursor: string | null; status: string };
  near: { items: Array<{ jobId: string }>; nextCursor: string | null; status: string };
  explore: { items: Array<{ jobId: string }>; nextCursor: string | null; status: string };
};

/**
 * Server-composed homepage feed using the new anonymous popularity-based backend.
 */
export function useHomeFeed(options: HomeFeedOptions = {}) {
  const client = useFeedClient();

  // Fetch home feed from new backend
  const [feedData, setFeedData] = useState<HomeFeedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;

    client
      .home({
        lat: options.latitude ?? null,
        lng: options.longitude ?? null,
        prefs: null,
      })
      .then((data) => {
        if (active) {
          setFeedData(data as unknown as HomeFeedResponse);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err);
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [client, options.latitude, options.longitude]);

  // Fetch job details for all sections
  const allJobIds = useMemo(() => {
    if (!feedData) return [];
    const ids = new Set<string>();
    feedData.recommended.items.forEach((i) => ids.add(i.jobId));
    feedData.popular.items.forEach((i) => ids.add(i.jobId));
    feedData.near.items.forEach((i) => ids.add(i.jobId));
    feedData.explore.items.forEach((i) => ids.add(i.jobId));
    return Array.from(ids);
  }, [feedData]);

  const { data: jobRecords } = trpc.homlo.publicJobs.useQuery(undefined, {
    enabled: allJobIds.length > 0,
  });

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

  // Helper to convert feed items to Jobs in order
  const itemsToJobs = (items: Array<{ jobId: string }>): Job[] => {
    return items.map((item) => jobMap.get(item.jobId)).filter((j): j is Job => !!j);
  };

  const nearby = useMemo(() => (feedData ? itemsToJobs(feedData.near.items) : []), [feedData, jobMap]);
  const recommended = useMemo(() => (feedData ? itemsToJobs(feedData.recommended.items) : []), [feedData, jobMap]);
  const featured = useMemo(() => (feedData ? itemsToJobs(feedData.popular.items) : []), [feedData, jobMap]);
  const explore = useMemo(() => (feedData ? itemsToJobs(feedData.explore.items) : []), [feedData, jobMap]);

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
  const more = useMemo(() => explore, [explore]);

  // Specialized sections (using explore pool)
  const [specialized, setSpecialized] = useState<HomeFeedSection[] | null>(null);
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
    more,
    loading,
    error,
    refetch: () => {
      setLoading(true);
      setError(null);
      client
        .home({ lat: options.latitude ?? null, lng: options.longitude ?? null, prefs: null })
        .then((data) => setFeedData(data as unknown as HomeFeedResponse))
        .catch((err) => setError(err))
        .finally(() => setLoading(false));
    },
  };
}