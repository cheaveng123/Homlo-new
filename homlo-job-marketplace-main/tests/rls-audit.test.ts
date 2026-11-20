import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";

const supabaseUrl = (process.env.SUPABASE_URL ?? "").replace(/\/+$/, "");
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
const databaseUrl = process.env.SUPABASE_DB_URL ?? "";
const hasConfig = (() => {
  if (!/^https:\/\/.+\.supabase\.co$/.test(supabaseUrl)) return false;
  if (!anonKey) return false;
  if (!/^postgres(?:ql)?:\/\//.test(databaseUrl)) return false;
  try {
    new URL(databaseUrl);
    return true;
  } catch {
    return false;
  }
})();

// Require explicit opt-in to run the RLS audit against a live database.
// Without RLS_AUDIT_ENABLED=true, the suite is skipped to avoid
// silently contacting production during ordinary test runs.
const rlsAuditEnabled = process.env.RLS_AUDIT_ENABLED === "true";

const APP_TABLES = [
  "users",
  "user_identities",
  "profiles",
  "categories",
  "jobs",
  "job_media",
  "applications",
  "conversations",
  "conversation_members",
  "messages",
  "message_hidden_for",
  "saved_jobs",
  "notifications",
  "reviews",
  "boosts",
  "payments",
  "payment_webhook_events",
  "reports",
  "audit_logs",
  "job_events",
  "employer_quality_stats",
  "job_quality_stats",
  "subscriptions",
  "plan_catalog",
];

const MESSAGING_TABLES = ["conversations", "conversation_members", "messages", "message_hidden_for"];

const POSTGIS_SYSTEM = ["spatial_ref_sys", "geometry_columns", "geography_columns"];

const HARDENED_FUNCTIONS = ["homlo_is_conversation_member", "homlo_is_blocked", "homlo_sync_jobs_location"];

const suite = hasConfig && rlsAuditEnabled ? describe : describe.skip;

suite("RLS security audit (migration 038)", () => {
  const connect = () =>
    postgres(databaseUrl, {
      connect_timeout: 12,
      idle_timeout: 2,
      max: 3,
      prepare: false,
      ssl: "require",
    });

  const rest = (path: string, init?: RequestInit, token?: string) =>
    fetch(`${supabaseUrl}${path}`, {
      ...init,
      headers: {
        apikey: anonKey,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });

  const statusIsDenied = (s: number) => [401, 403, 404, 425].includes(s);

  describe("row level security is enabled, not forced", () => {
    let sql: postgres.Sql | null = null;

    beforeAll(async () => {
      sql = connect();
    }, 20_000);

    afterAll(async () => {
      await sql?.end({ timeout: 3 });
    });

    it("every app table has RLS enabled", async () => {
      const rows = await sql!<{ table: string }[]>`
        select c.relname as "table"
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relkind = 'r'
          and c.relname <> 'spatial_ref_sys'
          and not c.relrowsecurity
        order by c.relname`;
      expect(rows.map((r) => r.table)).toEqual([]);
    });

    it("no app table is force row level security (service functions keep bypassing)", async () => {
      const rows = await sql!<{ table: string }[]>`
        select c.relname as "table"
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relkind = 'r'
          and c.relname <> 'spatial_ref_sys'
          and c.relforcerowsecurity
        order by c.relname`;
      expect(rows.map((r) => r.table)).toEqual([]);
    });

    it("only the expected authenticated-scoped SELECT policies exist", async () => {
      const rows = await sql!<{ t: string; name: string; cmd: string; roles: string[] }[]>`
        select p.polrelid::regclass::text as t, p.polname as name, p.polcmd as cmd,
               array(select r.rolname from pg_roles r where r.oid = any(p.polroles)) as roles
        from pg_policy p
        where p.polrelid in (
          select c.oid from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public'
        )
        order by p.polrelid::regclass::text, p.polname`;
      const expected = [
        { t: "conversation_members", name: "member row visible to the member", cmd: "r" },
        { t: "conversations", name: "conversation is visible to members", cmd: "r" },
        { t: "message_hidden_for", name: "own hide marks visible to the hider", cmd: "r" },
        { t: "messages", name: "message visible to members", cmd: "r" },
      ];
      expect(rows.length).toBe(expected.length);
      rows.forEach((row, i) => {
        expect(row.t).toBe(expected[i].t);
        expect(row.name).toBe(expected[i].name);
        expect(row.cmd).toBe(expected[i].cmd);
      });
      rows.forEach((row) => {
        expect(row.roles).toContain("authenticated");
        expect(row.roles).not.toContain("anon");
      });
    });
  });

  describe("grants are minimal", () => {
    let sql: postgres.Sql | null = null;

    beforeAll(async () => {
      sql = connect();
    }, 20_000);

    afterAll(async () => {
      await sql?.end({ timeout: 3 });
    });

    it("anon has zero privileges on app tables", async () => {
      const rows = await sql!<{ table: string }[]>`
        select distinct table_name as "table"
        from information_schema.role_table_grants
        where table_schema = 'public'
          and grantee = 'anon'
          and not (table_name = any(${POSTGIS_SYSTEM}::text[]))
        order by table_name`;
      expect(rows.map((r) => r.table)).toEqual([]);
    });

    it("authenticated has SELECT only on the four messaging tables", async () => {
      const rows = await sql!<{ t: string; p: string }[]>`
        select table_name as t, privilege_type as p
        from information_schema.role_table_grants
        where table_schema = 'public'
          and grantee = 'authenticated'
          and not (table_name = any(${POSTGIS_SYSTEM}::text[]))
        order by table_name, privilege_type`;
      const expected = MESSAGING_TABLES.map((t) => ({ t, p: "SELECT" })).sort((a, b) =>
        a.t < b.t ? -1 : a.t > b.t ? 1 : 0,
      );
      expect(rows.length).toBe(4);
      expect(rows).toEqual(expected);
    });

    it("service_role retains full access to every app table", async () => {
      const rows = await sql!<{ n: number }[]>`
        select count(distinct table_name)::int as n
        from information_schema.role_table_grants
        where table_schema = 'public'
          and grantee = 'service_role'
          and privilege_type = 'SELECT'
          and not (table_name = any(${POSTGIS_SYSTEM}::text[]))`;
      expect(rows[0].n).toBe(APP_TABLES.length);
    });
  });

  describe("security-definer helper functions are locked down", () => {
    let sql: postgres.Sql | null = null;

    beforeAll(async () => {
      sql = connect();
    }, 20_000);

    afterAll(async () => {
      await sql?.end({ timeout: 3 });
    });

    it("IDOR/trigger helpers are service_role only and current_user_id is authenticated-only", async () => {
      const rows = await sql!<{ fn: string; anon: boolean; authenticated: boolean; service_role: boolean }[]>`
        select p.proname as fn,
          has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
          has_function_privilege('authenticated', p.oid, 'EXECUTE') as "authenticated",
          has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname in ('homlo_current_user_id', 'homlo_is_blocked', 'homlo_is_conversation_member', 'homlo_sync_jobs_location')
        order by p.proname`;
      const byName = Object.fromEntries(rows.map((r) => [r.fn, r]));
      expect(byName["homlo_current_user_id"].authenticated).toBe(true);
      expect(byName["homlo_current_user_id"].anon).toBe(false);
      expect(byName["homlo_current_user_id"].service_role).toBe(true);
      for (const fn of HARDENED_FUNCTIONS) {
        expect(byName[fn].anon).toBe(false);
        expect(byName[fn].authenticated).toBe(false);
        expect(byName[fn].service_role).toBe(true);
      }
    });
  });

  describe("behavioral checks against the live project", () => {
    let sql: postgres.Sql | null = null;

    beforeAll(async () => {
      sql = connect();
    }, 20_000);

    afterAll(async () => {
      await sql?.end({ timeout: 3 });
    }, 20_000);

    const asRole = <T>(role: "anon" | "authenticated", fn: (t: postgres.TransactionSql) => Promise<T>) =>
      sql!.begin(async (t) => {
        await t.unsafe(`set local role ${role}`);
        return await fn(t);
      });

    it("anonymous clients get no Data API access to messaging data or helper RPCs", async () => {
      const read = await rest("/rest/v1/messages?select=id&limit=1");
      expect(statusIsDenied(read.status)).toBe(true);

      const rpc = await rest("/rest/v1/rpc/homlo_is_conversation_member", {
        method: "POST",
        body: JSON.stringify({ p_conversation_id: "00000000-0000-0000-0000-000000000000", p_user_id: "00000000-0000-0000-0000-000000000000" }),
      });
      expect(statusIsDenied(rpc.status)).toBe(true);

      const create = await rest("/rest/v1/jobs", {
        method: "POST",
        body: JSON.stringify({ title: "rls-audit", status: "draft" }),
      });
      expect(statusIsDenied(create.status)).toBe(true);
    }, 20_000);

    it("as the authenticated role, messaging reads return zero rows (no leakage outside member-policies)", async () => {
      const counts = await asRole("authenticated", async (t) => {
        const results: number[] = [];
        for (const table of MESSAGING_TABLES) {
          const [{ n }] = await t<{ n: number }[]>`select count(*)::int as n from public.${t.unsafe(table)}`;
          results.push(n);
        }
        return results;
      });
      expect(counts).toEqual([0, 0, 0, 0]);
    }, 20_000);

    it("as the authenticated role, homlo_current_user_id() resolves and stays callable for RLS policies", async () => {
      const [{ id }] = await asRole("authenticated", (t) =>
        t<{ id: string | null }[]>`select public.homlo_current_user_id() as id`,
      );
      expect(id).toBeNull();
    }, 20_000);

    it("as the authenticated role, zero-policy tables and hardened RPCs are still denied", async () => {
      await expect(
        asRole("authenticated", (t) => t`select count(*) from public.jobs`),
      ).rejects.toThrow(/permission denied|denied for table/);
      await expect(
        asRole("authenticated", (t) =>
          t.unsafe(`select public.homlo_is_conversation_member('00000000-0000-0000-0000-000000000000'::uuid, '00000000-0000-0000-0000-000000000000'::uuid) as m`),
        ),
      ).rejects.toThrow(/permission denied|denied for function/);
    }, 20_000);

    it("as the anon role, messaging tables are not readable", async () => {
      await expect(
        asRole("anon", (t) => t`select count(*) from public.messages`),
      ).rejects.toThrow(/permission denied|denied for table/);
    }, 20_000);
  });
});