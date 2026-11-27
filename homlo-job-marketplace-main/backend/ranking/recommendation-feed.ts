// =========================================================
// RecommendationFeedService — canonical Phase 3 → Phase 7 pipeline (phase 7).
//
// This is the ONLY entry point for the personalized job feed. It runs the one
// canonical, deterministic pipeline end to end:
//
//   retrieveCandidates (phase 3) → scoreCandidates (phase 4)
//   → rerankWithMMR (phase 5) → applySponsoredAndExploration (phase 6)
//   → finalFeedAssembly (phase 7, pure)
//
// and never re-orders or re-scores the assembled feed: the phase 6 order is the
// final order and pagination slices it, it does not shape it. The pool is the
// bounded phase 3 result (candidatePoolMin/Max), and every page is sliced from
// that full pool — the API never retrieves just a page-sized candidate set.
//
// User identity comes from the authenticated session (the caller passes the
// resolved user id; the tRPC route derives it from the session, never from the
// request body). Location is passed in by the orchestrator from the worker's
// `profiles` row; it can be null (missing/unknown location is handled by the
// pipeline, never by fabricating coordinates).
//
// `now` is explicit so the whole chain can be replayed deterministically.
// Efficiency: a constant number of batched queries for any pool size (at most
// ~5 retrieval sources + 4 phase 4 loads + 1 phase 6 boosts + 1 phase 7 display
// load) — no N+1, and the final assembly stage performs no I/O at all.
// =========================================================

import type { DatabaseAdapter } from "../infrastructure/database/DatabaseAdapter";
import { rankingConfig } from "../config/rankingConfig";
import type { WorkArrangement } from "../domain/work-arrangement";
import type { RetrievalPreferences } from "./candidate-retrieval";
import { CandidateRetrievalService } from "./candidate-retrieval";
import { RankingScoringService } from "./scoring-service";
import { rerankWithMMR } from "./mmr";
import { SponsoredExplorationService, type Phase6Candidate } from "./sponsored-exploration";
import {
  finalFeedAssembly,
  validateFeedCursor,
  type FeedAssemblyResult,
  type FeedJobDisplay,
} from "./feed-assembly";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type { FeedAssemblyResult, FeedJobDisplay } from "./feed-assembly";

export type RecommendationFeedInput = {
  /** Authenticated Homlo user id (server-sourced). null/undefined ⇒ anonymous cold-start feed. */
  userId?: string | null;
  /** Worker coordinates from `profiles`; null when unknown (missing/malformed/stale). */
  userLocation?: { latitude: number; longitude: number } | null;
  /** Optional explicit preference hints; omission ⇒ cold start. */
  preferences?: RetrievalPreferences | null;
  /** Page size; sanitized to [1, rankingConfig.feed.pageSizeMax]. */
  pageSize?: number;
  /** Raw cursor string from the previous page; null/empty ⇒ first page. */
  cursor?: string | null;
  /** Explicit ranking instant; defaults to new Date(). */
  now?: Date;
};

type DisplayRow = {
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
  workers_needed: number | string;
  workers_hired: number | string;
  created_at: string | Date;
  category: string;
  employer_name: string | null;
  employer_photo_key: string | null;
  banner_image: string | null;
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class RecommendationFeedService {
  constructor(private readonly database: DatabaseAdapter) {}

  /**
   * Runs the full Phase 3 → Phase 7 pipeline and returns one typed feed page.
   * An empty pool yields { jobs: [], nextCursor: null, hasMore: false }.
   */
  async getFeed(input: RecommendationFeedInput): Promise<FeedAssemblyResult> {
    const now =
      input.now instanceof Date && !Number.isNaN(input.now.getTime()) ? input.now : new Date();

    const pool = await this.buildFinalPool({ ...input, now });
    const display = pool.length > 0 ? await this.loadDisplay(pool) : new Map<string, FeedJobDisplay>();
    const cursor =
      typeof input.cursor === "string" && input.cursor.trim().length > 0
        ? validateFeedCursor(input.cursor, rankingConfig.version)
        : null;

    return finalFeedAssembly(pool, {
      display,
      pageSize: input.pageSize,
      cursor,
    });
  }

  /**
   * Phase 3 → Phase 6 candidate pooling + ranking. Exposed separately so tests
   * and callers can observe the bounded pool independently of page slicing.
   */
  async buildFinalPool(input: RecommendationFeedInput & { now: Date }): Promise<Phase6Candidate[]> {
    const retriever = new CandidateRetrievalService(this.database);
    const { candidates } = await retriever.retrieve({
      workerId: input.userId ?? null,
      userLocation: input.userLocation ?? null,
      preferences: input.preferences ?? null,
      now: input.now,
    });
    if (candidates.length === 0) return [];

    const scorer = new RankingScoringService(this.database);
    const scored = await scorer.scoreCandidates({
      userId: input.userId ?? null,
      userLocation: input.userLocation ?? null,
      candidates,
      preferences: input.preferences ?? null,
      now: input.now,
    });
    if (scored.length === 0) return [];

    const reranked = rerankWithMMR(scored);
    if (reranked.length === 0) return [];

    const sponsoredAndExploration = new SponsoredExplorationService(this.database);
    return sponsoredAndExploration.process(reranked, { now: input.now });
  }

  /**
   * ONE batched display-row load for the whole bounded pool (≤ candidatePoolMax
   * rows). Never page-sized, never per-job: the assembly assigns 1-based feed
   * positions over the full pool, so positions are exact on every page.
   */
  private async loadDisplay(pool: readonly Phase6Candidate[]): Promise<Map<string, FeedJobDisplay>> {
    const jobIds: string[] = [];
    const seen = new Set<string>();
    for (const candidate of pool) {
      if (candidate && typeof candidate.jobId === "string" && !seen.has(candidate.jobId)) {
        seen.add(candidate.jobId);
        jobIds.push(candidate.jobId);
      }
    }
    if (jobIds.length === 0) return new Map();

    const { rows } = await this.database.query<DisplayRow>(
      `select j.id, j.title, j.description, j.pay_amount, j.pay_currency, j.pay_type,
              j.location_text, j.latitude, j.longitude, j.workers_needed, j.workers_hired, j.created_at,
              j.work_arrangement,
              coalesce(c.name, 'Other') as category,
              p.full_name as employer_name,
              p.profile_photo_key as employer_photo_key,
              j.banner_image
         from jobs j
         left join categories c on c.id = j.category_id
         left join profiles p on p.user_id = j.employer_id and p.deleted_at is null
        where j.deleted_at is null
          and j.status = 'open'
          and (j.workers_needed = 0 or j.workers_hired < j.workers_needed)
          and (j.end_date is null or j.end_date >= current_date)
          and j.id = any($1::uuid[])`,
      [arrayUnionParam(jobIds)],
    );

    const display = new Map<string, FeedJobDisplay>();
    for (const row of rows) {
      display.set(row.id, {
        jobId: row.id,
        title: String(row.title),
        description: String(row.description),
        payAmount: toNumber(row.pay_amount) ?? 0,
        payCurrency: row.pay_currency,
        payType: row.pay_type,
        locationText: row.location_text,
        workArrangement: row.work_arrangement ?? null,
        latitude: toNumber(row.latitude),
        longitude: toNumber(row.longitude),
        workersNeeded: toNumber(row.workers_needed) ?? 0,
        workersHired: toNumber(row.workers_hired) ?? 0,
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
        category: row.category,
        employerName: row.employer_name,
        employerPhotoKey: row.employer_photo_key,
        bannerImage: row.banner_image,
      });
    }
    return display;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function arrayUnionParam(ids: readonly string[]): string {
  return `{${ids.join(",")}}`;
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}