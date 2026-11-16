import postgres from "postgres";
import type { PlanBoostDb, Queryable } from "./hlPlanBoostService";

type PostgresSql = ReturnType<typeof postgres>;

let cached: { key: string; db: PlanBoostDb } | null = null;

export function createPlanBoostDb(sql: PostgresSql): PlanBoostDb {
  const query: Queryable["query"] = async <T = Record<string, unknown>>(text: string, params: unknown[] = []) => {
    const rows = await sql.unsafe(text, params as never[]);
    return { rows: Array.from(rows) as unknown as T[] };
  };
  return {
    query,
    transaction: async <T>(fn: (tx: Queryable) => Promise<T>) =>
      sql.begin(async (tx) => {
        const txQuery: Queryable["query"] = async <R = Record<string, unknown>>(
          text: string,
          params: unknown[] = [],
        ) => {
          const rows = await tx.unsafe(text, params as never[]);
          return { rows: Array.from(rows) as unknown as R[] };
        };
        return fn({ query: txQuery });
      }) as Promise<T>,
  };
}

export function getPlanBoostDb(env: NodeJS.ProcessEnv = process.env): PlanBoostDb {
  const url = env.SUPABASE_DB_URL ?? env.DATABASE_URL;
  if (!url) throw new Error("SUPABASE_DB_URL or DATABASE_URL is required for plan and boost storage");
  if (cached?.key === url) return cached.db;
  const sql = postgres(url, { max: 5 });
  const db = createPlanBoostDb(sql);
  cached = { key: url, db };
  return db;
}
