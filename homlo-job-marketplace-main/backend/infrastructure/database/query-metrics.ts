import { AsyncLocalStorage } from "node:async_hooks";

/**
 * PERF guardrails shared by every query that goes through SupabaseAdapter:
 *  - per-request query count and DB time (read by the request logger in
 *    server/_core/index.ts), so a route that starts looping shows up in logs;
 *  - a client-side statement timeout: a query running longer than
 *    DB_QUERY_TIMEOUT_MS is cancelled on the server (postgres.js cancel()), so
 *    one bad query can't hold a pool connection forever.
 *
 * A client-side cancel is used instead of a `statement_timeout` startup
 * parameter because the Supabase pooler may not pass startup parameters
 * through; a cancel request always works.
 */

export type RequestMetrics = { queries: number; dbMs: number };

const storage = new AsyncLocalStorage<RequestMetrics>();

export function runWithRequestMetrics<T>(work: () => T): { metrics: RequestMetrics; result: T } {
  const metrics: RequestMetrics = { queries: 0, dbMs: 0 };
  const result = storage.run(metrics, work);
  return { metrics, result };
}

/**
 * Re-enters an existing request's metrics context. Needed after Express body
 * parsers: they resume on stream events, which can lose the async context.
 */
export function runWithExistingMetrics<T>(metrics: RequestMetrics, work: () => T): T {
  return storage.run(metrics, work);
}

export function currentRequestMetrics(): RequestMetrics | undefined {
  return storage.getStore();
}

export function recordQuery(durationMs: number): void {
  const metrics = storage.getStore();
  if (!metrics) return;
  metrics.queries += 1;
  metrics.dbMs += durationMs;
}

const DEFAULT_QUERY_TIMEOUT_MS = 15_000;

export function queryTimeoutMs(): number {
  const configured = Number(process.env.DB_QUERY_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_QUERY_TIMEOUT_MS;
}

export class QueryTimeoutError extends Error {
  readonly code = "QUERY_TIMEOUT";
  constructor(timeoutMs: number) {
    super(`Database query exceeded ${timeoutMs}ms and was cancelled`);
  }
}

/**
 * Awaits a pending query; after `timeoutMs` asks Postgres to cancel it (when
 * the driver supports cancel()) and rejects with QueryTimeoutError.
 */
export async function withQueryTimeout<T>(pending: Promise<T> & { cancel?: () => unknown }, timeoutMs = queryTimeoutMs()): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      try {
        void Promise.resolve(pending.cancel?.()).catch(() => undefined);
      } catch {
        // cancel is best effort
      }
      reject(new QueryTimeoutError(timeoutMs));
    }, timeoutMs);
  });
  try {
    return await Promise.race([pending, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
