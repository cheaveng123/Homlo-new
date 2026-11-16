/**
 * lynx_feed_client.ts
 * Typed client for the feed endpoints. Plain `fetch` (built into React Native, with or without Expo).
 * The feed returns job IDS plus small metadata. Load the actual job cards through your existing
 * jobs repository (e.g. getJobsByIds), then render them IN THE ORDER the feed returned.
 */
import type { EventBatch } from './otter_event_recorder';
import type { FeedPage, HomeFeed, Period, QuickSearchPrefs } from './finch_shared_shapes';

export interface FeedClientOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  /** e.g. async () => ({ Authorization: `Bearer ${token}` }). Optional. */
  getHeaders?: () => Promise<Record<string, string>> | Record<string, string>;
  timeoutMs?: number;
}

export interface ViewerParams {
  lat?: number | null;
  lng?: number | null;
  /** The saved quick-search answers. Only used for the optional fitPercent. */
  prefs?: QuickSearchPrefs | null;
}

export interface PageParams extends ViewerParams {
  cursor?: string | null;
  limit?: number;
}

export class FeedHttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'FeedHttpError';
  }
}

/** React Native's URLSearchParams is incomplete on some versions, so the query string is built by hand. */
function qs(params: Record<string, string | number | null | undefined>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined || v === '') continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

export function createFeedClient(opts: FeedClientOptions) {
  const doFetch = opts.fetchImpl ?? fetch;
  const base = opts.baseUrl.replace(/\/+$/, '');
  const timeoutMs = opts.timeoutMs ?? 10000;

  async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      const extra = opts.getHeaders ? await opts.getHeaders() : {};
      const res = await doFetch(`${base}${path}`, {
        method,
        headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...extra },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller?.signal,
      });
      const text = await res.text();
      const json = text ? JSON.parse(text) : null;
      if (!res.ok) throw new FeedHttpError(res.status, (json && json.error) || `HTTP ${res.status}`);
      return json as T;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  const viewerQs = (p: ViewerParams) => ({
    lat: p.lat ?? null,
    lng: p.lng ?? null,
    prefs: p.prefs ? JSON.stringify(p.prefs) : null,
  });

  return {
    home: (p: ViewerParams & { seed?: string } = {}) =>
      request<HomeFeed>('GET', `/feed/home${qs({ ...viewerQs(p), seed: p.seed })}`),

    recommended: (p: PageParams = {}) =>
      request<FeedPage>('GET', `/feed/recommended${qs({ ...viewerQs(p), cursor: p.cursor, limit: p.limit })}`),

    /** period = the chip selected on the Popular detail page. */
    popular: (p: PageParams & { period?: Period } = {}) =>
      request<FeedPage>(
        'GET',
        `/feed/popular${qs({ ...viewerQs(p), cursor: p.cursor, limit: p.limit, period: p.period })}`,
      ),

    near: (p: PageParams = {}) =>
      request<FeedPage>('GET', `/feed/near${qs({ ...viewerQs(p), cursor: p.cursor, limit: p.limit })}`),

    /** Keep the same `seed` for a whole Explore session (it is also stored inside the cursor). */
    explore: (p: PageParams & { seed?: string } = {}) =>
      request<FeedPage>('GET', `/feed/explore${qs({ ...viewerQs(p), cursor: p.cursor, limit: p.limit, seed: p.seed })}`),

    sendEvents: (batch: EventBatch) => request<{ accepted: number }>('POST', '/events', batch).then(() => undefined),
  };
}

export type FeedClient = ReturnType<typeof createFeedClient>;
