/**
 * PERF: small in-memory TTL cache with in-flight de-duplication.
 *
 * Used by the API server so identical reads that arrive close together
 * (many users opening Home at once, or one client mounting several screens
 * that all ask for the same list) share ONE upstream call instead of each
 * hitting Supabase / edge functions.
 *
 * - `get(key, load)` returns a fresh cached value, joins an in-flight load for
 *   the same key, or starts a new load.
 * - `clear()` bumps a generation counter, so a load that started BEFORE a
 *   write finished can never store its (now stale) result afterwards.
 * - Entries are bounded by `maxEntries` (oldest evicted first).
 *
 * Per-process only. If the server runs as several instances each keeps its own
 * copy, which is fine for these short TTLs.
 */
export class TtlCache<V> {
  private readonly entries = new Map<string, { value: V; expiresAt: number }>();
  private readonly inflight = new Map<string, Promise<V>>();
  private generation = 0;

  /**
   * @param staleMs PERF: stale-while-revalidate window. For this long after
   *   expiry the old value is still returned instantly while ONE background
   *   load refreshes it, so users never wait on an expired entry. A clear()
   *   (after a write) drops values entirely, so writes are never served stale.
   */
  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 500,
    private readonly staleMs = 0,
  ) {}

  async get(key: string, load: () => Promise<V>): Promise<V> {
    const now = Date.now();
    const hit = this.entries.get(key);
    if (hit && hit.expiresAt > now) return hit.value;
    if (hit && hit.expiresAt + this.staleMs > now) {
      if (!this.inflight.has(key)) this.start(key, load).catch(() => undefined);
      return hit.value;
    }
    if (hit) this.entries.delete(key);

    const pending = this.inflight.get(key);
    if (pending) return pending;
    return this.start(key, load);
  }

  private start(key: string, load: () => Promise<V>): Promise<V> {
    const startedAt = this.generation;
    const promise = load()
      .then((value) => {
        // Skip storing when clear()/delete() ran while this load was pending.
        if (startedAt === this.generation && this.inflight.get(key) === promise) this.set(key, value);
        return value;
      })
      .finally(() => {
        if (this.inflight.get(key) === promise) this.inflight.delete(key);
      });
    this.inflight.set(key, promise);
    return promise;
  }

  set(key: string, value: V): void {
    this.entries.delete(key); // re-insert so eviction order tracks freshness
    if (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  delete(key: string): void {
    this.entries.delete(key);
    this.inflight.delete(key);
  }

  /** Drops every entry and makes in-flight loads skip writing their result. */
  clear(): void {
    this.generation += 1;
    this.entries.clear();
    this.inflight.clear();
  }
}
