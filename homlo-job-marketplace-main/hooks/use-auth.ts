import * as Api from "@/lib/_core/api";
import * as Auth from "@/lib/_core/auth";
import { clearQueryClient } from "@/lib/trpc";
import { Platform } from "react-native";
import { useCallback, useEffect, useMemo, useState } from "react";

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
let sharedUser: Auth.User | null = null;

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
  sharedUser = next.user;
  listeners.forEach((listener) => listener());
}

async function syncRemoteSession(): Promise<void> {
  try {
    let remoteUser = await Api.getSupabaseMe();
    if (!remoteUser && (Platform.OS === "web" || (await Auth.getRefreshToken()))) {
      const refreshToken = await Auth.getRefreshToken();
      const refreshed = await Api.refreshSupabaseSession(refreshToken ?? undefined);
      if (refreshed.session) await Auth.setAuthSession(refreshed.session);
      remoteUser = refreshed.user;
    }

    if (!remoteUser) {
      await Auth.clearAuthSession();
      await Auth.clearUserInfo();
      setSnapshot({ user: null, error: null, loading: false });
      return;
    }

    const resolved = toStoredUser(remoteUser);
    await Auth.setUserInfo(resolved);
    setSnapshot({ user: resolved, error: null, loading: false });
  } catch (cause) {
    const resolvedError = cause instanceof Error ? cause : new Error("Unable to restore your secure Homlo session");
    setSnapshot({ user: null, error: resolvedError, loading: false });
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

export function useAuth(options?: UseAuthOptions) {
  const { autoFetch = true } = options ?? {};
  const [state, setState] = useState<AuthSnapshot>(() =>
    autoFetch && !snapshot.user ? { ...snapshot, loading: true } : snapshot,
  );

  const sync = useCallback(() => setState(snapshot), []);
  useEffect(() => {
    listeners.add(sync);
    sync();
    return () => {
      listeners.delete(sync);
    };
  }, [sync]);

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
    return resolved;
  }, []);

  const logout = useCallback(async () => {
    try {
      await Api.logout();
    } catch (cause) {
      console.error("[Auth] Remote logout failed:", cause);
    } finally {
      await Auth.clearAuthSession();
      await Auth.clearUserInfo();
      clearQueryClient();
      setSnapshot({ user: null, loading: false, error: null });
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