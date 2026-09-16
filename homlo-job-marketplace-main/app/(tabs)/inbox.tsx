import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Image as RNImage, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { Text } from "@/components/ui/text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuth } from "@/hooks/use-auth";
import { getMessagingService } from "@/lib/messaging";
import type { ConversationSummary } from "@/lib/messaging/types";
import { trpc } from "@/lib/trpc";
import { jobs } from "@/components/job-store";
import { localImageUris } from "@/lib/local-image-uris";
import { getProfilePhotoUrl } from "@/lib/profile-photo";

type Tab = "applications" | "messages" | "updates";
type GatewayApplication = { id: string; job_id: string; status: string; message: string | null; created_at: string; updated_at: string; job_title: string; job_location_text: string | null; employer_id: string; employer_name: string | null };
const TABS: { key: Tab; label: string }[] = [
  { key: "applications", label: "Applications" },
  { key: "messages", label: "Messages" },
  { key: "updates", label: "Updates" },
];

function initialsOf(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?";
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString();
}

const statusColors: Record<string, { label: string; bg: string; fg: string }> = {
  applied: { label: "Applied", bg: "#E3FAF1", fg: "#24A877" },
  reviewed: { label: "Viewed", bg: "#EEF2F7", fg: "#3B6A9E" },
  interview: { label: "Interview", bg: "#FFF5E0", fg: "#B8860B" },
  hired: { label: "Hired", bg: "#E3FAF1", fg: "#24A877" },
  rejected: { label: "Rejected", bg: "#FDECEE", fg: "#B42318" },
  declined: { label: "Rejected", bg: "#FDECEE", fg: "#B42318" },
  withdrawn: { label: "Withdrawn", bg: "#F3F6F4", fg: "#66736A" },
};

export default function InboxScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<Tab>("applications");
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applications = trpc.homlo.applications.list.useQuery(undefined, { enabled: Boolean(user) });
  const appRows = ((applications.data as { applications?: GatewayApplication[] } | undefined)?.applications ?? []);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    try {
      const svc = await getMessagingService();
      const data = await svc.getConversations();
      setError(null);
      setConversations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load conversations");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    void (async () => {
      if (!user) return;
      try {
        const svc = await getMessagingService();
        const data = await svc.getConversations();
        setError(null);
        setConversations(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load conversations");
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadConversations();
  }, [loadConversations]);

  if (authLoading || (user && loading)) {
    return (
      <ScreenContainer className="flex-1" containerClassName="bg-background">
        <View style={styles.loading}>
          <ActivityIndicator color="#34C99A" />
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (!user) {
    return (
      <ScreenContainer className="flex-1" containerClassName="bg-background">
        <View style={styles.empty}>
          <IconSymbol name="person.fill" size={28} color="#34C99A" />
          <Text style={styles.emptyTitle}>Sign in to view your inbox</Text>
          <Text style={styles.emptyCopy}>
            Your applications, messages, and updates appear here.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign in to Homlo"
            onPress={() => router.replace("/login" as never)}
            style={styles.actionButton}
          >
            <Text style={styles.actionButtonText}>Sign in</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  if (error && tab === "messages" && conversations.length === 0) {
    return (
      <ScreenContainer className="flex-1" containerClassName="bg-background">
        <View style={styles.empty}>
          <IconSymbol name="exclamationmark.triangle.fill" size={24} color="#E8A520" />
          <Text style={styles.emptyTitle}>{"Couldn't load messages"}</Text>
          <Text style={styles.emptyCopy}>{error}</Text>
          <Pressable accessibilityRole="button" onPress={loadConversations} style={styles.actionButton}>
            <Text style={styles.actionButtonText}>Retry</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  const header = (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <View>
          <Text style={styles.title}>My inbox</Text>
          <Text style={styles.subtitle}>Applications and messages in one place</Text>
        </View>
        <View style={styles.headerIcon}><IconSymbol name="bell" size={18} color="#2BB389" /></View>
      </View>
      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable
            key={t.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t.key }}
            onPress={() => setTab(t.key)}
            style={[styles.tab, tab === t.key && styles.tabActive]}
          >
            <Text style={tab === t.key ? styles.tabActiveText : styles.tabText}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  if (tab === "applications") {
    return (
      <ScreenContainer className="flex-1" containerClassName="bg-background">
        <FlatList
          data={appRows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.content}
          ListHeaderComponent={header}
          ListEmptyComponent={
            <View style={styles.empty}>
              <IconSymbol name="briefcase" size={24} color="#34C99A" />
              <Text style={styles.emptyTitle}>No applications yet</Text>
              <Text style={styles.emptyCopy}>Your application updates will appear here.</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Browse open jobs"
                onPress={() => router.push("/jobs" as never)}
                style={styles.actionButton}
              >
                <Text style={styles.actionButtonText}>Browse jobs</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => {
            const job = jobs.find((j) => j.id === item.job_id);
            const img = job ? localImageUris[job.id] || job.image : null;
            const sc = statusColors[item.status] ?? statusColors.pending;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.job_title ?? "Application"} — ${sc.label}`}
                onPress={() => router.push({ pathname: "/applications/[id]", params: { id: item.id } } as never)}
                style={({ pressed }) => [styles.appRow, pressed && styles.pressed]}
              >
                {img ? (
                  <RNImage source={{ uri: img }} style={styles.appImage} />
                ) : (
                  <View style={[styles.appImage, styles.appImagePlaceholder]}><IconSymbol name="briefcase" size={18} color="#94A098" /></View>
                )}
                <View style={styles.appCopy}>
                  <Text numberOfLines={1} style={styles.appTitle}>{item.job_title ?? "Application"}</Text>
                  <Text numberOfLines={1} style={styles.appMeta}>{item.employer_name ?? job?.company ?? ""}</Text>
                </View>
                <View style={styles.appEnd}>
                  <View style={[styles.appBadge, { backgroundColor: sc.bg }]}><Text style={[styles.appBadgeText, { color: sc.fg }]}>{sc.label}</Text></View>
                  {item.created_at ? <Text style={styles.appDate}>{new Date(item.created_at).toLocaleDateString()}</Text> : null}
                </View>
              </Pressable>
            );
          }}
          showsVerticalScrollIndicator={false}
        />
      </ScreenContainer>
    );
  }

  if (tab === "updates") {
    return (
      <ScreenContainer className="flex-1" containerClassName="bg-background">
        <View style={styles.content}>
          {header}
          <View style={styles.empty}>
            <IconSymbol name="checkmark.circle.fill" size={24} color="#34C99A" />
            <Text style={styles.emptyTitle}>No updates yet</Text>
            <Text style={styles.emptyCopy}>When employers update your application status, you will see it here.</Text>
          </View>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="flex-1" containerClassName="bg-background">
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#34C99A" colors={["#34C99A"]} />}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <View style={styles.empty}>
            <IconSymbol name="paperplane.fill" size={24} color="#34C99A" />
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptyCopy}>Your conversations with employers appear here.</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Browse open jobs"
              onPress={() => router.push("/jobs" as never)}
              style={styles.actionButton}
            >
              <Text style={styles.actionButtonText}>Browse jobs</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => {
          const photo = getProfilePhotoUrl(item.otherParticipant.photo);
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open conversation for ${item.jobTitle}`}
              onPress={() =>
                router.push({
                  pathname: "/conversations/[id]",
                  params: {
                    id: item.id,
                    jobId: item.jobId ?? "",
                    name: item.otherParticipant.name,
                    jobTitle: item.jobTitle,
                    applicationStatus: item.applicationStatus ?? "",
                    photo: photo ?? "",
                  },
                } as never)
              }
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={[styles.avatar, item.unreadCount > 0 && !photo && styles.avatarUnread]}>
                {photo ? (
                  <RNImage source={{ uri: photo }} style={styles.avatarPhoto} />
                ) : (
                  <Text style={styles.avatarText}>{initialsOf(item.otherParticipant.name)}</Text>
                )}
              </View>
              <View style={styles.rowCopy}>
                <View style={styles.rowTopLine}>
                  <Text numberOfLines={1} style={[styles.rowName, item.unreadCount > 0 && styles.rowNameUnread]}>
                    {item.otherParticipant.name}
                  </Text>
                  <Text style={styles.rowTime}>{timeAgo(item.lastMessageAt)}</Text>
                </View>
                <Text numberOfLines={1} style={styles.rowJob}>{item.jobTitle}</Text>
                {item.lastMessage && (
                  <Text numberOfLines={1} style={[styles.rowPreview, item.unreadCount > 0 && styles.rowPreviewUnread]}>
                    {item.lastMessage}
                  </Text>
                )}
              </View>
              {item.unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.unreadCount > 99 ? "99+" : item.unreadCount}</Text>
                </View>
              )}
            </Pressable>
          );
        }}
        showsVerticalScrollIndicator={false}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 18, paddingBottom: 28 },
  header: { borderBottomColor: "#E2E8E5", borderBottomWidth: 1, paddingBottom: 12, paddingTop: 3 },
  titleRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  title: { color: "#17201A", fontSize: 27, fontWeight: "800", letterSpacing: -0.75 },
  subtitle: { color: "#66736A", fontSize: 12.5, lineHeight: 18, marginTop: 5 },
  headerIcon: { alignItems: "center", backgroundColor: "#EAF6F3", borderRadius: 20, height: 40, justifyContent: "center", width: 40 },
  tabs: { flexDirection: "row", gap: 8, marginTop: 18 },
  tab: { alignItems: "center", backgroundColor: "#F3F6F4", borderRadius: 999, flex: 1, paddingVertical: 9 },
  tabActive: { backgroundColor: "#2BB389" },
  tabText: { color: "#66736A", fontSize: 12, fontWeight: "600" },
  tabActiveText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  empty: { alignItems: "center", flex: 1, justifyContent: "center", paddingHorizontal: 35 },
  emptyTitle: { color: "#17201A", fontSize: 17, fontWeight: "700", marginTop: 12 },
  emptyCopy: { color: "#66736A", fontSize: 13, lineHeight: 19, marginTop: 5, textAlign: "center" },
  actionButton: { alignItems: "center", backgroundColor: "#34C99A", borderRadius: 12, marginTop: 18, minHeight: 46, paddingHorizontal: 22, paddingVertical: 12 },
  actionButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  appRow: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E2E8E5", borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 11, marginTop: 10, padding: 12 },
  appImage: { borderRadius: 8, height: 56, width: 56 },
  appImagePlaceholder: { alignItems: "center", backgroundColor: "#EDF1EE", justifyContent: "center" },
  appCopy: { flex: 1, minWidth: 0 },
  appTitle: { color: "#17201A", fontSize: 13.5, fontWeight: "600" },
  appMeta: { color: "#66736A", fontSize: 11.5, marginTop: 3 },
  appEnd: { alignItems: "flex-end", marginLeft: 6 },
  appBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  appBadgeText: { fontSize: 10, fontWeight: "600" },
  appDate: { color: "#94A098", fontSize: 10, marginTop: 4 },
  row: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E2E8E5", borderRadius: 16, borderWidth: 1, flexDirection: "row", gap: 12, marginTop: 10, padding: 13 },
  pressed: { opacity: 0.78 },
  avatar: { alignItems: "center", backgroundColor: "#EDF1EE", borderRadius: 22, height: 44, justifyContent: "center", overflow: "hidden", width: 44 },
  avatarUnread: { backgroundColor: "#34C99A" },
  avatarPhoto: { height: 44, width: 44 },
  avatarText: { color: "#34C99A", fontSize: 14, fontWeight: "700" },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTopLine: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  rowName: { color: "#17201A", fontSize: 14, fontWeight: "600", flex: 1, minWidth: 0 },
  rowNameUnread: { fontWeight: "700" },
  rowTime: { color: "#94A098", fontSize: 11, marginLeft: 6 },
  rowJob: { color: "#66736A", fontSize: 11.5, marginTop: 2 },
  rowPreview: { color: "#66736A", fontSize: 12, marginTop: 3 },
  rowPreviewUnread: { color: "#1B2825", fontWeight: "600" },
  badge: { alignSelf: "center", backgroundColor: "#34C99A", borderRadius: 10, minWidth: 20, paddingHorizontal: 6, paddingVertical: 3 },
  badgeText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700", textAlign: "center" },
  loading: { alignItems: "center", flex: 1, gap: 10, justifyContent: "center" },
  loadingText: { color: "#66736A", fontSize: 13, fontWeight: "500" },
});
