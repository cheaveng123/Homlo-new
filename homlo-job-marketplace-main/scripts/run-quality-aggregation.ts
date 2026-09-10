// =========================================================
// Manual/admin trigger for the phase 8 quality aggregation.
//
// Internal service/command ONLY — never exposed as a public endpoint. Runs the
// deterministic full recomputation and writes the snapshot atomically.
//
//   pnpm agg:quality
//
// Required environment (same as the server): SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL.
//
// Production scheduling: run this script on the deployed host (e.g. a Render
// cron service, GitHub Actions schedule, or the platform's scheduler) at least
// once a day, or on demand after ingestion spikes. See
// backend/ranking/README.md → Phase 8 for the exact scheduling notes and
// alternatives (pg_cron hosted on Supabase invokes SQL — not this Node job — so
// the Node job belongs on the Node host).
// =========================================================

import "dotenv/config";
import { SupabaseAdapter } from "../backend/infrastructure/database/SupabaseAdapter";
import { QualityAggregationService } from "../backend/ranking/quality-aggregation-service";

async function main() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const databaseUrl = process.env.SUPABASE_DB_URL;
  if (!url || !serviceRoleKey || !databaseUrl) {
    console.error("SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_DB_URL are required");
    process.exit(1);
  }

  const adapter = new SupabaseAdapter({ url, serviceRoleKey, databaseUrl });
  const service = new QualityAggregationService(adapter, { logger: (line) => console.log(`[quality-aggregation] ${line}`) });

  try {
    const report = await service.run();
    console.log(JSON.stringify(report, null, 2));
    await adapter.close();
    if (!report.ok || !report.ran) process.exit(1);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    await adapter.close();
    process.exit(1);
  }
}

main();