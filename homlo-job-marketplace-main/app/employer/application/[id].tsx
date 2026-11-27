import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "@/lib/router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenContainer } from "@/components/screen-container";
import { ScalePressable } from "@/components/ui/scale-pressable";
import { AppIcon } from "@/components/ui/AppIcon";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { ReportSheet } from "@/components/legal/ReportSheet";
import { formatRelativeAgo } from "@/lib/format";
import { EmployerApplicantSkeleton } from "@/src/new/components/NewSkeletons";
import { useFirstLoadSkeletonFlag } from "@/lib/useFirstLoadSkeletonFlag";
import { colors } from "@/theme";
import EmployerApplicantDetailView from "@/EmployerApplicantDetailView";

type ApplicationStatus = "applied" | "reviewed" | "interview" | "hired" | "declined" | "withdrawn";
type GatewayApplication = { id: string; job_id: string; worker_id: string; status: ApplicationStatus; message: string | null; created_at: string; worker_full_name: string; worker_location: string | null; worker_bio: string | null; worker_photo_key: string | null; viewed_at?: string | null };
type GatewayJob = { id: string; title: string; pay_amount: number | string; pay_currency: string; pay_type: "hourly" | "daily" | "fixed"; location_text: string | null };

function displayStatus(status: ApplicationStatus) { return status === "applied" ? "New" : status === "reviewed" ? "Reviewing" : status === "interview" ? "Interview" : status === "hired" ? "Hired" : status === "declined" ? "Declined" : "Withdrawn"; }
function jobPay(job: GatewayJob) { const interval = job.pay_type === "hourly" ? "hour" : job.pay_type === "daily" ? "day" : "project"; return `${job.pay_currency} ${Number(job.pay_amount).toLocaleString()} / ${interval}`; }

export default function EmployerApplicantDetailScreen() {
  const router = useRouter();
  const { id, jobId } = useLocalSearchParams<{ id: string; jobId: string }>();
  const { user } = useAuth();
  const [reportOpen, setReportOpen] = useState(false);
  const applicationsQuery = trpc.homlo.employer.applications.useQuery({ jobId: jobId ?? "00000000-0000-0000-0000-000000000000" }, { enabled: Boolean(user && jobId) });
  const jobsQuery = trpc.homlo.employer.jobs.useQuery(undefined, { enabled: Boolean(user) });
  const application = (((applicationsQuery.data as { applications?: GatewayApplication[] } | undefined)?.applications ?? []).find((candidate) => candidate.id === id));
  const job = (((jobsQuery.data as { jobs?: GatewayJob[] } | undefined)?.jobs ?? []).find((candidate) => candidate.id === jobId));
  const markViewed = trpc.homlo.applications.markViewed.useMutation();

  const attemptedViewId = useRef<string | null>(null);
  useEffect(() => {
    const applicationId = application?.id;
    if (!applicationId) return;
    if (attemptedViewId.current === applicationId) return;
    if (application?.viewed_at) return;
    attemptedViewId.current = applicationId;
    markViewed.mutate({ applicationId });
  }, [application, markViewed]);

  const applicationsSkeleton = useFirstLoadSkeletonFlag(applicationsQuery);
  const jobsSkeleton = useFirstLoadSkeletonFlag(jobsQuery);
  const name = application?.worker_full_name?.trim() || "Applicant";
  const insets = useSafeAreaInsets();

  if (!user) return <EmployerAccess onBack={() => router.replace("/login" as never)} />;
  if (applicationsSkeleton || jobsSkeleton) return (
    <ScreenContainer className="flex-1" containerClassName="bg-background" edges={["top", "left", "right", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScalePressable accessibilityLabel="Back to applicants" hapticFeedback onPress={() => router.back()} style={styles.skeletonTopBar}>
          <AppIcon name="back" size={20} color={colors.text} />
          <Text style={styles.skeletonTopBarText}>Applicant</Text>
        </ScalePressable>
        <EmployerApplicantSkeleton showTopBar={false} padded={false} />
      </ScrollView>
    </ScreenContainer>
  );
  if (!application || !job) return <MissingApplication onBack={() => router.back()} />;

  const applicant = {
    name,
    tagline: application.worker_bio?.trim() || "",
    status: displayStatus(application.status),
    appliedAgo: formatRelativeAgo(application.created_at),
    coverMessage: application.message?.trim() || "",
  };
  const jobSummary = {
    title: job.title,
    place: job.location_text ?? "",
    pay: jobPay(job),
  };

  return (
    <View style={{ flex: 1 }}>
      <EmployerApplicantDetailView
        applicant={applicant}
        job={jobSummary}
        onBack={() => router.back()}
        onMessage={() => router.push({ pathname: "/conversations/[id]", params: { id: "conversation", applicationId: application.id } } as never)}
        topInset={insets.top}
        bottomInset={insets.bottom}
      />
      {/* Report button on every profile (scam, underage user, discrimination, illegal, other). */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Report this profile"
        onPress={() => setReportOpen(true)}
        style={{ position: "absolute", top: insets.top + 10, right: 16, backgroundColor: "rgba(255,255,255,0.92)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 }}
      >
        <Text style={{ fontSize: 13, fontWeight: "600", color: "#6A7C84" }}>Report</Text>
      </Pressable>
      <ReportSheet visible={reportOpen} onClose={() => setReportOpen(false)} targetType="user" targetId={application.worker_id} targetLabel={application.worker_full_name} />
    </View>
  );
}

function EmployerAccess({ onBack }: { onBack: () => void }) { return <ScreenContainer className="items-center justify-center p-6"><AppIcon name="user" size={27} color={colors.primary} /><Text style={styles.emptyTitle}>Employer access required</Text><Text style={styles.emptyText}>Sign in with the employer account that owns this listing to review applications.</Text><ScalePressable hapticFeedback onPress={onBack} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Sign in</Text></ScalePressable></ScreenContainer>; }
function MissingApplication({ onBack }: { onBack: () => void }) { return <ScreenContainer className="items-center justify-center p-6"><Text style={styles.emptyTitle}>This application is not available.</Text><ScalePressable hapticFeedback onPress={onBack} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Back to applicants</Text></ScalePressable></ScreenContainer>; }

const styles = StyleSheet.create({ content: { padding: 20, paddingBottom: 35 }, skeletonTopBar: { alignItems: "center", flexDirection: "row", gap: 6, minHeight: 42, minWidth: 92, marginBottom: 26 }, skeletonTopBarText: { color: colors.text, fontSize: 12.5, fontWeight: "700" }, emptyTitle: { color: colors.text, fontSize: 18, fontWeight: "800", marginTop: 11, textAlign: "center" }, emptyText: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 6, textAlign: "center" }, primaryButton: { backgroundColor: colors.primary, borderRadius: 12, marginTop: 18, paddingHorizontal: 17, paddingVertical: 12 }, primaryButtonText: { color: colors.white, fontSize: 13, fontWeight: "800" } });
