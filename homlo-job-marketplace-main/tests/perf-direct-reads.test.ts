import { describe, expect, it, vi } from "vitest";
import { HomloDirectService, type HomloSessionUser } from "../server/homlo-direct-service";
import { CacheBus, CACHE_BUS_CHANNEL } from "../server/_core/cache-bus";
import {
  QueryTimeoutError,
  recordQuery,
  runWithRequestMetrics,
  withQueryTimeout,
} from "../backend/infrastructure/database/query-metrics";

/**
 * Perf follow-up guards: signed-in reads served directly (no edge gateway),
 * single-job reads, search total, cross-instance cache bus, query timeout and
 * per-request query counting.
 */
function adapterWith(rowsFor: (sql: string, params: unknown[]) => Record<string, unknown>[]) {
  const statements: { sql: string; params: unknown[] }[] = [];
  const gatewayCalls: { action: string; payload: unknown }[] = [];
  return {
    statements,
    gatewayCalls,
    adapter: {
      query: async (sql: string, params: unknown[] = []) => {
        statements.push({ sql: sql.replace(/\s+/g, " ").trim(), params });
        const rows = rowsFor(sql, params);
        return { rows, rowCount: rows.length };
      },
      verifySupabaseToken: async () => ({ id: "auth-1" }),
      invokeAuthenticatedFunction: async (_fn: string, _token: string, body: { action: string; payload?: unknown }) => {
        gatewayCalls.push({ action: body.action, payload: body.payload });
        if (body.action === "session") return ACTIVE_USER;
        return { via: "gateway", action: body.action };
      },
    },
  };
}

const USER_ID = "11111111-1111-4111-8111-111111111111";
const JOB_ID = "22222222-2222-4222-8222-222222222222";
const ACTIVE_USER: HomloSessionUser = { id: USER_ID, status: "active", profileComplete: true, role: "worker", fullName: "W", email: null };

describe("signed-in reads skip the edge gateway", () => {
  it("serves each read with one direct query and no gateway call", async () => {
    const { adapter, statements, gatewayCalls } = adapterWith((sql) => {
      if (sql.includes("json_agg")) return [{ data: [{ id: "row-1" }] }];
      if (sql.includes("row_to_json")) return [{ data: { id: "row-1", user_id: USER_ID } }];
      return [];
    });
    const service = new HomloDirectService(adapter as never);

    await expect(service.read("t", ACTIVE_USER, "application.list")).resolves.toEqual({ applications: [{ id: "row-1" }] });
    await expect(service.read("t", ACTIVE_USER, "notifications.list")).resolves.toEqual({ notifications: [{ id: "row-1" }] });
    await expect(service.read("t", ACTIVE_USER, "messaging.conversations")).resolves.toEqual({ conversations: [{ id: "row-1" }] });
    await expect(service.read("t", ACTIVE_USER, "profile.get")).resolves.toEqual({ profile: { id: "row-1", user_id: USER_ID } });
    await expect(service.read("t", ACTIVE_USER, "application.for-job", { jobId: JOB_ID })).resolves.toEqual({ application: { id: "row-1", user_id: USER_ID } });

    expect(gatewayCalls).toHaveLength(0);
    expect(statements).toHaveLength(5);
    // Same security-definer functions and named arguments the gateway used; user id from the session only.
    expect(statements.map((s) => s.sql.match(/public\.(\w+)\(/)?.[1])).toEqual([
      "homlo_list_worker_applications_detailed",
      "homlo_list_user_notifications",
      "homlo_list_conversations",
      "homlo_get_profile",
      "homlo_get_application_for_worker",
    ]);
    expect(statements.every((s) => s.params[0] === USER_ID)).toBe(true);
    expect(statements[4].params).toEqual([USER_ID, JOB_ID]);
  });

  it("normalises an all-null application row to null, like the gateway", async () => {
    const { adapter } = adapterWith(() => [{ data: { id: null, job_id: null } }]);
    const service = new HomloDirectService(adapter as never);
    await expect(service.read("t", ACTIVE_USER, "application.for-job", { jobId: JOB_ID })).resolves.toEqual({ application: null });
  });

  it("account.get: runs both lookups together, drops activity when there is no account", async () => {
    const { adapter, statements } = adapterWith((sql) =>
      sql.includes("homlo_get_account") ? [{ data: [] }] : [{ data: [{ application_count: 3, posted_job_count: 1 }] }],
    );
    const service = new HomloDirectService(adapter as never);
    await expect(service.read("t", ACTIVE_USER, "account.get")).resolves.toEqual({ account: null, recentActivity: null });
    expect(statements).toHaveLength(2);
  });

  it("falls back to the gateway when the direct read fails, the user is not active, or the job id is not a uuid", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { adapter, gatewayCalls } = adapterWith(() => {
      throw new Error("db down");
    });
    const service = new HomloDirectService(adapter as never);
    await expect(service.read("t", ACTIVE_USER, "notifications.list")).resolves.toEqual({ via: "gateway", action: "notifications.list" });
    await expect(service.read("t", { ...ACTIVE_USER, status: "suspended" }, "profile.get")).resolves.toEqual({ via: "gateway", action: "profile.get" });
    await expect(service.read("t", ACTIVE_USER, "application.for-job", { jobId: "not-a-uuid" })).resolves.toMatchObject({ via: "gateway" });
    expect(gatewayCalls.filter((c) => c.action !== "session").map((c) => c.action)).toEqual(["notifications.list", "profile.get", "application.for-job"]);
    warn.mockRestore();
  });
});

describe("single public job (job detail)", () => {
  it("reads one job with the feed's visibility rules, adds boost + work time, caches it", async () => {
    const { adapter, statements } = adapterWith((sql) => {
      if (sql.includes("from jobs j")) return [{ id: JOB_ID, title: "Cook", pay_amount: "9.5", banner_image: "ftp://x", created_at: new Date("2026-11-02T00:00:00Z") }];
      if (sql.includes("from public.boosts")) return [{ job_id: JOB_ID }];
      return [];
    });
    const service = new HomloDirectService(adapter as never);
    const { job } = await service.getPublishedJob(JOB_ID);
    expect(job).toMatchObject({ id: JOB_ID, pay_amount: 9.5, banner_image: null, boosted: true, created_at: "2026-11-02T00:00:00.000Z" });
    const main = statements[0].sql;
    for (const rule of ["j.deleted_at is null", "j.status = 'open'", "(j.workers_needed = 0 or j.workers_hired < j.workers_needed)", "(j.end_date is null or j.end_date >= current_date)", "where j.id = $1::uuid"]) {
      expect(main).toContain(rule);
    }
    expect(statements).toHaveLength(3);
    await service.getPublishedJob(JOB_ID);
    expect(statements).toHaveLength(3); // cached
    service.invalidateAfterWrite(null);
    await service.getPublishedJob(JOB_ID);
    expect(statements).toHaveLength(6); // write clears it
  });

  it("returns null for a hidden job and for a non-uuid id (no query)", async () => {
    const { adapter, statements } = adapterWith(() => []);
    const service = new HomloDirectService(adapter as never);
    await expect(service.getPublishedJob(JOB_ID)).resolves.toEqual({ job: null });
    await expect(service.getPublishedJob("curated-1")).resolves.toEqual({ job: null });
    expect(statements).toHaveLength(1);
  });
});

describe("search total", () => {
  const row = (id: string, total?: number) => ({ id, title: "t", ...(total === undefined ? {} : { total_count: total }) });

  it("reports the real match count and strips total_count from job rows", async () => {
    const { adapter } = adapterWith((sql) => (sql.includes("homlo_search_public_jobs") ? [row("a", 57), row("b", 57)] : []));
    const service = new HomloDirectService(adapter as never);
    const result = await service.searchJobs({ query: "cook" });
    expect(result.total).toBe(57);
    expect(result.jobs.map((j) => Object.keys(j).includes("total_count"))).toEqual([false, false]);
  });

  it("keeps the old value (page size) before migration 061 is applied", async () => {
    const { adapter } = adapterWith((sql) => (sql.includes("homlo_search_public_jobs") ? [row("a"), row("b")] : []));
    const service = new HomloDirectService(adapter as never);
    expect((await service.searchJobs({ query: "driver" })).total).toBe(2);
  });
});

describe("cross-instance cache bus", () => {
  it("notifies other instances and ignores its own messages", async () => {
    const listeners: ((payload: string) => void)[] = [];
    const sent: string[] = [];
    const sql = {
      listen: async (channel: string, fn: (payload: string) => void) => {
        expect(channel).toBe(CACHE_BUS_CHANNEL);
        listeners.push(fn);
      },
      notify: async (_channel: string, payload: string) => {
        sent.push(payload);
        listeners.forEach((fn) => fn(payload));
      },
    };
    const a = new CacheBus(sql);
    const b = new CacheBus(sql);
    const clearedA = vi.fn();
    const clearedB = vi.fn();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    await a.start(clearedA);
    await b.start(clearedB);
    a.publish();
    await Promise.resolve();
    expect(sent).toEqual([a.instanceId]); // payload is only a random id
    expect(clearedA).not.toHaveBeenCalled();
    expect(clearedB).toHaveBeenCalledTimes(1);
  });

  it("keeps working when LISTEN is unavailable", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const bus = new CacheBus({ listen: async () => { throw new Error("prepared/LISTEN not supported"); }, notify: async () => undefined });
    await expect(bus.start(() => undefined)).resolves.toBe(false);
    expect(() => bus.publish()).not.toThrow();
    warn.mockRestore();
  });
});

describe("query timeout and per-request query count", () => {
  it("cancels a query that runs past the timeout", async () => {
    const cancel = vi.fn();
    const never = Object.assign(new Promise<never>(() => undefined), { cancel });
    await expect(withQueryTimeout(never, 20)).rejects.toBeInstanceOf(QueryTimeoutError);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("returns normally when the query finishes in time", async () => {
    await expect(withQueryTimeout(Promise.resolve([1]), 1_000)).resolves.toEqual([1]);
  });

  it("counts queries per request, across awaits", async () => {
    const { metrics, result } = runWithRequestMetrics(async () => {
      recordQuery(5);
      await new Promise((resolve) => setTimeout(resolve, 1));
      recordQuery(7);
    });
    await result;
    expect(metrics).toEqual({ queries: 2, dbMs: 12 });
  });
});
