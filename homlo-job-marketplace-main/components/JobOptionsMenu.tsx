/**
 * Employer job management overflow menu (Edit / Share / Open-close).
 * All writes go through the real tRPC gateway: status toggles route through
 * homlo_save_job with the full editable payload (home_save_job overwrites the
 * whole row on update — a partial payload would wipe title/description/pay).
 * Closing a job sets status to 'closed', preserving the job record and all
 * associated applications, messages, and analytics.
 */
import { useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  Share,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "@/lib/router";
import { AppIcon } from "@/components/ui/AppIcon";

import { Text } from "@/components/ui/text";
import { trpc } from "@/lib/trpc";
import {
  buildJobSavePayload,
  editableFieldsFromJob,
  normalizeEmployerJob,
  type EmployerJobRow,
} from "@/lib/job-management";
import type { EmployerJob } from "@/backend/domain/models";

type JobOptionsMenuProps = {
  job: EmployerJob;
  onJobUpdated: (job: EmployerJob) => void;
};

export default function JobOptionsMenu({ job, onJobUpdated }: JobOptionsMenuProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const utils = trpc.useUtils();
  const saveJob = trpc.homlo.employer.saveJob.useMutation();
  const isOpen = job.status === "open";

  function goEdit() {
    setOpen(false);
    router.push(`/employer/job/${job.id}/edit` as never);
  }

  async function shareListing() {
    setOpen(false);
    try {
      await Share.share({
        message: `Check out this job on Homlo: ${job.title} — ${job.locationLabel ?? "Homlo"}`,
      });
    } catch {
      // user cancelled the native share sheet; nothing to do
    }
  }

  function toggleOpenClosed() {
    setOpen(false);
    const nextStatus = isOpen ? "closed" : "open";
    Alert.alert(
      isOpen ? "Close this job?" : "Reopen this job?",
      isOpen
        ? "The listing will stop accepting new applications."
        : "The listing will become visible to applicants again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: isOpen ? "Close job" : "Reopen job",
          onPress: async () => {
            try {
              const saved = (await saveJob.mutateAsync(
                buildJobSavePayload(editableFieldsFromJob(job), {
                  jobId: job.id,
                  imageUrl: job.imageUrl,
                  status: nextStatus,
                }),
              )) as { job?: EmployerJobRow };
              if (saved?.job) onJobUpdated(normalizeEmployerJob(saved.job));
              void utils.homlo.employer.jobs.invalidate();
              void utils.homlo.publicJobs.invalidate();
              void utils.homlo.searchJobs.invalidate();
              void utils.homlo.homeFeed.invalidate();
            } catch {
              Alert.alert("Couldn't update the job", "Try again in a moment.");
            }
          },
        },
      ],
    );
  }

  return (
    <>
      <TouchableOpacity
        accessibilityLabel="Job options"
        onPress={() => setOpen(true)}
        hitSlop={10}
      >
        <AppIcon name="dots" size={20} color="#17201A" />
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        {/* BUGFIX: className is disabled on Pressable app-wide, so the backdrop had no size: no dim and no tap-outside-to-close. */}
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.2)" }} onPress={() => setOpen(false)}>
          <View className="absolute top-16 right-4 w-56 rounded-2xl border border-border bg-surface overflow-hidden shadow-lg">
            <TouchableOpacity
              onPress={goEdit}
              className="flex-row items-center gap-2.5 px-3.5 py-3 border-b border-border"
            >
              <AppIcon name="edit" size={17} color="#17201A" />
              <Text className="text-sm font-medium text-foreground">Edit job</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => void shareListing()}
              className="flex-row items-center gap-2.5 px-3.5 py-3 border-b border-border"
            >
              <AppIcon name="share" size={17} color="#17201A" />
              <Text className="text-sm font-medium text-foreground">Share listing</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={toggleOpenClosed}
              className="flex-row items-center gap-2.5 px-3.5 py-3 border-b border-border"
            >
              {isOpen ? <AppIcon name="pause" size={17} color="#17201A" /> : <AppIcon name="play" size={17} color="#17201A" />}
              <Text className="text-sm font-medium text-foreground">
                {isOpen ? "Close job" : "Reopen job"}
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}