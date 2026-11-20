import { describe, expect, it, vi } from "vitest";
import { HomloDirectService } from "../server/homlo-direct-service";

/** Fake adapter that records SQL so the account/report flows can be checked without a database. */
function fakeAdapter(rowsFor: (sql: string) => Record<string, unknown>[] = () => []) {
  const statements: { sql: string; params: unknown[]; inTx: boolean }[] = [];
  let inTx = false;
  const query = async (sql: string, params: unknown[] = []) => {
    statements.push({ sql: sql.replace(/\s+/g, " ").trim(), params, inTx });
    const rows = rowsFor(sql);
    return { rows, rowCount: rows.length };
  };
  return {
    statements,
    adapter: {
      query,
      transaction: async (work: (db: { query: typeof query }) => Promise<unknown>) => {
        inTx = true;
        try { return await work({ query }); } finally { inTx = false; }
      },
      verifySupabaseToken: vi.fn(async (token: string) => (token === "good-token" ? { id: "auth-user-1" } : null)),
      deleteAuthUser: vi.fn(async () => undefined),
    },
  };
}

describe("account deletion (App Store 5.1.1(v))", () => {
  it("removes listings, wipes the profile, retires the identity and deletes the login", async () => {
    const { adapter, statements } = fakeAdapter();
    const service = new HomloDirectService(adapter as never);
    await expect(service.deleteAccount("good-token", "user-1")).resolves.toEqual({ deleted: true });

    const sql = statements.map((s) => s.sql).join("\n");
    expect(sql).toMatch(/update jobs set status = case .* deleted_at = now\(\)/);
    expect(sql).toMatch(/update profiles set full_name = 'Deleted user', phone = null, profile_photo_key = null/);
    expect(sql).toMatch(/update user_identities set deleted_at = now\(\)/);
    expect(sql).toMatch(/update users set deleted_at = now\(\)/);
    // All data changes happen together, for the verified user only.
    expect(statements.every((s) => s.inTx)).toBe(true);
    expect(statements.every((s) => s.params[0] === "user-1")).toBe(true);
    expect(adapter.deleteAuthUser).toHaveBeenCalledWith("auth-user-1");
  });

  it("refuses an invalid session and changes nothing", async () => {
    const { adapter, statements } = fakeAdapter();
    const service = new HomloDirectService(adapter as never);
    await expect(service.deleteAccount("bad-token", "user-1")).rejects.toThrow();
    expect(statements).toHaveLength(0);
    expect(adapter.deleteAuthUser).not.toHaveBeenCalled();
  });
});

describe("reporting a job listing (App Store 1.2)", () => {
  it("stores one open report per user per job", async () => {
    let reported = false;
    const { adapter, statements } = fakeAdapter((sql) => {
      if (sql.includes("from jobs")) return [{ id: "job-1" }];
      if (sql.includes("from reports")) return reported ? [{ id: "r1" }] : [];
      if (sql.includes("insert into reports")) reported = true;
      return [];
    });
    const service = new HomloDirectService(adapter as never);
    await service.reportJob("user-1", "job-1", "scam_or_fraud", null);
    await service.reportJob("user-1", "job-1", "scam_or_fraud", null);
    const inserts = statements.filter((s) => s.sql.startsWith("insert into reports"));
    expect(inserts).toHaveLength(1);
    expect(inserts[0].params).toEqual(["user-1", "job-1", "scam_or_fraud", null]);
  });

  it("rejects reports for a job that no longer exists", async () => {
    const { adapter } = fakeAdapter(() => []);
    const service = new HomloDirectService(adapter as never);
    await expect(service.reportJob("user-1", "missing", "spam", null)).rejects.toThrow(/no longer available/);
  });
});
