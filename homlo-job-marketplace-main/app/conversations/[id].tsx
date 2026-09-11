import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenContainer } from "@/components/screen-container";
import { ScalePressable } from "@/components/ui/scale-pressable";
import { Text } from "@/components/ui/text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuth } from "@/hooks/use-auth";
import { getMessagingService } from "@/lib/messaging";
import type { Message } from "@/lib/messaging/types";
import { haptic } from "@/lib/haptics";

type GroupedMessage = { message: Message; showDate: boolean };

const MESSAGE_PAGE_SIZE = 50;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FULL_MESSAGE_LIMIT = 4000;
const LIMITED_MESSAGE_LIMIT = 160;

/**
 * Chat screen for a single conversation. Loads history via the messaging
 * service, marks messages read on focus, subscribes to realtime for new
 * inbound messages, and clears the subscription on unmount.
 *
 * Performance:
 *  - Entry screens pass name / jobTitle / applicationStatus via route params
 *    so the header renders immediately and the screen skips a full
 *    `getConversations()` fetch just to resolve one summary.
 *  - Message history is paginated (newest-last, latest page first) with a
 *    "load earlier" affordance instead of downloading the whole thread.
 *  - getMessages + markAsRead run concurrently.
 *
 * Message limits:
 *  - A confirmed connection (application status 'hired') unlocks full-length
 *    (4000 char) messages.
 *  - Before confirmation, messages are limited to 160 characters. The server
 *    enforces the same rule (homlo_send_message); the maxLength + hint here
 *    are the client-side mirror.
 *
 * Sender identity always comes from the auth session; the server (gateway →
 * SECURITY DEFINER RPC) derives and validates it again — the client can never
 * spoof another participant.
 */
export default function ConversationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    id?: string;
    applicationId?: string;
    name?: string;
    jobTitle?: string;
    applicationStatus?: string;
    jobId?: string;
  }>();
  const conversationIdParam =
    typeof params.id === "string" && UUID_PATTERN.test(params.id) ? params.id : undefined;
  const applicationId = typeof params.applicationId === "string" ? params.applicationId : undefined;
  const { user } = useAuth();
  const currentUserId = user?.id as string | undefined;

  const [conversationId, setConversationId] = useState<string | undefined>(conversationIdParam);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [opponentName, setOpponentName] = useState<string>(typeof params.name === "string" ? params.name : "Conversation");
  const [jobTitle, setJobTitle] = useState<string>(typeof params.jobTitle === "string" ? params.jobTitle : "");
  const [jobId, setJobId] = useState<string>(typeof params.jobId === "string" ? params.jobId : "");
  const [applicationStatus, setApplicationStatus] = useState<string | null>(typeof params.applicationStatus === "string" ? params.applicationStatus : null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [blocked] = useState(false);
  const listRef = useRef<FlatList<GroupedMessage>>(null);
  const mountedRef = useRef(true);

  const serviceRef = useRef<Awaited<ReturnType<typeof getMessagingService>> | null>(null);

  // Collapse the composer's home-indicator padding when the keyboard covers
  // the bottom inset, so the input sits flush above the keyboard.
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => setKeyboardVisible(true));
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // If only an applicationId was provided (no valid conversation id), resolve
  // the canonical conversation (idempotent get-or-create). Header data comes
  // from route params; getConversations() is only a last-resort fallback for
  // deep links that arrive without them.
  useEffect(() => {
    if (conversationId || !applicationId) return;
    (async () => {
      try {
        const svc = await getMessagingService();
        serviceRef.current = svc;
        const conv = await svc.openConversation(applicationId);
        if (!mountedRef.current) return;
        setConversationId(conv.id);
        if (typeof params.name !== "string" || typeof params.jobTitle !== "string" || typeof params.applicationStatus !== "string") {
          const summaries = await svc.getConversations().catch(() => []);
          const summary = summaries.find((s) => s.id === conv.id);
          if (summary && mountedRef.current) {
            setOpponentName(summary.otherParticipant.name);
            setJobTitle(summary.jobTitle);
            setJobId(summary.jobId ?? "");
            setApplicationStatus(summary.applicationStatus);
          }
        }
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : "Could not open conversation");
          setLoading(false);
        }
      }
    })();
  }, [conversationId, applicationId, params.name, params.jobTitle, params.applicationStatus]);

  useEffect(() => {
    mountedRef.current = true;

    // Load history on mount / conversation change. getMessages + markAsRead
    // run concurrently. setState only runs inside the async continuation
    // (after awaits), never synchronously in the effect body.
    void (async () => {
      if (!conversationId || !currentUserId) return;
      try {
        const svc = await getMessagingService();
        serviceRef.current = svc;
        const [data] = await Promise.all([
          svc.getMessages(conversationId, undefined, MESSAGE_PAGE_SIZE),
          svc.markAsRead(conversationId).catch(() => {}),
        ]);
        if (!mountedRef.current) return;
        setMessages(data);
        setHasMore(data.length === MESSAGE_PAGE_SIZE);
      } catch (err) {
        if (mountedRef.current) setError(err instanceof Error ? err.message : "Could not load messages");
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();

    // RealTime subscription — cleaned up on unmount.
    let unsub: (() => void) | undefined;
    (async () => {
      const svc = await getMessagingService();
      if (!mountedRef.current) return;
      unsub = svc.subscribeToMessages((event) => {
        if (event.conversationId !== conversationId) return;
        setMessages((prev) => {
          if (prev.some((m) => m.id === event.message.id)) return prev;
          return [...prev, event.message];
        });
      });
    })();

    return () => {
      mountedRef.current = false;
      unsub?.();
    };
  }, [conversationId, currentUserId]);

  const loadEarlier = useCallback(async () => {
    if (!conversationId || loadingEarlier) return;
    const oldest = messages[0];
    if (!oldest) return;
    setLoadingEarlier(true);
    try {
      const svc = serviceRef.current ?? (await getMessagingService());
      const older = await svc.getMessages(conversationId, oldest.createdAt, MESSAGE_PAGE_SIZE);
      if (!mountedRef.current) return;
      setMessages((prev) => {
        const known = new Set(prev.map((m) => m.id));
        return [...older.filter((m) => !known.has(m.id)), ...prev];
      });
      setHasMore(older.length === MESSAGE_PAGE_SIZE);
    } catch (err) {
      if (mountedRef.current) setError(err instanceof Error ? err.message : "Could not load earlier messages");
    } finally {
      if (mountedRef.current) setLoadingEarlier(false);
    }
  }, [conversationId, loadingEarlier, messages]);

  const confirmed = applicationStatus === "hired";
  const charLimit = confirmed ? FULL_MESSAGE_LIMIT : LIMITED_MESSAGE_LIMIT;

  const handleSend = useCallback(async () => {
    const body = draft.trim();
    if (!body || sending || !conversationId || !currentUserId) return;
    if (body.length > charLimit) {
      setDraft("");
      setError(confirmed ? "Message is too long" : `Messages are limited to ${LIMITED_MESSAGE_LIMIT} characters until the application is confirmed`);
      return;
    }
    setDraft("");
    setSending(true);
    setError(null);
    try {
      const svc = serviceRef.current ?? (await getMessagingService());
      const sent = await svc.sendMessage(conversationId, body, currentUserId);
      setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
      haptic.light();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send message");
      setDraft(body);
    } finally {
      setSending(false);
    }
  }, [draft, sending, conversationId, currentUserId, charLimit, confirmed]);

  // Scroll to bottom when messages change.
  useEffect(() => {
    if (messages.length > 0) {
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  }, [messages.length]);

  const grouped = useMemo(() => {
    return messages.map((m, i) => {
      const prev = messages[i - 1];
      const sameDay =
        prev &&
        new Date(prev.createdAt).toDateString() === new Date(m.createdAt).toDateString();
      return { message: m, showDate: !sameDay };
    });
  }, [messages]);

  if (loading) {
    return (
      <ScreenContainer className="flex-1" containerClassName="bg-background" edges={["left", "right", "bottom"]}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <ScalePressable accessibilityLabel="Go back" hapticFeedback onPress={() => router.back()} style={styles.backButton}>
            <IconSymbol name="chevron.left" size={20} color="#17201A" />
          </ScalePressable>
          <View style={styles.headerCopy}>
            <Text numberOfLines={1} style={styles.headerTitle}>{opponentName}</Text>
            <Text numberOfLines={1} style={styles.headerJob}>{jobTitle}</Text>
          </View>
        </View>
        <View style={styles.center}>
          <ActivityIndicator color="#16803C" />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="flex-1" containerClassName="bg-background" edges={["left", "right", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <ScalePressable accessibilityLabel="Go back" hapticFeedback onPress={() => router.back()} style={styles.backButton}>
            <IconSymbol name="chevron.left" size={20} color="#17201A" />
          </ScalePressable>
          <View style={styles.headerCopy}>
            <Text numberOfLines={1} style={styles.headerTitle}>{opponentName}</Text>
            <Text numberOfLines={1} style={styles.headerJob}>{jobTitle || "Job conversation"}</Text>
          </View>
          <View style={styles.headerActions}>
            <ScalePressable
              accessibilityLabel="More options"
              hapticFeedback
              onPress={() => {
                // Action sheet placeholder — reports/blocks are wired via the
                // messaging service when we add the options menu.
                haptic.light();
              }}
              style={styles.moreButton}
            >
              <IconSymbol name="ellipsis" size={20} color="#17201A" />
            </ScalePressable>
          </View>
        </View>

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        )}

        <FlatList
          ref={listRef}
          data={grouped}
          keyExtractor={(item) => item.message.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            hasMore ? (
              <View style={styles.loadEarlierWrap}>
                <ScalePressable
                  accessibilityLabel="Load earlier messages"
                  hapticFeedback
                  disabled={loadingEarlier}
                  onPress={loadEarlier}
                  style={styles.loadEarlierButton}
                >
                  {loadingEarlier ? (
                    <ActivityIndicator size="small" color="#16803C" />
                  ) : (
                    <Text style={styles.loadEarlierText}>Load earlier messages</Text>
                  )}
                </ScalePressable>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const own = item.message.senderId === currentUserId;
            return (
              <View>
                {item.showDate && (
                  <View style={styles.dateSeparator}>
                    <Text style={styles.dateSeparatorText}>
                      {new Date(item.message.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </Text>
                  </View>
                )}
                <View style={[styles.bubbleRow, own ? styles.bubbleRowOwn : styles.bubbleRowOther]}>
                  {item.message.deletedAt ? (
                    <View style={[styles.bubble, styles.bubbleDeleted, own ? styles.bubbleDeletedOwn : styles.bubbleDeletedOther]}>
                      <Text style={styles.deletedText}>Message deleted</Text>
                    </View>
                  ) : (
                    <View style={[styles.bubble, own ? styles.bubbleOwn : styles.bubbleOther]}>
                      <Text style={[styles.bubbleText, own ? styles.bubbleTextOwn : styles.bubbleTextOther]}>
                        {item.message.body}
                      </Text>
                      {item.message.messageType === "application" && !own && jobId ? (
                        <ScalePressable
                          accessibilityLabel="View this job"
                          hapticFeedback
                          onPress={() => router.push({ pathname: "/employer/job/[id]", params: { id: jobId } } as never)}
                          style={styles.jobCta}
                        >
                          <Text style={styles.jobCtaText}>View job</Text>
                          <IconSymbol name="arrow.right" size={14} color="#FFFFFF" />
                        </ScalePressable>
                      ) : null}
                      <Text style={styles.bubbleTime}>
                        {new Date(item.message.createdAt).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            );
          }}
        />

        {!confirmed && !blocked && (
          <View style={styles.limitHint}>
            <Text style={styles.limitHintText}>
              Messages are limited to {LIMITED_MESSAGE_LIMIT} characters until the application is confirmed.
            </Text>
            <Text style={styles.limitHintCount}>
              {draft.length}/{LIMITED_MESSAGE_LIMIT}
            </Text>
          </View>
        )}

        <View style={[styles.composer, { paddingBottom: keyboardVisible ? 8 : Math.max(insets.bottom, 10) + 8 }]}>
          {blocked ? (
            <View style={styles.blockedBar}>
              <Text style={styles.blockedText}>This conversation is blocked</Text>
            </View>
          ) : (
            <>
              <TextInput
                style={styles.input}
                placeholder={confirmed ? "Write a message…" : `Write a message (max ${LIMITED_MESSAGE_LIMIT} characters)…`}
                placeholderTextColor="#94A098"
                value={draft}
                onChangeText={setDraft}
                multiline
                maxLength={charLimit}
              />
              <ScalePressable
                accessibilityLabel="Send message"
                hapticFeedback
                disabled={!draft.trim() || sending}
                onPress={handleSend}
                style={[styles.sendButton, (!draft.trim() || sending) && styles.sendButtonDisabled]}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <IconSymbol name="arrow.up" size={18} color="#FFFFFF" />
                )}
              </ScalePressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { alignItems: "center", flex: 1, justifyContent: "center" },
  header: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderBottomColor: "#E2E8E5",
    borderBottomWidth: 1,
    flexDirection: "row",
    paddingBottom: 10,
    paddingHorizontal: 14,
  },
  backButton: {
    alignItems: "center",
    backgroundColor: "#F2F5F3",
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  moreButton: {
    alignItems: "center",
    backgroundColor: "#F2F5F3",
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  headerCopy: { flex: 1, minWidth: 0, paddingHorizontal: 8 },
  headerTitle: { color: "#17201A", fontSize: 15, fontWeight: "700" },
  headerJob: { color: "#66736A", fontSize: 11.5, marginTop: 2 },
  headerActions: { flexDirection: "row", gap: 6 },
  listContent: { padding: 14, paddingBottom: 24 },
  loadEarlierWrap: { alignItems: "center", paddingBottom: 4, paddingTop: 2 },
  loadEarlierButton: {
    alignItems: "center",
    backgroundColor: "#EDF1EE",
    borderRadius: 14,
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: 14,
  },
  loadEarlierText: { color: "#16803C", fontSize: 12, fontWeight: "700" },
  dateSeparator: { alignItems: "center", marginVertical: 8 },
  dateSeparatorText: { color: "#94A098", fontSize: 11, fontWeight: "600" },
  bubbleRow: { flexDirection: "row", marginVertical: 2 },
  bubbleRowOwn: { justifyContent: "flex-end" },
  bubbleRowOther: { justifyContent: "flex-start" },
  bubble: { borderRadius: 16, maxWidth: "80%", paddingHorizontal: 12, paddingVertical: 8 },
  bubbleOwn: { backgroundColor: "#16803C", borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: "#EDF1EE", borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 14, lineHeight: 19 },
  bubbleTextOwn: { color: "#FFFFFF" },
  bubbleTextOther: { color: "#1B2825" },
  jobCta: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#16803C",
    borderRadius: 10,
    flexDirection: "row",
    gap: 5,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  jobCtaText: { color: "#FFFFFF", fontSize: 12.5, fontWeight: "700" },
  bubbleTime: { color: "rgba(255,255,255,0.65)", fontSize: 9.5, marginTop: 3, textAlign: "right" },
  bubbleDeleted: { backgroundColor: "#F5F6F5", borderStyle: "dashed", borderWidth: 1, borderColor: "#CBD5D1" },
  bubbleDeletedOwn: {},
  bubbleDeletedOther: {},
  deletedText: { color: "#94A098", fontStyle: "italic", fontSize: 12 },
  limitHint: {
    alignItems: "center",
    backgroundColor: "#F2F5F3",
    borderTopColor: "#E2E8E5",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  limitHintText: { color: "#66736A", fontSize: 11, flex: 1 },
  limitHintCount: { color: "#94A098", fontSize: 11, fontWeight: "600" },
  composer: {
    alignItems: "flex-end",
    backgroundColor: "#FFFFFF",
    borderTopColor: "#E2E8E5",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  input: {
    backgroundColor: "#F2F5F3",
    borderRadius: 20,
    color: "#1B2825",
    flex: 1,
    fontSize: 14,
    maxHeight: 110,
    minHeight: 40,
    paddingHorizontal: 14,
    paddingTop: Platform.OS === "ios" ? 10 : 9,
    paddingBottom: 10,
  },
  sendButton: {
    alignItems: "center",
    backgroundColor: "#16803C",
    borderRadius: 20,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  sendButtonDisabled: { opacity: 0.4 },
  blockedBar: {
    backgroundColor: "#FBECEC",
    borderRadius: 10,
    padding: 12,
    width: "100%",
  },
  blockedText: { color: "#B54242", fontSize: 12.5, fontWeight: "600", textAlign: "center" },
  errorBanner: { backgroundColor: "#FBECEC", paddingHorizontal: 14, paddingVertical: 8 },
  errorBannerText: { color: "#B54242", fontSize: 12.5 },
});