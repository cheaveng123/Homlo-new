import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/hooks/use-auth";
import { useEmployerApplications } from "@/hooks/use-employer-applications";
import { useMessagingUnread } from "@/hooks/use-messaging-unread";
import { haptic } from "@/lib/haptics";
import { useTabNavigation } from "@/lib/navigation";
import { formatPositionsLabel } from "@/lib/positions";
import { trpc } from "@/lib/trpc";
import { useFirstLoadSkeletonFlag } from "@/lib/useFirstLoadSkeletonFlag";
import {
  PostDashboardScreenNew,
  type DashJobNew,
  type ManageItemNew,
} from "@/src/new/screens/PostDashboardScreenNew";

type TabKey = "Live" | "Draft" | "Review";
type JobStatus = "live" | "draft" | "review";

type GatewayJob = {
  id: string;
  title?: string | null;
  status?: string | null;
  created_at?: string | null;
  workers_needed?: number | null;
  workers_hired?: number | null;
  boost_status?: string | null;
  boost_expires_at?: string | null;
  boost_starts_at?: string | null;
  banner_image?: string | null;
  server_now?: string | null;
};

/** A running boost on this listing, or null. Expired rows are hidden by the badge's own countdown. */
function activeBoost(job: GatewayJob): DashJobNew["boost"] {
  if (job.boost_status !== "active" || !job.boost_expires_at) return null;
  return { endsAt: job.boost_expires_at, startsAt: job.boost_starts_at ?? null, serverNow: job.server_now ?? null };
}

/** Only a directly loadable banner is shown; anything else falls back to the card's photo placeholder. */
function bannerUri(job: GatewayJob): string | undefined {
  const value = job.banner_image?.trim();
  return value && /^(https?:|data:image\/)/i.test(value) ? value : undefined;
}

const TABS: TabKey[] = ["Live", "Draft", "Review"];

function listingStatus(job: GatewayJob): JobStatus {
  if (job.status === "open") return "live";
  if (job.status === "draft") return "draft";
  return "review";
}

function postedOn(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  return `Posted ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

function initialsOf(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "ME";
  return (parts[0].charAt(0) + (parts[1]?.charAt(0) ?? "")).toUpperCase();
}

/** `inTabs`: rendered as the Post tab, so the tab layout draws the bottom bar. */
export default function EmployerDashboardNewAdapter({ inTabs = false }: { inTabs?: boolean } = {}) {
  const router = useRouter();
  const tabNav = useTabNavigation();
  const params = useLocalSearchParams<{ tab?: string | string[] }>();
  const { user } = useAuth();
  const { count } = useMessagingUnread();

  const requested = (Array.isArray(params.tab) ? params.tab[0] : params.tab)?.trim().toLowerCase();
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    if (requested === "draft" || requested === "review" || requested === "live") {
      return (requested.charAt(0).toUpperCase() + requested.slice(1)) as TabKey;
    }
    return "Live";
  });
  const [menuJob, setMenuJob] = useState<GatewayJob | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const jobsQuery = trpc.homlo.employer.jobs.useQuery(undefined, { enabled: Boolean(user) });
  const gatewayJobs = useMemo<GatewayJob[]>(
    () => ((jobsQuery.data as { jobs?: GatewayJob[] } | undefined)?.jobs ?? []),
    [jobsQuery.data],
  );
  const { stats, isLoading: statsLoading } = useEmployerApplications();
  const jobsFirstLoad = useFirstLoadSkeletonFlag(jobsQuery);
  const dashboardLoading = statsLoading || jobsFirstLoad;

  const jobs = useMemo(
    () =>
      gatewayJobs.map((job) => {
        const total = Math.max(Number(job.workers_needed ?? 0), 0);
        const filled = Math.max(Number(job.workers_hired ?? 0), 0);
        return { job, total, filled, status: listingStatus(job) };
      }),
    [gatewayJobs],
  );

  const filtered = useMemo(() => jobs.filter((j) => j.status === activeTab.toLowerCase()), [jobs, activeTab]);

  const tabCounts = useMemo(() => {
    const counts: Record<TabKey, number> = { Live: 0, Draft: 0, Review: 0 };
    for (const j of jobs) {
      if (j.status === "live") counts.Live += 1;
      if (j.status === "draft") counts.Draft += 1;
      if (j.status === "review") counts.Review += 1;
    }
    return counts;
  }, [jobs]);

  const ownerInitials = useMemo(() => initialsOf(user?.name), [user?.name]);

  const dashJobs = useMemo<DashJobNew[]>(
    () =>
      filtered.map(({ job, total, filled }) => {
        return {
          id: job.id,
          title: job.title?.trim() || "Untitled job",
          dateLabel: postedOn(job.created_at),
          imageUri: bannerUri(job),
          // Hidden on the card when the listing has no position count.
          positions: total > 0 ? { total, filled: Math.min(filled, total) } : null,
          positionsLeftLabel: formatPositionsLabel(filled, total),
          boost: activeBoost(job),
        };
      }),
    [filtered],
  );

  const manage = useMemo<ManageItemNew[]>(
    () => [
      { key: "applications", label: "Applications", count: stats.totalApplications },
      { key: "jobsPosted", label: "Closed jobs", count: stats.closedJobs },
      { key: "liveNow", label: "Live jobs", count: stats.liveNow },
      { key: "newApplicants", label: "New applicants", count: stats.newApplicants },
    ],
    [stats],
  );

  const go = useCallback(
    (target: string) => {
      haptic.light();
      router.push(target as never);
    },
    [router],
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    jobsQuery.refetch().finally(() => setRefreshing(false));
  }, [jobsQuery]);

  return (
    <View style={{ flex: 1 }}>
      <PostDashboardScreenNew
        stats={{
          live: stats.liveNow,
          posted: stats.jobsPosted,
          applications: stats.totalApplications,
          newApplicants: stats.newApplicants,
        }}
        initials={ownerInitials}
        hasUnread={count > 0}
        onPressBell={() => { haptic.light(); tabNav.select("alerts"); }}
        onPressSearch={() => { haptic.light(); tabNav.select("search"); }}
        onAddJob={() => go("/employer/post-job")}
        manage={manage}
        onPressManage={(key) => {
          const route =
            key === "applications"
              ? "/employer/applications"
              : key === "jobsPosted"
                ? "/employer/jobs-posted"
                : key === "liveNow"
                  ? "/employer/live-now"
                  : "/employer/new-applicants";
          go(route);
        }}
        tabs={TABS.map((t) => ({ key: t, label: t, count: dashboardLoading ? undefined : tabCounts[t] }))}
        activeTab={activeTab}
        onChangeTab={(k) => setActiveTab(k as TabKey)}
        jobs={dashJobs}
        onBoostExpire={() => void jobsQuery.refetch()}
        onPressJob={(id) => go(`/employer/job/${id}`)}
        onPressJobMenu={(id) => {
          haptic.selection();
          const match = gatewayJobs.find((j) => j.id === id) ?? null;
          setMenuJob(match);
        }}
        onRefresh={onRefresh}
        refreshing={refreshing}
        loading={dashboardLoading}
        // BUGFIX: an empty tab (or a signed-out visitor) used to see a blank area.
        empty={
          !user
            ? { title: "Sign in to post and manage jobs", actionLabel: "Sign in", onAction: () => router.push("/login" as never) }
            : activeTab === "Live"
              ? { title: "No live jobs yet", actionLabel: "Add a new job", onAction: () => go("/employer/post-job") }
              : { title: `No ${activeTab.toLowerCase()} jobs` }
        }
        // From the /employer stack page this goes back to the mounted tabs
        // (see useTabNavigation) instead of stacking a new copy of them.
        nav={inTabs ? undefined : { activeKey: "post", onSelect: tabNav.select, badgeCount: count }}
      />

      <Modal
        animationType="slide"
        transparent
        visible={menuJob !== null}
        onRequestClose={() => setMenuJob(null)}
      >
        <View style={styles.sheetOverlay}>
          <Pressable style={styles.sheetDismiss} onPress={() => setMenuJob(null)} />
          <View style={styles.actionSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle} numberOfLines={1}>{menuJob?.title}</Text>
            <Pressable
              style={styles.sheetRow}
              onPress={() => {
                if (!menuJob) return;
                const id = menuJob.id;
                setMenuJob(null);
                go(`/boost/plan?jobId=${id}`);
              }}
            >
              <Text style={styles.sheetRowTitle}>Boost listing</Text>
            </Pressable>
            <Pressable
              style={styles.sheetRow}
              onPress={() => {
                if (!menuJob) return;
                const id = menuJob.id;
                setMenuJob(null);
                go(`/employer/job/${id}/edit`);
              }}
            >
              <Text style={styles.sheetRowTitle}>Edit job info</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  sheetOverlay: { flex: 1, backgroundColor: "rgba(6,32,36,0.35)", justifyContent: "flex-end" },
  sheetDismiss: { flex: 1 },
  actionSheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 28, paddingTop: 10 },
  sheetHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "#E2E8E5", marginBottom: 12 },
  sheetTitle: { paddingHorizontal: 20, fontSize: 15, fontWeight: "700", color: "#062024", marginBottom: 8 },
  sheetRow: { paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderColor: "#EAF0EE" },
  sheetRowTitle: { fontSize: 15, fontWeight: "600", color: "#062024" },
});
