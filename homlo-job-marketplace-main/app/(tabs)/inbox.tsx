import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { Text } from "@/components/ui/text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuth } from "@/hooks/use-auth";
import { getMessagingService } from "@/lib/messaging";
import type { ConversationSummary } from "@/lib/messaging/types";

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

export default function InboxScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    // Initial load. setState only runs inside the async continuation (after
    // awaits), never synchronously in the effect body.
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
          <ActivityIndicator color="#16803C" />
          <Text style={styles.loadingText}>Loading conversations…</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (!user) {
    return (
      <ScreenContainer className="flex-1" containerClassName="bg-background">
        <View style={styles.empty}>
          <IconSymbol name="person.fill" size={28} color="#16803C" />
          <Text style={styles.emptyTitle}>Sign in to view messages</Text>
          <Text style={styles.emptyCopy}>
            Your conversations with employers appear here.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign in to Homlo"
            onPress={() => router.replace("/login" as never)}
            style={styles.signInButton}
          >
            <Text style={styles.signInButtonText}>Sign in</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  if (error && conversations.length === 0) {
    return (
      <ScreenContainer className="flex-1" containerClassName="bg-background">
        <View style={styles.empty}>
          <IconSymbol name="exclamationmark.triangle.fill" size={24} color="#E8A520" />
          <Text style={styles.emptyTitle}>{"Couldn't load conversations"}</Text>
          <Text style={styles.emptyCopy}>{error}</Text>
          <Pressable accessibilityRole="button" onPress={loadConversations} style={styles.browseButton}>
            <Text style={styles.browseButtonText}>Retry</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="flex-1" containerClassName="bg-background">
      <FlatList
        contentContainerStyle={styles.content}
        data={conversations}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#16803C" colors={["#16803C"]} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View>
                <Text style={styles.title}>My inbox</Text>
                <Text style={styles.subtitle}>Applications and messages in one place</Text>
              </View>
              <View style={styles.headerIcon}><IconSymbol name="bell" size={18} color="#0F7D5E" /></View>
            </View>
            <View style={styles.tabs}>
              <View style={[styles.tab, styles.tabActive]}><Text style={styles.tabActiveText}>Applications</Text></View>
              <View style={styles.tab}><Text style={styles.tabText}>Messages</Text></View>
              <View style={styles.tab}><Text style={styles.tabText}>Updates</Text></View>
            </View>
          </View>
        }
        ListEmptyComponent={
            <View style={styles.empty}>
            <IconSymbol name="paperplane.fill" size={24} color="#16803C" />
              <Text style={styles.emptyTitle}>No applications yet</Text>
              <Text style={styles.emptyCopy}>
              Your application updates and employer messages will appear here.
              </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Browse open jobs"
              onPress={() => router.push("/jobs" as never)}
              style={styles.browseButton}
            >
              <Text style={styles.browseButtonText}>Browse jobs</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => {
          const initials = item.otherParticipant.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open conversation for ${item.jobTitle}`}
              onPress={() =>
                router.push({
                  pathname: "/conversations/[id]",
                  params: { id: item.id },
                } as never)
              }
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={[styles.avatar, item.unreadCount > 0 && styles.avatarUnread]}>
                <Text style={styles.avatarText}>{initials || "?"}</Text>
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
  tabActive: { backgroundColor: "#0F7D5E" },
  tabText: { color: "#66736A", fontSize: 12, fontWeight: "600" },
  tabActiveText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  empty: { alignItems: "center", flex: 1, justifyContent: "center", paddingHorizontal: 35 },
  emptyTitle: { color: "#17201A", fontSize: 17, fontWeight: "700", marginTop: 12 },
  emptyCopy: { color: "#66736A", fontSize: 13, lineHeight: 19, marginTop: 5, textAlign: "center" },
  browseButton: { alignItems: "center", backgroundColor: "#16803C", borderRadius: 12, marginTop: 18, minHeight: 46, paddingHorizontal: 22, paddingVertical: 12 },
  browseButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  signInButton: { alignItems: "center", backgroundColor: "#16803C", borderRadius: 12, justifyContent: "center", minHeight: 48, marginTop: 18, paddingHorizontal: 22 },
  signInButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  row: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E2E8E5", borderRadius: 16, borderWidth: 1, flexDirection: "row", gap: 12, marginTop: 12, padding: 13 },
  pressed: { opacity: 0.78 },
  avatar: { alignItems: "center", backgroundColor: "#EDF1EE", borderRadius: 22, height: 44, justifyContent: "center", width: 44 },
  avatarUnread: { backgroundColor: "#16803C" },
  avatarText: { color: "#16803C", fontSize: 14, fontWeight: "700" },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTopLine: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  rowName: { color: "#17201A", fontSize: 14, fontWeight: "600", flex: 1, minWidth: 0 },
  rowNameUnread: { fontWeight: "700" },
  rowTime: { color: "#94A098", fontSize: 11, marginLeft: 6 },
  rowJob: { color: "#66736A", fontSize: 11.5, marginTop: 2 },
  rowPreview: { color: "#66736A", fontSize: 12, marginTop: 3 },
  rowPreviewUnread: { color: "#1B2825", fontWeight: "600" },
  badge: { alignSelf: "center", backgroundColor: "#16803C", borderRadius: 10, minWidth: 20, paddingHorizontal: 6, paddingVertical: 3 },
  badgeText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700", textAlign: "center" },
  loading: { alignItems: "center", flex: 1, gap: 10, justifyContent: "center" },
  loadingText: { color: "#66736A", fontSize: 13, fontWeight: "500" },
});
