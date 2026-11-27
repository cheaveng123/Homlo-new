import { useLocalSearchParams, useRouter } from "@/lib/router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";

import { useAuth } from "@/hooks/use-auth";
import { haptic } from "@/lib/haptics";
import { getMessagingService } from "@/lib/messaging";
import type { Message } from "@/lib/messaging/types";
import { ChatScreenNew, type ChatMessageNew } from "@/src/new/screens/ChatScreenNew";

const MESSAGE_PAGE_SIZE = 50;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FULL_MESSAGE_LIMIT = 4000;
const LIMITED_MESSAGE_LIMIT = 160;

const REFRESH_INTERVAL_MS = 5_000;

/**
 * A message as shown in the thread. `clientKey` stays the same from the
 * optimistic bubble to the confirmed server message so the row is never
 * re-created (no flicker); `status` marks a local message still sending or
 * that failed to send.
 */
type ThreadMessage = Message & { clientKey: string; status?: "sending" | "failed" };

/** Last messages seen per conversation, so reopening a thread is instant. */
const threadCache = new Map<string, ThreadMessage[]>();

function toThread(m: Message, clientKey = m.id): ThreadMessage {
  return { ...m, clientKey };
}

/**
 * Merges a fresh server page into what is on screen without blanking it:
 * server rows win, earlier pages already loaded are kept, optimistic rows that
 * haven't been confirmed yet stay at the end, and confirmed rows keep the key
 * of the optimistic bubble they replaced.
 */
function mergeServerPage(prev: ThreadMessage[], page: Message[]): ThreadMessage[] {
  const keyById = new Map(prev.map((m) => [m.id, m.clientKey]));
  const fresh = page.map((m) => toThread(m, keyById.get(m.id) ?? m.id));
  const freshIds = new Set(fresh.map((m) => m.id));
  const oldestFresh = fresh[0]?.createdAt;
  const olderKept = prev.filter(
    (m) => !m.status && !freshIds.has(m.id) && oldestFresh !== undefined && m.createdAt < oldestFresh,
  );
  const pending = prev.filter((m) => m.status && !freshIds.has(m.id));
  return [...olderKept, ...fresh, ...pending];
}

function initialsOf(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?";
}

export default function ChatThreadScreenNewAdapter() {
  const router = useRouter();
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
    typeof params.id === "string" && UUID_PATTERN.test(params.id) ? params.id : undefined;
  const applicationId = typeof params.applicationId === "string" ? params.applicationId : undefined;
  const { user, loading: authLoading } = useAuth();
  const currentUserId = user?.id as string | undefined;

  const [conversationId, setConversationId] = useState<string | undefined>(conversationIdParam);
  const [messages, setMessages] = useState<ThreadMessage[]>(() =>
    conversationIdParam ? threadCache.get(conversationIdParam) ?? [] : [],
  );
  const [loading, setLoading] = useState(
    () => Boolean(conversationIdParam || applicationId) && !(conversationIdParam && threadCache.has(conversationIdParam)),
  );
  // Keys present when the thread first appeared: those rows render without an
  // entrance animation; anything that arrives later animates in.
  const [baselineKeys, setBaselineKeys] = useState<Set<string> | null>(() =>
    conversationIdParam && threadCache.has(conversationIdParam)
      ? new Set(threadCache.get(conversationIdParam)!.map((m) => m.clientKey))
      : null,
  );
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [canRetryLoad, setCanRetryLoad] = useState(false);
  const [opponentName, setOpponentName] = useState<string>(typeof params.name === "string" ? params.name : "Conversation");
  const [jobTitle, setJobTitle] = useState<string>(typeof params.jobTitle === "string" ? params.jobTitle : "");
  const applicationStatus = typeof params.applicationStatus === "string" ? params.applicationStatus : null;
  const [hasMore, setHasMore] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const mountedRef = useRef(true);
  const sendingRef = useRef(false);
  const serviceRef = useRef<Awaited<ReturnType<typeof getMessagingService>> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (conversationId || !applicationId) return;
    void (async () => {
      try {
        const svc = await getMessagingService();
        serviceRef.current = svc;
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Opening conversation timed out")), 30_000),
        );
        const conv = await Promise.race([svc.openConversation(applicationId), timeout]);
        if (!mountedRef.current) return;
        setConversationId(conv.id);
        if (typeof params.name !== "string" || typeof params.jobTitle !== "string") {
          const summaries = await svc.getConversations().catch(() => []);
          const summary = summaries.find((s) => s.id === conv.id);
          if (summary && mountedRef.current) {
            setOpponentName(summary.otherParticipant.name);
            setJobTitle(summary.jobTitle);
          }
        }
      } catch (err) {
        console.error(
          "[messaging:chat] openConversation: error:",
          err instanceof Error ? err.message : String(err),
          "error=", err,
        );
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : "Could not open conversation");
          setCanRetryLoad(false);
          setLoading(false);
        }
      }
    })();
  }, [conversationId, applicationId, params.name, params.jobTitle, authLoading]);

  const loadMessagesRequestId = useRef(0);

  const loadMessages = useCallback(async (options?: { silent?: boolean }) => {
    if (authLoading || !conversationId) return;
    const silent = Boolean(options?.silent);
    const requestId = ++loadMessagesRequestId.current;
    const timeoutMs = 30_000;
    // Only show the loading state when there is nothing on screen yet; a
    // refresh keeps the current messages visible.
    if (!silent && !threadCache.has(conversationId)) setLoading(true);
    if (!silent) {
      setError(null);
      setCanRetryLoad(false);
    }
    try {
      const svc = await getMessagingService();
      serviceRef.current = svc;
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Message loading timed out")), timeoutMs),
      );
      const data = await Promise.race([
        svc.getMessages(conversationId, undefined, MESSAGE_PAGE_SIZE),
        timeout,
      ]);
      if (requestId !== loadMessagesRequestId.current) return;
      if (mountedRef.current) {
        setMessages((prev) => mergeServerPage(prev, data));
        // First load: everything already in the thread appears without animating.
        setBaselineKeys((keys) => keys ?? new Set(data.map((m) => m.id)));
        setHasMore((prevHasMore) => (silent ? prevHasMore || data.length === MESSAGE_PAGE_SIZE : data.length === MESSAGE_PAGE_SIZE));
      }
      void svc.markAsRead(conversationId).catch((readErr) => {
        console.warn(
          "[messaging:chat] markAsRead: error:",
          readErr instanceof Error ? readErr.message : String(readErr),
        );
      });
    } catch (err) {
      if (!mountedRef.current) return;
      if (requestId !== loadMessagesRequestId.current) return;
      // A failed background refresh keeps the thread as-is; no error banner.
      if (silent) return;
      console.error(
        "[messaging:chat] loadMessages: error:",
        err instanceof Error ? err.message : String(err),
        "requestId=", requestId,
        "error=", err,
      );
      setError(err instanceof Error ? err.message : "Could not load conversation");
      setCanRetryLoad(true);
    } finally {
      if (requestId === loadMessagesRequestId.current && mountedRef.current) setLoading(false);
    }
  }, [conversationId, authLoading]);

  useEffect(() => {
    void Promise.resolve().then(() => loadMessages());
  }, [loadMessages]);

  // Realtime push is disabled for security, so new replies are picked up by a
  // quiet background refresh that merges into the list (never blanks it).
  useEffect(() => {
    if (!conversationId || authLoading) return;
    // PERF: skip the 5s refresh while the app is backgrounded (it used to keep
    // hitting the API with the phone locked).
    const timer = setInterval(() => {
      if (AppState.currentState !== "active") return;
      if (!sendingRef.current) void loadMessages({ silent: true });
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [conversationId, authLoading, loadMessages]);

  // Keep the cache current (confirmed messages only).
  useEffect(() => {
    if (conversationId && messages.length) threadCache.set(conversationId, messages.filter((m) => !m.status));
  }, [conversationId, messages]);

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
        return [...older.filter((m) => !known.has(m.id)).map((m) => toThread(m)), ...prev];
      });
      setHasMore(older.length === MESSAGE_PAGE_SIZE);
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : "Could not load earlier messages");
        setCanRetryLoad(false);
      }
    } finally {
      if (mountedRef.current) setLoadingEarlier(false);
    }
  }, [conversationId, loadingEarlier, messages]);

  const deliver = useCallback(
    async (clientKey: string, text: string) => {
      if (!conversationId || !currentUserId) return;
      sendingRef.current = true;
      try {
        const svc = serviceRef.current ?? (await getMessagingService());
        const sent = await svc.sendMessage(conversationId, text, currentUserId);
        if (!mountedRef.current) return;
        // Swap the optimistic bubble for the server message, keeping its key.
        setMessages((prev) => {
          const withoutDuplicate = prev.filter((m) => m.id !== sent.id || m.clientKey === clientKey);
          return withoutDuplicate.map((m) => (m.clientKey === clientKey ? toThread(sent, clientKey) : m));
        });
        haptic.light();
      } catch (err) {
        if (!mountedRef.current) return;
        setMessages((prev) => prev.map((m) => (m.clientKey === clientKey ? { ...m, status: "failed" } : m)));
        setError(err instanceof Error ? err.message : "Couldn't send message");
        setCanRetryLoad(false);
      } finally {
        sendingRef.current = false;
      }
    },
    [conversationId, currentUserId],
  );

  const handleSend = useCallback(() => {
    const text = draft.trim();
    if (!text || !conversationId || !currentUserId) return;
    const confirmed = applicationStatus === "hired";
    const charLimit = confirmed ? FULL_MESSAGE_LIMIT : LIMITED_MESSAGE_LIMIT;
    if (text.length > charLimit) {
      setError(confirmed ? "Message is too long" : `Messages are limited to ${LIMITED_MESSAGE_LIMIT} characters until the application is confirmed`);
      setCanRetryLoad(false);
      return;
    }
    setError(null);
    setCanRetryLoad(false);
    setDraft("");
    // Show the message immediately; it turns solid once the server confirms.
    const clientKey = `local-${conversationId}-${messages.length}-${text.length}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    const optimistic: ThreadMessage = {
      id: clientKey,
      clientKey,
      status: "sending",
      conversationId,
      senderId: currentUserId,
      body: text,
      messageType: "text",
      createdAt: now,
      updatedAt: null,
      readAt: null,
      deletedAt: null,
      applicationId: null,
      jobId: null,
      jobTitle: null,
    };
    setMessages((prev) => [...prev, optimistic]);
    void deliver(clientKey, text);
  }, [draft, conversationId, currentUserId, applicationStatus, messages.length, deliver]);

  const retryMessage = useCallback(
    (clientKey: string) => {
      const failed = messages.find((m) => m.clientKey === clientKey && m.status === "failed");
      if (!failed) return;
      haptic.selection();
      setError(null);
      setMessages((prev) => prev.map((m) => (m.clientKey === clientKey ? { ...m, status: "sending" } : m)));
      void deliver(clientKey, failed.body);
    },
    [messages, deliver],
  );

  const adapted = useMemo(() => {
    let lastDay: string | null = null;
    let lastApplicationId: string | null = null;
    const titlesByApplication = new Map<string, string>();
    for (const m of messages) {
      if (m.applicationId && m.jobTitle) titlesByApplication.set(m.applicationId, m.jobTitle);
    }
    const adaptedMessages: ChatMessageNew[] = [];
    for (const m of messages) {
      const day = new Date(m.createdAt).toDateString();
      const mine = m.senderId === currentUserId;
      const system = !mine && (m.messageType === "application" || m.messageType === "status_change");
      const dayLabel = day !== lastDay ? new Date(m.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : undefined;
      lastDay = day;
      let jobLabel: string | undefined;
      if (m.applicationId) {
        const title = m.jobTitle || titlesByApplication.get(m.applicationId);
        if (title && m.applicationId !== lastApplicationId) {
          jobLabel = title;
        }
        lastApplicationId = m.applicationId;
      }
      adaptedMessages.push({
        id: m.clientKey,
        mine,
        text: m.deletedAt ? "Message deleted" : m.body,
        system,
        dayLabel,
        jobLabel,
        status: m.status,
        animate: baselineKeys !== null && !baselineKeys.has(m.clientKey),
      });
    }
    return adaptedMessages;
  }, [messages, currentUserId, baselineKeys]);

  const shared = {
    name: opponentName,
    initials: initialsOf(opponentName),
    photo: typeof params.photo === "string" ? params.photo : null,
    subtitle: jobTitle || "Job conversation",
    draft,
    onChangeDraft: setDraft,
    onSend: handleSend,
    // Going back keeps the inbox as it was (no reload); only fall back to
    // opening it fresh when the chat was the first screen (e.g. a deep link).
    onBack: () =>
      router.canGoBack()
        ? router.back()
        : router.replace({ pathname: "/inbox", params: { tab: "messages" } } as never),
    onPressMore: () => haptic.selection(),
  };

  return (
    <ChatScreenNew
      {...shared}
      messages={adapted}
      loading={loading}
      errorText={error ?? undefined}
      onRetry={canRetryLoad ? () => void loadMessages() : undefined}
      hasMore={hasMore}
      loadingEarlier={loadingEarlier}
      onLoadEarlier={() => void loadEarlier()}
      onRetryMessage={retryMessage}
    />
  );
}