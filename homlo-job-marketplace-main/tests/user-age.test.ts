import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { AGE_DEFAULT, AGE_MAX, AGE_MIN, clampAge } from "../lib/age";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const migration = read("backend/database/migrations/055_user_age.sql");
const supabaseMigration = read("supabase/migrations/20261119150000_user_age.sql");
const gateway = read("supabase/functions/homlo-service-gateway/index.ts");
const routers = read("server/routers.ts");

describe("age limits", () => {
  it("default sits inside the allowed range", () => {
    expect(AGE_DEFAULT).toBeGreaterThanOrEqual(AGE_MIN);
    expect(AGE_DEFAULT).toBeLessThanOrEqual(AGE_MAX);
  });

  it("clamps and rounds picker values", () => {
    expect(clampAge(5)).toBe(AGE_MIN);
    expect(clampAge(200)).toBe(AGE_MAX);
    expect(clampAge(30.4)).toBe(30);
    expect(clampAge(30.6)).toBe(31);
  });
});

describe("user age migration", () => {
  it("is mirrored unchanged into supabase/migrations", () => {
    expect(supabaseMigration).toBe(migration);
  });

  it("stores age on users with a database-level range check matching the app", () => {
    expect(migration).toMatch(/alter table users add column if not exists age smallint/);
    expect(migration).toMatch(/alter table users add column if not exists age_recorded_at timestamptz/);
    expect(migration).toContain(`check (age is null or age between ${AGE_MIN} and ${AGE_MAX})`);
    expect(migration).toContain(`p_age < ${AGE_MIN} or p_age > ${AGE_MAX}`);
  });

  it("only lets the service role call the age functions", () => {
    for (const fn of ["homlo_set_user_age(uuid, integer)", "homlo_get_user_age(uuid)"]) {
      expect(migration).toContain(`revoke all on function public.${fn} from public, anon, authenticated;`);
      expect(migration).toContain(`grant execute on function public.${fn} to service_role;`);
    }
  });

  it("only updates active, non-deleted users", () => {
    const setFn = migration.slice(
      migration.indexOf("create or replace function public.homlo_set_user_age"),
      migration.indexOf("create or replace function public.homlo_get_user_age"),
    );
    expect(setFn).toContain("u.deleted_at is null");
    expect(setFn).toContain("u.status = 'active'");
  });
});

describe("age API surface", () => {
  it("gateway validates the age and uses the caller's own account id", () => {
    expect(gateway).toContain('action === "age.set"');
    expect(gateway).toContain("age < 16 || age > 80");
    expect(gateway).toMatch(/"homlo_set_user_age",\s*\{ p_user_id: account\.id, p_age: age \}/);
    expect(gateway).toMatch(/"homlo_get_user_age",\s*\{ p_user_id: account\.id \}/);
  });

  it("tRPC input is bounded by the shared limits", () => {
    expect(routers).toContain("z.number().int().min(AGE_MIN).max(AGE_MAX)");
  });
});

describe("age is served by the app server from Postgres", () => {
  const userId = "11111111-1111-1111-1111-111111111111";

  it("routes no longer depend on the edge gateway's age actions", () => {
    expect(routers).toContain("getHomloDirectService().getUserAge(ctx.homloUser.id)");
    expect(routers).toContain("getHomloDirectService().setUserAge(ctx.homloUser.id, input.age)");
    expect(routers).not.toMatch(/"age\.(get|set)"/);
  });

  it("reads and writes only the signed-in user's row", async () => {
    const { getHomloDirectService } = await import("../server/homlo-direct-service");
    const { SupabaseAdapter } = await import("../backend/infrastructure/database/SupabaseAdapter");
    const recordedAt = new Date("2026-11-19T09:00:00.000Z");
    const query = vi
      .spyOn(SupabaseAdapter.prototype, "query")
      .mockResolvedValueOnce({ rows: [{ age: 31, age_recorded_at: recordedAt }] } as never)
      .mockResolvedValueOnce({ rows: [{ age: 31, age_recorded_at: recordedAt }] } as never);

    const service = getHomloDirectService();
    await expect(service.setUserAge(userId, 31)).resolves.toEqual({ age: 31, recordedAt: recordedAt.toISOString() });
    await expect(service.getUserAge(userId)).resolves.toEqual({ age: 31, recordedAt: recordedAt.toISOString() });

    expect(query.mock.calls[0][0]).toMatch(/update users\s+set age = \$2, age_recorded_at = now\(\)\s+where id = \$1 and deleted_at is null and status = 'active'/);
    expect(query.mock.calls[0][1]).toEqual([userId, 31]);
    expect(query.mock.calls[1][1]).toEqual([userId]);
    query.mockRestore();
  });

  it("rejects out-of-range ages before touching the database", async () => {
    const { getHomloDirectService } = await import("../server/homlo-direct-service");
    const { SupabaseAdapter } = await import("../backend/infrastructure/database/SupabaseAdapter");
    const query = vi.spyOn(SupabaseAdapter.prototype, "query");
    await expect(getHomloDirectService().setUserAge(userId, AGE_MIN - 1)).rejects.toThrow(/between/);
    await expect(getHomloDirectService().setUserAge(userId, AGE_MAX + 1)).rejects.toThrow(/between/);
    expect(query).not.toHaveBeenCalled();
    query.mockRestore();
  });

  it("gives a clear message, not raw SQL, when the age migration is missing", async () => {
    const { getHomloDirectService } = await import("../server/homlo-direct-service");
    const { SupabaseAdapter } = await import("../backend/infrastructure/database/SupabaseAdapter");
    const missing = Object.assign(new Error('column "age" does not exist'), { code: "42703" });
    const query = vi.spyOn(SupabaseAdapter.prototype, "query").mockRejectedValue(missing);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(getHomloDirectService().setUserAge(userId, 30)).rejects.toThrow("Saving your age isn't available yet. Please try again shortly.");
    expect(log).toHaveBeenCalled();
    query.mockRestore();
    log.mockRestore();
  });
});
