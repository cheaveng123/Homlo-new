import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";

import { getJob } from "@/components/job-store";
import { usePublishedJobs } from "@/hooks/use-published-jobs";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { logJobEvent, isCanonicalJobId } from "@/lib/event-logging";
import { recordJobApply, shouldRecordEvents } from "@/lib/event-recorder";
import { haptic } from "@/lib/haptics";
import { isActiveApplication } from "@/lib/application-eligibility";
import { EmptyStateNew } from "@/src/new/components/PrimitivesNew";
import { colorsNew } from "@/src/new/theme/tokensNew";
import { ApplyScreenNew, type CvFileNew } from "@/src/new/screens/ApplyScreenNew";
import { ApplySuccessScreenNew } from "@/src/new/screens/ApplySuccessScreenNew";

const CV_TYPES = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "H";
  return parts.map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

export default function ApplyRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { jobs: availableJobs, loading: liveJobsLoading } = usePublishedJobs();
  const job = availableJobs.find((candidate) => candidate.id === id) ?? getJob(id);
  const { user } = useAuth();
  const submit = trpc.homlo.applications.submit.useMutation();
  const utils = trpc.useUtils();
  const canonical = isCanonicalJobId(id);
  const applicationQuery = trpc.homlo.applications.byJob.useQuery(
    { jobId: id },
    { enabled: Boolean(user) && canonical },
  );

  const [name, setName] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [cv, setCv] = useState<CvFileNew>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [, setApplicationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (canonical) logJobEvent({ jobId: id, eventType: "apply_started" });
  }, [canonical, id]);

  const nameValue = name ?? user?.name ?? "";
  const existingApplication = applicationQuery.data?.application ?? null;

  if (!job && liveJobsLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colorsNew.white }}>
        <ActivityIndicator color={colorsNew.primary} />
      </View>
    );
  }
  if (!job) {
    return (
      <View style={{ flex: 1, backgroundColor: colorsNew.white }}>
        <EmptyStateNew
          icon="brief"
          title="This role is no longer available."
          actionLabel="Go back"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  if (submitted) {
    return (
      <ApplySuccessScreenNew
        cvName={cv?.name}
        onViewApplications={() => {
          void utils.homlo.applications.list.invalidate();
          router.dismissTo({ pathname: "/inbox", params: { tab: "applications" } } as never);
        }}
        onBackToJobs={() => router.dismissTo("/" as never)}
      />
    );
  }

  if (user && canonical && applicationQuery.isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colorsNew.white }}>
        <ActivityIndicator color={colorsNew.primary} />
      </View>
    );
  }

  if (isActiveApplication(existingApplication)) {
    return (
      <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 16, backgroundColor: colorsNew.white }}>
        <EmptyStateNew
          icon="chk"
          title="You've already applied to this role."
          actionLabel="View my applications"
          onAction={() => router.replace({ pathname: "/inbox", params: { tab: "applications" } } as never)}
        />
      </View>
    );
  }

  const pickCv = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: CV_TYPES });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setCv({ name: asset.name, sizeLabel: "" });
      haptic.selection();
    } catch {
      setCv(null);
    }
  };

  const handleSubmit = async () => {
    if (submit.isPending) return;
    if (!nameValue.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (!user) {
      haptic.light();
      router.push("/login" as never);
      return;
    }
    const note = [nameValue.trim(), message.trim()].filter(Boolean).join("\n\n") || null;
    setSubmitting(true);
    setError(null);
    try {
      const result = (await submit.mutateAsync({ jobId: job.id, message: note })) as
        | { application?: { id?: string | null } | null }
        | null
        | undefined;
      const newApplicationId =
        result && result.application && typeof result.application.id === "string"
          ? result.application.id
          : null;
      if (shouldRecordEvents(user?.role)) {
        recordJobApply(job.id);
      } else {
        logJobEvent({ jobId: job.id, eventType: "apply_submitted" });
      }
      haptic.success();
      setApplicationId(newApplicationId);
      setSubmitted(true);
      void utils.homlo.applications.byJob.invalidate({ jobId: job.id });
      void utils.homlo.applications.list.invalidate();
      void utils.homlo.employer.jobs.invalidate();
      void utils.homlo.publicJobs.invalidate();
      void utils.homlo.searchJobs.invalidate();
      void utils.homlo.homeFeed.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't submit application. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ApplyScreenNew
      jobTitle={job.title}
      employerName={job.company}
      employerInitials={initialsOf(job.company)}
      form={{ name: nameValue, phone: "", message }}
      onChangeField={(key, value) => {
        if (key === "name") setName(value);
        else if (key === "message") setMessage(value);
      }}
      cv={cv}
      onPickCv={() => void pickCv()}
      onRemoveCv={() => setCv(null)}
      onSubmit={handleSubmit}
      submitting={submitting}
      canSubmit={nameValue.trim().length > 0}
      onBack={() => router.back()}
      showPhone={false}
      cvRequired={false}
      errorText={error ?? undefined}
    />
  );
}