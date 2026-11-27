import { createFeedClient, FeedHttpError, type FeedClient, type ViewerParams, type PageParams } from '@/backend/feed/lynx_feed_client';
import { getApiBaseUrl } from '@/constants/oauth';
import * as Auth from '@/lib/_core/auth';
import { useMemo } from 'react';

let feedClientInstance: FeedClient | null = null;

function resolveFeedBaseUrl(): string {
  const base = (getApiBaseUrl() || 'http://localhost:3000').replace(/\/+$/, '');
  // Supabase Edge hosts the API as the `api` function (…/functions/v1/api),
  // the same place tRPC calls go; a bare …/functions/v1/feed/* does not exist.
  return /\/functions\/v1$/.test(base) ? `${base}/api` : base;
}

/**
 * BUGFIX/PERF: feed calls used to fail silently. One timeout, network blip or
 * 429 left a Home/Popular/Explore section permanently empty ("job containers
 * disappear"). Every read now:
 *  - retries up to 2 more times with backoff on network errors, timeouts,
 *    429 and 5xx (never on other 4xx);
 *  - shares one in-flight request between screens asking for the same page;
 *  - reuses a successful page for 30s, so switching tabs doesn't refetch.
 */
const RETRY_DELAYS_MS = [700, 1800];
const READ_REUSE_MS = 30_000;

function isRetryable(error: unknown): boolean {
  if (error instanceof FeedHttpError) return error.status === 429 || error.status >= 500;
  return true; // network failure / abort-on-timeout / bad JSON
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function withRetry<T>(run: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      if (attempt === RETRY_DELAYS_MS.length || !isRetryable(error)) break;
      await wait(RETRY_DELAYS_MS[attempt]);
    }
  }
  if (__DEV__) console.warn('[feed] request failed after retries:', lastError instanceof Error ? lastError.message : lastError);
  throw lastError;
}

const readCache = new Map<string, { at: number; promise: Promise<unknown> }>();

/**
 * PERF (stale-while-revalidate): the last successful result for each read,
 * kept for 30 min. Screens seed their first render from it (peekFeedRead) so
 * a revisit paints the previous list instantly while the read re-validates.
 * Not cleared by clearFeedClientCache(): after a write the stale page still
 * paints at once and is replaced as soon as the fresh read lands.
 */
const SETTLED_MAX_AGE_MS = 30 * 60_000;
const settledCache = new Map<string, { at: number; value: unknown }>();

function readKey(name: string, args: unknown): string {
  return `${name}:${JSON.stringify(args ?? {})}`;
}

/** Last successful result for this feed read, if any (synchronous). */
export function peekFeedRead<T>(name: 'home' | 'recommended' | 'popular' | 'near' | 'explore', args: unknown): T | undefined {
  const hit = settledCache.get(readKey(name, args));
  if (!hit || Date.now() - hit.at > SETTLED_MAX_AGE_MS) return undefined;
  return hit.value as T;
}

function cachedRead<T>(key: string, run: () => Promise<T>): Promise<T> {
  const hit = readCache.get(key);
  if (hit && Date.now() - hit.at < READ_REUSE_MS) return hit.promise as Promise<T>;
  const promise = withRetry(run);
  readCache.set(key, { at: Date.now(), promise });
  // Never keep a failure: the next caller tries again.
  promise.then(
    (value) => {
      settledCache.set(key, { at: Date.now(), value });
      if (settledCache.size > 100) settledCache.delete(settledCache.keys().next().value as string);
    },
    () => {
      if (readCache.get(key)?.promise === promise) readCache.delete(key);
    },
  );
  if (readCache.size > 100) readCache.delete(readCache.keys().next().value as string);
  return promise;
}

/** Drop reused feed pages (e.g. after posting or editing a job, or pull-to-refresh). */
export function clearFeedClientCache(): void {
  readCache.clear();
}

function withResilience(client: FeedClient): FeedClient {
  const keyed = <A,>(name: string, fn: (args: A) => Promise<unknown>) =>
    (args: A) => cachedRead(readKey(name, args), () => fn(args));
  return {
    home: keyed('home', client.home) as FeedClient['home'],
    recommended: keyed('recommended', client.recommended) as FeedClient['recommended'],
    popular: keyed('popular', client.popular) as FeedClient['popular'],
    near: keyed('near', client.near) as FeedClient['near'],
    explore: keyed('explore', client.explore) as FeedClient['explore'],
    sendEvents: client.sendEvents,
  };
}

export function getFeedClient(): FeedClient {
  if (!feedClientInstance) {
    feedClientInstance = withResilience(
      createFeedClient({
        baseUrl: resolveFeedBaseUrl(),
        timeoutMs: 15_000,
        getHeaders: async (): Promise<Record<string, string>> => {
          const token = await Auth.getSessionToken();
          const headers: Record<string, string> = {};
          if (token) headers.Authorization = `Bearer ${token}`;
          return headers;
        },
      }),
    );
  }
  return feedClientInstance;
}

export function useFeedClient(): FeedClient {
  return useMemo(() => getFeedClient(), []);
}

export type { ViewerParams, PageParams, FeedClient };
