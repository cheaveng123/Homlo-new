import { useEffect, useMemo, useState } from "react";

import type { Job } from "@/components/job-store";
import { normalizePublishedJob } from "@/lib/job-record";
import { HOME_FEED_SPECIALIZED_COUNT, pickSpecializedFields } from "@/lib/home-feed-rotation";
import type { SpecializedField } from "@/lib/specialized-fields";
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

/**
 * Server-composed homepage feed. The layout's nearby/recommended/featured and
 * listing data all come from `homlo.homeFeed`; the specialized sections are
 * rotated once per page session from the eligible fields the server returned.
 */
export function useHomeFeed(options: HomeFeedOptions = {}) {
  const radiusKm = options.radiusKm ?? HOME_FEED_RADIUS_KM;
  const query = trpc.homlo.homeFeed.useQuery(
    {
      latitude: options.latitude ?? null,
      longitude: options.longitude ?? null,
      radiusKm,
    },
    {
      staleTime: 30_000,
      placeholderData: (previousData) => previousData,
    },
  );
  const payload = query.data;

  const nearby = useMemo(
    () => (payload?.nearby ?? []).map(normalizePublishedJob),
    [payload?.nearby],
  );
  const recommended = useMemo(
    () => (payload?.recommended ?? []).map(normalizePublishedJob),
    [payload?.recommended],
  );
  const featured = useMemo(
    () => (payload?.featured ?? []).map(normalizePublishedJob),
    [payload?.featured],
  );
  const remote = useMemo(
    () => (payload?.remote ?? []).map(normalizePublishedJob),
    [payload?.remote],
  );
  const more = useMemo(
    () => (payload?.more ?? []).map(normalizePublishedJob),
    [payload?.more],
  );

  // null while the once-per-session rotation is being decided (a few ms), so
  // the sections render as skeletons instead of flashing a different order.
  const [specialized, setSpecialized] = useState<HomeFeedSection[] | null>(null);
  useEffect(() => {
    if (!payload) {
      setSpecialized(null);
      return;
    }
    let active = true;
    pickSpecializedFields(
      payload.specialized.map((section) => section.field),
      HOME_FEED_SPECIALIZED_COUNT,
    )
      .then((fields) => {
        if (!active) return;
        const jobsByField = new Map(payload.specialized.map((section) => [section.field.id, section.jobs]));
        setSpecialized(
          fields.map((field) => ({
            field,
            jobs: (jobsByField.get(field.id) ?? []).map(normalizePublishedJob),
          })),
        );
      })
      .catch(() => {
        if (active) setSpecialized([]);
      });
    return () => {
      active = false;
    };
  }, [payload]);

  return {
    nearby,
    recommended,
    featured,
    specialized,
    specializedLoading: specialized === null,
    remote,
    more,
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}