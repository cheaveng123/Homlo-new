import { createClient, type User } from "@supabase/supabase-js";
import postgres from "postgres";

import type { DatabaseAdapter, QueryResult, SqlParameter } from "./DatabaseAdapter";

type QueryExecutor = {
  unsafe: (statement: string, parameters?: readonly unknown[]) => Promise<unknown[]>;
};

export type SupabaseAdapterConfig = {
  url: string;
  serviceRoleKey: string;
  databaseUrl?: string;
};

export type SupabaseIssuedSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number | null;
  expiresIn: number | null;
};

/**
 * The only infrastructure file that imports and talks to Supabase directly.
 * Repositories receive DatabaseAdapter, never a Supabase client or provider type.
 */
export class SupabaseAdapter implements DatabaseAdapter {
  private readonly client;
  private readonly sql: ReturnType<typeof postgres> | null;
  private readonly url: string;
  private readonly serviceRoleKey: string;

  constructor(config: SupabaseAdapterConfig) {
    this.url = config.url.replace(/\/+$/, "");
    this.serviceRoleKey = config.serviceRoleKey;
    this.client = createClient(config.url, config.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    this.sql = config.databaseUrl
      ? postgres(config.databaseUrl, {
          idle_timeout: 20,
          max: 10,
          prepare: true,
          ssl: "require",
        })
      : null;
  }

  async query<Row extends Record<string, unknown> = Record<string, unknown>>(
    statement: string,
    parameters: readonly SqlParameter[] = [],
  ): Promise<QueryResult<Row>> {
    return queryWith(this.requireTransactionalConnection() as unknown as QueryExecutor, statement, parameters);
  }

  async transaction<T>(work: (database: DatabaseAdapter) => Promise<T>): Promise<T> {
    const result = await this.requireTransactionalConnection().begin(async (transactionSql) => work(new TransactionAdapter(transactionSql as unknown as QueryExecutor)));
    return result as unknown as T;
  }

  async getStorageUrl(bucket: string, key: string): Promise<string> {
    const { data, error } = await this.client.storage.from(bucket).createSignedUrl(key, 60 * 10);
    if (error || !data?.signedUrl) throw new Error(`Unable to resolve storage key: ${error?.message ?? key}`);
    return data.signedUrl;
  }

  async uploadStorage(bucket: string, key: string, file: Uint8Array, contentType: string): Promise<void> {
    const { error } = await this.client.storage.from(bucket).upload(key, file, { contentType, upsert: false });
    if (error) throw new Error(`Unable to upload storage object: ${error.message}`);
  }

  async deleteStorage(bucket: string, key: string): Promise<void> {
    const { error } = await this.client.storage.from(bucket).remove([key]);
    if (error) throw new Error(`Unable to delete storage object: ${error.message}`);
  }

  async verifySupabaseToken(token: string): Promise<User | null> {
    const { data, error } = await this.client.auth.getUser(token);
    if (error) return null;
    return data.user ?? null;
  }

  async signUpWithEmailPassword(email: string, password: string, fullName?: string): Promise<{ user: User | null; session: SupabaseIssuedSession | null }> {
    const { data, error } = await this.client.auth.signUp({
      email,
      password,
      options: fullName ? { data: { full_name: fullName } } : undefined,
    });
    if (error) throw new Error(error.message);
    return { user: data.user ?? null, session: mapIssuedSession(data.session) };
  }

  async signInWithEmailPassword(email: string, password: string): Promise<{ user: User | null; session: SupabaseIssuedSession | null }> {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    return { user: data.user ?? null, session: mapIssuedSession(data.session) };
  }

  async refreshAuthSession(refreshToken: string): Promise<{ user: User | null; session: SupabaseIssuedSession | null }> {
    const { data, error } = await this.client.auth.refreshSession({ refresh_token: refreshToken });
    if (error) throw new Error(error.message);
    return { user: data.user ?? null, session: mapIssuedSession(data.session) };
  }

  async signOutAuthSession(accessToken: string): Promise<void> {
    const response = await fetch(`${this.url}/auth/v1/logout`, {
      method: "POST",
      headers: { apikey: this.serviceRoleKey, Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok && response.status !== 401) {
      throw new Error("Unable to close the Supabase authentication session");
    }
  }

  async invokeAuthenticatedFunction<T>(functionName: string, accessToken: string, body: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${this.url}/functions/v1/${functionName}`, {
      method: "POST",
      headers: {
        apikey: this.serviceRoleKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({ error: "Supabase service request failed" }));
    if (!response.ok) {
      throw new Error(typeof data?.error === "string" ? data.error : "Supabase service request failed");
    }
    return data as T;
  }

  async invokePublicFunction<T>(functionName: string): Promise<T> {
    const response = await fetch(`${this.url}/functions/v1/${functionName}`, {
      method: "GET",
      headers: { apikey: this.serviceRoleKey },
    });
    const data = await response.json().catch(() => ({ error: "Supabase public service request failed" }));
    if (!response.ok) {
      throw new Error(typeof data?.error === "string" ? data.error : "Supabase public service request failed");
    }
    return data as T;
  }

  async close(): Promise<void> {
    if (this.sql) await this.sql.end({ timeout: 5 });
  }

  private requireTransactionalConnection(): ReturnType<typeof postgres> {
    if (!this.sql) {
      throw new Error("A direct Postgres URL is not configured; use the approved Supabase Edge Function gateway for transactional service operations.");
    }
    return this.sql;
  }
}

function mapIssuedSession(session: { access_token: string; refresh_token: string; expires_at?: number; expires_in?: number } | null): SupabaseIssuedSession | null {
  if (!session) return null;
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at ?? null,
    expiresIn: session.expires_in ?? null,
  };
}

class TransactionAdapter implements DatabaseAdapter {
  constructor(private readonly executor: QueryExecutor) {}

  async query<Row extends Record<string, unknown> = Record<string, unknown>>(
    statement: string,
    parameters: readonly SqlParameter[] = [],
  ): Promise<QueryResult<Row>> {
    return queryWith(this.executor, statement, parameters);
  }

  async transaction<T>(work: (database: DatabaseAdapter) => Promise<T>): Promise<T> {
    return work(this);
  }
}

async function queryWith<Row extends Record<string, unknown>>(
  executor: QueryExecutor,
  statement: string,
  parameters: readonly SqlParameter[],
): Promise<QueryResult<Row>> {
  const rows = (await executor.unsafe(statement, [...parameters])) as Row[];
  return { rows, rowCount: rows.length };
}
