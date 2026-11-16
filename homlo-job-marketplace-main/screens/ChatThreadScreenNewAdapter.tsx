import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "@/hooks/use-auth";
import { haptic } from "@/lib/haptics";
import { getMessagingService } from "@/lib/messaging";
import type { Message } from "@/lib/messaging/types";
import { ChatScreenNew } from "@/src/new/screens/ChatScreenNew";

const MESSAGE_PAGE_SIZE = 50;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FULL_MESSAGE_LIMIT = 4000;
const LIMITED_MESSAGE_LIMIT = 160;

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(() => Boolean(conversationIdParam || applicationId));
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

  const loadMessages = useCallback(async () => {
    if (authLoading || !conversationId) return;
    const requestId = ++loadMessagesRequestId.current;
    const timeoutMs = 30_000;
    console.log("[messaging:chat] loadMessages: starting, requestId=", requestId, "conversationId=", conversationId, "userId=", currentUserId);
    setLoading(true);
    setError(null);
    setCanRetryLoad(false);
    try {
      const svc = await getMessagingService();
      serviceRef.current = svc;
      console.log("[messaging:chat] loadMessages: got messaging service");
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Message loading timed out")), timeoutMs),
      );
      const data = await Promise.race([
        svc.getMessages(conversationId, undefined, MESSAGE_PAGE_SIZE),
        timeout,
      ]);
      console.log("[messaging:chat] loadMessages: got", data?.length ?? 0, "messages, requestId=", requestId);
      if (requestId !== loadMessagesRequestId.current) {
        console.log("[messaging:chat] loadMessages: stale response ignored, requestId=", requestId, "current=", loadMessagesRequestId.current);
        return;
      }
      if (mountedRef.current) {
        setMessages(data);
        setHasMore(data.length === MESSAGE_PAGE_SIZE);
      }
      void svc.markAsRead(conversationId).catch((readErr) => {
        console.warn(
          "[messaging:chat] markAsRead: error:",
          readErr instanceof Error ? readErr.message : String(readErr),
        );
      });
    } catch (err) {
      if (!mountedRef.current) return;
      if (requestId !== loadMessagesRequestId.current) {
        console.log("[messaging:chat] loadMessages: stale error ignored, requestId=", requestId);
        return;
      }
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
  }, [conversationId, currentUserId, authLoading]);

  useEffect(() => {
    void Promise.resolve().then(loadMessages);
  }, [loadMessages]);

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
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : "Could not load earlier messages");
        setCanRetryLoad(false);
      }
    } finally {
      if (mountedRef.current) setLoadingEarlier(false);
    }
  }, [conversationId, loadingEarlier, messages]);

  const handleSend = useCallback(() => {
    const text = draft.trim();
    if (!text || sendingRef.current || !conversationId || !currentUserId) return;
    const confirmed = applicationStatus === "hired";
    const charLimit = confirmed ? FULL_MESSAGE_LIMIT : LIMITED_MESSAGE_LIMIT;
    if (text.length > charLimit) {
      setDraft("");
      setError(confirmed ? "Message is too long" : `Messages are limited to ${LIMITED_MESSAGE_LIMIT} characters until the application is confirmed`);
      setCanRetryLoad(false);
      return;
    }
    sendingRef.current = true;
    setError(null);
    setCanRetryLoad(false);
    setDraft("");
    void (async () => {
      try {
        const svc = serviceRef.current ?? (await getMessagingService());
        const sent = await svc.sendMessage(conversationId, text, currentUserId);
        if (mountedRef.current) {
          setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
          haptic.light();
        }
      } catch (err) {
        sendingRef.current = false;
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : "Couldn't send message");
          setCanRetryLoad(false);
          setDraft(text);
        }
        return;
      }
      sendingRef.current = false;
    })();
  }, [draft, conversationId, currentUserId, applicationStatus]);

  const adapted = useMemo(() => {
    let lastDay: string | null = null;
    let lastApplicationId: string | null = null;
    const titlesByApplication = new Map<string, string>();
    for (const m of messages) {
      if (m.applicationId && m.jobTitle) titlesByApplication.set(m.applicationId, m.jobTitle);
    }
    const adaptedMessages: { id: string; mine: boolean; text: string; system: boolean; dayLabel?: string; jobLabel?: string }[] = [];
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
      adaptedMessages.push({ id: m.id, mine, text: m.deletedAt ? "Message deleted" : m.body, system, dayLabel, jobLabel });
    }
    return adaptedMessages;
  }, [messages, currentUserId]);

  const shared = {
    name: opponentName,
    initials: initialsOf(opponentName),
    photo: typeof params.photo === "string" ? params.photo : null,
    subtitle: jobTitle || "Job conversation",
    draft,
    onChangeDraft: setDraft,
    onSend: handleSend,
    onBack: () => router.replace({ pathname: "/inbox", params: { tab: "messages" } } as never),
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
    />
  );
}