import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";

import {
  PROFILE_PHOTOS_BUCKET,
  PROFILE_PHOTO_MAX_BYTES,
} from "../lib/profile-photo-shared";
import { JOB_IMAGES_BUCKET } from "../lib/job-images-shared";
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
    const url = await this.adapter.getStorageUrl(JOB_IMAGES_BUCKET, key);
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
