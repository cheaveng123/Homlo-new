import React, { useMemo } from "react";
import { FlatList, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated from "react-native-reanimated";

import { useJobStore, type Job } from "@/components/job-store";
import { usePublishedJobs } from "@/hooks/use-published-jobs";
import { useFirstLoadSkeletonFlag } from "@/lib/useFirstLoadSkeletonFlag";
import { computePositionsLeft } from "@/lib/positions";
import { JobResultListSkeleton } from "@/src/new/components/NewSkeletons";
import { mockJobFor } from "@/lib/mock-job";
import { DEMO_CONTENT_ENABLED } from "@/lib/demo-content";
import { haptic } from "@/lib/haptics";
import { EmptyStateNew, RoundButtonNew } from "@/src/new/components/PrimitivesNew";
import { JobResultCardNew } from "@/src/new/components/JobPartsNew";
import { TextNew } from "@/src/new/components/TextNew";
import { colorsNew } from "@/src/new/theme/tokensNew";
import { useEnterNew } from "@/src/new/theme/motionNew";
import type { JobSummaryNew } from "@/src/new/types/jobNew";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "H";
  return parts.map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

/** Maps the app's canonical Job onto the new job container's view-model. */
function toSummary(job: Job): JobSummaryNew {
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
    liked: true,
    boosted: job.boosted === true || job.boost?.isSponsored === true,
  };
}

export default function SavedJobsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const enter = useEnterNew();
  const { savedIds, toggleSaved } = useJobStore();
  const { jobs: allJobs, loading } = usePublishedJobs();

  // Filtering by savedIds is what makes unsaving drop the card: toggleSaved
  // removes the id, this memo recomputes, and the row disappears. The list
  // covers curated + live published jobs; ids that are in neither (demo or
  // removed listings) fall back to their placeholder so nothing is lost.
  const savedJobs = useMemo(() => {
    const known = savedIds
      .map((id) => allJobs.find((job) => job.id === id))
      .filter((job): job is Job => Boolean(job));
    // Saved jobs that no longer exist are dropped; sample jobs only in demo mode.
    const missing = loading || !DEMO_CONTENT_ENABLED
      ? []
      : savedIds
          .filter((id) => !allJobs.some((job) => job.id === id))
          .map((id) => mockJobFor(id));
    return [...known, ...missing].map(toSummary);
  }, [savedIds, allJobs, loading]);

  const showSkeleton = useFirstLoadSkeletonFlag({
    loading,
    data: savedJobs.length ? savedJobs : undefined,
  });

  const toggleSave = (id: string) => {
    haptic.selection();
    toggleSaved(id);
  };

  const openJob = (id: string) => {
    haptic.light();
    router.push({ pathname: "/job/[id]", params: { id } } as never);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colorsNew.white, paddingTop: insets.top + 8 }}>
      <Animated.View entering={enter(0)} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16 }}>
        <RoundButtonNew icon="back" onPress={() => router.back()} accessibilityLabel="Back" />
        <TextNew variant="header">Saved</TextNew>
      </Animated.View>

      {!showSkeleton && (
        <TextNew variant="meta" color={colorsNew.muted} style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
          {savedJobs.length} saved job{savedJobs.length === 1 ? "" : "s"}
        </TextNew>
      )}

      {showSkeleton ? (
        <JobResultListSkeleton />
      ) : (
        <FlatList
          data={savedJobs}
          keyExtractor={(j) => j.id}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <Animated.View entering={enter(index + 1)}>
              <JobResultCardNew job={item} onPress={() => openJob(item.id)} onToggleLike={() => toggleSave(item.id)} />
            </Animated.View>
          )}
          ListEmptyComponent={<EmptyStateNew icon="heart" title="No saved jobs yet" actionLabel="Explore jobs" onAction={() => router.push("/explore" as never)} />}
        />
      )}
    </View>
  );
}
