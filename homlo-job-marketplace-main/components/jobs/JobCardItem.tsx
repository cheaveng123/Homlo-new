import { useRef } from "react";
import { useRouter } from "@/lib/router";

import { JobCard } from "@/components/jobs/JobCard";
import type { JobCardData } from "@/components/jobs/jobCardTypes";
import { toJobCardData } from "@/components/jobs/toJobCardData";
import { type Job, useJobStore } from "@/components/job-store";
import { useHeroTransitionStore } from "@/store/heroTransitionStore";
import { useAuth } from "@/hooks/use-auth";
import { FALLBACK_JOB_IMAGE } from "@/lib/job-banner";
import { haptic } from "@/lib/haptics";
import { logJobEvent } from "@/lib/event-logging";
import { localImageUris } from "@/lib/local-image-uris";

type Props = {
  job: Job;
};

/**
 * Row-variant job container with the app-level wiring that the presentational
 * JobCard deliberately leaves out: saved state, the login gate on saving, event
 * logging, local picker banners and the card -> detail hero transition.
 */
export function JobCardItem({ job }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const { isSaved, toggleSaved } = useJobStore();
  const openingRef = useRef(false);

  const card: JobCardData = toJobCardData(job);
  const localUri = localImageUris[job.id] ?? null;
  const own = job.image;
  const resolved =
    own && (own.startsWith("http") || own.startsWith("file:") || own.startsWith("data:")) ? own : localUri;
  // No banner at all leaves `imageUrl` empty so the card shows its own
  // briefcase placeholder; the stock photo is only for the hero transition's
  // start frame, which can't render a placeholder.
  const imageUrl = resolved ?? "";
  const imageUri = imageUrl || FALLBACK_JOB_IMAGE;

  const openJob = () => {
    if (openingRef.current) return;
    openingRef.current = true;
    haptic.light();
    logJobEvent({ jobId: job.id, eventType: "click", feedContext: "feed" });
    router.push({ pathname: "/job/[id]", params: { id: job.id } } as never);
    setTimeout(() => {
      openingRef.current = false;
    }, 500);
  };

  const toggleSave = (next: JobCardData) => {
    haptic.selection();
    if (!user) {
      router.push("/login" as never);
      return;
    }
    logJobEvent({ jobId: next.id, eventType: isSaved(next.id) ? "unsave" : "save" });
    toggleSaved(next.id);
  };

  return (
    <JobCard
      job={{ ...card, imageUrl }}
      variant="row"
      saved={isSaved(job.id)}
      onPress={(_, imageRef) => {
        const measure = imageRef.current?.measureInWindow;
        if (!measure) {
          openJob();
          return;
        }
        measure((x, y, width, height) => {
          useHeroTransitionStore.getState().start(imageUri, { x, y, width, height });
          openJob();
        });
      }}
      onToggleSave={toggleSave}
    />
  );
}