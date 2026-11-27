import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getHomloDirectService } from "../server/homlo-direct-service";
import { SupabaseAdapter } from "../backend/infrastructure/database/SupabaseAdapter";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const migration = read("backend/database/migrations/056_user_adult_confirmation.sql");
const routers = read("server/routers.ts");
const editProfile = read("app/profile/[section].tsx");
const userId = "11111111-1111-1111-1111-111111111111";

afterEach(() => vi.restoreAllMocks());

describe("adult confirmation migration", () => {
  it("is mirrored unchanged into supabase/migrations", () => {
    expect(read("supabase/migrations/20261119170000_user_adult_confirmation.sql")).toBe(migration);
  });

  it("adds a nullable answer plus when it was given", () => {
    expect(migration).toContain("alter table users add column if not exists is_adult boolean;");
    expect(migration).toContain("alter table users add column if not exists is_adult_confirmed_at timestamptz;");
  });
});

describe("adult status on the app server", () => {
  it("returns the member's own answer when they gave one", async () => {
    vi.spyOn(SupabaseAdapter.prototype, "query").mockResolvedValue({
      rows: [{ is_adult: false, is_adult_confirmed_at: new Date("2026-11-19T10:00:00Z"), age: 30 }],
    } as never);
    await expect(getHomloDirectService().getAdultStatus(userId)).resolves.toEqual({
      isAdult: false,
      suggested: false,
      confirmedAt: "2026-11-19T10:00:00.000Z",
    });
  });

  it("suggests from the sign-up age when they never answered", async () => {
    const query = vi.spyOn(SupabaseAdapter.prototype, "query");
    query.mockResolvedValueOnce({ rows: [{ is_adult: null, is_adult_confirmed_at: null, age: 17 }] } as never);
    await expect(getHomloDirectService().getAdultStatus(userId)).resolves.toMatchObject({ isAdult: null, suggested: false });
    query.mockResolvedValueOnce({ rows: [{ is_adult: null, is_adult_confirmed_at: null, age: 18 }] } as never);
    await expect(getHomloDirectService().getAdultStatus(userId)).resolves.toMatchObject({ isAdult: null, suggested: true });
    query.mockResolvedValueOnce({ rows: [{ is_adult: null, is_adult_confirmed_at: null, age: null }] } as never);
    await expect(getHomloDirectService().getAdultStatus(userId)).resolves.toMatchObject({ isAdult: null, suggested: null });
  });

  it("saves only the signed-in member's active row", async () => {
    const query = vi
      .spyOn(SupabaseAdapter.prototype, "query")
      .mockResolvedValue({ rows: [{ is_adult: true, is_adult_confirmed_at: new Date("2026-11-19T10:00:00Z") }] } as never);
    await expect(getHomloDirectService().setAdultStatus(userId, true)).resolves.toMatchObject({ isAdult: true });
    expect(query.mock.calls[0][0]).toMatch(/where id = \$1 and deleted_at is null and status = 'active'/);
    expect(query.mock.calls[0][1]).toEqual([userId, true]);
  });

  it("explains a missing migration instead of leaking SQL", async () => {
    vi.spyOn(SupabaseAdapter.prototype, "query").mockRejectedValue(
      Object.assign(new Error('column "is_adult" does not exist'), { code: "42703" }),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(getHomloDirectService().getAdultStatus(userId)).rejects.toThrow("The age check isn't available yet. Please try again shortly.");
  });
});

describe("Edit profile", () => {
  it("routes use the verified session user and accept only a boolean", () => {
    expect(routers).toContain("getHomloDirectService().getAdultStatus(ctx.homloUser.id)");
    expect(routers).toContain(".input(z.object({ isAdult: z.boolean() }))");
  });

  it("no longer shows the account type", () => {
    expect(editProfile).not.toMatch(/Account type|ROLE_LABEL|roleLabel/);
    expect(editProfile).toContain("Are you 18 or older?");
  });
});
