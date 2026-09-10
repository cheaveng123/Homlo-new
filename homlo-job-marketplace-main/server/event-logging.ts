import { createHash } from "node:crypto";
import { z } from "zod";

import type { DatabaseAdapter } from "../backend/infrastructure/database/DatabaseAdapter";

/**
 * Event logging for the Homlo recommendation pipeline (phase 2).
 *
 * Single-destination append-only logging into `job_events`:
 *  - Strictly validates the payload (event type + field shapes).
 *  - Derives employer_id server-side from the authoritative `jobs` row instead
 *    of trusting the client, so the NOT NULL foreign key on employer_id can
 *    never fail from a stale or forged client value.
 *  - Stores only a salted SHA-256 hash of the request IP (never the raw IP).
 *  - Guards against implausibly high-frequency submissions per user/IP.
 *
 * No scoring, ranking, or retrieval logic lives here.
 */

export const HOMLO_EVENT_TYPES = [
  "impression",
  "click",
  "view",
  "save",
  "unsave",
  "share",
  "apply_started",
  "apply_submitted",
  "apply_withdrawn",
  "hide",
  "not_interested",
  "report",
] as const;

export type HomloEventType = (typeof HOMLO_EVENT_TYPES)[number];

export const homloEventInputSchema = z.object({
  eventType: z.enum(HOMLO_EVENT_TYPES),
  jobId: z.string().uuid(),
  employerId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
  feedPosition: z.number().int().nonnegative().max(10_000).optional(),
  feedContext: z.string().trim().max(40).optional(),
  shownAsSponsored: z.boolean().optional(),
  shownAsExploration: z.boolean().optional(),
  rankingScoreSnapshot: z.record(z.string(), z.unknown()).nullable().optional(),
  userLat: z.number().finite().min(-90).max(90).optional(),
  userLng: z.number().finite().min(-180).max(180).optional(),
  distanceKmAtEvent: z.number().finite().nonnegative().max(40_075).optional(),
  dwellTimeMs: z.number().int().nonnegative().max(3_600_000).optional(),
});

export type HomloEventLogInput = z.infer<typeof homloEventInputSchema>;

const RATE_LIMIT_WINDOW_MS = 5_000;
const RATE_LIMIT_MAX_EVENTS_PER_WINDOW = 40;
const RATE_LIMIT_MAX_BUCKETS = 10_000;

function ipHashSalt(): string {
  return process.env.HOMLO_EVENT_IP_HASH_SALT || "homlo-event-ip-hash-v1";
}

export function hashIp(ip: string): string {
  return createHash("sha256").update(`${ipHashSalt()}:${ip}`).digest("hex");
}

/**
 * Minimal in-memory sliding-window limiter. Sufficient for sanity-guarding a
 * single Node process; a distributed deployment would swap this for Redis.
 */
class SlidingWindowRateLimiter {
  private readonly buckets = new Map<string, number[]>();

  constructor(
    private readonly windowMs: number,
    private readonly maxEventsPerWindow: number,
  ) {}

  allows(key: string, now = Date.now()): boolean {
    const cutoff = now - this.windowMs;
    const timestamps = (this.buckets.get(key) ?? []).filter((timestamp) => timestamp > cutoff);
    if (timestamps.length >= this.maxEventsPerWindow) {
      this.buckets.set(key, timestamps);
      return false;
    }
    timestamps.push(now);
    this.buckets.set(key, timestamps);
    if (this.buckets.size > RATE_LIMIT_MAX_BUCKETS) this.buckets.clear();
    return true;
  }
}

export type EventLogResult =
  | { ok: true; id: string }
  | { ok: false; code: "rate_limited" | "invalid_job" | "invalid_payload" | "database" };

export class EventLoggingService {
  private readonly limiter = new SlidingWindowRateLimiter(
    RATE_LIMIT_WINDOW_MS,
    RATE_LIMIT_MAX_EVENTS_PER_WINDOW,
  );

  constructor(private readonly database: DatabaseAdapter) {}

  async log(
    input: HomloEventLogInput,
    meta: { ip: string | null; userId: string | null },
  ): Promise<EventLogResult> {
    const now = Date.now();
    const ipKey = meta.ip ? hashIp(meta.ip) : null;

    if (meta.userId && !this.limiter.allows(`user:${meta.userId}`, now)) {
      this.warnRejected("rate_limited", input, meta);
      return { ok: false, code: "rate_limited" };
    }
    if (ipKey && !this.limiter.allows(`ip:${ipKey}`, now)) {
      this.warnRejected("rate_limited", input, meta);
      return { ok: false, code: "rate_limited" };
    }
    if (!meta.userId && !ipKey && !this.limiter.allows("anon:global", now)) {
      this.warnRejected("rate_limited", input, meta);
      return { ok: false, code: "rate_limited" };
    }

    const jobRows = await this.database.query<{ id: string; employer_id: string }>(
      `select id, employer_id from jobs where id = $1 and deleted_at is null limit 1`,
      [input.jobId],
    );
    const job = jobRows.rows[0];
    if (!job) {
      this.warnRejected("invalid_job", input, meta);
      return { ok: false, code: "invalid_job" };
    }

    if (input.employerId && input.employerId !== job.employer_id) {
      console.warn(
        `[events] client employer_id ignored for job ${job.id}: expected ${job.employer_id}, received ${input.employerId}`,
      );
    }

    try {
      const result = await this.database.query<{ id: unknown }>(
        `insert into job_events (
           event_type,
           user_id,
           job_id,
           employer_id,
           session_id,
           feed_position,
           feed_context,
           shown_as_sponsored,
           shown_as_exploration,
           ranking_score_snapshot,
           user_lat,
           user_lng,
           distance_km_at_event,
           ip_hash,
           dwell_time_ms
         ) values (
           $1, $2, $3, $4, $5, $6, $7, $8, $9,
           $10::jsonb, $11, $12, $13, $14, $15
         ) returning id`,
        [
          input.eventType,
          meta.userId ?? null,
          job.id,
          job.employer_id,
          input.sessionId ?? null,
          input.feedPosition ?? null,
          input.feedContext ?? null,
          input.shownAsSponsored ?? false,
          input.shownAsExploration ?? false,
          input.rankingScoreSnapshot ? JSON.stringify(input.rankingScoreSnapshot) : null,
          input.userLat ?? null,
          input.userLng ?? null,
          input.distanceKmAtEvent ?? null,
          ipKey,
          input.dwellTimeMs ?? null,
        ],
      );
      const row = result.rows[0];
      if (!row) return { ok: false, code: "database" };
      return { ok: true, id: String(row.id) };
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "23503") {
        this.warnRejected("fk_violation", input, meta);
        return { ok: false, code: "invalid_job" };
      }
      console.warn(`[events] insert failed: ${error instanceof Error ? error.message : String(error)}`);
      return { ok: false, code: "database" };
    }
  }

  private warnRejected(
    reason: string,
    input: HomloEventLogInput,
    meta: { ip: string | null; userId: string | null },
  ) {
    console.warn(
      `[events] rejected event_type=${input.eventType} job=${input.jobId} user=${meta.userId ?? "anon"} reason=${reason}`,
    );
  }
}