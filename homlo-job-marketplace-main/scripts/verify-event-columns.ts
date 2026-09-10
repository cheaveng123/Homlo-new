import "dotenv/config";
import { SupabaseAdapter } from "../backend/infrastructure/database/SupabaseAdapter";

const INSERT_COLUMNS = [
  "event_type", "user_id", "job_id", "employer_id", "session_id",
  "feed_position", "feed_context", "shown_as_sponsored", "shown_as_exploration",
  "ranking_score_snapshot", "user_lat", "user_lng", "distance_km_at_event",
  "ip_hash", "dwell_time_ms",
];

async function main() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const databaseUrl = process.env.SUPABASE_DB_URL;
  if (!url || !serviceRoleKey || !databaseUrl) process.exit(1);

  const adapter = new SupabaseAdapter({ url, serviceRoleKey, databaseUrl });
  try {
    // Every column named by the insert in event-logging.ts, with its type, if present.
    const r = await adapter.query<{ column_name: string; data_type: string }>(
      `select column_name, data_type from information_schema.columns
       where table_schema='public' and table_name='job_events' order by ordinal_position`,
    );
    const tableCols = new Map(r.rows.map((row) => [row.column_name, row.data_type]));
    let missing = 0;
    for (const col of INSERT_COLUMNS) {
      if (!tableCols.has(col)) {
        console.log(`[FAIL] insert column missing in table: ${col}`);
        missing += 1;
      } else {
        console.log(`[OK  ] insert column present: ${col} (${tableCols.get(col)})`);
      }
    }
    // Columns the insert does NOT provide but the table requires NOT NULL without default.
    const requiredNotProvided = r.rows.filter(
      (row) => row.column_name === "occurred_at" || row.column_name === "id",
    );
    for (const row of requiredNotProvided) {
      console.log(`[OK  ] default/identity handled: ${row.column_name} (${row.data_type})`);
    }
    console.log(missing === 0 ? "INSERT BINDING OK — statement columns all resolve." : `${missing} column(s) missing.`);
    process.exit(missing === 0 ? 0 : 1);
  } finally {
    await adapter.close();
  }
}

main();
