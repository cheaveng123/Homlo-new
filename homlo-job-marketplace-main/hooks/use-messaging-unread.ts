import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { getMessagingService } from "@/lib/messaging";

/**
 * Poll + realtime-driven unread count for the Inbox tab badge.
 * Falls back to a lightweight periodic poll so the badge stays correct
 * even when Realtime is unavailable. Always cleans up on unmount.
 */
export function useMessagingUnread(pollMs = 15_000) {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const [ready, setReady] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setCount(0);
      return;
    }
    try {
      const svc = await getMessagingService();
      const c = await svc.getUnreadCount();
      setCount(c);
      setReady(true);
    } catch {
      // Ignore transient failures; keep the last known count.
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setCount(0);
      setReady(false);
      return;
    }
    refresh();
    const id = setInterval(refresh, pollMs);
    timerRef.current = id;
    (async () => {
      const svc = await getMessagingService();
      unsubRef.current = svc.subscribeToMessages(() => {
        // A new message arrives → recompute unread count.
        refresh();
      });
    })();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      unsubRef.current?.();
    };
  }, [user, refresh, pollMs]);

  return { count, ready };
}
