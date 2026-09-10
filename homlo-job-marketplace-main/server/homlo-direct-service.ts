import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";

import { SupabaseAdapter, type SupabaseIssuedSession } from "../backend/infrastructure/database/SupabaseAdapter";
import { CandidateRetrievalService, type RetrievalInput, type RetrievalResult } from "../backend/ranking/candidate-retrieval";
import { RankingScoringService, type ScoreCandidatesInput, type ScoredCandidate } from "../backend/ranking/scoring-service";
import { RecommendationFeedService, type FeedAssemblyResult } from "../backend/ranking/recommendation-feed";
import { HomeFeedService, type HomeFeedInput, type HomeFeedResult } from "./home-feed";
import { EventLoggingService, type EventLogResult, type HomloEventLogInput } from "./event-logging";

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
  latitude: number | null;
  longitude: number | null;
  workers_needed: number;
  created_at: string;
  category: string;
  employer_name: string | null;
  employer_photo_key: string | null;
  banner_image?: string | null;
};

export type SearchJobRecord = PublishedJobRecord & {
  relevance_score: number;
  banner_image: string | null;
};

class HomloDirectService {
  constructor(private readonly adapter: SupabaseAdapter) {}

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
    const issued = await this.adapter.signUpWithEmailPassword(email, password, fullName);
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
    return { user: await this.resolveSession(issued.session.accessToken), session: issued.session };
  }

  async resolveSession(accessToken: string): Promise<HomloSessionUser> {
    const verified = await this.adapter.verifySupabaseToken(accessToken);
    if (!verified) throw new Error("Invalid Supabase authentication token");
    const response = await this.adapter.invokeAuthenticatedFunction<HomloSessionUser>("homlo-service-gateway", accessToken, { action: "session" });
    return response;
  }

  async invoke<T>(accessToken: string, action: string, payload: Record<string, unknown> = {}): Promise<T> {
    await this.resolveSession(accessToken);
    return this.adapter.invokeAuthenticatedFunction<T>("homlo-service-gateway", accessToken, { action, payload });
  }

  async listPublishedJobs(): Promise<{ jobs: PublishedJobRecord[] }> {
    return this.adapter.invokePublicFunction<{ jobs: PublishedJobRecord[] }>("homlo-public-job-feed");
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
    const { parseSearchQuery, buildSearchParams, searchInputSchema } = await import("../backend/search/query-parser");
    const { SearchService } = await import("../backend/search/search-service");
    
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

    return {
      jobs: rows,
      total: rows.length,
    };
  }

  async signOut(accessToken: string): Promise<void> {
    await this.adapter.signOutAuthSession(accessToken);
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
