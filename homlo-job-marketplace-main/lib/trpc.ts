import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import { QueryClient } from "@tanstack/react-query";
import superjson from "superjson";
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
      return token ? { Authorization: `Bearer ${token}` } : {};
    },
    // Custom fetch to include credentials for cookie-based auth
    async fetch(url, options) {
      const requestUrl = String(url);
      const request = async (label: string) => {
        const startedAt = Date.now();
        try {
          const response = await fetch(url, { ...options, credentials: "include" });
          if (__DEV__) {
            console.log(`[trpc] ${label}:`, response.status, requestUrl, `${Date.now() - startedAt}ms`);
          }
          return response;
        } catch (err) {
          console.error(`[trpc] ${label} failed:`, requestUrl, `${Date.now() - startedAt}ms`, err);
          throw err;
        }
      };
      let response = await request("response");
      if (response.status === 401) {
        const refreshToken = await Auth.getRefreshToken();
        try {
          const refreshed = await Api.refreshSupabaseSession(refreshToken ?? undefined);
          if (refreshed.session) await Auth.setAuthSession(refreshed.session);
          response = await request("response after refresh");
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
export function clearQueryClient() { queryClientInstance?.clear(); }