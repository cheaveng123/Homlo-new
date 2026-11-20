import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, StatusBar, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { getJob, useJobStore } from "@/components/job-store";
import { mapJobToDetails } from "@/components/job-details/map-job-to-details";
import { usePublishedJobs } from "@/hooks/use-published-jobs";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { logJobEvent } from "@/lib/event-logging";
import { isCanonicalJobId, jobDetailDecision } from "@/lib/job-detail-decision";
import {
  recordJobView,
  startJobDwell,
  recordJobSave,
  shouldRecordEvents,
} from "@/lib/event-recorder";
import { haptic } from "@/lib/haptics";
import { mockJobFor } from "@/lib/mock-job";
import { jobCoordinate } from "@/lib/job-geography";
import { computePositionsLeft } from "@/lib/positions";
import { JobDetailMap } from "@/src/components/JobDetailMap";
import { AppIcon } from "@/components/ui/AppIcon";
import { ReportSheet } from "@/components/legal/ReportSheet";
import { useFirstLoadSkeletonFlag } from "@/lib/useFirstLoadSkeletonFlag";
import { JobDetailSkeleton } from "@/src/new/components/NewSkeletons";
import { EmptyStateNew } from "@/src/new/components/PrimitivesNew";
import { applyActionState } from "@/lib/application-eligibility";
import {
  JobDetailScreenNew,
  type JobDetailNew,
} from "@/src/new/screens/JobDetailScreenNew";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "H";
  return parts
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function JobDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    jobs: availableJobs,
    loading: liveJobsLoading,
    error: liveJobsError,
    refetch: jobsRefetch,
  } = usePublishedJobs();
  const liveJob =
    availableJobs.find((candidate) => candidate.id === id) ?? getJob(id);
  const { isSaved, toggleSaved } = useJobStore();
  const { user } = useAuth();
  const [reportOpen, setReportOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [mapFullScreen, setMapFullScreen] = useState(false);

  const canonical = isCanonicalJobId(id);
  const applicationQuery = trpc.homlo.applications.byJob.useQuery(
    { jobId: id },
    { enabled: Boolean(user) && canonical },
  );
  const dwellStopRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!canonical) return;
    const shouldRecord = shouldRecordEvents(user?.role);
    if (!shouldRecord) return;

    recordJobView(id);
    dwellStopRef.current = startJobDwell(id);

    return () => {
      if (dwellStopRef.current) {
        dwellStopRef.current();
        dwellStopRef.current = null;
      }
    };
  }, [canonical, id, user?.role]);

  const employerName = liveJob?.company?.trim() ?? null;

  // PERF: was a trpcDirect call in an effect, re-sent on every visit to any
  // job. A cached query reuses the about text for the same employer.
  const employerProfileQuery = trpc.homlo.employerProfile.useQuery(
    { name: employerName ?? "" },
    { enabled: Boolean(employerName), staleTime: 10 * 60_000, retry: false },
  );
  const employerAboutText = employerProfileQuery.data?.about?.trim() || null;

  const showSkeleton = useFirstLoadSkeletonFlag({
    loading: liveJobsLoading,
    data: liveJob,
  });

  if (showSkeleton) {
    return <JobDetailSkeleton />;
  }

  const decision = jobDetailDecision(liveJob, id, liveJobsError);

  if (decision === "error") {
    return (
      <View style={{ flex: 1 }}>
        <EmptyStateNew
          icon="brief"
          title="Couldn't load this role."
          actionLabel="Try again"
          onAction={() => {
            setRefreshing(true);
            jobsRefetch().finally(() => setRefreshing(false));
          }}
        />
      </View>
    );
  }

  if (decision === "unavailable") {
    return (
      <View style={{ flex: 1 }}>
        <EmptyStateNew
          icon="brief"
          title="This role is no longer available."
          actionLabel="Go back"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const job = liveJob ?? mockJobFor(id);
  const saved = isSaved(job.id);
  const handleToggleSaved = () => {
    haptic.selection();
    if (!user) {
      router.push("/login" as never);
      return;
    }
    const savedNow = isSaved(job.id);
    if (!savedNow) {
      recordJobSave(job.id);
    } else {
      logJobEvent({ jobId: job.id, eventType: "unsave" });
    }
    toggleSaved(job.id);
  };

  // Report button on every listing (scam, underage user, discrimination, illegal, other).
  const reportListing = (_jobId: string) => setReportOpen(true);

  const d = mapJobToDetails(job);
  const filled = d.jobStatus === "filled";
  const apply = applyActionState(
    applicationQuery.data?.application ?? null,
    filled,
  );
  const isRemote = job.arrangement === "Remote";
  const coordinate = jobCoordinate(job);
  const mapJob = coordinate
    ? {
        id: job.id,
        title: job.title,
        category: job.category,
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
      }
    : null;
  const detail: JobDetailNew = {
    id: d.id,
    employerId: d.employerId,
    title: d.title,
    employerName: d.companyName,
    employerInitials: initialsOf(d.companyName),
    imageUri: d.coverImageUrl ?? undefined,
    locationLabel: d.location,
    addressNote: d.locationFull,
    payLabel: `${d.salary}${d.salaryUnit}`,
    typeLabel: d.employmentType,
    positionsLeft:
      d.positionsAvailable ??
      computePositionsLeft(d.positionsTotal, d.positionsFilled),
    positionsTotal: d.positionsTotal ?? 0,
    requirements: d.requirements,
    workDays: d.workDays ?? null,
    workHours: d.workHours ?? null,
    workDayKeys: d.workDayKeys ?? [],
    liked: saved,
    employerAbout: employerAboutText,
  };

  return (
    <View style={{ flex: 1 }}>
      <JobDetailScreenNew
        job={detail}
        showMap={!isRemote}
        mapSlot={
          mapJob ? (
            <View
              style={{
                height: 190,
                borderRadius: 16,
                overflow: "hidden",
                marginHorizontal: 16,
                position: "relative",
              }}
            >
              <JobDetailMap job={mapJob} height={190} />
              <Pressable
                accessibilityLabel="Open full-screen map"
                onPress={() => setMapFullScreen(true)}
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  backgroundColor: "rgba(255,255,255,0.9)",
                  borderRadius: 20,
                  padding: 6,
                }}
              >
                <AppIcon name="maximize" size={20} color="#0891B2" />
              </Pressable>
            </View>
          ) : undefined
        }
        onBack={() => router.back()}
        onToggleLike={handleToggleSaved}
        onAboutEmployer={() => {
          if (d.employerId)
            void router.push(`/employer/${d.employerId}` as never);
        }}
        onApply={() =>
          router.push({
            pathname: "/job/[id]/apply",
            params: { id: job.id, from: "detail" },
          } as never)
        }
        onPressLocation={() =>
          router.push({
            pathname: "/job/[id]/location",
            params: { id: job.id },
          } as never)
        }
        applyDisabled={apply.disabled}
        applyLabel={apply.label}
        onRefresh={() => {
          setRefreshing(true);
          jobsRefetch().finally(() => setRefreshing(false));
        }}
        refreshing={refreshing}
        onReport={isCanonicalJobId(job.id) ? () => reportListing(job.id) : undefined}
      />
      {isCanonicalJobId(job.id) ? (
        <ReportSheet visible={reportOpen} onClose={() => setReportOpen(false)} targetType="job" targetId={job.id} targetLabel={job.title} />
      ) : null}
      {mapFullScreen && mapJob && (
        <Modal
          transparent
          visible={mapFullScreen}
          onRequestClose={() => setMapFullScreen(false)}
          animationType="fade"
        >
          <View style={{ flex: 1, backgroundColor: "#000000" }}>
            <StatusBar barStyle="light-content" />
            <View
              style={{
                position: "absolute",
                top: 40,
                left: 12,
                right: 12,
                zIndex: 100,
              }}
            >
              <Pressable
                accessibilityLabel="Close full-screen map"
                onPress={() => setMapFullScreen(false)}
                style={{
                  backgroundColor: "rgba(255,255,255,0.9)",
                  borderRadius: 24,
                  padding: 10,
                  alignSelf: "flex-start",
                }}
              >
                <AppIcon name="close" size={22} color="#0891B2" />
              </Pressable>
            </View>
            <View style={{ flex: 1 }}>
              <JobDetailMap job={mapJob} />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}
