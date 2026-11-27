/**
 * Employer-side applicant card. Status writes go through
 * homlo_change_application_status (gateway `application.change-status`);
 * hiring increments workers_hired + transitions the job to filled at capacity
 * server-side, so the parent refetches after a change.
 *
 * The read model (homlo_list_employer_applications_detailed) does not expose
 * rating / years-of-experience, so those rows from the reference design are
 * intentionally not rendered.
 */
import { useState } from "react";
import { Alert, Image, TouchableOpacity, View } from "react-native";
import { useRouter } from "@/lib/router";
import { AppIcon } from "@/components/ui/AppIcon";

import { Text } from "@/components/ui/text";
import { trpc } from "@/lib/trpc";
import { getProfilePhotoUrl } from "@/lib/profile-photo";
import { formatRelativeAgo } from "@/lib/format";
import type { ApplicationStatus, JobApplicant } from "@/backend/domain/models";

type ApplicantCardProps = {
  applicant: JobApplicant;
  jobId: string;
  onStatusChange?: (applicationId: string, status: ApplicationStatus) => void;
  /**
   * Shown as a second line under "Applied …". Only pass it when the card is
   * rendered outside a single job's context (the New applicants list spans
   * every listing); per-job screens leave it off.
   */
  jobTitle?: string;
};

type ManageableApplicationStatus = Exclude<ApplicationStatus, "applied">;

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  applied: "New",
  reviewed: "Reviewing",
  interview: "Interview",
  hired: "Hired",
  declined: "Declined",
  withdrawn: "Withdrawn",
};

function initials(fullName: string) {
  return fullName
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatAppliedAt(value: string) {
  return formatRelativeAgo(value);
}

export default function ApplicantCard({ applicant, jobId, onStatusChange, jobTitle }: ApplicantCardProps) {
  const router = useRouter();
  const [pendingStatus, setPendingStatus] = useState<ApplicationStatus | null>(null);
  const changeStatus = trpc.homlo.applications.changeStatus.useMutation();
  const avatarUrl = getProfilePhotoUrl(applicant.avatarUrl);

  function openProfile() {
    router.push({
      pathname: "/employer/application/[id]",
      params: { id: applicant.id, jobId },
    } as never);
  }

  function openMessageThread() {
    // Messaging opens (or creates) the chat thread tied to this application,
    // matching the auto-created-thread rule the worker side uses.
    router.push({
      pathname: "/conversations/[id]",
      params: {
        id: "conversation",
        applicationId: applicant.id,
        name: applicant.fullName,
        applicationStatus: applicant.status,
      },
    } as never);
  }

  function moveTo(status: ManageableApplicationStatus, title: string, message: string) {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      {
        text: title,
        onPress: () => {
          setPendingStatus(status);
          changeStatus
            .mutateAsync({ applicationId: applicant.id, status })
            .then(() => {
              onStatusChange?.(applicant.id, status);
            })
            .catch((error) => {
              const detail = error instanceof Error && error.message ? error.message : "Try again in a moment.";
              Alert.alert("Couldn't update the application", detail);
            })
            .finally(() => setPendingStatus(null));
        },
      },
    ]);
  }

  // The applicant funnel is applied → reviewed → interview → hired. "Accept"
  // (hire) is only valid on an interviewed applicant, matching the detail
  // screen's status sheet, so the primary button advances the applicant
  // through the funnel instead of attempting an invalid hire.
  const funnelAction: { status: ManageableApplicationStatus; label: string } | null =
    applicant.status === "applied"
      ? { status: "reviewed", label: "Review" }
      : applicant.status === "reviewed"
        ? { status: "interview", label: "Interview" }
        : applicant.status === "interview"
          ? { status: "hired", label: "Accept" }
          : null;

  const isTerminal = applicant.status === "hired" || applicant.status === "declined" || applicant.status === "withdrawn";

  function confirmPrimary() {
    if (!funnelAction) return;
    if (funnelAction.status === "hired") {
      moveTo(
        "hired",
        "Hire this applicant?",
        `${applicant.fullName} will be notified that they were hired for this job.`,
      );
    } else if (funnelAction.status === "interview") {
      moveTo(
        "interview",
        "Move to interview?",
        `${applicant.fullName} will be notified to arrange an interview.`,
      );
    } else {
      moveTo(
        "reviewed",
        "Start reviewing?",
        `${applicant.fullName} will be notified that their application is being reviewed.`,
      );
    }
  }

  function confirmDecline() {
    moveTo(
      "declined",
      "Decline applicant?",
      `${applicant.fullName} will be notified they were not selected.`,
    );
  }

  return (
    <View className="mb-3">
      <TouchableOpacity
        onPress={openProfile}
        activeOpacity={0.8}
        className="bg-surface rounded-2xl border border-border p-3"
      >
        <View className="flex-row gap-3">
          <View className="w-11 h-11 rounded-full bg-green-100 items-center justify-center overflow-hidden">
            {avatarUrl ? (
              <Image
                accessibilityLabel={`Photo of ${applicant.fullName}`}
                source={{ uri: avatarUrl }}
                className="w-full h-full"
              />
            ) : (
              <Text className="text-green-900 text-sm font-semibold">
                {initials(applicant.fullName)}
              </Text>
            )}
          </View>
          <View className="flex-1">
            <View className="flex-row items-center justify-between gap-2">
              {/* Unread marker. Driven by `isNew`, which comes from the
                  `viewed_at` read receipt, not from the pipeline status. */}
              {applicant.isNew ? (
                <View className="w-2 h-2 rounded-full bg-green-600" />
              ) : null}
              <Text className="flex-1 text-sm font-semibold text-foreground" numberOfLines={1}>
                {applicant.fullName}
              </Text>
              <View
                className={`rounded-full px-2 py-0.5 ${
                  applicant.status === "hired"
                    ? "bg-green-600"
                    : applicant.status === "declined" || applicant.status === "withdrawn"
                      ? "bg-red-50"
                      : "bg-green-100"
                }`}
              >
                <Text
                  className={`text-[11px] font-medium ${
                    applicant.status === "hired" ? "text-white" : "text-green-900"
                  }`}
                >
                  {STATUS_LABELS[applicant.status]}
                </Text>
              </View>
            </View>
            <Text className="text-xs text-muted mt-0.5">Applied {formatAppliedAt(applicant.appliedAt)}</Text>
            {jobTitle ? (
              <Text className="text-xs text-muted mt-0.5" numberOfLines={1}>
                {jobTitle}
              </Text>
            ) : null}
          </View>
        </View>

        <View className="flex-row gap-4 my-2.5 py-2.5 border-y border-border">
          <View className="flex-row items-center gap-1 flex-1">
            <AppIcon name="pin" size={14} color="#9AAAB1" />
            <Text className="text-xs text-muted" numberOfLines={1}>
              {applicant.locationLabel ?? "Location not provided"}
            </Text>
          </View>
        </View>

        <Text className="text-xs text-muted leading-5 mb-2.5" numberOfLines={3}>
          {applicant.message ? `"${applicant.message}"` : "No message with this application."}
        </Text>

        <View className="flex-row gap-2">
          {funnelAction ? (
            <TouchableOpacity
              onPress={confirmPrimary}
              disabled={pendingStatus !== null}
              className="flex-1 bg-primary rounded-xl py-2.5 items-center"
            >
              <Text className="text-white text-sm font-semibold">
                {pendingStatus === funnelAction.status ? "Updating…" : funnelAction.label}
              </Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            onPress={openMessageThread}
            className="flex-1 bg-surface border border-border rounded-xl py-2.5 items-center"
          >
            <Text className="text-foreground text-sm font-semibold">Message</Text>
          </TouchableOpacity>
          {!isTerminal ? (
            <TouchableOpacity
              onPress={confirmDecline}
              disabled={pendingStatus !== null}
              className="bg-surface border border-border rounded-xl px-3 py-2.5 items-center justify-center"
            >
              <AppIcon name="close" size={16} color="#A32D2D" />
            </TouchableOpacity>
          ) : null}
        </View>
      </TouchableOpacity>
    </View>
  );
}