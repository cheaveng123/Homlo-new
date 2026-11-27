import { memo as reactMemo, useMemo } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { useRouter } from "@/lib/router";

import { useHeroTransitionStore } from "@/store/heroTransitionStore";

import { type Job, useJobStore } from "@/components/job-store";
import { JobCard } from "@/components/jobs/JobCard";
import type { JobCardData } from "@/components/jobs/jobCardTypes";
import { toJobCardData } from "@/components/jobs/toJobCardData";
import { haptic } from "@/lib/haptics";
import { FALLBACK_JOB_IMAGE } from "@/lib/job-banner";
import { localImageUris } from "@/lib/local-image-uris";
import { useAuth } from "@/hooks/use-auth";
import { usePressLock } from "@/hooks/use-press-lock";
import { logJobEvent } from "@/lib/event-logging";

type SearchJobCardProps = {
  job: Job;
  onPress?: (job: Job) => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * Search results can carry a local picker URI that isn't on the Job itself, so
 * the resolved banner is layered onto the adapter's output. A job with neither
 * keeps an empty `imageUrl` so the card falls back to its own briefcase
 * placeholder instead of a stock photo.
 */
function withBanner(card: JobCardData, job: Job): JobCardData {
  const localUri = localImageUris[job.id] ?? null;
  const own = job.image;
  const resolved =
    own && (own.startsWith("http") || own.startsWith("file:") || own.startsWith("data:")) ? own : localUri;
  return { ...card, imageUrl: resolved ?? "" };
}

function SearchJobCardImpl({ job, onPress, style }: SearchJobCardProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { isSaved, toggleSaved } = useJobStore();
  const saved = isSaved(job.id);

  // The adapter takes the raw Job, not `normalizeJob`'d output: normalizing
  // first would drop the fields that map onto the card (notably positions).
  const card = useMemo(() => withBanner(toJobCardData(job), job), [job]);

  const imageUri = card.imageUrl || FALLBACK_JOB_IMAGE;

  // The new card owns its own photo ref; the hero transition reads that instead
  // of a per-card image ref.
  const handleOpen = usePressLock(() => {
    haptic.light();
    if (onPress) {
      onPress(job);
      return;
    }
    logJobEvent({ jobId: job.id, eventType: "click", feedContext: "search" });
    router.push({ pathname: "/job/[id]", params: { id: job.id } } as never);
  });

  const handleToggleSave = (next: JobCardData) => {
    haptic.selection();
    if (!user) {
      router.push("/login" as never);
      return;
    }
    logJobEvent({ jobId: next.id, eventType: saved ? "unsave" : "save" });
    toggleSaved(next.id);
  };

  return (
    <View style={style}>
      <JobCard
        job={card}
        variant="row"
        saved={saved}
        onPress={(_, imageRef) => {
          const measure = imageRef.current?.measureInWindow;
          if (!measure) {
            handleOpen();
            return;
          }
          measure((x, y, width, height) => {
            useHeroTransitionStore.getState().start(imageUri, { x, y, width, height });
            handleOpen();
          });
        }}
        onToggleSave={handleToggleSave}
      />
    </View>
  );
}

export const SearchJobCard = reactMemo(SearchJobCardImpl, (prev, next) => {
  return prev.job === next.job && prev.onPress === next.onPress && prev.style === next.style;
});