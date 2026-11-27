import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import { getDeviceId } from "@/lib/device-id";
import { createTRPCReact } from "@trpc/react-query";
import { QueryClient } from "@tanstack/react-query";
import { clearPersistedQueries } from "@/lib/query-persistence";
import superjson from "superjson";
import { Platform } from "react-native";
import type { AppRouter } from "@/server/routers";
import { getApiBaseUrl } from "@/constants/oauth";
import * as Auth from "@/lib/_core/auth";
import * as Api from "@/lib/_core/api";

/**
 * tRPC React client for type-safe API calls.
 *
 * IMPORTANT (tRPC v11): The `transformer` must be inside `httpBatchLink`,
 * NOT at the root createClient level. This ensures client and server
 * use the same serialization format (superjson).
 */
export const trpc = createTRPCReact<AppRouter>();

/**
 * Builds the shared HTTP batch link used by both the React client and the
 * plain proxy client. Handles session-token headers, cookie credentials and
 * one-shot token refresh on 401 responses so a single definition is reused.
 */
function buildTRPCLink() {
  return httpBatchLink({
    url: `${getApiBaseUrl()}/api/trpc`,
    transformer: superjson,
    async headers() {
      const token = await Auth.getSessionToken();
      const deviceHeader = { "X-Homlo-Device-Id": await getDeviceId() };
      return token ? { Authorization: `Bearer ${token}`, ...deviceHeader } : deviceHeader;
    },
    // Custom fetch to include credentials for cookie-based auth
    async fetch(url, options) {
      const requestUrl = String(url);
      const request = async (label: string, init: typeof options) => {
        const startedAt = Date.now();
        try {
          const response = await fetch(url, { ...init, credentials: "include" });
          if (__DEV__) {
            console.log(`[trpc] ${label}:`, response.status, requestUrl, `${Date.now() - startedAt}ms`);
          }
          return response;
        } catch (err) {
          // Network failures (server restarting, phone offline, app waking up)
          // are expected and retried by the caller. A warning, not a red
          // console error, so polling can't flood the dev error screen.
          if (__DEV__) {
            console.warn(`[trpc] ${label} failed:`, requestUrl, `${Date.now() - startedAt}ms`, err instanceof Error ? err.message : err);
          }
          throw err;
        }
      };
      const tokenUsed = await Auth.getSessionToken();
      let response = await request("response", options);
      // Signed-out native users have nothing to refresh (web relies on cookies).
      const canRefresh = Boolean(tokenUsed) || Platform.OS === "web";
      if (response.status === 401 && canRefresh) {
        try {
          // If another request already refreshed while this one was in
          // flight, just retry with the new token; otherwise refresh once
          // (shared with every other caller).
          let token = await Auth.getSessionToken();
          if (!token || token === tokenUsed) {
            await Api.refreshSessionShared();
            token = await Auth.getSessionToken();
          }
          // BUGFIX: the retry used to resend the OLD Authorization header.
          const headers = { ...(options?.headers as Record<string, string> | undefined) };
          if (token) headers.Authorization = `Bearer ${token}`;
          response = await request("response after refresh", { ...options, headers });
        } catch {
          // The caller receives the original unauthorized response when refresh is unavailable or invalid.
        }
      }
      return response;
    },
  });
}

/**
 * Creates the tRPC client with proper configuration.
 * Call this once in your app's root layout.
 */
export function createTRPCClient() {
  return trpc.createClient({
    links: [buildTRPCLink()],
  });
}

/**
 * Plain (non-React) tRPC proxy client. Use this outside components — e.g. the
 * messaging providers that need to call the router from a service layer.
 */
export const trpcDirect = createTRPCProxyClient<AppRouter>({
  links: [buildTRPCLink()],
});

/** Holds the live QueryClient instance so sign-out / account switch can clear the cache. */
export let queryClientInstance: QueryClient | null = null;
export function setQueryClientInstance(qc: QueryClient) { queryClientInstance = qc; }
export function clearQueryClient() { queryClientInstance?.clear(); clearPersistedQueries(); }