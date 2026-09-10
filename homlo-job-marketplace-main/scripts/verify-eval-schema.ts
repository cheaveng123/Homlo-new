// =========================================================
// Schema verification for the ranking/event stack (Phase: post-migration).
// Connects to the REAL Supabase Postgres (via SUPABASE_DB_URL) and confirms the
// tables/columns the ranking + event-logging code depends on now exist.
//
// Run:   pnpm exec tsx scripts/verify-eval-schema.ts
//
// Read-only: issues only information_schema SELECTs + safe existence probes.
// =========================================================

import "dotenv/config";
import { SupabaseAdapter } from "../backend/infrastructure/database/SupabaseAdapter";

const TABLES = [
  "job_events",
  "job_quality_stats",
  "employer_quality_stats",
  "boosts",
] as const;

const JOBS_GEO_COLUMN = "location";
const JOB_COLUMNS_REQUIRED = [
  "latitude",
  "longitude",
  "location",
] as const;

async function tableExists(adapter: SupabaseAdapter, table: string): Promise<boolean> {
  const r = await adapter.query<{ n: number }>(
    `select count(*)::int as n from information_schema.tables where table_schema = 'public' and table_name = $1`,
    [table],
  );
  return (r.rows[0]?.n ?? 0) > 0;
}

async function columnExists(adapter: SupabaseAdapter, table: string, column: string): Promise<boolean> {
  const r = await adapter.query<{ n: number }>(
    `select count(*)::int as n from information_schema.columns where table_schema = 'public' and table_name = $1 and column_name = $2`,
    [table, column],
  );
  return (r.rows[0]?.n ?? 0) > 0;
}

async function triggerExists(adapter: SupabaseAdapter, name: string): Promise<boolean> {
  const r = await adapter.query<{ n: number }>(
    `select count(*)::int as n from information_schema.triggers where trigger_name = $1`,
    [name],
  );
  return (r.rows[0]?.n ?? 0) > 0;
}

async function postgisEnabled(adapter: SupabaseAdapter): Promise<boolean> {
  const r = await adapter.query<{ n: number }>(
    `select count(*)::int as n from pg_extension where extname = 'postgis'`,
  );
  return (r.rows[0]?.n ?? 0) > 0;
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const databaseUrl = process.env.SUPABASE_DB_URL;
  if (!url || !serviceRoleKey || !databaseUrl) {
    console.error("SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL are required");
    process.exit(1);
  }

  const adapter = new SupabaseAdapter({ url, serviceRoleKey, databaseUrl });
  const results: { check: string; ok: boolean; detail?: string }[] = [];

  try {
    for (const table of TABLES) {
      const exists = await tableExists(adapter, table);
      results.push({ check: `table public.${table}`, ok: exists });
    }

    for (const col of JOB_COLUMNS_REQUIRED) {
      const exists = await columnExists(adapter, "jobs", col);
      results.push({ check: `jobs.${col}`, ok: exists });
    }

    const postgis = await postgisEnabled(adapter);
    results.push({ check: "postgis extension enabled", ok: postgis, detail: postgis ? "geography/ST_* available" : "geography type NOT available" });

    const trigger = await triggerExists(adapter, "trg_homlo_jobs_location_sync");
    results.push({ check: "trigger trg_homlo_jobs_location_sync on jobs", ok: trigger });

    // --- Direct probe of the previously-failing statement's target table -------
    const count = await adapter.query<{ c: unknown }>(`select count(*)::text as c from public.job_events`);
    results.push({ check: "SELECT from public.job_events", ok: true, detail: `rows=${count.rows[0]?.c ?? 0}` });

    const geoType = await adapter.query<{ t: string }>(
      `select data_type as t from information_schema.columns where table_schema='public' and table_name='jobs' and column_name='location'`,
    );
    results.push({
      check: "jobs.location data_type (should be 'USER-DEFINED' = geography)",
      ok: geoType.rows[0]?.t === "USER-DEFINED",
      detail: `${geoType.rows[0]?.t}`,
    });
  } finally {
    await adapter.close();
  }

  let failed = 0;
  for (const r of results) {
    const mark = r.ok ? "OK  " : "FAIL";
    if (!r.ok) failed += 1;
    console.log(`[${mark}] ${r.check}${r.detail ? ` — ${r.detail}` : ""}`);
  }
  console.log("");
  console.log(failed === 0 ? "ALL CHECKS PASSED — schema is accessible." : `${failed} check(s) FAILED.`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
