import type { Express, Request, Response, NextFunction } from 'express';
import { createRouter } from '../backend/feed/ibis_request_router';
import { createFeedService } from '../backend/feed/heron_feed_assembler';
import { createPostgresFeedStore } from '../backend/feed/badger_postgres_store';
import { requestSourceIp } from './_core/requestIp';
import postgres from 'postgres';

// Create the database connection pool
const sql = postgres(process.env.SUPABASE_DB_URL!, { max: 10 });

// Create the feed store and service
const store = createPostgresFeedStore({
  query: async <T = unknown>(text: string, params?: unknown[] | undefined): Promise<{ rows: T[] }> => {
    const result = await sql.unsafe(text, params as any[]);
    return { rows: result as unknown as T[] };
  },
});

const service = createFeedService(store);
const handle = createRouter(service);

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
      const { method, path, query, body } = req;
      const response = await handle({ method, path, query: req.query as Record<string, string | undefined>, body });
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