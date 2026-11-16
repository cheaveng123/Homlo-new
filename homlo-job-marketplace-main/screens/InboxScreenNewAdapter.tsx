import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";

import { TextNew } from "@/src/new/components/TextNew";
import { PressableScaleNew } from "@/src/new/components/PrimitivesNew";
import { colorsNew } from "@/src/new/theme/tokensNew";
import { InboxScreenNew, type ConversationNew } from "@/src/new/screens/InboxScreenNew";
import { ScreenStateNew } from "@/src/new/types/jobNew";
import { ApplicationsList } from "@/src/new/applications";
import { useMyApplications } from "@/src/new/applications/useMyApplications";
import {
  openApplication as navigateApplication,
  openApplicationChat as navigateApplicationChat,
} from "@/src/new/applications/routes";
import { useAuth } from "@/hooks/use-auth";
import { haptic } from "@/lib/haptics";
import { getMessagingService } from "@/lib/messaging";
import type { ConversationSummary } from "@/lib/messaging/types";
import { getProfilePhotoUrl } from "@/lib/profile-photo";
import { trpc } from "@/lib/trpc";

const TABS = ["Applications", "Messages", "Updates"];
const TAB_KEYS = ["applications", "messages", "updates"] as const;

const STATUS_LABELS: Record<string, string> = {
  applied: "applicant",
  reviewed: "applicant",
  interview: "interview",
  hired: "hired",
  rejected: "rejected",
  declined: "rejected",
  withdrawn: "withdrawn",
};

const UPDATE_STATUSES = new Set(["interview", "hired", "rejected", "declined", "withdrawn"]);

function normalizeTab(tab?: string): string {
  return tab === "applications" || tab === "updates" ? tab : "messages";
}

function initialsOf(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?";
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString();
}

export default function InboxScreenNewAdapter({ initialTab = "messages" }: { initialTab?: string }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<string>(() => normalizeTab(initialTab));
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contactQuery, setContactQuery] = useState("");

  const {
    applications,
    isLoading: appLoading,
    error: appError,
    refetch: refetchApplications,
  } = useMyApplications();

  const markRead = trpc.homlo.notifications.markRead.useMutation();

  const notificationsQuery = trpc.homlo.notifications.list.useQuery(undefined, {
    enabled: Boolean(user),
  });
  const notificationsRefetch = notificationsQuery.refetch;

  useEffect(() => {
    // The route can change the requested tab while the Inbox stays mounted,
    // for example when apply-success replaces the modal with Inbox/Applications.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTab(normalizeTab(initialTab));
  }, [initialTab]);

  const loadConversationsRequestId = useRef(0);

  const loadConversations = useCallback(async () => {
    if (authLoading) return;
    if (!user) {
      console.log("[messaging:inbox] loadConversations: no user, setting loading=false");
      setConversations([]);
      setError(null);
      setLoading(false);
      return;
    }
    const requestId = ++loadConversationsRequestId.current;
    console.log("[messaging:inbox] loadConversations: starting, requestId=", requestId, "userId=", user.id);
    const timeoutMs = 30_000;
    setLoading(true);
    setError(null);
    try {
      const svc = await getMessagingService();
      console.log("[messaging:inbox] loadConversations: got messaging service");
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Conversation loading timed out")), timeoutMs),
      );
      const data = await Promise.race([svc.getConversations(), timeout]);
      console.log("[messaging:inbox] loadConversations: got", data?.length ?? 0, "conversations, requestId=", requestId);
      if (requestId !== loadConversationsRequestId.current) {
        console.log("[messaging:inbox] loadConversations: stale response ignored, requestId=", requestId, "current=", loadConversationsRequestId.current);
        return;
      }
      setConversations(data);
      setError(null);
    } catch (err) {
      console.error(
        "[messaging:inbox] loadConversations: error:",
        err instanceof Error ? err.message : String(err),
        "requestId=", requestId,
        "error=", err,
      );
      if (requestId !== loadConversationsRequestId.current) {
        console.log("[messaging:inbox] loadConversations: stale error ignored, requestId=", requestId);
        return;
      }
      setError(err instanceof Error ? err.message : "Could not load conversations");
    } finally {
      if (requestId === loadConversationsRequestId.current) {
        console.log("[messaging:inbox] loadConversations: finally, setting loading=false, requestId=", requestId);
        setLoading(false);
      }
    }
  }, [user, authLoading]);

  useFocusEffect(
    useCallback(() => {
      void loadConversations();
      void refetchApplications();
      void notificationsRefetch();
    }, [loadConversations, refetchApplications, notificationsRefetch]),
  );

  const notificationItems = useMemo<ConversationSummary[]>(() => {
    const rows = (notificationsQuery.data as { notifications?: Array<{ id: string; type: string; title: string; body: string; read: boolean; created_at: string; job_id: string | null; data: unknown }> | undefined})?.notifications ?? [];
    return rows
      .filter((n) => n.type === 'boost_started' || n.type === 'boost_ended')
      .map((n) => ({
        id: `notification-${n.id}`,
        applicationId: null,
        jobId: typeof n.data === 'object' && n.data !== null && 'job_id' in n.data ? String((n.data as { job_id?: unknown }).job_id) : (n.job_id ?? null),
        jobTitle: n.title,
        otherParticipant: { userId: '', name: n.title, role: 'both' as const, photo: null },
        lastMessageAt: n.created_at,
        lastMessage: n.body,
        lastMessageAuthorId: null,
        unreadCount: n.read ? 0 : 1,
        applicationStatus: null,
      } as ConversationSummary));
  }, [notificationsQuery.data]);

  const filtered = useMemo(() => {
    const byTab =
      tab === "applications"
        ? conversations.filter((c) => !!c.applicationStatus)
        : tab === "updates"
          ? [...conversations.filter((c) => c.applicationStatus && UPDATE_STATUSES.has(c.applicationStatus)), ...notificationItems]
          : conversations;
    const q = contactQuery.trim().toLowerCase();
    if (!q) return byTab;
    return byTab.filter((c) => c.otherParticipant.name.toLowerCase().includes(q));
  }, [conversations, tab, contactQuery, notificationItems]);

  const items = useMemo<ConversationNew[]>(
    () =>
      filtered.map((c) => {
        const isNotification = c.id.startsWith('notification-');
        const statusLabel = c.applicationStatus ? STATUS_LABELS[c.applicationStatus] ?? c.applicationStatus : "";
        return {
          id: c.id,
          name: c.otherParticipant.name,
          initials: initialsOf(c.otherParticipant.name),
          photo: c.otherParticipant.photo ?? null,
          preview: isNotification ? c.lastMessage ?? "" : [statusLabel, c.lastMessage ?? c.jobTitle].filter(Boolean).join(" · "),
          timeLabel: timeAgo(c.lastMessageAt),
          unreadCount: c.unreadCount,
        };
      }),
    [filtered],
  );

  const openThread = useCallback(
    (id: string) => {
      if (id.startsWith('notification-')) {
        const notificationId = id.slice('notification-'.length);
        const row = (notificationsQuery.data as { notifications?: Array<{ id: string; data: unknown; job_id: string | null }> | undefined})?.notifications?.find((n) => n.id === notificationId);
        const jobId = typeof row?.data === 'object' && row?.data !== null && 'job_id' in row.data ? String((row.data as { job_id?: unknown }).job_id) : (row?.job_id ?? null);
        if (jobId) {
          void markRead.mutateAsync({ notificationId });
          router.push({ pathname: "/employer/job/[id]", params: { id: jobId } } as never);
        }
        return;
      }
      const summary = conversations.find((c) => c.id === id);
      if (!summary) return;
      const photo = getProfilePhotoUrl(summary.otherParticipant.photo) ?? "";
      router.push({
        pathname: "/conversations/[id]",
        params: {
          id: summary.id,
          jobId: summary.jobId ?? "",
          name: summary.otherParticipant.name,
          jobTitle: summary.jobTitle,
          applicationStatus: summary.applicationStatus,
          photo,
        },
      } as never);
    },
    [conversations, notificationsQuery.data, router, trpc, markRead],
  );

  const openApplication = useCallback(
    (applicationId: string) => navigateApplication(router, applicationId),
    [router],
  );

  const openApplicationChat = useCallback(
    (applicationId: string) => navigateApplicationChat(router, applicationId),
    [router],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.allSettled([loadConversations(), refetchApplications(), notificationsRefetch()]);
    } finally {
      setRefreshing(false);
    }
  }, [loadConversations, refetchApplications, notificationsRefetch]);

  const tabLoading = tab === "applications"
    ? appLoading
    : tab === "messages"
      ? loading
      : loading || appLoading || notificationsQuery.isLoading;
  let state: ScreenStateNew = "ready";
  if (authLoading || (user && tabLoading)) state = "loading";
  else if (tab !== "applications" && error && items.length === 0) state = "error";
  else if (tab !== "applications" && items.length === 0) state = "empty";

  const applicationsTab = (
    <ApplicationsList
      applications={applications.map((app) => ({
        id: app.id,
        jobTitle: app.job_title,
        employerName: app.employer_name ?? null,
        jobImageUri: app.banner_image ?? null,
        status: app.state,
        appliedAt: app.created_at,
      }))}
      isLoading={authLoading || appLoading}
      isError={Boolean(appError)}
      onRetry={() => void refetchApplications()}
      onOpen={(id) => openApplication(id)}
      onMessage={(item) => openApplicationChat(item.id)}
    />
  );

  if (!user && !authLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32, backgroundColor: colorsNew.white }}>
        <TextNew variant="hero" align="center">Your inbox</TextNew>
        <TextNew variant="body" color={colorsNew.muted} align="center">
          Sign in to see your applications and messages.
        </TextNew>
        <PressableScaleNew
          onPress={() => router.push("/login" as never)}
          style={{ marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999, backgroundColor: colorsNew.primary }}
        >
          <TextNew variant="title" weight="semibold" color={colorsNew.white}>Sign in</TextNew>
        </PressableScaleNew>
      </View>
    );
  }

  return (
    <InboxScreenNew
      state={state}
      tab={tab}
      onChangeTab={setTab}
      tabs={TAB_KEYS.map((key, i) => ({ key, label: TABS[i] }))}
      onPressSearch={() => haptic.selection()}
      onPressNotification={() => {}}
      groups={[]}
      conversations={items}
      contactQuery={contactQuery}
      onChangeContactQuery={setContactQuery}
      onPressConversation={openThread}
      onRetry={() => {
        void refetchApplications();
        void loadConversations();
        void notificationsRefetch();
      }}
      applicationsTab={applicationsTab}
      refreshing={refreshing}
      onRefresh={() => void onRefresh()}
    />
  );
}
