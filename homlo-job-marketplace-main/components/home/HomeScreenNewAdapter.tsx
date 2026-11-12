import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { View, FlatList } from "react-native";

import { useAuth } from "@/hooks/use-auth";
import { useHomeFeed } from "@/hooks/use-home-feed";
import { usePopularJobs } from "@/hooks/use-popular-jobs";
import { useSearchLocation } from "@/hooks/use-search-location";
import { useFirstLoadSkeletonFlag } from "@/lib/useFirstLoadSkeletonFlag";
import { trpc } from "@/lib/trpc";
import { computePositionsLeft } from "@/lib/positions";
import { useJobStore, type Job } from "@/components/job-store";
import { JOB_TYPE_IMAGES } from "@/components/shared/jobTypeImage";
import { haptic } from "@/lib/haptics";
import { logJobEvent } from "@/lib/event-logging";
import { JOB_FIELDS } from "@/lib/job-fields";
import { JobFieldArtwork } from "@/components/shared/JobFieldArtwork";
import { vistaKeyForField } from "@/components/vista/vistaCategoryData";
import { HomeScreenNew, type JobFieldNew, type JobTypeNew } from "@/src/new/screens/HomeScreenNew";
import { JobSummaryNew } from "@/src/new/types/jobNew";
import { getEventRecorder, makeImpressionHandler, shouldRecordEvents, recordJobSave, recordJobImpression, impressionViewabilityConfig } from "@/lib/event-recorder";

// Every field maps to one of the five category pages. Kept in lockstep with the
// route adapter so a tile can never fall through to the legacy listing.
// (Mirrors FIELD_CATEGORY_SLUG in components/home/HomeScreen.tsx.)
const FIELD_CATEGORY_SLUG = new Map<string, string>([
  ["hospitality-food", "cafe"],
  ["beauty-personal-care", "hotel"],
  ["cleaning-housekeeping", "hotel"],
  ["healthcare", "hotel"],
  ["retail-ecommerce", "retail"],
  ["sales-business", "retail"],
  ["logistics-delivery", "delivery"],
  ["manufacturing", "delivery"],
  ["security", "delivery"],
  ["agriculture", "delivery"],
  ["administration", "office"],
  ["customer-service", "office"],
  ["it-technology", "office"],
  ["marketing-media", "office"],
  ["finance-accounting", "office"],
  ["human-resources", "office"],
  ["education-training", "office"],
  ["engineering-construction", "office"],
  ["design-creative", "office"],
]);

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "H";
  return parts.map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

/** Maps the app's canonical Job onto the *New card view-model. */
function toSummary(job: Job, liked: boolean): JobSummaryNew {
  const total = job.positionsTotal && job.positionsTotal > 0 ? job.positionsTotal : 0;
  const left = typeof job.positionsAvailable === "number"
    ? job.positionsAvailable
    : computePositionsLeft(total, job.positionsFilled);
  return {
    id: job.id,
    title: job.title,
    locationLabel: job.location?.split(",")[0]?.trim() || "Location to be confirmed",
    payLabel: job.pay,
    positionsLeft: total ? left : 0,
    positionsTotal: total || 1,
    employerInitials: initialsOf(job.company),
    imageUri: job.image || undefined,
    typeLabel: job.tag || undefined,
    liked,
    boosted: job.boosted === true || job.boost?.isSponsored === true,
  };
}

export default function HomeScreenNewAdapter() {
  const router = useRouter();
  const { user } = useAuth();
  const { isSaved, toggleSaved, savedIds } = useJobStore();
  const { coordinates, locationLabel } = useSearchLocation({ requestOnMount: false });
  const { nearby, recommended, more, loading: homeFeedLoading } = useHomeFeed({
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    radiusKm: 50,
  });
  const { jobs: popular, loading: popularLoading } = usePopularJobs();
  // The feed returns job ids first and the cards need the public job records.
  // Read the same query here so it loads alongside the feed and the skeletons
  // stay up until the cards can actually render.
  const { isLoading: jobRecordsLoading } = trpc.homlo.publicJobs.useQuery();
  const feedPending = homeFeedLoading || jobRecordsLoading;

  const recommendedSkeleton = useFirstLoadSkeletonFlag({
    loading: feedPending,
    data: recommended.length ? recommended : undefined,
  });
  const nearbySkeleton = useFirstLoadSkeletonFlag({
    loading: feedPending,
    data: nearby.length ? nearby : undefined,
  });
  const popularSkeleton = useFirstLoadSkeletonFlag({
    loading: popularLoading,
    data: popular.length ? popular : undefined,
  });
  const exploreSkeleton = useFirstLoadSkeletonFlag({
    loading: feedPending,
    data: more.length ? more : undefined,
  });

  // Initialize event recorder
  const recorder = getEventRecorder();
  const shouldRecord = shouldRecordEvents(user?.role);
  const impressionHandlerRef = useRef(makeImpressionHandler((item: any) => item.id));

  // Explore draws the feed's long tail, minus anything already shown above.
  const explore = useMemo(() => {
    const shown = new Set([...recommended, ...nearby, ...popular].map((j) => j.id));
    return more.filter((j) => !shown.has(j.id));
  }, [more, recommended, nearby, popular]);

  const jobFields = useMemo<JobFieldNew[]>(
    () =>
      JOB_FIELDS.map((field) => ({
        id: field.id,
        label: field.title,
        icon: <JobFieldArtwork xml={field.svg} size={56} />,
      })),
    [],
  );

  const jobTypes = useMemo<JobTypeNew[]>(
    () => JOB_TYPE_IMAGES.map((entry) => ({ id: entry.key, label: entry.label })),
    [],
  );

  const recommendedSummaries = useMemo(
    () => recommended.map((j) => toSummary(j, isSaved(j.id))),
    [recommended, isSaved],
  );
  const nearbySummaries = useMemo(
    () => nearby.map((j) => toSummary(j, isSaved(j.id))),
    [nearby, isSaved],
  );
  const popularSummaries = useMemo(
    () => popular.map((j) => toSummary(j, isSaved(j.id))),
    [popular, isSaved],
  );
  const exploreSummaries = useMemo(
    () => explore.map((j) => toSummary(j, isSaved(j.id))),
    [explore, isSaved],
  );

  const openJob = useCallback(
    (id: string) => {
      haptic.light();
      logJobEvent({ jobId: id, eventType: "click", feedContext: "feed" });
      router.push({ pathname: "/job/[id]", params: { id } } as never);
    },
    [router],
  );

  const toggleLike = useCallback(
    (id: string) => {
      haptic.selection();
      if (!user) {
        router.push("/login" as never);
        return;
      }
      const savedNow = isSaved(id);
      if (!savedNow && shouldRecord) {
        recordJobSave(id);
      } else {
        logJobEvent({ jobId: id, eventType: savedNow ? "unsave" : "save" });
      }
      toggleSaved(id);
    },
    [user, router, isSaved, toggleSaved, shouldRecord],
  );

  const selectField = useCallback(
    (id: string) => {
      haptic.light();
      // The redesigned Vista page handles every known field tile; the legacy
      // routes below stay as the safety net for an id the map doesn't know.
      const vistaKey = vistaKeyForField(id);
      if (vistaKey) {
        router.push(`/vista/${vistaKey}` as never);
        return;
      }
      const slug = FIELD_CATEGORY_SLUG.get(id);
      if (slug) {
        router.push(`/jobs/category/${slug}` as never);
        return;
      }
      const title = JOB_FIELDS.find((f) => f.id === id)?.title ?? "Jobs";
      router.push({ pathname: "/category-listing", params: { title } } as never);
    },
    [router],
  );

  return (
    <HomeScreenNew
      locationLabel={locationLabel}
      onPressLocation={() => router.push("/search-detail" as never)}
      onPressBell={() => router.push("/saved" as never)}
      savedCount={savedIds.length}
      onPressSearch={() => router.push("/search-detail" as never)}
      onPressFilter={() => router.push("/search-detail" as never)}
      jobFields={jobFields}
      onSelectField={selectField}
      jobTypes={jobTypes}
      onSelectJobType={(key) => router.push({ pathname: "/jobs/ways-to-work", params: { tab: key } } as never)}
      recommended={recommendedSummaries}
      recommendedLoading={recommendedSkeleton}
      onSeeAllRecommended={() => router.push("/jobs/recommended" as never)}
      nearby={nearbySummaries}
      nearbyLoading={nearbySkeleton}
      popularJobs={popularSummaries}
      popularLoading={popularSkeleton}
      onSeePopular={() => router.push("/jobs/popular" as never)}
      exploreJobs={exploreSummaries}
      exploreLoading={exploreSkeleton}
      onSeeExplore={() => router.push({ pathname: "/category-listing", params: { title: "Explore jobs" } } as never)}
      onPostJob={() => router.push("/employer" as never)}
      onPressJob={openJob}
      onToggleLike={toggleLike}
      onViewableItemsChanged={impressionHandlerRef.current}
      viewabilityConfig={impressionViewabilityConfig}
    />
  );
}