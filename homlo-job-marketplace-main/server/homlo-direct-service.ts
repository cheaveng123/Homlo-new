import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";

import {
  PROFILE_PHOTOS_BUCKET,
  PROFILE_PHOTO_MAX_BYTES,
} from "../lib/profile-photo-shared";
import { JOB_IMAGES_BUCKET, buildPublicJobImageUrl } from "../lib/job-images-shared";
import { AGE_MAX, AGE_MIN } from "../lib/age";
import { SupabaseAdapter, type SupabaseIssuedSession } from "../backend/infrastructure/database/SupabaseAdapter";
import type { WorkArrangement } from "../backend/domain/work-arrangement";
import { CandidateRetrievalService, type RetrievalInput, type RetrievalResult } from "../backend/ranking/candidate-retrieval";
import { RankingScoringService, type ScoreCandidatesInput, type ScoredCandidate } from "../backend/ranking/scoring-service";
import { RecommendationFeedService, type FeedAssemblyResult } from "../backend/ranking/recommendation-feed";
import { HomeFeedService, type HomeFeedInput, type HomeFeedResult } from "./home-feed";
import { EventLoggingService, type EventLogResult, type HomloEventLogInput } from "./event-logging";
import { createHash } from "node:crypto";
import { TtlCache } from "./_core/ttl-cache";

// PERF: cache lifetimes for hot read paths. Kept short so new posts/edits show
// up quickly; any write request also clears them (see invalidateAfterWrite).
const SESSION_CACHE_TTL_MS = 20_000;
const PUBLIC_JOBS_CACHE_TTL_MS = 15_000;
const SEARCH_CACHE_TTL_MS = 15_000;
const CATEGORIES_CACHE_TTL_MS = 10 * 60_000;
// Public employer profile (name, photo, banner, bio, coarse location).
const EMPLOYER_PROFILE_CACHE_TTL_MS = 60_000;

export type EmployerPublicProfile = {
  fullName: string | null; profilePhotoKey: string | null;
  bannerImage: string | null; verified: boolean; about: string | null;
  locationText: string | null; latitude: number | null; longitude: number | null;
};
// After the TTL, keep serving the last value instantly while one background
// refresh runs. Writes clear these caches outright, so they are never stale.
const PUBLIC_STALE_WHILE_REVALIDATE_MS = 5 * 60_000;

/**
 * Makes a row from `homlo_list_public_published_jobs()` read over postgres.js
 * identical to what the edge function returned via PostgREST JSON: numeric →
 * number, timestamptz → ISO string, and only http(s) banner URLs.
 */
function normalizePublicJobRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row };
  for (const [key, value] of Object.entries(out)) {
    if (value instanceof Date) out[key] = value.toISOString();
  }
  if (typeof out.pay_amount === "string") {
    const n = Number(out.pay_amount);
    out.pay_amount = Number.isFinite(n) ? n : null;
  }
  const banner = typeof out.banner_image === "string" ? out.banner_image.trim() : "";
  out.banner_image = /^https?:\/\//i.test(banner) ? banner : null;
  return out;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function tokenKey(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export const SUPABASE_ACCESS_COOKIE = "homlo_supabase_access";
export const SUPABASE_REFRESH_COOKIE = "homlo_supabase_refresh";

export type HomloSessionUser = {
  id: string;
  status: "active" | "suspended" | "banned";
  profileComplete: boolean;
  role: "worker" | "employer" | "both" | null;
  fullName: string | null;
  email: string | null;
};

export type HomloAuthResult = {
  user: HomloSessionUser;
  session: SupabaseIssuedSession;
};

export type PublishedJobRecord = {
  id: string;
  title: string;
  description: string;
  pay_amount: number | string;
  pay_currency: string;
  pay_type: "hourly" | "daily" | "fixed";
  location_text: string | null;
  work_arrangement: WorkArrangement | null;
  latitude: number | null;
  longitude: number | null;
  workers_needed: number;
  created_at: string;
  category: string;
  employer_name: string | null;
  employer_photo_key: string | null;
  banner_image?: string | null;
  status?: string | null;
  workers_hired?: number | null;
  boosted?: boolean;
  /** 059_job_work_time.sql; null/absent = not set. */
  work_days?: string[] | null;
  clock_in?: string | null;
  clock_out?: string | null;
  pay_amount_max?: number | null;
};

export type SearchJobRecord = PublishedJobRecord & {
  relevance_score: number;
  banner_image: string | null;
};

/** Rounds a coordinate to 2 decimals (about 1.1 km) so a public profile never shows an exact location. */
export function coarsenCoordinate(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function toIso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

/**
 * Maps a missing-column error (migration 055 not applied yet) to a clear
 * message instead of leaking raw SQL errors to the client.
 */
function ageStorageError(error: unknown): Error {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === "42703" || (error instanceof Error && /column .*age.* does not exist/i.test(error.message))) {
    console.error("[homlo-direct-service] users.age is missing — apply backend/database/migrations/055_user_age.sql", error);
    return new Error("Saving your age isn't available yet. Please try again shortly.");
  }
  console.error("[homlo-direct-service] age storage failed", error);
  return new Error("We could not save your age. Please try again.");
}

export type AdultStatus = { isAdult: boolean | null; suggested: boolean | null; confirmedAt: string | null };

function adultStorageError(error: unknown): Error {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === "42703" || (error instanceof Error && /column .*(is_adult|age).* does not exist/i.test(error.message))) {
    console.error("[homlo-direct-service] users.is_adult is missing — apply backend/database/migrations/056_user_adult_confirmation.sql", error);
    return new Error("The age check isn't available yet. Please try again shortly.");
  }
  console.error("[homlo-direct-service] age check storage failed", error);
  return new Error("We could not save your age check. Please try again.");
}

export class HomloDirectService {
  constructor(private readonly adapter: SupabaseAdapter) {}

  // PERF: before this cache every authenticated request paid for TWO Supabase
  // round trips in createContext (getUser + gateway "session"), and every
  // invoke() paid for the same two AGAIN before doing its real work.
  private readonly sessionCache = new TtlCache<HomloSessionUser>(SESSION_CACHE_TTL_MS, 2_000);
  private readonly publicJobsCache = new TtlCache<{ jobs: PublishedJobRecord[] }>(PUBLIC_JOBS_CACHE_TTL_MS, 1, PUBLIC_STALE_WHILE_REVALIDATE_MS);
  private readonly searchCache = new TtlCache<{ jobs: SearchJobRecord[]; total: number }>(SEARCH_CACHE_TTL_MS, 300, PUBLIC_STALE_WHILE_REVALIDATE_MS);
  private readonly categoriesCache = new TtlCache<{ categories: { id: string; name: string; slug: string }[] }>(CATEGORIES_CACHE_TTL_MS, 1, 60 * 60_000);
  private readonly employerProfileCache = new TtlCache<EmployerPublicProfile | null>(EMPLOYER_PROFILE_CACHE_TTL_MS, 500);
  private readonly publicJobCache = new TtlCache<{ job: PublishedJobRecord | null }>(PUBLIC_JOBS_CACHE_TTL_MS, 1_000);

  /**
   * Called after any write request. Drops the caller's cached session (role,
   * profileComplete, etc. may have changed) and the public job lists (a job
   * may have been posted, edited, closed, boosted or applied to).
   */
  /**
   * PERF: called once at server start. Opens the DB pool (first connect
   * measured ~1.5–7s) and fills the public job list cache, so the first user
   * after a deploy/restart doesn't pay for it.
   */
  async warmUp(): Promise<void> {
    const startedAt = Date.now();
    try {
      await Promise.all([this.listPublishedJobs(), this.listCategories()]);
      console.log(`[api] caches warmed in ${Date.now() - startedAt}ms`);
    } catch (error) {
      console.warn("[api] cache warm-up failed (will load on first request)", error instanceof Error ? error.message : error);
    }
  }

  /**
   * Readiness probe: one trivial query with a short timeout, so a load
   * balancer can stop sending traffic to an instance that can't reach the DB.
   */
  async checkDatabase(timeoutMs = 2_000): Promise<{ ok: boolean; latencyMs: number }> {
    const startedAt = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        this.adapter.query(`select 1 as ok`),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error("database health check timed out")), timeoutMs);
        }),
      ]);
      return { ok: true, latencyMs: Date.now() - startedAt };
    } catch {
      return { ok: false, latencyMs: Date.now() - startedAt };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /** Drops only the caller's cached session (writes with no listing impact). */
  invalidateSessionAfterWrite(accessToken: string | null): void {
    if (accessToken) this.sessionCache.delete(tokenKey(accessToken));
  }

  invalidateAfterWrite(accessToken: string | null): void {
    this.invalidateSessionAfterWrite(accessToken);
    this.publicJobsCache.clear();
    this.searchCache.clear();
    this.employerProfileCache.clear();
    this.publicJobCache.clear();
  }

  private eventLogger: EventLoggingService | null = null;

  async logEvent(
    input: HomloEventLogInput,
    meta: { ip: string | null; userId: string | null },
  ): Promise<EventLogResult> {
    if (!this.eventLogger) {
      this.eventLogger = new EventLoggingService(this.adapter);
    }
    return this.eventLogger.log(input, meta);
  }

  private candidateRetriever: CandidateRetrievalService | null = null;

  async retrieveCandidates(input: RetrievalInput): Promise<RetrievalResult> {
    if (!this.candidateRetriever) {
      this.candidateRetriever = new CandidateRetrievalService(this.adapter);
    }
    return this.candidateRetriever.retrieve(input);
  }

  private scoringService: RankingScoringService | null = null;

  async scoreCandidates(input: ScoreCandidatesInput): Promise<ScoredCandidate[]> {
    if (!this.scoringService) {
      this.scoringService = new RankingScoringService(this.adapter);
    }
    return this.scoringService.scoreCandidates(input);
  }

  private recommendationFeed: RecommendationFeedService | null = null;

  /**
   * Phase 7 personalized job feed. The user id MUST come from the resolved
   * session (never from a request body); the worker's location is derived
   * server-side from `profiles` so stale/invalid/missing coordinates degrade
   * deterministically instead of trusting the client.
   */
  async getRecommendedJobs(input: {
    userId: string;
    pageSize?: number;
    cursor?: string | null;
  }): Promise<FeedAssemblyResult> {
    if (!this.recommendationFeed) {
      this.recommendationFeed = new RecommendationFeedService(this.adapter);
    }
    return this.recommendationFeed.getFeed({
      userId: input.userId,
      userLocation: await this.loadWorkerLocation(input.userId),
      preferences: null,
      pageSize: input.pageSize,
      cursor: input.cursor ?? null,
      now: new Date(),
    });
  }

  private homeFeed: HomeFeedService | null = null;

  /**
   * Server-composed homepage feed. The userId (when present) derives from the
   * resolved session and is verified against `profiles` before the personalized
   * recommendation section is built; anonymous visitors get no synthetic
   * ranking, so `homefeed` stays public and data-driven.
   */
  async getHomeFeed(input: HomeFeedInput): Promise<HomeFeedResult> {
    if (!this.homeFeed) {
      this.homeFeed = new HomeFeedService(this.adapter);
    }
    const userId = input.userId ?? null;
    const userLocation = userId ? await this.loadWorkerLocation(userId) : null;
    return this.homeFeed.getHomeFeed({ ...input, userId, userLocation });
  }

  /** Reads the worker's authoritative coordinates from `profiles`; a missing, deleted, out-of-range or non-finite row yields null (unknown location). */
  private async loadWorkerLocation(userId: string): Promise<{ latitude: number; longitude: number } | null> {
    if (!userId) return null;
    const { rows } = await this.adapter.query<{ latitude: number | null; longitude: number | null }>(
      `select latitude, longitude from profiles where user_id = $1 and deleted_at is null limit 1`,
      [userId],
    );
    const row = rows[0];
    if (!row) return null;
    const latitude = Number(row.latitude);
    const longitude = Number(row.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
    return { latitude, longitude };
  }

  async signUp(email: string, password: string, fullName?: string): Promise<HomloAuthResult | { confirmationRequired: true }> {
    // Auto-login on account creation: the account is created confirmed and
    // signed in at once. `confirmationRequired` now only means "account made,
    // but the follow-up sign-in failed — log in normally".
    const issued = await this.adapter.createConfirmedUserAndSignIn(email, password, fullName);
    if (!issued.session) return { confirmationRequired: true };
    return { user: await this.resolveSession(issued.session.accessToken), session: issued.session };
  }

  async signIn(email: string, password: string): Promise<HomloAuthResult> {
    const issued = await this.adapter.signInWithEmailPassword(email, password);
    if (!issued.session) throw new Error("Supabase did not issue an authentication session");
    return { user: await this.resolveSession(issued.session.accessToken), session: issued.session };
  }

  async refresh(refreshToken: string): Promise<HomloAuthResult> {
    const issued = await this.adapter.refreshAuthSession(refreshToken);
    if (!issued.session) throw new Error("Supabase did not refresh the authentication session");
    // The refresh token is already rotated at this point, so a transient
    // gateway failure here must not lose the new session: retry briefly.
    let lastError: unknown;
    for (const delayMs of [0, 800, 2_000]) {
      if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
      try {
        return { user: await this.resolveSession(issued.session.accessToken), session: issued.session };
      } catch (error) {
        lastError = error;
        if (!(error as { authUnavailable?: boolean } | null)?.authUnavailable) break;
      }
    }
    throw lastError;
  }

  /**
   * Verifies the token and loads the Homlo user. Cached per token for
   * SESSION_CACHE_TTL_MS; pass `{ fresh: true }` for the authoritative
   * /me check so profile/role changes are never served stale there.
   */
  async resolveSession(accessToken: string, options?: { fresh?: boolean }): Promise<HomloSessionUser> {
    const key = tokenKey(accessToken);
    if (options?.fresh) this.sessionCache.delete(key);
    return this.sessionCache.get(key, () => this.resolveSessionUncached(accessToken));
  }

  private async resolveSessionUncached(accessToken: string): Promise<HomloSessionUser> {
    const verified = await this.adapter.verifySupabaseToken(accessToken);
    if (!verified) throw new Error("Invalid Supabase authentication token");
    const response = await this.adapter.invokeAuthenticatedFunction<HomloSessionUser>("homlo-service-gateway", accessToken, { action: "session" });
    return response;
  }

  async invoke<T>(accessToken: string, action: string, payload: Record<string, unknown> = {}): Promise<T> {
    await this.resolveSession(accessToken);
    return this.adapter.invokeAuthenticatedFunction<T>("homlo-service-gateway", accessToken, { action, payload });
  }

  /**
   * PERF: signed-in READ actions served straight from Postgres instead of the
   * edge gateway. The gateway path costs: app server → edge function → auth
   * check → session RPC → action RPC (3 Supabase hops + edge cold starts).
   * Here: one query on the pooled connection, using the same security-definer
   * function, called with the same named arguments, and JSON built by Postgres
   * itself (json_agg / row_to_json — what PostgREST does), so numbers and
   * timestamps serialize exactly as the gateway returned them.
   *
   * Falls back to the gateway (identical behaviour and errors) when the
   * account is not active, the action has no direct reader, or the direct
   * read fails. `user` must be the verified session user.
   */
  async read<T>(accessToken: string, user: HomloSessionUser, action: string, payload: Record<string, unknown> = {}): Promise<T> {
    const direct = user.status === "active" ? this.directReader(action, user.id, payload) : null;
    if (!direct) return this.invoke<T>(accessToken, action, payload);
    try {
      return (await direct()) as T;
    } catch (error) {
      console.warn(`[homlo] direct read ${action} failed; using gateway`, error instanceof Error ? error.message : error);
      return this.invoke<T>(accessToken, action, payload);
    }
  }

  private directReader(action: string, userId: string, payload: Record<string, unknown>): (() => Promise<unknown>) | null {
    switch (action) {
      case "profile.get":
        return async () => ({ profile: await this.rowJson(`homlo_get_profile(p_user_id => $1::uuid)`, [userId]) });
      case "application.list":
        return async () => ({ applications: await this.setJson(`homlo_list_worker_applications_detailed(p_worker_id => $1::uuid)`, [userId]) });
      case "application.for-job": {
        const jobId = typeof payload.jobId === "string" ? payload.jobId : "";
        if (!UUID_PATTERN.test(jobId)) return null; // let the gateway produce its usual error
        return async () => {
          const application = await this.rowJson<{ id?: string | null }>(
            `homlo_get_application_for_worker(p_worker_id => $1::uuid, p_job_id => $2::uuid)`,
            [userId, jobId],
          );
          // Same normalisation as the gateway: an all-null composite means "none".
          return { application: application?.id ? application : null };
        };
      }
      case "messaging.conversations":
        return async () => ({ conversations: await this.setJson(`homlo_list_conversations(p_user_id => $1::uuid)`, [userId]) });
      case "notifications.list":
        return async () => ({ notifications: await this.setJson(`homlo_list_user_notifications(p_user_id => $1::uuid)`, [userId]) });
      case "account.get":
        return async () => {
          // The gateway ran these one after the other; same result, run together.
          const [accounts, activity] = await Promise.all([
            this.setJson(`homlo_get_account(p_user_id => $1::uuid)`, [userId]),
            this.setJson(`homlo_get_recent_activity(p_user_id => $1::uuid)`, [userId]),
          ]);
          const account = accounts[0] ?? null;
          return { account, recentActivity: account ? activity[0] ?? null : null };
        };
      default:
        return null;
    }
  }

  /** A set-returning function's rows as JSON, like PostgREST's array response. */
  private async setJson<T = Record<string, unknown>>(call: string, params: string[]): Promise<T[]> {
    const { rows } = await this.adapter.query<{ data: T[] | string | null }>(
      `select coalesce(json_agg(t), '[]'::json) as data from public.${call} t`,
      params,
    );
    const data = rows[0]?.data;
    return (typeof data === "string" ? JSON.parse(data) : data ?? []) as T[];
  }

  /** A composite-returning function as one JSON object (all-null when no row), like PostgREST. */
  private async rowJson<T = Record<string, unknown>>(call: string, params: string[]): Promise<T | null> {
    const { rows } = await this.adapter.query<{ data: T | string | null }>(
      `select row_to_json(t) as data from public.${call} t`,
      params,
    );
    const data = rows[0]?.data ?? null;
    return (typeof data === "string" ? JSON.parse(data) : data) as T | null;
  }

  /**
   * The age a member gave after signing up (055_user_age.sql). Read and written
   * straight from Postgres by the app server, keyed by the already-verified
   * session user id, so it does not depend on the edge gateway version.
   */
  async getUserAge(userId: string): Promise<{ age: number | null; recordedAt: string | null }> {
    try {
      const { rows } = await this.adapter.query<{ age: number | null; age_recorded_at: Date | string | null }>(
        `select age, age_recorded_at from users where id = $1 and deleted_at is null limit 1`,
        [userId],
      );
      const row = rows[0];
      return { age: row?.age ?? null, recordedAt: toIso(row?.age_recorded_at) };
    } catch (error) {
      throw ageStorageError(error);
    }
  }

  async setUserAge(userId: string, age: number): Promise<{ age: number; recordedAt: string | null }> {
    if (!Number.isInteger(age) || age < AGE_MIN || age > AGE_MAX) {
      throw new Error(`Age must be a whole number between ${AGE_MIN} and ${AGE_MAX}`);
    }
    let rows: { age: number; age_recorded_at: Date | string | null }[];
    try {
      ({ rows } = await this.adapter.query<{ age: number; age_recorded_at: Date | string | null }>(
        `update users
            set age = $2, age_recorded_at = now()
          where id = $1 and deleted_at is null and status = 'active'
          returning age, age_recorded_at`,
        [userId, age],
      ));
    } catch (error) {
      throw ageStorageError(error);
    }
    if (!rows[0]) throw new Error("This Homlo account is unavailable");
    return { age: rows[0].age, recordedAt: toIso(rows[0].age_recorded_at) };
  }

  /**
   * "Are you 18 or older?" (056_user_adult_confirmation.sql). `isAdult` is the
   * member's own answer, or null if they never answered; `suggested` falls
   * back to the sign-up age so the screen can pre-select a choice.
   */
  async getAdultStatus(userId: string): Promise<AdultStatus> {
    try {
      const { rows } = await this.adapter.query<{ is_adult: boolean | null; is_adult_confirmed_at: Date | string | null; age: number | null }>(
        `select is_adult, is_adult_confirmed_at, age from users where id = $1 and deleted_at is null limit 1`,
        [userId],
      );
      const row = rows[0];
      const isAdult = row?.is_adult ?? null;
      const suggested = isAdult ?? (row?.age != null ? row.age >= 18 : null);
      return { isAdult, suggested, confirmedAt: toIso(row?.is_adult_confirmed_at) };
    } catch (error) {
      throw adultStorageError(error);
    }
  }

  async setAdultStatus(userId: string, isAdult: boolean): Promise<AdultStatus> {
    let rows: { is_adult: boolean; is_adult_confirmed_at: Date | string | null }[];
    try {
      ({ rows } = await this.adapter.query<{ is_adult: boolean; is_adult_confirmed_at: Date | string | null }>(
        `update users
            set is_adult = $2, is_adult_confirmed_at = now()
          where id = $1 and deleted_at is null and status = 'active'
          returning is_adult, is_adult_confirmed_at`,
        [userId, isAdult],
      ));
    } catch (error) {
      throw adultStorageError(error);
    }
    if (!rows[0]) throw new Error("This Homlo account is unavailable");
    return { isAdult: rows[0].is_adult, suggested: rows[0].is_adult, confirmedAt: toIso(rows[0].is_adult_confirmed_at) };
  }

  async listPublishedJobs(): Promise<{ jobs: PublishedJobRecord[] }> {
    // PERF: the whole public feed is requested by ~10 screens; share it.
    return this.publicJobsCache.get("all", () => this.listPublishedJobsUncached());
  }

  private async listPublishedJobsUncached(): Promise<{ jobs: PublishedJobRecord[] }> {
    // PERF: read the same database function the `homlo-public-job-feed` edge
    // function wraps, straight over the server's pooled DB connection. Measured
    // ~100ms vs ~400ms warm / ~15s cold-start through the edge function. Falls
    // back to the edge function if the direct connection is unavailable.
    try {
      const { rows } = await this.adapter.query<Record<string, unknown>>(
        `select * from homlo_list_public_published_jobs()`,
      );
      return { jobs: await this.withBoostsAndWorkTime(rows.map(normalizePublicJobRow) as unknown as PublishedJobRecord[]) };
    } catch (error) {
      console.warn("[homlo] direct public job read failed; using edge function", error instanceof Error ? error.message : error);
    }
    const result = await this.adapter.invokePublicFunction<{ jobs: PublishedJobRecord[] }>(
      "homlo-public-job-feed",
    );
    return { jobs: await this.withBoostsAndWorkTime(result.jobs ?? []) };
  }

  /**
   * PERF: the boost flag and the work-time columns are two independent
   * lookups by the same job ids. They used to run one after the other
   * (feed → boosts → work time: 3 sequential round trips on a cache miss);
   * now they run together (2 round trips). Same fields, same values.
   */
  private async withBoostsAndWorkTime<T extends { id: string; boosted?: boolean }>(rows: T[]): Promise<T[]> {
    const [boosted, timed] = await Promise.all([this.withActiveBoosts(rows), this.withWorkTime(rows)]);
    return timed.map((row, index) => ({ ...row, boosted: boosted[index]?.boosted ?? false }));
  }

  /**
   * PERF: one public job by id, for the job detail page, which used to
   * download the whole public feed (up to 200 rows with descriptions) to show
   * one job — and could not open a job past that 200-row cap at all.
   * Same columns, joins and visibility rules as
   * homlo_list_public_published_jobs() (20261101150000_boost_lifecycle.sql),
   * plus the same boost flag and work-time fields as listPublishedJobs().
   * Returns null when the job is not publicly visible (closed, full, expired,
   * deleted). Cached briefly per id; cleared on writes like the list.
   */
  async getPublishedJob(id: string): Promise<{ job: PublishedJobRecord | null }> {
    if (!UUID_PATTERN.test(id)) return { job: null };
    return this.publicJobCache.get(id.toLowerCase(), async () => {
      const { rows } = await this.adapter.query<Record<string, unknown>>(
        `select
           j.id, j.title, j.description, j.pay_amount, j.pay_currency, j.pay_type,
           j.location_text, j.latitude, j.longitude, j.workers_needed, j.created_at,
           coalesce(c.name, 'Other') as category,
           p.full_name as employer_name,
           p.profile_photo_key as employer_photo_key,
           j.banner_image, j.status, j.workers_hired, j.work_arrangement
         from jobs j
         left join categories c on c.id = j.category_id
         left join profiles p on p.user_id = j.employer_id and p.deleted_at is null
         where j.id = $1::uuid
           and j.deleted_at is null
           and j.status = 'open'
           and (j.workers_needed = 0 or j.workers_hired < j.workers_needed)
           and (j.end_date is null or j.end_date >= current_date)
         limit 1`,
        [id],
      );
      if (!rows[0]) return { job: null };
      const [job] = await this.withBoostsAndWorkTime([normalizePublicJobRow(rows[0]) as unknown as PublishedJobRecord]);
      return { job: job ?? null };
    });
  }

  /**
   * Adds work days, clock-in/out and the pay-range top (059_job_work_time.sql),
   * which homlo_list_public_published_jobs() does not return. Best effort: if
   * the migration is not applied yet the feed is returned unchanged.
   */
  private async withWorkTime<T extends { id: string }>(rows: T[]): Promise<T[]> {
    if (rows.length === 0) return rows;
    try {
      const { rows: extra } = await this.adapter.query<{
        id: string; work_days: string[] | null; clock_in: string | null; clock_out: string | null; pay_amount_max: number | string | null;
      }>(
        `select id, work_days, to_char(clock_in, 'HH24:MI') as clock_in, to_char(clock_out, 'HH24:MI') as clock_out, pay_amount_max
           from public.jobs
          where id = any($1::uuid[])`,
        [`{${rows.map((row) => row.id).join(",")}}`],
      );
      const byId = new Map(extra.map((row) => [row.id, row]));
      return rows.map((row) => {
        const e = byId.get(row.id);
        if (!e) return row;
        const max = e.pay_amount_max == null ? null : Number(e.pay_amount_max);
        return {
          ...row,
          work_days: e.work_days ?? null,
          clock_in: e.clock_in ?? null,
          clock_out: e.clock_out ?? null,
          pay_amount_max: max != null && Number.isFinite(max) ? max : null,
        };
      });
    } catch (error) {
      console.warn("[homlo] work time columns unavailable (apply 059_job_work_time.sql)", error instanceof Error ? error.message : error);
      return rows;
    }
  }

  /** Adds the job-seeker ad flag without leaking price, plan, or end time. */
  private async withActiveBoosts<T extends { id: string; boosted?: boolean }>(rows: T[]): Promise<T[]> {
    if (rows.length === 0) return rows;
    const { rows: active } = await this.adapter.query<{ job_id: string }>(
      `select distinct b.job_id
         from public.boosts b
        where b.job_id = any($1::uuid[])
          and b.status = 'active'
          and b.start_at <= now()
          and b.expires_at > now()`,
      [`{${rows.map((row) => row.id).join(",")}}`],
    );
    const boosted = new Set(active.map((row) => row.job_id));
    return rows.map((row) => ({ ...row, boosted: boosted.has(row.id) }));
  }

  /**
   * PERF: an employer's dashboard asks for applicants once PER JOB (34 calls
   * for 34 jobs), and each went through the edge gateway (~1–2s each). Read
   * the same security-definer function the gateway's "employer.applications"
   * action uses, directly over the pooled DB connection. `userId` must be the
   * verified session user (ownership is enforced in SQL by employer_id).
   */
  async listEmployerApplicationsDirect(userId: string, jobId: string): Promise<{ applications: Record<string, unknown>[] }> {
    const { rows } = await this.adapter.query<Record<string, unknown>>(
      `select * from homlo_list_employer_applications_detailed($1::uuid, $2::uuid)`,
      [userId, jobId],
    );
    // Match the gateway's JSON (timestamps as ISO strings, not Date objects).
    const applications = rows.map((row) => {
      const out: Record<string, unknown> = { ...row };
      for (const [key, value] of Object.entries(out)) {
        if (value instanceof Date) out[key] = value.toISOString();
      }
      return out;
    });
    return { applications };
  }

  /**
   * PERF: every applicant across ALL of the employer's jobs in ONE query.
   * The dashboard used to call listEmployerApplicationsDirect once per job
   * (1 + N queries). Same joins, filters and columns as
   * homlo_list_employer_applications_detailed (042_application_viewed_at.sql),
   * minus the single-job filter; `job_id` is in every row so the client groups
   * by it. `userId` must be the verified session user.
   */
  async listAllEmployerApplicationsDirect(userId: string): Promise<{ applications: Record<string, unknown>[] }> {
    const { rows } = await this.adapter.query<Record<string, unknown>>(
      `select a.id, a.job_id, a.worker_id, a.status, a.message, a.created_at, a.updated_at, a.viewed_at,
              p.full_name as worker_full_name, p.location_text as worker_location,
              p.bio as worker_bio, p.profile_photo_key as worker_photo_key
         from applications a
         join jobs j on j.id = a.job_id and j.deleted_at is null
         join profiles p on p.user_id = a.worker_id and p.deleted_at is null
        where j.employer_id = $1::uuid
        order by a.created_at desc, a.id desc`,
      [userId],
    );
    const applications = rows.map((row) => {
      const out: Record<string, unknown> = { ...row };
      for (const [key, value] of Object.entries(out)) {
        if (value instanceof Date) out[key] = value.toISOString();
      }
      return out;
    });
    return { applications };
  }

  /**
   * PERF: the employer dashboard's job list, read directly instead of through
   * the gateway's "employer.jobs" action (same security-definer function,
   * same verified user id). Converts postgres.js types to what PostgREST JSON
   * returned: numeric/bigint -> number, timestamptz -> ISO string.
   */
  async listEmployerJobsDirect(userId: string): Promise<{ jobs: Record<string, unknown>[] }> {
    const { rows } = await this.adapter.query<Record<string, unknown>>(
      `select * from homlo_list_employer_jobs_with_boosts($1::uuid)`,
      [userId],
    );
    const NUMERIC = ["pay_amount", "boost_rank_multiplier", "views_count", "latitude", "longitude", "workers_needed", "workers_hired", "queued_boosts"];
    const jobs = rows.map((row) => {
      const out: Record<string, unknown> = { ...row };
      for (const [key, value] of Object.entries(out)) {
        if (value instanceof Date) out[key] = value.toISOString();
        else if (typeof value === "bigint") out[key] = Number(value);
      }
      for (const key of NUMERIC) {
        if (typeof out[key] === "string") {
          const n = Number(out[key]);
          out[key] = Number.isFinite(n) ? n : null;
        }
      }
      return out;
    });
    return { jobs };
  }

  async listCategories(): Promise<{ categories: { id: string; name: string; slug: string }[] }> {
    return this.categoriesCache.get("all", async () => {
    const { rows } = await this.adapter.query<{ id: string; name: string; slug: string }>(
      `select id, name, slug from categories order by name asc`
    );
    return { categories: rows };
    });
  }

  async searchJobs(input: {
    query?: string;
    category?: string;
    employmentType?: string;
    arrangement?: string;
    experience?: string;
    location?: string;
    salaryMin?: number;
    salaryMax?: number;
    posted?: string;
    sort?: string;
    latitude?: number;
    longitude?: number;
    radiusKm?: number;
    bbox?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ jobs: SearchJobRecord[]; total: number }> {
    // PERF: identical searches (same filters) within a few seconds share one query.
    return this.searchCache.get(JSON.stringify(input), () => this.searchJobsUncached(input));
  }

  private async searchJobsUncached(input: Parameters<HomloDirectService["searchJobs"]>[0]): Promise<{ jobs: SearchJobRecord[]; total: number }> {
    const { parseSearchQuery, buildSearchParams, searchInputSchema } = await import("../backend/search/query-parser");
    
    const validatedInput = searchInputSchema.parse(input);
    const rawQuery = validatedInput.query ?? "";
    const parsedIntent = parseSearchQuery(rawQuery);
    const params = buildSearchParams(validatedInput, parsedIntent);

    const { rows } = await this.adapter.query<SearchJobRecord>(
      `select * from homlo_search_public_jobs(
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
      )`,
      [
        params.p_query,
        params.p_category,
        params.p_location,
        params.p_employment_type,
        params.p_arrangement,
        params.p_experience,
        params.p_salary_min,
        params.p_salary_max,
        params.p_posted,
        params.p_latitude,
        params.p_longitude,
        params.p_radius_km,
        params.p_sort,
        params.p_limit,
        params.p_offset,
        params.p_bbox,
      ]
    );

    // 061_search_radius_and_total.sql adds `total_count` (matches before
    // limit/offset). Strip it from the job rows so their shape is unchanged;
    // before that migration is applied, keep the old value (page size).
    let total = rows.length;
    const jobs = rows.map((row) => {
      const { total_count: totalCount, ...job } = row as SearchJobRecord & { total_count?: number | string | bigint };
      if (totalCount !== undefined && totalCount !== null) {
        const n = Number(totalCount);
        if (Number.isFinite(n)) total = n;
      }
      return job as SearchJobRecord;
    });
    return {
      jobs: await this.withActiveBoosts(jobs),
      total,
    };
  }

  /**
   * App Store guideline 1.2 (user-generated content): any signed-in user can
   * report a job listing for moderation. One open report per user per job.
   */
  async reportJob(reporterId: string, jobId: string, reason: string, details: string | null): Promise<{ reported: true }> {
    const { rows: job } = await this.adapter.query<{ id: string }>(
      `select id from jobs where id = $1::uuid and deleted_at is null limit 1`,
      [jobId],
    );
    if (!job[0]) throw new Error("This job is no longer available");
    const { rows: existing } = await this.adapter.query<{ id: string }>(
      `select id from reports
        where reporter_id = $1::uuid and target_type = 'job' and target_id = $2::uuid and status = 'open'
        limit 1`,
      [reporterId, jobId],
    );
    if (!existing[0]) {
      await this.adapter.query(
        `insert into reports (reporter_id, target_type, target_id, reason, category, details)
         values ($1::uuid, 'job', $2::uuid, $3, $3, $4)`,
        [reporterId, jobId, reason, details],
      );
    }
    return { reported: true };
  }

  /**
   * App Store guideline 5.1.1(v): in-app account deletion.
   *
   * Permanently closes the account for the verified session user:
   *  - their job listings are closed and removed from every feed;
   *  - their profile is wiped (name, phone, photo, bio, location, banner);
   *  - the login identity and the Homlo user are marked deleted;
   *  - the Supabase auth user is deleted, so the credentials stop working.
   * Conversations/applications stay for the other party, shown as "Deleted user".
   * `userId` must come from the verified session, never from the client.
   */
  async deleteAccount(accessToken: string, userId: string): Promise<{ deleted: true }> {
    const authUser = await this.adapter.verifySupabaseToken(accessToken);
    if (!authUser) throw new Error("Invalid Supabase authentication token");
    await this.closeAccountData(userId);
    await this.adapter.deleteAuthUser(authUser.id);
    this.invalidateAfterWrite(accessToken);
    return { deleted: true };
  }

  /**
   * Closes an account without a session: used by the retention job for
   * accounts inactive past `inactive_account_months` (server/trust/privacy.ts).
   */
  async closeAccountById(userId: string): Promise<void> {
    const { rows } = await this.adapter.query<{ provider_user_id: string }>(
      `select provider_user_id from user_identities where user_id = $1::uuid and provider = 'supabase' and deleted_at is null limit 1`,
      [userId],
    );
    await this.closeAccountData(userId);
    if (rows[0]) await this.adapter.deleteAuthUser(rows[0].provider_user_id);
  }

  private async closeAccountData(userId: string): Promise<void> {
    await this.adapter.transaction(async (db) => {
      await db.query(
        `update jobs
            set status = case when status in ('open', 'draft', 'filled', 'pending_review') then 'closed' else status end,
                deleted_at = now(), updated_at = now()
          where employer_id = $1::uuid and deleted_at is null`,
        [userId],
      );
      await db.query(
        `update profiles
            set full_name = 'Deleted user', phone = null, profile_photo_key = null, bio = null,
                location_text = null, latitude = null, longitude = null, banner_image = null,
                deleted_at = now(), updated_at = now()
          where user_id = $1::uuid`,
        [userId],
      );
      await db.query(
        `update user_identities set deleted_at = now() where user_id = $1::uuid and deleted_at is null`,
        [userId],
      );
      // closed_at starts the retention clock (server/trust/privacy.ts runRetention).
      await db.query(`update users set deleted_at = now(), closed_at = now(), updated_at = now() where id = $1::uuid`, [userId]);
    });
  }

  async signOut(accessToken: string): Promise<void> {
    this.sessionCache.delete(tokenKey(accessToken));
    await this.adapter.signOutAuthSession(accessToken);
  }

  /**
   * Upload the caller's profile-photo BYTES into the public `profile-photos`
   * bucket and persist nothing. The client stores the returned object key in
   * `profiles.profile_photo_key` on the regular profile save.
   *
   * The account (and therefore the folder) always comes from the verified
   * session token — never from the payload — so a caller can only ever write
   * inside their own `<user_id>/` folder.
   */
  async uploadProfilePhoto(accessToken: string, photoDataUrl: string): Promise<{ key: string }> {
    const account = await this.resolveSession(accessToken);
    const parsed = parseProfilePhotoDataUrl(photoDataUrl);
    if (!parsed) {
      throw new Error("We could not read that image. Choose a JPEG, PNG, WEBP, HEIC, HEIF or GIF photo.");
    }
    const detectedContentType = sniffImageContentType(parsed.bytes);
    const contentType = detectedContentType ?? parsed.contentType;
    const extension = IMAGE_MIME_EXTENSION[contentType];
    if (!extension) {
      throw new Error("Unsupported image type. Choose a JPEG, PNG, WEBP, HEIC, HEIF or GIF photo.");
    }
    // Canonical lowercase UUID keeps the folder exactly equal to
    // `auth.uid()::text`, so the storage RLS "own folder" checks
    // (storage.foldername(name))[1] = auth.uid()::text line up for any
    // authenticated-key writer, not only the service-role uploader.
    const folder = account.id.toLowerCase();
    if (!folder || folder.includes("..") || folder.length > 64) {
      throw new Error("We could not prepare your profile photo. Please try again.");
    }
    const key = `${folder}/avatar-${Date.now()}-${cryptoRandomSuffix()}.${extension}`;
    try {
      await this.adapter.uploadStorage(PROFILE_PHOTOS_BUCKET, key, parsed.bytes, contentType);
    } catch (underlying) {
      console.error("[uploadProfilePhoto] storage upload failed:", underlying);
      throw new Error("We could not upload your profile photo. Please try again.");
    }
    // The caller is replacing their photo: remove the previous Storage object so
    // the bucket never accumulates orphaned avatars after a profile save.
    await this.deletePreviousProfilePhoto(account.id, folder, key);
    return { key };
  }

  /**
   * Best-effort removal of the caller's previous profile-photo object. Only
   * Storage keys inside the caller's own folder are deleted; legacy https or
   * data URLs are forwarded to the profile save and left untouched.
   */
  private async deletePreviousProfilePhoto(userId: string, folder: string, newKey: string): Promise<void> {
    try {
      const { rows } = await this.adapter.query<{ profile_photo_key: string | null }>(
        `select profile_photo_key from profiles where user_id = $1`,
        [userId],
      );
      const previous = rows[0]?.profile_photo_key?.trim();
      console.log("[uploadProfilePhoto] cleanup check", JSON.stringify({ userId, folder, newKey, previous: previous ?? null }));
      if (!previous || previous === newKey) return;
      if (!previous.startsWith(`${folder}/`)) return;
      if (previous.length > 1024 || previous.includes("..") || previous.includes(" ") || previous.includes("%")) return;
      await this.adapter.deleteStorage(PROFILE_PHOTOS_BUCKET, previous);
    } catch (error) {
      console.error("[uploadProfilePhoto] removing previous profile photo failed:", error);
    }
  }

  /**
   * Upload a job image's BYTES into the public `job-images` bucket and return
   * its public URL. Ownership is verified server-side (only the listing
   * employer can attach an image) and the object is scoped under
   * `<employer_id>/<job_id>/` so the storage RLS "own folder" checks line up
   * for any authenticated-key writer, not only the service-role uploader.
   *
   * The returned URL is persisted by the client into `jobs.banner_image` on
   * the next `employer.save-job`; every existing job card renders
   * `banner_image` directly, so we return a self-contained public URL (never
   * a device-local URI or a bare storage key).
   */
  async uploadJobImage(accessToken: string, jobId: string, imageDataUrl: string): Promise<{ url: string }> {
    const account = await this.resolveSession(accessToken);
    if (!(await this.isJobOwner(account.id, jobId))) {
      throw new Error("Only the listing employer can change this job's image");
    }
    const parsed = parseProfilePhotoDataUrl(imageDataUrl);
    if (!parsed) {
      throw new Error("We could not read that image. Choose a JPEG, PNG, WEBP, HEIC, HEIF or GIF photo.");
    }
    const detectedContentType = sniffImageContentType(parsed.bytes);
    const contentType = detectedContentType ?? parsed.contentType;
    const extension = IMAGE_MIME_EXTENSION[contentType];
    if (!extension) {
      throw new Error("Unsupported image type. Choose a JPEG, PNG, WEBP, HEIC, HEIF or GIF photo.");
    }
    const employerFolder = account.id.toLowerCase();
    const jobFolder = jobId.toLowerCase();
    if (
      !employerFolder ||
      employerFolder.includes("..") ||
      employerFolder.length > 64 ||
      !jobFolder ||
      jobFolder.includes("..") ||
      jobFolder.length > 64
    ) {
      throw new Error("We could not prepare the job image. Please try again.");
    }
    const key = `${employerFolder}/${jobFolder}/job-${Date.now()}-${cryptoRandomSuffix()}.${extension}`;
    try {
      await this.adapter.uploadStorage(JOB_IMAGES_BUCKET, key, parsed.bytes, contentType);
    } catch (underlying) {
      console.error("[uploadJobImage] storage upload failed:", underlying);
      throw new Error("We could not upload the job image. Please try again.");
    }
    await this.deletePreviousJobImage(jobId, employerFolder, key);
    const url = buildPublicJobImageUrl(process.env.SUPABASE_URL ?? "", key);
    return { url };
  }

  private async isJobOwner(userId: string, jobId: string): Promise<boolean> {
    const { rows } = await this.adapter.query<{ employer_id: string }>(
      `select employer_id from jobs where id = $1 and deleted_at is null`,
      [jobId],
    );
    return rows.length > 0 && rows[0]?.employer_id?.toLowerCase() === userId.toLowerCase();
  }

  /**
   * Best-effort removal of this job's previous image object. Only Storage keys
   * inside the job's own employer folder are deleted; legacy https or data
   * URLs are forwarded to the job save and left untouched.
   */
  private async deletePreviousJobImage(jobId: string, employerFolder: string, newKey: string): Promise<void> {
    try {
      const { rows } = await this.adapter.query<{ banner_image: string | null }>(
        `select banner_image from jobs where id = $1 and employer_id = $2 and deleted_at is null`,
        [jobId, employerFolder],
      );
      const previous = rows[0]?.banner_image?.trim();
      if (!previous || previous === newKey) return;
      if (!previous.startsWith(`${employerFolder}/`)) return;
      if (previous.length > 1024 || previous.includes("..") || previous.includes(" ") || previous.includes("%")) return;
      await this.adapter.deleteStorage(JOB_IMAGES_BUCKET, previous);
    } catch (error) {
      console.error("[uploadJobImage] removing previous job image failed:", error);
    }
  }

  getAccessToken(request: Request): string | null {
    const authorization = request.headers.authorization;
    if (typeof authorization === "string" && authorization.startsWith("Bearer ")) {
      const token = authorization.slice("Bearer ".length).trim();
      return token || null;
    }
    const cookies = parseCookieHeader(request.headers.cookie ?? "");
    return cookies[SUPABASE_ACCESS_COOKIE] ?? null;
  }

  getRefreshToken(request: Request): string | null {
    const cookies = parseCookieHeader(request.headers.cookie ?? "");
    return cookies[SUPABASE_REFRESH_COOKIE] ?? null;
  }

  /**
   * Returns the public employer profile (name, photo, banner, verified, about,
   * location) from `profiles`. Matches by exact full_name first, then a
   * case-insensitive prefix match so derived ids like `emp-meng-cheaveng`
   * resolve to the real profile. Role is used only to break ties: anyone who
   * has posted a job can be an employer even if their role flag is still
   * `worker`, so filtering by role would hide legitimate profiles.
   */
  async getEmployerProfile(name: string): Promise<EmployerPublicProfile | null> {
    // PERF: public, identical for every viewer, and read on every job detail
    // page. Cleared by invalidateAfterWrite (profile saves and account
    // deletion both go through it), so edits show on the next read.
    return this.employerProfileCache.get(name, () => this.getEmployerProfileUncached(name));
  }

  private async getEmployerProfileUncached(name: string): Promise<EmployerPublicProfile | null> {
    const { rows } = await this.adapter.query<{
      full_name: string | null; profile_photo_key: string | null;
      banner_image: string | null; verified: boolean; bio: string | null;
      location_text: string | null; latitude: number | null; longitude: number | null;
    }>(
      `select full_name, profile_photo_key, banner_image, verified, bio,
              location_text, latitude, longitude
       from profiles
       where full_name is not null
         and (lower(full_name) = lower($1) or full_name ilike $2)
       order by
         (lower(full_name) = lower($1)) desc,
         (role in ('employer', 'both')) desc,
         length(full_name) asc
       limit 1`,
      [name, `${name}%`],
    );
    return rows[0]
      ? {
          fullName: rows[0].full_name,
          profilePhotoKey: rows[0].profile_photo_key,
          bannerImage: rows[0].banner_image,
          verified: rows[0].verified,
          about: rows[0].bio,
          locationText: rows[0].location_text,
          latitude: coarsenCoordinate(rows[0].latitude),
          longitude: coarsenCoordinate(rows[0].longitude),
        }
      : null;
  }
}

const IMAGE_MIME_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
};

const MAX_BASE64_DATA_URL_LENGTH = 16_000_000;

/** Parses `data:<mime>;base64,<bytes>` and enforces the payload budget. */
function parseProfilePhotoDataUrl(
  photoDataUrl: string,
): { bytes: Uint8Array; contentType: string } | null {
  if (typeof photoDataUrl !== "string" || photoDataUrl.length === 0 || photoDataUrl.length > MAX_BASE64_DATA_URL_LENGTH) {
    return null;
  }
  const commaIndex = photoDataUrl.indexOf(",");
  if (commaIndex <= 0) return null;
  const header = photoDataUrl.slice(0, commaIndex);
  const mimeMatch = /^data:([^;]+);base64$/i.exec(header);
  if (!mimeMatch || !/^image\/(jpeg|png|webp|gif|heic|heif)$/i.test(mimeMatch[1])) {
    return null;
  }
  const base64 = photoDataUrl.slice(commaIndex + 1);
  if (!base64) return null;
  const bytes = decodeBase64ToBytes(base64);
  if (!bytes || bytes.length === 0 || bytes.length > PROFILE_PHOTO_MAX_BYTES) {
    return null;
  }
  return { bytes, contentType: mimeMatch[1].toLowerCase() };
}

/** Lightweight base64 → bytes (Forge/Node and Deno both ship Buffer-ish helpers; this avoids global differences). */
function decodeBase64ToBytes(base64: string): Uint8Array | null {
  try {
    const normalized = base64.replace(/\s+/g, "");
    if (typeof Buffer !== "undefined") {
      return new Uint8Array(Buffer.from(normalized, "base64"));
    }
    if (typeof atob === "function") {
      const binary = atob(normalized);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      return bytes;
    }
    return null;
  } catch {
    return null;
  }
}

/** Sniffs common image magic bytes so a non-image payload is rejected even if it carries a claims image mime. */
function sniffImageContentType(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  const readUint32Be = (offset: number): number =>
    ((bytes[offset]! << 24) | (bytes[offset + 1]! << 16) | (bytes[offset + 2]! << 8) | bytes[offset + 3]!) >>> 0;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return "image/gif";
  if (
    readUint32Be(0) === 0x52494646 &&
    readUint32Be(8) === 0x57454250
  ) {
    return "image/webp";
  }
  if (readUint32Be(4) === 0x66747970) {
    const brand = String.fromCharCode(bytes[8]!, bytes[9]!, bytes[10]!, bytes[11]!);
    if (brand === "heic" || brand === "heix" || brand === "hevc" || brand === "hevx" || brand === "mif1" || brand === "msf1") {
      return "image/heic";
    }
    if (brand === "avif") return "image/heif";
  }
  return null;
}

function cryptoRandomSuffix(): string {
  try {
    const bytes = new Uint8Array(5);
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
      crypto.getRandomValues(bytes);
      return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
    }
  } catch {
    // fall through to the timestamp-based suffix below
  }
  return Math.random().toString(36).slice(2, 10);
}

let service: HomloDirectService | null = null;

export function getHomloDirectService(): HomloDirectService {
  if (service) return service;
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase server credentials are required for the Homlo direct service gateway");
  }
  service = new HomloDirectService(new SupabaseAdapter({ url, serviceRoleKey, databaseUrl: process.env.SUPABASE_DB_URL }));
  return service;
}
