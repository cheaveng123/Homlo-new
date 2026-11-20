import { createClient, type User } from "@supabase/supabase-js";
import { getSharedSql } from "./shared-pool";
import postgres from "postgres";

import type { DatabaseAdapter, QueryResult, SqlParameter } from "./DatabaseAdapter";

type QueryExecutor = {
  unsafe: (statement: string, parameters?: readonly unknown[]) => Promise<unknown[]>;
};

const RPC_TIMEOUT_MS = 30_000;

/** Fetch with an AbortController-based timeout; rejects after deadline. */
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Race a promise against a deadline; rejects after deadline. */
function promiseWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Request timed out")), timeoutMs)),
  ]);
}

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
  private readonly storageClient;
  private readonly sql: ReturnType<typeof postgres> | null;
  private readonly url: string;
  private readonly serviceRoleKey: string;

  constructor(config: SupabaseAdapterConfig) {
    this.url = config.url.replace(/\/+$/, "");
    this.serviceRoleKey = config.serviceRoleKey;
    this.client = createClient(config.url, config.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    // Dedicated service-role client for Storage only. It is never used for
    // auth sign-in/refresh, so it never picks up a user session: storage
    // uploads bypass RLS deterministically instead of riding whichever user
    // last authenticated on the shared client.
    this.storageClient = createClient(config.url, config.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    // One shared pool per process (see shared-pool.ts for why).
    this.sql = config.databaseUrl ? getSharedSql(config.databaseUrl) : null;
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
    const { data, error } = await this.storageClient.storage.from(bucket).createSignedUrl(key, 60 * 10);
    if (error || !data?.signedUrl) throw new Error(`Unable to resolve storage key: ${error?.message ?? key}`);
    return data.signedUrl;
  }

  async uploadStorage(bucket: string, key: string, file: Uint8Array, contentType: string): Promise<void> {
    const { error } = await this.storageClient.storage.from(bucket).upload(key, file, { contentType, upsert: false });
    if (error) throw new Error(`Unable to upload storage object: ${error.message}`);
  }

  async deleteStorage(bucket: string, key: string): Promise<void> {
    const { error } = await this.storageClient.storage.from(bucket).remove([key]);
    if (error) throw new Error(`Unable to delete storage object: ${error.message}`);
  }

  /** Deletes the Supabase auth user (account deletion). Missing users are fine. */
  async deleteAuthUser(authUserId: string): Promise<void> {
    const { error } = await this.client.auth.admin.deleteUser(authUserId);
    if (error && (error as { status?: number }).status !== 404) {
      throw new Error(`Unable to delete the sign-in account: ${error.message}`);
    }
  }

  async verifySupabaseToken(token: string): Promise<User | null> {
    const getUser = this.client.auth.getUser(token);
    let result: Awaited<typeof getUser>;
    try {
      result = await promiseWithTimeout(getUser, RPC_TIMEOUT_MS);
    } catch (cause) {
      // Timeout / transport failure: the token may be fine.
      throw Object.assign(new Error(cause instanceof Error ? cause.message : "Auth check timed out"), { authUnavailable: true });
    }
    const { data, error } = result;
    if (error) {
      // BUGFIX: only a real rejection means "invalid token". A network error or
      // Supabase 5xx used to look identical, so an outage signed users out.
      const status = (error as { status?: number }).status;
      if (typeof status === "number" && status >= 400 && status < 500) return null;
      throw Object.assign(new Error(this.describeAuthError(error)), { authUnavailable: true });
    }
    return data.user ?? null;
  }

  /**
   * Supabase's client surfaces transport failures (DNS failure, connection
   * refused, timeouts) as a bare "fetch failed". Keep genuine auth errors
   * (e.g. "Invalid login credentials") intact, but make an unreachable project
   * actionable instead of opaque.
   */
  private describeAuthError(error: { message?: string } | null | undefined): string {
    const message = error?.message ?? "Authentication request failed";
    if (/fetch failed|failed to fetch|network request failed|ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(message)) {
      let host = this.url;
      try {
        host = new URL(this.url).host;
      } catch {
        // Keep the raw URL if it cannot be parsed.
      }
      return `Unable to reach the authentication service at ${host}. The Supabase project may be paused or deleted — verify SUPABASE_URL and your network connection.`;
    }
    return message;
  }

  async signUpWithEmailPassword(email: string, password: string, fullName?: string): Promise<{ user: User | null; session: SupabaseIssuedSession | null }> {
    const { data, error } = await this.client.auth.signUp({
      email,
      password,
      options: fullName ? { data: { full_name: fullName } } : undefined,
    });
    if (error) throw new Error(this.describeAuthError(error));
    return { user: data.user ?? null, session: mapIssuedSession(data.session) };
  }

  /**
   * Creates the account already email-confirmed (service-role admin API) and
   * immediately signs it in, so a new member is logged in on account creation
   * regardless of the project's "Confirm email" setting.
   *
   * Throws when the account cannot be created (including when the address is
   * already registered — the route answers that with the same generic error as
   * any other failure, so sign-up never reveals which emails have accounts).
   * If the account is created but the follow-up sign-in fails, returns
   * `session: null` so the caller can ask the person to log in normally.
   */
  async createConfirmedUserAndSignIn(
    email: string,
    password: string,
    fullName?: string,
  ): Promise<{ user: User | null; session: SupabaseIssuedSession | null }> {
    const { data: created, error: createError } = await this.client.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: fullName ? { full_name: fullName } : undefined,
    });
    if (createError) throw new Error(this.describeAuthError(createError));

    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) {
      console.error("[SupabaseAdapter] account created but auto sign-in failed", this.describeAuthError(error));
      return { user: created.user ?? null, session: null };
    }
    return { user: data.user ?? created.user ?? null, session: mapIssuedSession(data.session) };
  }

  async signInWithEmailPassword(email: string, password: string): Promise<{ user: User | null; session: SupabaseIssuedSession | null }> {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw new Error(this.describeAuthError(error));
    return { user: data.user ?? null, session: mapIssuedSession(data.session) };
  }

  async refreshAuthSession(refreshToken: string): Promise<{ user: User | null; session: SupabaseIssuedSession | null }> {
    const { data, error } = await this.client.auth.refreshSession({ refresh_token: refreshToken });
    if (error) throw new Error(this.describeAuthError(error));
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
    let response: Response;
    try {
      response = await fetchWithTimeout(`${this.url}/functions/v1/${functionName}`, {
        method: "POST",
        headers: {
          apikey: this.serviceRoleKey,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }, RPC_TIMEOUT_MS);
    } catch (cause) {
      // Timeout / network: a temporary outage, not a bad session.
      throw Object.assign(new Error(cause instanceof Error ? cause.message : "Supabase service request failed"), {
        authUnavailable: true,
        status: 503,
      });
    }
    const data = await response.json().catch(() => ({ error: "Supabase service request failed" }));
    if (!response.ok) {
      console.error("[supabase:gateway] authenticated function failed", {
        functionName,
        status: response.status,
        statusText: response.statusText,
        response: data,
      });
      // BUGFIX: carry the status so callers can tell a rejected session (4xx)
      // from an edge-function outage/cold-start failure (5xx), which used to
      // be reported as "not authenticated" and sign the user out.
      throw Object.assign(new Error(typeof data?.error === "string" ? data.error : "Supabase service request failed"), {
        status: response.status,
        authUnavailable: response.status >= 500,
      });
    }
    return data as T;
  }

  async invokePublicFunction<T>(functionName: string): Promise<T> {
    const feedSecret = process.env.HOMLO_FEED_SECRET;
    const response = await fetch(`${this.url}/functions/v1/${functionName}`, {
      method: "GET",
      headers: {
        apikey: this.serviceRoleKey,
        ...(feedSecret ? { "x-homlo-feed-secret": feedSecret } : {}),
      },
    });
    const data = await response.json().catch(() => ({ error: "Supabase public service request failed" }));
    if (!response.ok) {
      console.error("[supabase:gateway] public function failed", {
        functionName,
        status: response.status,
        statusText: response.statusText,
        response: data,
      });
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
  const startedAt = Date.now();
  const rows = (await executor.unsafe(statement, [...parameters])) as Row[];
  logIfSlow(statement, Date.now() - startedAt, rows.length);
  return { rows, rowCount: rows.length };
}

/**
 * PERF guardrail: logs any query slower than SLOW_QUERY_MS (default 200ms).
 * Only the SQL text (with $n placeholders) is logged — never the parameter
 * values, so no emails, tokens or user ids reach the logs.
 */
const SLOW_QUERY_MS = Number(process.env.SLOW_QUERY_MS) > 0 ? Number(process.env.SLOW_QUERY_MS) : 200;

export function logIfSlow(statement: string, durationMs: number, rowCount: number): void {
  if (durationMs < SLOW_QUERY_MS) return;
  const sql = statement.replace(/\s+/g, " ").trim().slice(0, 200);
  console.warn(`[db] slow query ${durationMs}ms rows=${rowCount}: ${sql}`);
}
