/**
 * ibis_request_router.ts
 * Turns HTTP-like requests into FeedService calls, with strict input validation.
 * Framework-neutral: wire it into Express, Hono, Fastify, a Supabase Edge Function, or AWS Lambda
 * by mapping that framework's request into HttpLikeRequest.
 *
 *   GET  /feed/home        ?lat&lng&prefs&seed
 *   GET  /feed/recommended ?lat&lng&prefs&cursor&limit
 *   GET  /feed/popular     ?lat&lng&prefs&cursor&limit&period=today|week|month
 *   GET  /feed/near        ?lat&lng&prefs&cursor&limit
 *   GET  /feed/explore     ?lat&lng&prefs&cursor&limit&seed
 *   POST /events           { sessionId, events: [{ jobId, type }] }
 *
 * `prefs` is optional URL-encoded JSON of the quick-search answers (used only for the optional fit %).
 */
import { PERIODS } from './marmot_tuning_knobs';
import {
  FeedInputError,
  type EventInput,
  type EventType,
  type JobType,
  type PayPeriod,
  type Period,
  type QuickSearchPrefs,
  type Viewer,
} from './finch_shared_shapes';
import type { FeedService } from './heron_feed_assembler';

export interface HttpLikeRequest {
  method: string;
  path: string;
  query: Record<string, string | undefined>;
  body?: unknown;
}
export interface HttpLikeResponse {
  status: number;
  body: unknown;
}

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const EVENT_TYPES: readonly EventType[] = ['impression', 'view', 'dwell_15s', 'save', 'apply'];
const JOB_TYPES = ['part_time', 'full_time', 'weekends', 'remote'] as const;
const PAY_PERIODS: readonly PayPeriod[] = ['hourly', 'daily', 'weekly', 'monthly', 'yearly'];
export const MAX_EVENTS_PER_BATCH = 100;

function num(raw: string | undefined, name: string, min: number, max: number): number | null {
  if (raw === undefined || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < min || n > max) throw new FeedInputError(`Invalid ${name}`);
  return n;
}

export function parseViewer(query: Record<string, string | undefined>): Viewer {
  const lat = num(query.lat, 'lat', -90, 90);
  const lng = num(query.lng, 'lng', -180, 180);
  if ((lat === null) !== (lng === null)) throw new FeedInputError('lat and lng must be provided together');
  return { lat, lng, preferences: parsePrefs(query.prefs) };
}

export function parsePrefs(raw: string | undefined): QuickSearchPrefs | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new FeedInputError('Invalid prefs');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new FeedInputError('Invalid prefs');
  const p = parsed as Record<string, unknown>;
  const out: QuickSearchPrefs = {};
  if (p.jobTypes !== undefined) {
    if (!Array.isArray(p.jobTypes) || p.jobTypes.length > 4 || !p.jobTypes.every((t) => (JOB_TYPES as readonly unknown[]).includes(t))) {
      throw new FeedInputError('Invalid prefs.jobTypes');
    }
    out.jobTypes = p.jobTypes as (JobType | 'remote')[];
  }
  for (const key of ['payMin', 'payMax'] as const) {
    const v = p[key];
    if (v === undefined || v === null) continue;
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1e9) throw new FeedInputError(`Invalid prefs.${key}`);
    out[key] = v;
  }
  if (p.payPeriod !== undefined && p.payPeriod !== null) {
    if (!(PAY_PERIODS as readonly unknown[]).includes(p.payPeriod)) throw new FeedInputError('Invalid prefs.payPeriod');
    out.payPeriod = p.payPeriod as PayPeriod;
  }
  return out;
}

function parseLimit(query: Record<string, string | undefined>): number | undefined {
  const n = num(query.limit, 'limit', 1, 1000);
  return n === null ? undefined : Math.floor(n);
}

function parseSeed(raw: string | undefined): string | undefined {
  if (raw === undefined || raw === '') return undefined;
  if (raw.length > 64) throw new FeedInputError('Invalid seed');
  return raw;
}

export function parseEventBatch(body: unknown): { sessionId: string; events: EventInput[] } {
  if (typeof body !== 'object' || body === null) throw new FeedInputError('Invalid body');
  const b = body as Record<string, unknown>;
  if (typeof b.sessionId !== 'string' || b.sessionId.length < 8 || b.sessionId.length > 64) {
    throw new FeedInputError('Invalid sessionId');
  }
  if (!Array.isArray(b.events) || b.events.length === 0 || b.events.length > MAX_EVENTS_PER_BATCH) {
    throw new FeedInputError(`events must contain 1-${MAX_EVENTS_PER_BATCH} items`);
  }
  const events: EventInput[] = b.events.map((raw) => {
    if (typeof raw !== 'object' || raw === null) throw new FeedInputError('Invalid event');
    const e = raw as Record<string, unknown>;
    if (typeof e.jobId !== 'string' || !UUID.test(e.jobId)) throw new FeedInputError('Invalid jobId');
    if (typeof e.type !== 'string' || !(EVENT_TYPES as readonly string[]).includes(e.type)) {
      throw new FeedInputError('Invalid event type');
    }
    return { jobId: e.jobId, type: e.type as EventType };
  });
  return { sessionId: b.sessionId, events };
}

export function createRouter(service: FeedService) {
  return async function handle(req: HttpLikeRequest): Promise<HttpLikeResponse> {
    try {
      const method = req.method.toUpperCase();
      const path = req.path.replace(/\/+$/, '');

      if (method === 'POST' && path === '/events') {
        const { sessionId, events } = parseEventBatch(req.body);
        const stored = await service.recordEvents(sessionId, events);
        return { status: 202, body: { accepted: stored } };
      }

      if (method !== 'GET') return { status: 405, body: { error: 'Method not allowed' } };

      const viewer = parseViewer(req.query);
      const cursor = req.query.cursor || null;
      const limit = parseLimit(req.query);

      switch (path) {
        case '/feed/home':
          return { status: 200, body: await service.home(viewer, { seed: parseSeed(req.query.seed) }) };
        case '/feed/recommended':
          return { status: 200, body: await service.recommended(viewer, { cursor, limit }) };
        case '/feed/popular': {
          const p = req.query.period;
          if (p !== undefined && p !== '' && !(PERIODS as readonly string[]).includes(p)) {
            throw new FeedInputError('Invalid period');
          }
          const period = p ? (p as Period) : undefined;
          return { status: 200, body: await service.popular(viewer, { cursor, limit, period }) };
        }
        case '/feed/near':
          return { status: 200, body: await service.near(viewer, { cursor, limit }) };
        case '/feed/explore':
          return { status: 200, body: await service.explore(viewer, { cursor, limit, seed: parseSeed(req.query.seed) }) };
        default:
          return { status: 404, body: { error: 'Not found' } };
      }
    } catch (err) {
      if (err instanceof FeedInputError) return { status: 400, body: { error: err.message } };
      // Never leak internals to the client; log on the server side in your host.
      console.error('[feed] unhandled error', err);
      return { status: 500, body: { error: 'Internal error' } };
    }
  };
}
