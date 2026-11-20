import { describe, expect, it, vi } from "vitest";
import { HomloDirectService } from "../server/homlo-direct-service";
import { logIfSlow } from "../backend/infrastructure/database/SupabaseAdapter";

/**
 * Query-budget guards for the hot public reads (perf Phases 1, 4, 6).
 */
function countingAdapter(rowsFor: (sql: string) => Record<string, unknown>[] = () => []) {
  const statements: string[] = [];
  return {
    statements,
    adapter: {
      query: async (sql: string) => {
        statements.push(sql.replace(/\s+/g, " ").trim());
        const rows = rowsFor(sql);
        return { rows, rowCount: rows.length };
      },
    },
  };
}

const JOB_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const JOB_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

function feedRows(sql: string): Record<string, unknown>[] {
  if (sql.includes("homlo_list_public_published_jobs")) {
    return [
      { id: JOB_A, title: "Cook", pay_amount: "10", banner_image: null, created_at: new Date("2026-11-01T00:00:00Z") },
      { id: JOB_B, title: "Driver", pay_amount: "12", banner_image: null, created_at: new Date("2026-10-01T00:00:00Z") },
    ];
  }
  if (sql.includes("from public.boosts")) return [{ job_id: JOB_B }];
  if (sql.includes("work_days")) {
    return [{ id: JOB_A, work_days: ["mon"], clock_in: "09:00", clock_out: "17:00", pay_amount_max: "15" }];
  }
  return [];
}

describe("query budget: public job feed", () => {
  it("costs 3 queries on a cache miss and 0 on a hit, with boosts and work time merged", async () => {
    const { adapter, statements } = countingAdapter(feedRows);
    const service = new HomloDirectService(adapter as never);

    const first = await service.listPublishedJobs();
    expect(statements).toHaveLength(3); // feed + boosts + work time (the last two run in parallel)
    await service.listPublishedJobs();
    expect(statements).toHaveLength(3); // cached

    const [a, b] = first.jobs as unknown as Record<string, unknown>[];
    // Order and fields are the same as before the parallel lookup.
    expect(a.id).toBe(JOB_A);
    expect(a.boosted).toBe(false);
    expect(a.work_days).toEqual(["mon"]);
    expect(a.pay_amount_max).toBe(15);
    expect(a.pay_amount).toBe(10);
    expect(a.created_at).toBe("2026-11-01T00:00:00.000Z");
    expect(b.id).toBe(JOB_B);
    expect(b.boosted).toBe(true);
    expect(b.work_days).toBeUndefined();
  });

  it("still returns the feed (without work time) when the work-time columns are missing", async () => {
    const { adapter } = countingAdapter(feedRows);
    const failing = {
      query: async (sql: string) => {
        if (sql.includes("work_days")) throw new Error("column work_days does not exist");
        return adapter.query(sql);
      },
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const service = new HomloDirectService(failing as never);
    const { jobs } = await service.listPublishedJobs();
    warn.mockRestore();
    expect(jobs.map((job) => [job.id, job.boosted])).toEqual([[JOB_A, false], [JOB_B, true]]);
  });
});

describe("query budget: employer public profile", () => {
  it("is cached per name and refreshed after a listing/profile write", async () => {
    const { adapter, statements } = countingAdapter(() => [
      { full_name: "Homlo Cafe", profile_photo_key: null, banner_image: null, verified: true, bio: null, location_text: null, latitude: 11.5564, longitude: 104.9282 },
    ]);
    const service = new HomloDirectService(adapter as never);

    const first = await service.getEmployerProfile("Homlo Cafe");
    await service.getEmployerProfile("Homlo Cafe");
    expect(statements).toHaveLength(1); // budget: 1 per name per minute
    expect(first?.latitude).toBe(11.56); // still coarsened

    service.invalidateAfterWrite(null);
    await service.getEmployerProfile("Homlo Cafe");
    expect(statements).toHaveLength(2); // write invalidates its own cache
  });
});

describe("guardrails", () => {
  it("readiness check reports database failure instead of throwing", async () => {
    const down = new HomloDirectService({ query: async () => { throw new Error("connection refused"); } } as never);
    await expect(down.checkDatabase()).resolves.toMatchObject({ ok: false });
    const up = new HomloDirectService({ query: async () => ({ rows: [{ ok: 1 }], rowCount: 1 }) } as never);
    await expect(up.checkDatabase()).resolves.toMatchObject({ ok: true });
  });

  it("slow-query log never includes parameter values", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    logIfSlow("select * from users where email = $1", 50, 1);
    expect(warn).not.toHaveBeenCalled();
    logIfSlow("select * from users\n   where email = $1", 450, 1);
    expect(warn).toHaveBeenCalledWith("[db] slow query 450ms rows=1: select * from users where email = $1");
    warn.mockRestore();
  });
});
