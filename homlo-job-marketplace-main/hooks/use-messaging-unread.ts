import { useEffect, useSyncExternalStore } from "react";
import { AppState, type NativeEventSubscription } from "react-native";
import { useAuth } from "@/hooks/use-auth";
import { getMessagingService } from "@/lib/messaging";

/**
 * Unread count for the Inbox badge.
 *
 * PERF: this used to start its OWN 15s poll in every component that called it
 * (tab bar + MyListings + JobDashboard + EmployerDashboard), so the same
 * request went out 2–4x per interval. It is now one module-level poller shared
 * by every subscriber: it starts with the first mounted consumer, stops when
 * the last one unmounts, only polls while the app is in the foreground, and
 * skips a tick when a refresh is already in flight.
 */
const POLL_MS = 15_000;

type UnreadSnapshot = { count: number; ready: boolean };
let snapshot: UnreadSnapshot = { count: 0, ready: false };
const listeners = new Set<() => void>();
let activeUserId: string | null = null;
let consumers = 0;
let timer: ReturnType<typeof setInterval> | null = null;
let appStateSub: NativeEventSubscription | null = null;
let unsubscribeRealtime: (() => void) | null = null;
let inflight: Promise<void> | null = null;

function emit(next: UnreadSnapshot) {
  if (next.count === snapshot.count && next.ready === snapshot.ready) return;
  snapshot = next;
  listeners.forEach((l) => l());
}

function refresh(): Promise<void> {
  if (!activeUserId) {
    emit({ count: 0, ready: false });
    return Promise.resolve();
  }
  if (inflight) return inflight;
  const userAtStart = activeUserId;
  inflight = (async () => {
    try {
      const svc = await getMessagingService();
      const c = await svc.getUnreadCount();
      if (userAtStart === activeUserId) emit({ count: c, ready: true });
    } catch {
      // Transient failure: keep the last known count.
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

function stopPolling() {
  if (timer) clearInterval(timer);
  timer = null;
  appStateSub?.remove();
  appStateSub = null;
  unsubscribeRealtime?.();
  unsubscribeRealtime = null;
}

function startPolling() {
  stopPolling();
  if (!activeUserId) return;
  timer = setInterval(() => {
    if (AppState.currentState === "active") void refresh();
  }, POLL_MS);
  appStateSub = AppState.addEventListener("change", (next) => {
    if (next === "active") void refresh();
  });
  const userAtStart = activeUserId;
  void getMessagingService().then((svc) => {
    if (userAtStart !== activeUserId || !timer) return;
    unsubscribeRealtime = svc.subscribeToMessages(() => void refresh());
  });
}

function setUser(userId: string | null) {
  if (userId === activeUserId) return;
  activeUserId = userId;
  if (!userId) {
    stopPolling();
    emit({ count: 0, ready: false });
    return;
  }
  if (consumers > 0) startPolling();
  void refresh();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => snapshot;

/** Force an immediate badge refresh (e.g. after opening a conversation). */
export function refreshMessagingUnread() {
  return refresh();
}

export function useMessagingUnread(): UnreadSnapshot {
  const { user } = useAuth();
  const userId = user?.id != null ? String(user.id) : null;
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    consumers += 1;
    if (consumers === 1 && activeUserId) startPolling();
    return () => {
      consumers -= 1;
      if (consumers === 0) stopPolling();
    };
  }, []);

  useEffect(() => {
    setUser(userId);
  }, [userId]);

  return state;
}
