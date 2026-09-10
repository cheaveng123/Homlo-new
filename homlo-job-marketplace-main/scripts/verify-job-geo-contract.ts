// =========================================================
// Read-only verification of the job geo write contract against the LIVE
// Supabase Postgres (via SUPABASE_DB_URL). Confirms:
//   - public.homlo_save_job argument names (does it accept p_banner_image? lat/lng?)
//   - public.homlo_list_employer_jobs returns structured address columns?
//   - jobs table columns relevant to structured location + banner
//
// Run:   pnpm exec tsx scripts/verify-job-geo-contract.ts
//
// Read-only: information_schema / pg_proc selects only. No writes.
// =========================================================

import "dotenv/config";
import { SupabaseAdapter } from "../backend/infrastructure/database/SupabaseAdapter";

const JOBS_COLUMNS_TO_CHECK = [
  "location_text",
  "latitude",
  "longitude",
  "location",
  "city",
  "district",
  "province",
  "country",
  "postal_code",
  "address",
  "banner",
  "banner_image",
];

async function main() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const databaseUrl = process.env.SUPABASE_DB_URL;
  if (!url || !serviceRoleKey || !databaseUrl) {
    console.error("SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL are required (check .env)");
    process.exit(1);
  }

  const adapter = new SupabaseAdapter({ url, serviceRoleKey, databaseUrl });

  try {
    const jobsColumns = await adapter.query<{ column_name: string; data_type: string }>(
      `select column_name, data_type from information_schema.columns
       where table_schema = 'public' and table_name = 'jobs'
       order by ordinal_position`,
    );
    const present = jobsColumns.rows.map((r) => r.column_name);
    console.log("--- jobs columns (live) ---");
    console.log(present.join(", ") || "(none)");
    for (const col of JOBS_COLUMNS_TO_CHECK) {
      const hit = jobsColumns.rows.find((r) => r.column_name === col);
      console.log(`  jobs.${col}: ${hit ? hit.data_type : "MISSING"}`);
    }

    const fnArgs = await adapter.query<{ proname: string; proargnames: string[] | null }>(
      `select p.proname, p.proargnames
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname in ('homlo_save_job', 'homlo_list_employer_jobs')`,
    );
    for (const fn of fnArgs.rows) {
      console.log(`\n--- ${fn.proname} arguments (live) ---`);
      console.log((fn.proargnames ?? []).join(", "));
    }
  } finally {
    await adapter.close();
  }
}

main();