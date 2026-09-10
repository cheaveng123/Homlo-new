import postgres from "postgres";
import { describe, expect, it } from "vitest";

const databaseUrl = process.env.SUPABASE_DB_URL;
const hasValidDirectPostgresUrl = (() => {
  if (!databaseUrl || !/^postgres(?:ql)?:\/\//i.test(databaseUrl)) return false;
  try {
    new URL(databaseUrl);
    return true;
  } catch {
    return false;
  }
})();

describe("optional direct Supabase Postgres connection", () => {
  const directPostgresTest = hasValidDirectPostgresUrl ? it : it.skip;

  directPostgresTest("opens a server-only connection and completes a read-only health query", async () => {

    const sql = postgres(databaseUrl!, {
      connect_timeout: 12,
      idle_timeout: 2,
      max: 1,
      prepare: false,
      ssl: "require",
    });

    try {
      const rows = await sql<{ healthy: number }[]>`select 1 as healthy`;
      expect(rows[0]?.healthy).toBe(1);
    } finally {
      await sql.end({ timeout: 3 });
    }
  }, 20_000);
});
