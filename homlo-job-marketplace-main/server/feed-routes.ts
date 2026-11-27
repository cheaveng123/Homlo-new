import type { Express, Request, Response, NextFunction } from 'express';
import { createRouter } from '../backend/feed/ibis_request_router';
import { createFeedService } from '../backend/feed/heron_feed_assembler';
import { createPostgresFeedStore } from '../backend/feed/badger_postgres_store';
import { requestSourceIp } from './_core/requestIp';
import { getSharedSql } from '../backend/infrastructure/database/shared-pool';
import { TtlCache } from './_core/ttl-cache';

// Create the database connection pool
// Shares the server's single DB pool (the Supabase pooler allows 15 clients in total).
const sql = getSharedSql(process.env.SUPABASE_DB_URL!);

// Create the feed store and service
const store = createPostgresFeedStore({
  query: async <T = unknown>(text: string, params?: unknown[] | undefined): Promise<{ rows: T[] }> => {
    const result = await sql.unsafe(text, params as any[]);
    return { rows: result as unknown as T[] };
  },
});

const service = createFeedService(store);
const handle = createRouter(service);

// PERF: a home feed is ~6 sequential DB round trips (1–3s measured) and the
// app fires several feed calls per screen. Identical GETs share one result for
// 30s, then the last result is served instantly while one background refresh
// runs. Any write request clears it (see invalidateFeedCache), so new posts,
// edits and boosts show up on the next read.
type FeedResponse = { status: number; body: unknown };
const feedCache = new TtlCache<FeedResponse>(30_000, 500, 5 * 60_000);

export function invalidateFeedCache(): void {
  feedCache.clear();
}

/** Rounds coordinates to ~100m so nearby viewers share cache entries. */
function normalizedFeedQuery(query: Record<string, string | undefined>): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = { ...query };
  for (const key of ['lat', 'lng'] as const) {
    const n = Number(out[key]);
    if (out[key] !== undefined && out[key] !== '' && Number.isFinite(n)) out[key] = n.toFixed(3);
  }
  return out;
}

// Rate limiting store (in-memory, per IP)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function rateLimit(req: Request, res: Response, next: NextFunction) {
  const ip = requestSourceIp(req) ?? 'unknown';
  const now = Date.now();
  const windowMs = 60_000; // 1 minute
  const maxRequests = 100;

  const entry = rateLimitStore.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + windowMs });
    return next();
  }

  if (entry.count >= maxRequests) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  entry.count++;
  next();
}

export function registerFeedRoutes(app: Express) {
  // Feed endpoints
  app.all('/feed/*', async (req: Request, res: Response) => {
    try {
      const { method, path, body } = req;
      const query = normalizedFeedQuery(req.query as Record<string, string | undefined>);
      if (method !== 'GET') {
        const response = await handle({ method, path, query, body });
        res.status(response.status).json(response.body);
        return;
      }
      const key = `${path}?${Object.keys(query).sort().map((k) => `${k}=${query[k] ?? ''}`).join('&')}`;
      const response = await feedCache.get(key, async () => {
        const result = await handle({ method, path, query, body });
        // Only successful pages are cached; errors are retried by the client.
        if (result.status !== 200) throw Object.assign(new Error('feed error'), { feedResponse: result });
        return result;
      }).catch((error: { feedResponse?: FeedResponse }) => {
        if (error?.feedResponse) return error.feedResponse;
        throw error;
      });
      res.status(response.status).json(response.body);
    } catch (error) {
      console.error('[feed] unhandled error', error);
      res.status(500).json({ error: 'Internal error' });
    }
  });

  // Events endpoint with rate limiting
  app.post('/events', rateLimit, async (req: Request, res: Response) => {
    try {
      const response = await handle({ method: 'POST', path: '/events', query: {}, body: req.body });
      res.status(response.status).json(response.body);
    } catch (error) {
      console.error('[events] unhandled error', error);
      res.status(500).json({ error: 'Internal error' });
    }
  });
}