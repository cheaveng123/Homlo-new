import * as Api from "@/lib/_core/api";
import * as Auth from "@/lib/_core/auth";
import { clearPurchasesUser, identifyPurchasesUser } from "@/lib/purchases";
import { clearQueryClient } from "@/lib/trpc";
import { Platform } from "react-native";
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";

type UseAuthOptions = { autoFetch?: boolean };

function toStoredUser(user: Api.HomloSessionUser): Auth.User {
  return {
    id: user.id,
    name: user.fullName,
    email: user.email,
    loginMethod: "supabase",
    status: user.status,
    profileComplete: user.profileComplete,
    role: user.role,
  };
}

type AuthListener = () => void;
const listeners = new Set<AuthListener>();

type AuthSnapshot = { user: Auth.User | null; loading: boolean; error: Error | null };
let snapshot: AuthSnapshot = { user: null, loading: false, error: null };
let inflight: Promise<void> | null = null;
let lastFetchAt = 0;

// Session verification is a network round trip; many screens mount useAuth at
// once (Home, cards, tabs, gates). Deduplicate so all consumers share ONE
// in-flight fetch and never re-fetch within the TTL — screens that mount again
// get the current snapshot instantly from the module cache instead.
const FETCH_TTL_MS = 60_000;

function setSnapshot(next: AuthSnapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryDelayMs = 3_000;

async function syncRemoteSession(): Promise<void> {
  try {
    let remoteUser = await Api.getSupabaseMe(); // throws on network/server errors
    if (!remoteUser && (Platform.OS === "web" || (await Auth.getRefreshToken()))) {
      try {
        const refreshed = await Api.refreshSessionShared();
        remoteUser = refreshed.user;
      } catch (refreshError) {
        // Only a definite rejection means signed out; anything else is a blip.
        if (!Api.isAuthRejection(refreshError)) throw refreshError;
        remoteUser = null;
      }
    }

    if (!remoteUser) {
      await Auth.clearAuthSession();
      await Auth.clearUserInfo();
      setSnapshot({ user: null, error: null, loading: false });
      void clearPurchasesUser();
      return;
    }

    retryDelayMs = 3_000;
    const resolved = toStoredUser(remoteUser);
    await Auth.setUserInfo(resolved);
    setSnapshot({ user: resolved, error: null, loading: false });
    void identifyPurchasesUser(resolved.id);
  } catch (cause) {
    // BUGFIX: a network error, timeout, 429/5xx or server restart used to set
    // user=null here, so the app showed "Sign in" although the session was
    // fine. Keep the signed-in user (in memory, else the one saved on the
    // device) and retry in the background with backoff.
    const resolvedError = cause instanceof Error ? cause : new Error("Unable to restore your secure Homlo session");
    let fallbackUser = snapshot.user;
    if (!fallbackUser && (await Auth.getSessionToken().catch(() => null))) {
      fallbackUser = await Auth.getUserInfo().catch(() => null);
    }
    setSnapshot({ user: fallbackUser, error: resolvedError, loading: false });
    if (!retryTimer) {
      retryTimer = setTimeout(() => {
        retryTimer = null;
        runSessionFetch();
      }, retryDelayMs);
      retryDelayMs = Math.min(retryDelayMs * 2, 60_000);
    }
  }
}

/** Starts the session sync unless one is already running; returns it for await. */
function runSessionFetch(): Promise<void> | null {
  if (inflight) return inflight;
  lastFetchAt = Date.now();
  setSnapshot({ ...snapshot, loading: true });
  inflight = syncRemoteSession().finally(() => {
    inflight = null;
  });
  return inflight;
}

function subscribe(listener: AuthListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): AuthSnapshot {
  return snapshot;
}

export function useAuth(options?: UseAuthOptions) {
  const { autoFetch = true } = options ?? {};
  // Reads the shared session directly (no copied local state to keep in sync).
  const live = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  // Before the first session check has started, auto-fetching screens report
  // "loading" so they don't flash a signed-out state.
  const state = autoFetch && !live.user && lastFetchAt === 0 ? { ...live, loading: true } : live;

  useEffect(() => {
    if (!autoFetch) {
      if (snapshot.loading) setSnapshot({ ...snapshot, loading: false });
      return;
    }
    if (snapshot.loading || inflight) return;
    if (Date.now() - lastFetchAt < FETCH_TTL_MS) return;
    runSessionFetch();
  }, [autoFetch]);

  const completeSignIn = useCallback(async (response: Api.HomloAuthResponse) => {
    if (response.session) await Auth.setAuthSession(response.session);
    clearQueryClient();
    const resolved = toStoredUser(response.user);
    setSnapshot({ user: resolved, loading: false, error: null });
    await Auth.setUserInfo(resolved);
    void identifyPurchasesUser(resolved.id);
    return resolved;
  }, []);

  const logout = useCallback(async () => {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
    try {
      await Api.logout();
    } catch (cause) {
      console.error("[Auth] Remote logout failed:", cause);
    } finally {
      await Auth.clearAuthSession();
      await Auth.clearUserInfo();
      clearQueryClient();
      setSnapshot({ user: null, loading: false, error: null });
      void clearPurchasesUser();
    }
  }, []);

  const refresh = useCallback(() => {
    runSessionFetch();
  }, []);

  const isAuthenticated = useMemo(() => Boolean(state.user), [state.user]);

  return {
    user: state.user,
    loading: state.loading,
    error: state.error,
    isAuthenticated,
    refresh,
    completeSignIn,
    logout,
  };
}