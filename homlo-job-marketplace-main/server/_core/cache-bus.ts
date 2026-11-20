import { randomUUID } from "node:crypto";

/**
 * PERF/correctness when running more than one server instance.
 *
 * The public read caches (job list, search, employer profiles, ranked feed)
 * live in each process. A write used to clear only the instance that handled
 * it, so other instances could keep serving the old list for up to
 * TTL + stale window (~5 min). Each instance now also broadcasts a Postgres
 * NOTIFY, and every other instance LISTENs and clears its own caches.
 *
 * Best effort by design: if LISTEN is unavailable (e.g. a transaction-mode
 * pooler URL) the app still works exactly as before — single-instance
 * correctness never depends on this. Set CACHE_BUS=off to disable.
 * The payload is only the sender's random instance id: no user data.
 */

export const CACHE_BUS_CHANNEL = "homlo_cache_invalidate";

type NotifySql = {
  notify: (channel: string, payload: string) => Promise<unknown>;
  listen: (channel: string, onNotify: (payload: string) => void) => Promise<unknown>;
};

export class CacheBus {
  readonly instanceId = randomUUID();
  private listening = false;

  constructor(private readonly sql: NotifySql | null) {}

  get enabled(): boolean {
    return Boolean(this.sql) && process.env.CACHE_BUS !== "off";
  }

  async start(onRemoteInvalidate: () => void): Promise<boolean> {
    if (!this.enabled || this.listening || !this.sql) return false;
    try {
      await this.sql.listen(CACHE_BUS_CHANNEL, (payload) => {
        if (payload === this.instanceId) return; // our own write, already cleared
        onRemoteInvalidate();
      });
      this.listening = true;
      console.log("[cache-bus] listening for cross-instance invalidations");
      return true;
    } catch (error) {
      console.warn("[cache-bus] LISTEN unavailable; caches are per-instance only", error instanceof Error ? error.message : error);
      return false;
    }
  }

  publish(): void {
    if (!this.enabled || !this.sql) return;
    this.sql.notify(CACHE_BUS_CHANNEL, this.instanceId).catch((error: unknown) => {
      console.warn("[cache-bus] NOTIFY failed", error instanceof Error ? error.message : error);
    });
  }
}

let bus: Promise<CacheBus> | null = null;

/** Process-wide bus on the shared DB pool (null SQL when no DB URL is set). */
export function getCacheBus(): Promise<CacheBus> {
  bus ??= (async () => {
    const url = process.env.SUPABASE_DB_URL;
    let sql: NotifySql | null = null;
    if (url) {
      const { getSharedSql } = await import("../../backend/infrastructure/database/shared-pool");
      sql = getSharedSql(url) as unknown as NotifySql;
    }
    return new CacheBus(sql);
  })();
  return bus;
}
