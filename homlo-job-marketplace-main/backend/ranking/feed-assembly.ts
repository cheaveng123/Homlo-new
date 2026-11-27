// =========================================================
// Final feed assembly (phase 7).
//
// Consumes the PHASE 6 SponsoredExplorationCandidate[] — already in its final
// deterministic order (finalRankingScore desc, with the phase 6 tie-break
// chain) — and turns it into the typed feed contract:
//
//   1. Defensive job-id dedupe (keeps the first occurrence, matching phase 6).
//   2. Position assignment: 1-based feed positions, incremented by exactly 1,
//      assigned to the FINAL assembled result (after dedupe and dropping items
//      whose display row vanished between scoring and assembly).
//   3. Cursor-based pagination over the FULL assembled pool — the pool is the
//      bounded phase 3/6 result (candidatePoolMax), NOT a page-sized slice of
//      it. The pool is never re-ordered here: the phase 6 order is canonical,
//      and no source re-sorts by creation date, distance, or pay.
//   4. Deterministic cursor codec: base64url(JSON { v: rankingVersion, s:
//      finalRankingScore, j: jobId }). The score + jobId pair anchors resumption
//      to the exact item that ended the previous page (finalRankingScore alone
//      is NOT sufficient), so equal scores can never resume at the wrong spot.
//      Malformed cursors and ranking-version mismatches are rejected; a stale
//      cursor (item no longer present, or its score changed) is rejected too so
//      the client deterministically recovers by refetching page 1.
//
// Purely in-memory: zero database access. The display rows are loaded by the
// orchestrating service (recommendation-feed.ts) with ONE batched query over
// the bounded pool; this module only slices that map by job id.
// =========================================================

import { rankingConfig } from "../config/rankingConfig";
import type { WorkArrangement } from "../domain/work-arrangement";
import type { Phase6Candidate } from "./sponsored-exploration";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Display fields a feed job card renders; fetched in one batched query. */
export type FeedJobDisplay = {
  jobId: string;
  title: string;
  description: string;
  payAmount: number;
  payCurrency: string;
  payType: "hourly" | "daily" | "fixed";
  locationText: string | null;
  workArrangement: WorkArrangement | null;
  latitude: number | null;
  longitude: number | null;
  workersNeeded: number;
  workersHired?: number;
  createdAt: string;
  category: string;
  employerName: string | null;
  employerPhotoKey: string | null;
  bannerImage: string | null;
};

/**
 * Curated, serializable subset of the phase 6 ranking snapshot exposed to the
 * client with each feed item. Field names mirror rankingScoreSnapshot so a
 * client can echo `rankingMetadata` back into a phase 2 event's snapshot.
 */
export type FeedRankingMetadata = {
  rankingVersion: string;
  baseRelevance: number;
  combinedQuality: number;
  organicScore: number;
  distanceKm: number | null;
  coldStart: boolean;
  mmrScore: number | null;
  mmrSelectedRank: number | null;
  sponsored: boolean;
  sponsoredEligible: boolean;
  sponsoredMultiplier: number;
  exploration: boolean;
  finalRankingScore: number;
};

export type FeedItem = {
  job: FeedJobDisplay;
  feedPosition: number;
  rankingMetadata: FeedRankingMetadata;
};

/**
 * Curated cursor payload. `s`/`j` identify the LAST delivered item; `v` pins
 * the cursor to the ranking version that produced it.
 */
export type FeedCursorPayload = {
  v: string;
  s: number;
  j: string;
};

export type FeedAssemblyOptions = {
  /** Display rows keyed by job id (result of the orchestrator's single batched load). */
  display?: ReadonlyMap<string, FeedJobDisplay>;
  /** Page size; sanitized to the range [1, rankingConfig.feed.pageSizeMax]. */
  pageSize?: number;
  /** Validated cursor describing the last delivered item; null = first page. */
  cursor?: FeedCursorPayload | null;
};

export type FeedAssemblyResult = {
  jobs: FeedItem[];
  /** Size of the fully assembled pool (post-dedupe, post-display-filter). */
  total: number;
  /** Raw phase 6 output size before assembly filtering. */
  poolSize: number;
  nextCursor: string | null;
  hasMore: boolean;
  rankingVersion: string;
};

export class InvalidFeedCursorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidFeedCursorError";
  }
}

// ---------------------------------------------------------------------------
// Page-size policy (centralized in rankingConfig; never a literal in routers)
// ---------------------------------------------------------------------------

export function sanitizePageSize(size: number | null | undefined): number {
  const max = rankingConfig.feed.pageSizeMax;
  if (size == null || !Number.isFinite(size)) return rankingConfig.feed.pageSizeDefault;
  const floored = Math.floor(size);
  if (floored < 1) return 1;
  return Math.min(floored, max);
}

// ---------------------------------------------------------------------------
// Cursor codec + validation
// ---------------------------------------------------------------------------

export function encodeFeedCursor(payload: FeedCursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function parseFeedCursor(cursor: string): FeedCursorPayload | null {
  if (typeof cursor !== "string") return null;
  const trimmed = cursor.trim();
  if (trimmed.length < 4 || trimmed.length > 1024) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) return null;
  const decoded = Buffer.from(trimmed, "base64url").toString("utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(decoded);
  } catch {
    return null;
  }
  return isValidCursorPayload(parsed) ? parsed : null;
}

/** Strict decode: returns the payload or throws InvalidFeedCursorError. */
export function validateFeedCursor(cursor: string, rankingVersion: string): FeedCursorPayload {
  const payload = parseFeedCursor(cursor);
  if (!payload) {
    throw new InvalidFeedCursorError("Malformed feed cursor");
  }
  if (payload.v !== rankingVersion) {
    throw new InvalidFeedCursorError(
      `Feed cursor ranking version mismatch: expected ${rankingVersion}, received ${payload.v}`,
    );
  }
  if (typeof payload.s !== "number" || !Number.isFinite(payload.s)) {
    throw new InvalidFeedCursorError("Feed cursor carries a non-finite ranking score");
  }
  return payload;
}

function isValidCursorPayload(value: unknown): value is FeedCursorPayload {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.v === "string" &&
    record.v.length > 0 &&
    typeof record.j === "string" &&
    record.j.length > 0 &&
    record.j.length <= 64 &&
    typeof record.s === "number" &&
    Number.isFinite(record.s)
  );
}

// ---------------------------------------------------------------------------
// Final assembly
// ---------------------------------------------------------------------------

/**
 * Builds the typed feed contract from a phase 6 pool. Pure: no I/O, no mutation
 * of the input candidates or the display map. Input order is the phase 6 final
 * order and is preserved exactly.
 */
export function finalFeedAssembly(
  candidates: readonly Phase6Candidate[],
  options: FeedAssemblyOptions = {},
): FeedAssemblyResult {
  const rankingVersion = rankingConfig.version;
  const pageSize = sanitizePageSize(options.pageSize);

  const assembled: FeedItem[] = [];
  const seen = new Set<string>();
  let position = 0;
  for (const candidate of candidates) {
    if (candidate == null || typeof candidate.jobId !== "string" || seen.has(candidate.jobId)) {
      continue;
    }
    seen.add(candidate.jobId);
    const job = options.display?.get(candidate.jobId);
    // A candidate whose display row vanished between scoring and assembly is
    // skipped deterministically so a page never surfaces a card with no data.
    if (!job) continue;
    position += 1;
    assembled.push({
      job,
      feedPosition: position,
      rankingMetadata: toFeedMetadata(candidate),
    });
  }

  if (assembled.length === 0) {
    return {
      jobs: [],
      total: 0,
      poolSize: candidates.length,
      nextCursor: null,
      hasMore: false,
      rankingVersion,
    };
  }

  let start = 0;
  if (options.cursor) {
    start = resumeIndex(assembled, options.cursor, rankingVersion) + 1;
  }
  const end = Math.min(start + pageSize, assembled.length);
  const jobs = assembled.slice(start, end);
  const hasMore = end < assembled.length;
  const last = jobs[jobs.length - 1];
  const nextCursor = hasMore
    ? encodeFeedCursor({
        v: rankingVersion,
        s: last.rankingMetadata.finalRankingScore,
        j: last.job.jobId,
      })
    : null;

  return {
    jobs,
    total: assembled.length,
    poolSize: candidates.length,
    nextCursor,
    hasMore,
    rankingVersion,
  };
}

/** Deterministic, curated metadata derived from the phase 6 ranking snapshot. */
export function toFeedMetadata(candidate: Phase6Candidate): FeedRankingMetadata {
  const snapshot = candidate.rankingSnapshot;
  return {
    rankingVersion: snapshot.rankingVersion ?? candidate.rankingVersion,
    baseRelevance: snapshot.baseRelevance,
    combinedQuality: snapshot.combinedQuality,
    organicScore: snapshot.organicScore,
    distanceKm: snapshot.distanceKm ?? null,
    coldStart: snapshot.coldStart,
    mmrScore: snapshot.mmr?.score ?? null,
    mmrSelectedRank: snapshot.mmr?.selectedRank ?? null,
    sponsored: candidate.sponsored,
    sponsoredEligible: snapshot.sponsoredEligible ?? false,
    sponsoredMultiplier: candidate.sponsoredMultiplier,
    exploration: candidate.exploration,
    finalRankingScore: candidate.finalRankingScore,
  };
}

/**
 * Finds the index of the item the cursor anchors to. The anchor is the exact
 * (finalRankingScore, jobId) pair of the last delivered item; a stale cursor —
 * unknown job, or the same job now carrying a different score — is rejected.
 */
function resumeIndex(
  assembled: readonly FeedItem[],
  cursor: FeedCursorPayload,
  rankingVersion: string,
): number {
  if (cursor.v !== rankingVersion) {
    throw new InvalidFeedCursorError(
      `Feed cursor ranking version mismatch: expected ${rankingVersion}, received ${cursor.v}`,
    );
  }
  for (let index = 0; index < assembled.length; index += 1) {
    const item = assembled[index];
    if (item.job.jobId === cursor.j) {
      if (item.rankingMetadata.finalRankingScore !== cursor.s) {
        throw new InvalidFeedCursorError(
          `Feed cursor is stale: job ${cursor.j} no longer carries its previous ranking score`,
        );
      }
      return index;
    }
  }
  throw new InvalidFeedCursorError(`Feed cursor is stale: job ${cursor.j} is no longer in the feed`);
}