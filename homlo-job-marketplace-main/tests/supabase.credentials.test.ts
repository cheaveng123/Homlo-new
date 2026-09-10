import { describe, expect, it } from "vitest";
import postgres from "postgres";

const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/+$/, "");
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseDatabaseUrl = process.env.SUPABASE_DB_URL;
const hasParseableDatabaseUrl = (() => {
  if (!supabaseDatabaseUrl?.startsWith("postgres")) return false;
  try {
    new URL(supabaseDatabaseUrl);
    return true;
  } catch {
    return false;
  }
})();

describe("Supabase server credentials", () => {
  it("can authenticate a lightweight server health request", async () => {
    expect(supabaseUrl).toMatch(/^https:\/\/.+\.supabase\.co$/);
    expect(serviceRoleKey).toBeTruthy();

    const response = await fetch(`${supabaseUrl}/auth/v1/health`, {
      headers: {
        apikey: serviceRoleKey!,
        Authorization: `Bearer ${serviceRoleKey!}`,
      },
    });

    expect(response.status).not.toBe(401);
    expect(response.status).not.toBe(403);
    expect(response.ok).toBe(true);
  }, 15_000);

  const databaseIt = hasParseableDatabaseUrl ? it : it.skip;
  databaseIt("can open a server-only transactional Postgres connection", async () => {
    expect(supabaseDatabaseUrl).toMatch(/^postgres(?:ql)?:\/\//);

    const sql = postgres(supabaseDatabaseUrl!, {
      connect_timeout: 10,
      idle_timeout: 1,
      max: 1,
      ssl: "require",
    });

    try {
      const [{ current_database: currentDatabase }] = await sql<{ current_database: string }[]>`select current_database()`;
      expect(currentDatabase).toBeTruthy();
    } finally {
      await sql.end({ timeout: 2 });
    }
  }, 15_000);
});
