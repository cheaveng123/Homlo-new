/**
 * screens/ChatThreadScreen.tsx
 *
 * Chat thread with the redesign shell (ChatHeader, QuickReplyChips,
 * ChatInputBar, SystemMessageCard for application/status-change messages)
 * while retaining the proven thread data flow: load history via the
 * messaging service, mark messages read on focus, subscribe to realtime for
 * inbound messages, paginate older history, and enforce the pre-confirmation
 * character limit on send.
 *
 * Sender identity always comes from the auth session; the server (gateway →
 * SECURITY DEFINER RPC) derives and validates it again.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image as RNImage,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ChatHeader from '../components/chat/ChatHeader';
import SystemMessageCard from '../components/chat/SystemMessageCard';
import ChatInputBar from '../components/chat/ChatInputBar';
import { SEND_EXIT_MS } from '../components/chat/send-config';
import { colors, type } from '../theme/tokens';
import { useAuth } from '@/hooks/use-auth';
import { getMessagingService } from '@/lib/messaging';
import type { Message } from '@/lib/messaging/types';
import { haptic } from '@/lib/haptics';
import { getProfilePhotoUrl } from '@/lib/profile-photo';

type GroupedMessage = { message: Message; showDate: boolean };

const MESSAGE_PAGE_SIZE = 50;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FULL_MESSAGE_LIMIT = 4000;
const LIMITED_MESSAGE_LIMIT = 160;

function initialsOf(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || '?';
}

function timeOf(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function Avatar({ uri, name, size = 26 }: { uri: string | null; name: string; size?: number }) {
  return (
    <View style={[styles.avatarBase, { borderRadius: size / 2, height: size, width: size }]}>
      {uri ? (
        <RNImage source={{ uri }} style={{ borderRadius: size / 2, height: size, width: size }} />
      ) : (
        <Text style={[styles.avatarInitials, { fontSize: Math.round(size * 0.42) }]}>{initialsOf(name)}</Text>
      )}
    </View>
  );
}

type Props = {
  onBack?: () => void;
};

export default function ChatThreadScreen({ onBack }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    id?: string;
    applicationId?: string;
    name?: string;
    jobTitle?: string;
    applicationStatus?: string;
    jobId?: string;
    photo?: string;
  }>();
  const conversationIdParam =
    typeof params.id === 'string' && UUID_PATTERN.test(params.id) ? params.id : undefined;
  const applicationId = typeof params.applicationId === 'string' ? params.applicationId : undefined;
  const { user } = useAuth();
  const currentUserId = user?.id as string | undefined;

  const [conversationId, setConversationId] = useState<string | undefined>(conversationIdParam);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [opponentName, setOpponentName] = useState<string>(typeof params.name === 'string' ? params.name : 'Conversation');
  const [opponentPhoto, setOpponentPhoto] = useState<string | null>(typeof params.photo === 'string' ? getProfilePhotoUrl(params.photo) : null);
  const [jobTitle, setJobTitle] = useState<string>(typeof params.jobTitle === 'string' ? params.jobTitle : '');
  const [jobId, setJobId] = useState<string>(typeof params.jobId === 'string' ? params.jobId : '');
  const [applicationStatus, setApplicationStatus] = useState<string | null>(typeof params.applicationStatus === 'string' ? params.applicationStatus : null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [blocked] = useState(false);
  const listRef = useRef<FlatList<GroupedMessage>>(null);
  const mountedRef = useRef(true);
  // Synchronous double-send guards: the `sending` state alone isn't committed
  // within a single tick, so a ref mirror closes the race on rapid taps.
  const sendingRef = useRef(false);
  const sendFailedRef = useRef(false);

  const serviceRef = useRef<Awaited<ReturnType<typeof getMessagingService>> | null>(null);
  const loadMessagesRequestId = useRef(0);

  // Collapse the composer's home-indicator padding when the keyboard covers
  // the bottom inset, so the input sits flush above the keyboard.
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // If only an applicationId was provided (no valid conversation id), resolve
  // the canonical conversation (idempotent get-or-create).
  useEffect(() => {
    if (conversationId || !applicationId) return;
    (async () => {
      try {
        const svc = await getMessagingService();
        serviceRef.current = svc;
        const conv = await svc.openConversation(applicationId);
        if (!mountedRef.current) return;
        setConversationId(conv.id);
        if (typeof params.name !== 'string' || typeof params.jobTitle !== 'string' || typeof params.applicationStatus !== 'string') {
          const summaries = await svc.getConversations().catch(() => []);
          const summary = summaries.find((s) => s.id === conv.id);
          if (summary && mountedRef.current) {
            setOpponentName(summary.otherParticipant.name);
            setJobTitle(summary.jobTitle);
            setJobId(summary.jobId ?? '');
            setApplicationStatus(summary.applicationStatus);
            setOpponentPhoto(getProfilePhotoUrl(summary.otherParticipant.photo));
          }
        }
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : 'Could not open conversation');
          setLoading(false);
        }
      }
    })();
  }, [conversationId, applicationId, params.name, params.jobTitle, params.applicationStatus]);

  useEffect(() => {
    mountedRef.current = true;
    const requestId = ++loadMessagesRequestId.current;

    // Load history on mount / conversation change. getMessages + markAsRead
    // run concurrently.
    const timeoutMs = 30_000;
    console.log("[messaging:chat-legacy] loadMessages: starting, requestId=", requestId, "conversationId=", conversationId, "userId=", currentUserId);
    void (async () => {
      if (!conversationId || !currentUserId) return;
      setLoading(true);
      setError(null);
      try {
        const svc = await getMessagingService();
        serviceRef.current = svc;
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Message loading timed out")), timeoutMs),
        );
        const [data] = await Promise.race([
          Promise.all([
            svc.getMessages(conversationId, undefined, MESSAGE_PAGE_SIZE),
            svc.markAsRead(conversationId).catch(() => {}),
          ]),
          timeout,
        ]);
        console.log("[messaging:chat-legacy] loadMessages: got", data?.length ?? 0, "messages, requestId=", requestId);
        if (requestId !== loadMessagesRequestId.current) {
          console.log("[messaging:chat-legacy] loadMessages: stale response ignored, requestId=", requestId, "current=", loadMessagesRequestId.current);
          return;
        }
        if (!mountedRef.current) return;
        setMessages(data);
        setHasMore(data.length === MESSAGE_PAGE_SIZE);
      } catch (err) {
        if (!mountedRef.current) return;
        if (requestId !== loadMessagesRequestId.current) {
          console.log("[messaging:chat-legacy] loadMessages: stale error ignored, requestId=", requestId);
          return;
        }
        console.log("[messaging:chat-legacy] loadMessages: error:", err instanceof Error ? err.message : String(err));
        setError(err instanceof Error ? err.message : 'Could not load messages');
      } finally {
        if (requestId === loadMessagesRequestId.current && mountedRef.current) setLoading(false);
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

  // Fill in the other person's photo when the chat was opened without one.
  useEffect(() => {
    if (!conversationId || opponentPhoto) return;
    let cancelled = false;
    (async () => {
      try {
        const svc = await getMessagingService();
        const summaries = await svc.getConversations();
        const summary = summaries.find((c) => c.id === conversationId);
        if (!cancelled && summary) {
          const url = getProfilePhotoUrl(summary.otherParticipant.photo);
          if (url) setOpponentPhoto(url);
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

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
      if (mountedRef.current) setError(err instanceof Error ? err.message : 'Could not load earlier messages');
    } finally {
      if (mountedRef.current) setLoadingEarlier(false);
    }
  }, [conversationId, loadingEarlier, messages]);

  const confirmed = applicationStatus === 'hired';
  const charLimit = confirmed ? FULL_MESSAGE_LIMIT : LIMITED_MESSAGE_LIMIT;

  // Returns true only if a send actually started. The composer runs its
  // outgoing-text animation exclusively when this returns true, and the draft
  // is NOT cleared here — it clears when the composer's exit animation finishes
  // (handleSendComplete), so the text visibly flies out instead of vanishing.
  const handleSend = useCallback(
    (text: string): boolean => {
      const body = text.trim();
      if (!body || sendingRef.current || !conversationId || !currentUserId) return false;
      if (body.length > charLimit) {
        setDraft('');
        setError(confirmed ? 'Message is too long' : `Messages are limited to ${LIMITED_MESSAGE_LIMIT} characters until the application is confirmed`);
        return false;
      }
      sendingRef.current = true;
      sendFailedRef.current = false;
      setSending(true);
      setError(null);
      const startedAt = Date.now();
      void (async () => {
        try {
          const svc = serviceRef.current ?? (await getMessagingService());
          const sent = await svc.sendMessage(conversationId, body, currentUserId);
          // Land the bubble right as the input-side exit animation completes —
          // never before it, never after a visible gap.
          const remaining = SEND_EXIT_MS - (Date.now() - startedAt);
          if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
          if (mountedRef.current) {
            setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
            haptic.light();
          }
        } catch (err) {
          sendFailedRef.current = true;
          if (mountedRef.current) {
            setError(err instanceof Error ? err.message : "Couldn't send message");
            setDraft(body);
          }
        } finally {
          sendingRef.current = false;
          if (mountedRef.current) setSending(false);
        }
      })();
      return true;
    },
    [conversationId, currentUserId, charLimit, confirmed],
  );

  // The composer calls this after the exit animation; it clears the draft (so
  // the placeholder and disabled button return) unless the send already failed,
  // in which case the restored text must not be wiped by the late clear.
  const handleSendComplete = useCallback(() => {
    if (sendFailedRef.current) return;
    setDraft('');
  }, []);

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

  const initial = initialsOf(opponentName);

  if (loading) {
    return (
      <View style={styles.screen}>
        <View style={[styles.headerWrap, { paddingTop: insets.top + 8 }]}>
          <ChatHeader
            initial={initial}
            photo={opponentPhoto}
            name={opponentName}
            role={jobTitle || 'Job conversation'}
            onBack={onBack ?? (() => router.back())}
            onPressMore={() => haptic.selection()}
          />
        </View>
        <View style={styles.center}>
          <ActivityIndicator color={colors.mint700} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.headerWrap, { paddingTop: insets.top + 8 }]}>
        <ChatHeader
          initial={initial}
          photo={opponentPhoto}
          name={opponentName}
          role={jobTitle || 'Job conversation'}
          onBack={onBack ?? (() => router.back())}
          onPressMore={() => haptic.selection()}
        />
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
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          hasMore ? (
            <View style={styles.loadEarlierWrap}>
              <PressableLoadEarlier loading={loadingEarlier} onPress={loadEarlier} />
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const own = item.message.senderId === currentUserId;
          const isSystem =
            !own && (item.message.messageType === 'application' || item.message.messageType === 'status_change');
          return (
            <View>
              {item.showDate && (
                <View style={styles.dateChipWrap}>
                  <Text style={type.dateChip}>
                    {new Date(item.message.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </Text>
                </View>
              )}
              {isSystem ? (
                <SystemMessageCard
                  initial={initial}
                  message={item.message.body}
                  time={timeOf(item.message.createdAt)}
                  seen={item.message.readAt != null}
                  onPressViewJob={() =>
                    jobId
                      ? router.push({ pathname: '/employer/job/[id]', params: { id: jobId } } as never)
                      : undefined
                  }
                />
              ) : (
                <View style={[styles.bubbleRow, own ? styles.bubbleRowOwn : styles.bubbleRowOther]}>
                  {!own && <Avatar uri={opponentPhoto} name={opponentName} size={26} />}
                  {item.message.deletedAt ? (
                    <View style={[styles.bubble, styles.bubbleDeleted, own ? styles.bubbleDeletedOwn : styles.bubbleDeletedOther]}>
                      <Text style={styles.deletedText}>Message deleted</Text>
                    </View>
                  ) : (
                    <View style={[styles.bubble, own ? styles.bubbleOwn : styles.bubbleOther]}>
                      <Text style={[styles.bubbleText, own ? styles.bubbleTextOwn : styles.bubbleTextOther]}>
                        {item.message.body}
                      </Text>
                      <Text style={styles.bubbleTime}>{timeOf(item.message.createdAt)}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          );
        }}
      />

      {blocked ? (
        <View style={[styles.blockedBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <Text style={styles.blockedText}>This conversation is blocked</Text>
        </View>
      ) : (
        <View style={[styles.composerWrap, { paddingBottom: keyboardVisible ? 0 : Math.max(insets.bottom, 8) }]}>
          <ChatInputBar
            value={draft}
            onChangeText={setDraft}
            onPressAttach={() => haptic.selection()}
            onPressSend={handleSend}
            onSendComplete={handleSendComplete}
            sending={sending}
          />
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

function PressableLoadEarlier({ loading, onPress }: { loading: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Load earlier messages"
      disabled={loading}
      onPress={onPress}
      style={styles.loadEarlierButton}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.mint700} />
      ) : (
        <Text style={styles.loadEarlierText}>Load earlier messages</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.white,
  },
  headerWrap: {
    backgroundColor: colors.white,
  },
  center: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
    paddingTop: 14,
    paddingBottom: 24,
    gap: 14,
  },
  loadEarlierWrap: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  loadEarlierButton: {
    alignItems: 'center',
    backgroundColor: colors.sand100,
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: 14,
  },
  loadEarlierText: {
    color: colors.mint700,
    fontSize: 12,
    fontWeight: '600',
  },
  dateChipWrap: {
    alignItems: 'center',
    paddingVertical: 2,
  },
  bubbleRow: { flexDirection: 'row', gap: 6, marginVertical: 2 },
  bubbleRowOwn: { justifyContent: 'flex-end' },
  bubbleRowOther: { justifyContent: 'flex-start' },
  bubble: { borderRadius: 16, maxWidth: '78%', paddingHorizontal: 12, paddingVertical: 8 },
  bubbleOwn: { backgroundColor: colors.mint500, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: colors.sand100, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 14, lineHeight: 19 },
  bubbleTextOwn: { color: colors.white },
  bubbleTextOther: { color: colors.forest900 },
  bubbleTime: { color: 'rgba(255,255,255,0.7)', fontSize: 9.5, marginTop: 3, textAlign: 'right' },
  bubbleDeleted: { backgroundColor: '#F5F6F5', borderStyle: 'dashed', borderWidth: 1, borderColor: '#CBD5D1' },
  bubbleDeletedOwn: {},
  bubbleDeletedOther: {},
  deletedText: { color: colors.sand400, fontStyle: 'italic', fontSize: 12 },
  avatarBase: { alignItems: 'center', backgroundColor: colors.sand100, justifyContent: 'center', overflow: 'hidden' },
  avatarInitials: { color: colors.mint700, fontWeight: '700' },
  composerWrap: {
    backgroundColor: colors.white,
  },
  blockedBar: {
    backgroundColor: '#FBECEC',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  blockedText: { color: '#B54242', fontSize: 12.5, fontWeight: '600', textAlign: 'center' },
  errorBanner: { backgroundColor: '#FBECEC', paddingHorizontal: 14, paddingVertical: 8 },
  errorBannerText: { color: '#B54242', fontSize: 12.5 },
});