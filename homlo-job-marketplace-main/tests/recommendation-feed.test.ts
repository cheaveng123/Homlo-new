import { describe, expect, it } from "vitest";

import { rankingConfig } from "../backend/config/rankingConfig";
import { RecommendationFeedService } from "../backend/ranking/recommendation-feed";
import {
  encodeFeedCursor,
  InvalidFeedCursorError,
  type FeedJobDisplay,
} from "../backend/ranking/feed-assembly";
import type { Phase6Candidate } from "../backend/ranking/sponsored-exploration";
import type { DatabaseAdapter, QueryResult, SqlParameter } from "../backend/infrastructure/database/DatabaseAdapter";
import { router, supabaseProtectedProcedure } from "../server/_core/trpc";
import type { TrpcContext } from "../server/_core/context";
import type { HomloSessionUser } from "../server/homlo-direct-service";
import { appRouter } from "../server/routers";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = new Date("2026-08-01T12:00:00.000Z");
const VERSION = rankingConfig.version;
const MAX_MULTIPLIER = rankingConfig.sponsored.maxMultiplier;

function createdAgo(hours: number): Date {
  return new Date(NOW.getTime() - hours * 3_600_000);
}

type JobSeed = {
  id: string;
  employerId: string;
  categoryId: string | null;
  title: string;
  description: string;
  payAmount: number;
  payCurrency: string;
  payType: "hourly" | "daily" | "fixed";
  locationText: string | null;
  latitude: number | null;
  longitude: number | null;
  startDate: string | null;
  startTime: string | null;
  endTime: string | null;
  workersNeeded: number;
  createdAt: Date;
};

type BoostSeed = { jobId: string; employerId: string; startAt: Date; expiresAt: Date };
type EmployerQualitySeed = { employerId: string; completion: number; positiveReview: number; response: number };
type EventSeed = {
  userId: string;
  eventType: string;
  occurredAt: Date;
  dwellTimeMs: number;
  employerId: string;
  categoryId: string | null;
};

function job(id: string, overrides: Partial<JobSeed> = {}): JobSeed {
  return {
    id,
    employerId: `emp-${id}`,
    categoryId: "cat-1",
    title: `Job ${id}`,
    description: `Description ${id}`,
    payAmount: 25,
    payCurrency: "USD",
    payType: "hourly",
    locationText: "Test City",
    latitude: 0,
    longitude: 0,
    startDate: null,
    startTime: null,
    endTime: null,
    workersNeeded: 2,
    createdAt: createdAgo(2),
    ...overrides,
  };
}

function jobs(count: number): JobSeed[] {
  return Array.from({ length: count }, (_, i) => job(`job-${i}`));
}

function boost(jobId: string, employerId: string): BoostSeed {
  return { jobId, employerId, startAt: createdAgo(1), expiresAt: new Date(NOW.getTime() + 86_400_000) };
}

function highQuality(employerId: string): EmployerQualitySeed {
  return { employerId, completion: 1, positiveReview: 1, response: 1 };
}

function clicks(userId: string, employerIds: readonly string[]): EventSeed[] {
  return employerIds.map((employerId) => ({
    userId,
    eventType: "click",
    occurredAt: createdAgo(0.1),
    dwellTimeMs: 0,
    employerId,
    categoryId: "cat-1",
  }));
}

function parseArrayParam(value: string): Set<string> {
  const trimmed = value.replace(/^{/, "").replace(/}$/, "");
  if (!trimmed) return new Set();
  return new Set(trimmed.split(","));
}

// ---------------------------------------------------------------------------
// In-memory database: routes the authoritative SQL statements to seeded rows,
// with per-statement counters to prove the no-N+1, constant-query contract.
// ---------------------------------------------------------------------------

class InMemoryFeedDatabase implements DatabaseAdapter {
  public queryCount = 0;
  public retrievalQueries = 0;
  public boostQueries = 0;
  public displayQueries = 0;

  constructor(
    private readonly seeds: {
      jobs: JobSeed[];
      boosts?: BoostSeed[];
      employerQuality?: EmployerQualitySeed[];
      events?: EventSeed[];
    } = { jobs: [] },
  ) {}

  async query<Row extends Record<string, unknown> = Record<string, unknown>>(
    statement: string,
    parameters: readonly SqlParameter[] = [],
  ): Promise<QueryResult<Row>> {
    this.queryCount += 1;
    const { jobs, boosts = [], employerQuality = [], events = [] } = this.seeds;
    let raw: Record<string, unknown>[] = [];

    if (statement.includes("select eje.id, j.employer_id, j.category_id, j.created_at")) {
      this.retrievalQueries += 1;
      raw = jobs.map((j) => ({ id: j.id, employer_id: j.employerId, category_id: j.categoryId, created_at: j.createdAt.toISOString() }));
    } else if (statement.startsWith("with trending as (")) {
      this.retrievalQueries += 1;
      raw = [];
    } else if (statement.startsWith("select id, job_id, employer_id, package, start_at, expires_at")) {
      this.boostQueries += 1;
      const jobIds = parseArrayParam(String(parameters[0]));
      const now = parameters[1] as Date;
      raw = boosts
        .filter((b) => jobIds.has(b.jobId) && new Date(b.startAt) <= now && now < new Date(b.expiresAt))
        .map((b) => ({
          id: `boost-${b.jobId}`,
          job_id: b.jobId,
          employer_id: b.employerId,
          package: "verified_checkout",
          start_at: b.startAt.toISOString(),
          expires_at: b.expiresAt.toISOString(),
        }));
    } else if (statement.startsWith("select id, employer_id, category_id, pay_amount")) {
      raw = jobs.map((j) => ({
        id: j.id,
        employer_id: j.employerId,
        category_id: j.categoryId,
        pay_amount: j.payAmount,
        pay_currency: j.payCurrency,
        pay_type: j.payType,
        location_text: j.locationText,
        latitude: j.latitude,
        longitude: j.longitude,
        start_date: j.startDate,
        start_time: j.startTime,
        end_time: j.endTime,
        created_at: j.createdAt.toISOString(),
      }));
    } else if (statement.startsWith("select employer_id, completion_rate_wilson_lb")) {
      raw = employerQuality.map((q) => ({
        employer_id: q.employerId,
        completion_rate_wilson_lb: q.completion,
        positive_review_rate_wilson_lb: q.positiveReview,
        response_rate_wilson_lb: q.response,
      }));
    } else if (statement.startsWith("select job_id, ctr_wilson_lb")) {
      raw = [];
    } else if (statement.startsWith("select je.event_type, je.occurred_at")) {
      const userId = String(parameters[0]);
      raw = events
        .filter((e) => e.userId === userId)
        .map((e) => ({
          event_type: e.eventType,
          occurred_at: e.occurredAt.toISOString(),
          dwell_time_ms: e.dwellTimeMs,
          employer_id: e.employerId,
          category_id: e.categoryId,
        }));
    } else if (statement.startsWith("select j.id, j.title, j.description")) {
      this.displayQueries += 1;
      raw = jobs.map((j) => ({
        id: j.id,
        title: j.title,
        description: j.description,
        pay_amount: j.payAmount,
        pay_currency: j.payCurrency,
        pay_type: j.payType,
        location_text: j.locationText,
        latitude: j.latitude,
        longitude: j.longitude,
        workers_needed: j.workersNeeded,
        created_at: j.createdAt.toISOString(),
        category: "Other",
        employer_name: null,
        employer_photo_key: null,
      }));
    }
    return { rows: raw as Row[], rowCount: raw.length };
  }

  transaction<T>(work: (database: DatabaseAdapter) => Promise<T>): Promise<T> {
    return work(this);
  }
}

type FeedCall = {
  userId?: string | null;
  userLocation?: { latitude: number; longitude: number } | null;
  pageSize?: number;
  cursor?: string | null;
};

function serviceFor(database: DatabaseAdapter): RecommendationFeedService {
  return new RecommendationFeedService(database);
}

// ---------------------------------------------------------------------------
// Cold start / empty pool
// ---------------------------------------------------------------------------

describe("RecommendationFeedService — cold start & empty pool", () => {
  it("returns the typed empty contract with zero jobs in the catalog", async () => {
    const database = new InMemoryFeedDatabase({ jobs: [] });
    const feed = await serviceFor(database).getFeed({ userLocation: { latitude: 0, longitude: 0 }, now: NOW });
    expect(feed).toEqual({ jobs: [], total: 0, poolSize: 0, nextCursor: null, hasMore: false, rankingVersion: VERSION });
  });

  it("serves a fully cold-start feed with contiguous positions when no user is identified", async () => {
    const database = new InMemoryFeedDatabase({ jobs: jobs(5) });
    const feed = await serviceFor(database).getFeed({ userId: null, userLocation: { latitude: 0, longitude: 0 }, now: NOW });
    expect(feed.jobs).toHaveLength(5);
    expect(feed.total).toBe(5);
    expect(feed.poolSize).toBe(5);
    expect(feed.hasMore).toBe(false);
    expect(feed.jobs.map((item) => item.feedPosition)).toEqual([1, 2, 3, 4, 5]);
    expect(new Set(feed.jobs.map((item) => item.job.jobId)).size).toBe(5);
    for (const item of feed.jobs) {
      expect(item.rankingMetadata.rankingVersion).toBe(VERSION);
      expect(item.rankingMetadata.sponsored).toBe(false);
      expect(item.rankingMetadata.coldStart).toBe(true);
      expect(Number.isFinite(item.rankingMetadata.finalRankingScore)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Full pipeline: sponsored propagation, exploration, determinism
// ---------------------------------------------------------------------------

describe("RecommendationFeedService — full pipeline", () => {
  it("is deterministic: identical inputs with a fixed now produce identical output", async () => {
    const database = new InMemoryFeedDatabase({ jobs: jobs(5) });
    const serve = () => serviceFor(database).getFeed({ userId: null, userLocation: { latitude: 0, longitude: 0 }, now: NOW });
    expect(await serve()).toStrictEqual(await serve());
  });

  it("propagates an active, quality-passing boost into the exposed ranking metadata", async () => {
    const database = new InMemoryFeedDatabase({
      jobs: jobs(4),
      boosts: [boost("job-1", "emp-job-1")],
      employerQuality: [highQuality("emp-job-1")],
    });
    const feed = await serviceFor(database).getFeed({ userId: null, userLocation: { latitude: 0, longitude: 0 }, now: NOW });
    const sponsored = feed.jobs.find((item) => item.job.jobId === "job-1");
    expect(sponsored).toBeDefined();
    expect(sponsored!.rankingMetadata.sponsored).toBe(true);
    expect(sponsored!.rankingMetadata.sponsoredEligible).toBe(true);
    expect(sponsored!.rankingMetadata.sponsoredMultiplier).toBeCloseTo(MAX_MULTIPLIER, 6);
    expect(Number.isFinite(sponsored!.rankingMetadata.finalRankingScore)).toBe(true);
    for (const item of feed.jobs) {
      if (item.job.jobId !== "job-1") expect(item.rankingMetadata.sponsored).toBe(false);
    }
  });

  it("flags exactly the configured exploration target share when the pool is cold", async () => {
    const database = new InMemoryFeedDatabase({ jobs: jobs(5) });
    const feed = await serviceFor(database).getFeed({ userId: null, userLocation: { latitude: 0, longitude: 0 }, now: NOW });
    const flagged = feed.jobs.filter((item) => item.rankingMetadata.exploration);
    expect(flagged).toHaveLength(Math.ceil(5 * rankingConfig.exploration.targetShare));
    for (const item of flagged) expect(item.rankingMetadata.exploration).toBe(true);
  });

  it("is finite and self-consistent on every item (positions, metadata, no NaN)", async () => {
    const database = new InMemoryFeedDatabase({ jobs: jobs(8), boosts: [boost("job-2", "emp-job-2")], employerQuality: [highQuality("emp-job-2")] });
    const feed = await serviceFor(database).getFeed({ userId: null, userLocation: { latitude: 0, longitude: 0 }, now: NOW });
    expect(feed.jobs).toHaveLength(8);
    for (const item of feed.jobs) {
      expect(Number.isInteger(item.feedPosition)).toBe(true);
      expect(item.feedPosition).toBeGreaterThanOrEqual(1);
      expect(item.feedPosition).toBeLessThanOrEqual(8);
      expect(Number.isFinite(item.rankingMetadata.finalRankingScore)).toBe(true);
      expect(item.rankingMetadata.sponsoredMultiplier).toBeGreaterThanOrEqual(rankingConfig.sponsored.minMultiplier - 1e-9);
      expect(item.rankingMetadata.sponsoredMultiplier).toBeLessThanOrEqual(rankingConfig.sponsored.maxMultiplier + 1e-9);
    }
  });

  it("buildFinalPool exposes the bounded phase 6 pool for observability", async () => {
    const database = new InMemoryFeedDatabase({ jobs: jobs(6) });
    const pool = await serviceFor(database).buildFinalPool({ userId: null, userLocation: { latitude: 0, longitude: 0 }, now: NOW });
    expect(pool).toHaveLength(6);
    for (const candidate of pool as Phase6Candidate[]) {
      expect(Number.isFinite(candidate.finalRankingScore)).toBe(true);
      expect(typeof candidate.jobId).toBe("string");
    }
  });
});

// ---------------------------------------------------------------------------
// Pagination over the full pool
// ---------------------------------------------------------------------------

describe("RecommendationFeedService — pagination", () => {
  const catalog = () => new InMemoryFeedDatabase({ jobs: jobs(6) });
  const base = { userId: null, userLocation: { latitude: 0, longitude: 0 }, now: NOW } as const;

  it("walks three pages with no duplicates, contiguous positions and a consistent cursor chain", async () => {
    const database = catalog();
    const seen: FeedJobDisplay[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const feed = await serviceFor(database).getFeed({ ...base, pageSize: 2, cursor });
      pages += 1;
      seen.push(...feed.jobs.map((item) => item.job));
      cursor = feed.nextCursor;
      expect(feed.hasMore).toBe(cursor !== null);
      if (!feed.hasMore) break;
    } while (cursor !== null);

    expect(pages).toBe(3);
    expect(seen).toHaveLength(6);
    expect(new Set(seen.map((j) => j.jobId)).size).toBe(6);
  });

  it("keeps the query count constant regardless of page size (no per-page N+1)", async () => {
    const database = catalog();
    const counts = await Promise.all([1, 3, 6, undefined].map(async (pageSize) => {
      const perCall = new InMemoryFeedDatabase({ jobs: jobs(6) });
      await serviceFor(perCall).getFeed({ ...base, pageSize });
      return perCall.queryCount;
    }));
    expect(new Set(counts).size).toBe(1);
    const one = new InMemoryFeedDatabase({ jobs: jobs(6) });
    await serviceFor(one).getFeed({ ...base, pageSize: 2 });
    expect(one.retrievalQueries).toBe(4);
    expect(one.boostQueries).toBe(1);
    expect(one.displayQueries).toBe(1);
    expect(one.queryCount).toBe(9); // retrieval 4 + scoring 3 + boosts 1 + display 1
  });

  it("rejects a malformed cursor through the service", async () => {
    const database = catalog();
    await expect(serviceFor(database).getFeed({ ...base, cursor: "not-base64!!" })).rejects.toBeInstanceOf(InvalidFeedCursorError);
  });

  it("rejects a version-mismatched cursor through the service", async () => {
    const database = catalog();
    const cursor = encodeFeedCursor({ v: "v9.9.9", s: 0.5, j: "job-0" });
    await expect(serviceFor(database).getFeed({ ...base, cursor })).rejects.toBeInstanceOf(InvalidFeedCursorError);
  });

  it("rejects a stale cursor naming a job that is no longer in the pool", async () => {
    const database = catalog();
    const cursor = encodeFeedCursor({ v: VERSION, s: 0.5, j: "vanished-job" });
    await expect(serviceFor(database).getFeed({ ...base, cursor })).rejects.toBeInstanceOf(InvalidFeedCursorError);
  });

  it("resumes exactly where the previous page stopped and reaches the end", async () => {
    const database = catalog();
    const first = await serviceFor(database).getFeed({ ...base, pageSize: 4 });
    expect(first.hasMore).toBe(true);
    const second = await serviceFor(database).getFeed({ ...base, pageSize: 4, cursor: first.nextCursor });
    expect(second.jobs.map((item) => item.feedPosition)).toEqual([5, 6]);
    expect(second.hasMore).toBe(false);
    expect(second.nextCursor).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Identity, location and behavior wiring
// ---------------------------------------------------------------------------

describe("RecommendationFeedService — identity & location", () => {
  it("adds the behavioral affinity load when a user id is supplied", async () => {
    const database = new InMemoryFeedDatabase({
      jobs: jobs(4),
      events: clicks("worker-u", ["emp-job-0", "emp-job-1", "emp-job-2", "emp-job-3", "emp-job-0", "emp-job-1"]),
    });
    await serviceFor(database).getFeed({ userId: "worker-u", userLocation: { latitude: 0, longitude: 0 }, now: NOW });
    expect(database.queryCount).toBe(10); // retrieval 4 + scoring 4 (events) + boosts 1 + display 1
  });

  it("runs fewer retrieval sources and exposes null distance when the worker location is unknown", async () => {
    const database = new InMemoryFeedDatabase({ jobs: jobs(5) });
    const feed = await serviceFor(database).getFeed({ userId: null, userLocation: null, now: NOW });
    expect(feed.jobs).toHaveLength(5);
    expect(database.retrievalQueries).toBe(2); // trending + exploration; geo/general/preferences skipped
    expect(database.queryCount).toBe(7); // retrieval 2 + scoring 3 + boosts 1 + display 1
    for (const item of feed.jobs) expect(item.rankingMetadata.distanceKm).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// tRPC wiring: middleware semantics + endpoint presence
// ---------------------------------------------------------------------------

const HOMLO_USER: HomloSessionUser = {
  id: "worker-1",
  status: "active",
  profileComplete: true,
  role: "worker",
  fullName: "Test Worker",
  email: "worker@test.dev",
};

const probeRouter = router({
  probe: supabaseProtectedProcedure.query(() => "ok" as const),
});

describe("supabaseProtectedProcedure middleware", () => {
  it("rejects when no homlo session is present", async () => {
    const caller = probeRouter.createCaller({} as TrpcContext);
    await expect(caller.probe()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects when the user is resolved but the access token is missing", async () => {
    const caller = probeRouter.createCaller({ homloUser: HOMLO_USER, supabaseAccessToken: null } as TrpcContext);
    await expect(caller.probe()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("runs the resolver when both user and access token are present", async () => {
    const caller = probeRouter.createCaller({ homloUser: HOMLO_USER, supabaseAccessToken: "tok-1" } as TrpcContext);
    await expect(caller.probe()).resolves.toBe("ok");
  });
});

describe("appRouter — homlo.recommendations.feed wiring", () => {
  it("exposes the feed query on the app router", () => {
    const caller = appRouter.createCaller({} as TrpcContext);
    expect(typeof (caller.homlo.recommendations.feed as unknown as (...args: unknown[]) => unknown)).toBe("function");
  });

  it("rejects an unauthenticated feed request before touching the service", async () => {
    const caller = appRouter.createCaller({} as TrpcContext);
    await expect(caller.homlo.recommendations.feed({})).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects a request with only the token but no resolved user", async () => {
    const caller = appRouter.createCaller({ homloUser: null, supabaseAccessToken: "tok-1" } as TrpcContext);
    await expect(caller.homlo.recommendations.feed({})).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("reaches the service layer once authenticated (fails only on missing Supabase credentials)", async () => {
    const caller = appRouter.createCaller({ homloUser: HOMLO_USER, supabaseAccessToken: "tok-1" } as TrpcContext);
    await expect(caller.homlo.recommendations.feed({})).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
});