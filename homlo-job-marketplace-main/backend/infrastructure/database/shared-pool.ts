import postgres from "postgres";

/**
 * BUGFIX: one Postgres pool for the whole server process.
 *
 * The Supabase pooler (session mode, port 5432) allows only 15 client
 * connections in total. The server used to open three separate pools against
 * it — SupabaseAdapter (max 10), the feed routes (max 10) and plan/boost
 * storage (max 5) — up to 25 connections. Under load the extra ones failed with
 * "EMAXCONNSESSION max clients reached", so feeds and lists came back empty.
 * Everything now shares this single pool, capped below the pooler limit with
 * headroom for scripts and migrations.
 */
const MAX_CONNECTIONS = 12;

const pools = new Map<string, postgres.Sql>();

export function getSharedSql(url: string): postgres.Sql {
  let sql = pools.get(url);
  if (!sql) {
    sql = postgres(url, {
      max: MAX_CONNECTIONS,
      // Keep warm connections for a while (reconnecting costs ~1s), but let a
      // quiet server hand them back to the pooler.
      idle_timeout: 120,
      prepare: true,
      ssl: "require",
    });
    pools.set(url, sql);
  }
  return sql;
}
