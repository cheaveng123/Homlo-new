import { describe, expect, it, vi } from "vitest";

import type { DatabaseAdapter, QueryResult, SqlParameter } from "../backend/infrastructure/database/DatabaseAdapter";
import type { SpecializedField } from "../lib/specialized-fields";
import { HomeFeedService } from "../server/home-feed";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = new Date("2026-08-01T12:00:00.000Z");

function createdAgo(hours: number): Date {
  return new Date(NOW.getTime() - hours * 3_600_000);
}

type HomeSeed = {
  id: string;
  employerId: string;
  categoryId: string | null;
  category: string;
  title: string;
  description: string;
  payAmount: number;
  payCurrency: string;
  payType: "hourly" | "daily" | "fixed";
  locationText: string | null;
  latitude: number | null;
  longitude: number | null;
  workersNeeded: number;
  createdAt: Date;
  bannerImage: string | null;
};

type BoostSeed = { jobId: string; employerId: string; startAt: Date; expiresAt: Date };

function seed(id: string, overrides: Partial<HomeSeed> = {}): HomeSeed {
  return {
    id,
    employerId: `emp-${id}`,
    categoryId: "cat-other",
    category: "Other",
    title: `Job ${id}`,
    description: `Description ${id}`,
    payAmount: 25,
    payCurrency: "USD",
    payType: "hourly",
    locationText: "Test City",
    latitude: 11.5564,
    longitude: 104.9282,
    workersNeeded: 2,
    createdAt: createdAgo(2),
    bannerImage: null,
    ...overrides,
  };
}

// The boosts join compares against the live database clock (SQL now()), so
// fixtures are anchored to the real clock rather than the fixed NOW used to
// pin the recommendation pipeline's determinism.
const REAL_NOW = new Date();

function boost(jobId: string, employerId: string): BoostSeed {
  return { jobId, employerId, startAt: new Date(REAL_NOW.getTime() - 3_600_000), expiresAt: new Date(REAL_NOW.getTime() + 86_400_000) };
}

function expiredBoost(jobId: string, employerId: string): BoostSeed {
  return { jobId, employerId, startAt: new Date(REAL_NOW.getTime() - 72 * 3_600_000), expiresAt: new Date(REAL_NOW.getTime() - 24 * 3_600_000) };
}

function parseArrayParam(value: string): Set<string> {
  const trimmed = value.replace(/^{/, "").replace(/}$/, "");
  if (!trimmed) return new Set();
  return new Set(trimmed.split(","));
}

// ---------------------------------------------------------------------------
// In-memory database: routes the authoritative SQL used by HomeFeedService —
// the shared pool read model, the geo search function, the boosts join and the
// recommendation pipeline underneath — to seeded rows.
// ---------------------------------------------------------------------------

class InMemoryHomeFeedDatabase implements DatabaseAdapter {
  public poolQueries = 0;
  public searchQueries = 0;
  public featuredQueries = 0;

  constructor(
    private readonly seeds: {
      jobs: HomeSeed[];
      boosts?: BoostSeed[];
    } = { jobs: [] },
  ) {}

  private toRow(j: HomeSeed): Record<string, unknown> {
    return {
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
      category: j.category,
      employer_name: null,
      employer_photo_key: null,
      banner_image: j.bannerImage,
      relevance_score: 0,
    };
  }

  async query<Row extends Record<string, unknown> = Record<string, unknown>>(
    statement: string,
    parameters: readonly SqlParameter[] = [],
  ): Promise<QueryResult<Row>> {
    const { jobs, boosts = [] } = this.seeds;
    let raw: Record<string, unknown>[] = [];

    if (statement.includes("homlo_list_public_published_jobs")) {
      this.poolQueries += 1;
      raw = [...jobs].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).map((j) => this.toRow(j));
    } else if (statement.includes("homlo_search_public_jobs")) {
      this.searchQueries += 1;
      const limit = Number(parameters[13]);
      const bounded = Number.isFinite(limit) ? Math.max(limit, 0) : Infinity;
      raw = [...jobs]
        .filter((j) => j.latitude != null && j.longitude != null)
        .slice(0, bounded)
        .map((j) => this.toRow(j));
    } else if (statement.includes("from boosts b")) {
      this.featuredQueries += 1;
      const now = new Date();
      raw = [...jobs]
        .filter((j) => boosts.some((b) => b.jobId === j.id && new Date(b.startAt) <= now && now < new Date(b.expiresAt)))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((j) => this.toRow(j));
    } else if (statement.includes("select eje.id, j.employer_id, j.category_id, j.created_at")) {
      raw = jobs.map((j) => ({ id: j.id, employer_id: j.employerId, category_id: j.categoryId, created_at: j.createdAt.toISOString() }));
    } else if (statement.startsWith("with trending as (")) {
      raw = [];
    } else if (statement.startsWith("select id, job_id, employer_id, package, start_at, expires_at")) {
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
        start_date: null,
        start_time: null,
        end_time: null,
        created_at: j.createdAt.toISOString(),
      }));
    } else if (statement.startsWith("select employer_id, completion_rate_wilson_lb")) {
      raw = [];
    } else if (statement.startsWith("select job_id, ctr_wilson_lb")) {
      raw = [];
    } else if (statement.startsWith("select je.event_type, je.occurred_at")) {
      raw = [];
    } else if (statement.startsWith("select j.id, j.title, j.description")) {
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
        category: j.category,
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

// ---------------------------------------------------------------------------
// HomeFeedService — section composition
// ---------------------------------------------------------------------------

describe("HomeFeedService — section composition", () => {
  it("returns the typed empty contract for an empty catalog", async () => {
    const database = new InMemoryHomeFeedDatabase({ jobs: [] });
    const feed = await new HomeFeedService(database).getHomeFeed({ now: NOW });
    expect(feed).toEqual({
      nearby: [],
      recommended: [],
      featured: [],
      specialized: [],
      remote: [],
      more: [],
      total: 0,
    });
  });

  it("composes all sections for an anonymous visitor without coordinates, deduping across sections", async () => {
    const database = new InMemoryHomeFeedDatabase({
      jobs: [
        seed("t1", { categoryId: "cat-tech", category: "Technology", createdAt: createdAgo(2) }),
        seed("t2", { categoryId: "cat-tech", category: "Technology", createdAt: createdAgo(5) }),
        seed("s1", { categoryId: "cat-sales", category: "Sales", createdAt: createdAgo(3) }),
        seed("h1", { categoryId: "cat-hosp", category: "Hospitality", createdAt: createdAgo(1) }),
        seed("f1", { createdAt: createdAgo(6) }),
        seed("r1", { locationText: "Remote — anywhere in Southeast Asia", createdAt: createdAgo(4) }),
        seed("r2", { locationText: "Remote — anywhere in Southeast Asia", createdAt: createdAgo(8) }),
        seed("o1", { createdAt: createdAgo(10) }),
        seed("o2", { createdAt: createdAgo(12) }),
      ],
      boosts: [boost("f1", "emp-f1"), expiredBoost("o2", "emp-o2")],
    });

    const feed = await new HomeFeedService(database).getHomeFeed({ now: NOW });

    // Anonymous and coordinate-less: nearby and recommended are empty even
    // though the pool has jobs — never a silent "show everything" fallback.
    expect(feed.nearby).toEqual([]);
    expect(feed.recommended).toEqual([]);

    // Featured: ONLY the active boost; the expired one is not featured.
    expect(feed.featured.map((job) => job.id)).toEqual(["f1"]);

    // Specialized: only fields whose categories actually have published jobs,
    // richest first, each capped at the default section size.
    expect(feed.specialized.map((section) => section.field.id)).toEqual([
      "technology",
      "hospitality",
      "sales-and-marketing",
    ]);
    expect(feed.specialized.map((section) => section.available)).toEqual([2, 1, 1]);
    expect(feed.specialized[0].jobs.map((job) => job.id)).toEqual(["t1", "t2"]);
    expect(feed.specialized[1].jobs.map((job) => job.id)).toEqual(["h1"]);
    expect(feed.specialized[2].jobs.map((job) => job.id)).toEqual(["s1"]);

    // The other config-driven fields (construction, finance, education,
    // customer-service) have no matching published jobs → not shipped.
    const present = new Set(feed.specialized.map((section) => section.field.id));
    for (const absent of ["construction", "finance", "education", "customer-service"]) {
      expect(present.has(absent)).toBe(false);
    }

    // Remote keeps the existing location_text convention and stays disjoint
    // from More.
    expect(feed.remote.map((job) => job.id)).toEqual(["r1", "r2"]);

// More leads with the not-yet-shown leftovers (freshest first), then tops up
// with already-shown jobs when the leftover pool is smaller than the slice.
expect(feed.more.map((job) => job.id).slice(0, 2)).toEqual(["o1", "o2"]);
expect(feed.more).toHaveLength(8);
expect(feed.total).toBe(9);

const shown = new Set([
  ...feed.nearby,
  ...feed.recommended,
  ...feed.featured,
  ...feed.specialized.flatMap((section) => section.jobs),
  ...feed.remote,
].map((job) => job.id));
expect(feed.more[0]).toMatchObject({ id: "o1" });
expect(feed.more[1]).toMatchObject({ id: "o2" });
for (const job of feed.more.slice(2)) {
  expect(shown.has(job.id)).toBe(true);
}
  });

  it("serves Jobs Near You only when real coordinates are provided", async () => {
    const database = new InMemoryHomeFeedDatabase({
      jobs: [seed("a"), seed("b"), seed("c"), seed("d"), seed("e"), seed("f")],
      boosts: [],
    });
    const anonymous = await new HomeFeedService(database).getHomeFeed({
      latitude: 11.56,
      longitude: 104.92,
      radiusKm: 50,
      now: NOW,
    });
    expect(anonymous.nearby).toHaveLength(4);
    expect(anonymous.total).toBe(6);

    // The pool is smaller than the More slice, so pickSection tops up with the
    // already-shown jobs — but the not-yet-shown jobs always come first.
    const nearbyIds = new Set(anonymous.nearby.map((job) => job.id));
    expect(anonymous.more.slice(0, 2).some((job) => nearbyIds.has(job.id))).toBe(false);
    expect(anonymous.more.map((job) => job.id)).toEqual(["e", "f", "a", "b", "c", "d"]);
  });

  it("clamps section sizing to a sane range", async () => {
    const database = new InMemoryHomeFeedDatabase({
      jobs: [
        seed("t1", { categoryId: "cat-tech", category: "Technology" }),
        seed("t2", { categoryId: "cat-tech", category: "Technology" }),
        seed("t3", { categoryId: "cat-tech", category: "Technology" }),
        seed("s1", { categoryId: "cat-sales", category: "Sales" }),
      ],
      boosts: [boost("t1", "emp-t1"), boost("t2", "emp-t2")],
    });
    const feed = await new HomeFeedService(database).getHomeFeed({
      sectionSize: 10,
      moreSize: 99,
      now: NOW,
    });

    expect(feed.featured).toHaveLength(2);
    for (const section of feed.specialized) {
      expect(section.jobs.length).toBeLessThanOrEqual(8);
    }
    expect(feed.more.length).toBeLessThanOrEqual(16);
    expect(feed.total).toBe(4);
  });

  it("runs the recommendation pipeline only for a signed-in user", async () => {
    const database = new InMemoryHomeFeedDatabase({
      jobs: Array.from({ length: 6 }, (_, i) => seed(`job-${i}`, { categoryId: "cat-tech", category: "Technology" })),
      boosts: [],
    });
    const feed = await new HomeFeedService(database).getHomeFeed({
      userId: "user-1",
      userLocation: { latitude: 11.56, longitude: 104.92 },
      sectionSize: 3,
      now: NOW,
    });

    // The pipeline runs for a signed-in user and ranks a bounded slice.
    expect(feed.recommended).toHaveLength(3);
    for (const job of feed.recommended) {
      expect(["job-0", "job-1", "job-2", "job-3", "job-4", "job-5"]).toContain(job.id);
    }
    // No coordinates at the top level → nearby is deliberately empty.
    expect(feed.nearby).toEqual([]);
    expect(feed.total).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// Home-feed rotation helper
// ---------------------------------------------------------------------------

const storageState = vi.hoisted(() => {
  const map = new Map<string, string>();
  return {
    get: (key: string): string | null => map.get(key) ?? null,
    set: (key: string, value: string): void => {
      map.set(key, value);
    },
    clear: (): void => {
      map.clear();
    },
  };
});

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (key: string) => storageState.get(key),
    setItem: async (key: string, value: string) => {
      storageState.set(key, value);
    },
    removeItem: async (key: string) => {
      storageState.get(key);
    },
  },
}));

const FIELD_IDS = ["a", "b", "c"];
const THREE_FIELDS: SpecializedField[] = FIELD_IDS.map((id) => ({
  id,
  title: id,
  summary: id,
  searchCategory: id,
  categorySlugs: [id],
}));

function field(id: string): SpecializedField {
  return { id, title: id, summary: id, searchCategory: id, categorySlugs: [id] };
}

const LAST_ARRANGEMENT_KEY = "homlo.homeFeed.specializedArrangement.v1";

// A fresh module instance mimics a page reload: new session seed, no cached
// selection, and the persisted arrangement read from (mocked) storage again.
async function freshRotation(): Promise<typeof import("../lib/home-feed-rotation")> {
  vi.resetModules();
  return import("../lib/home-feed-rotation");
}

describe("home-feed rotation (pickSpecializedFields)", () => {
  it("returns nothing when no fields are eligible", async () => {
    storageState.clear();
    const { pickSpecializedFields } = await freshRotation();
    expect(await pickSpecializedFields([], 3)).toEqual([]);
  });

  it("clamps the requested count to the number of eligible fields", async () => {
    storageState.clear();
    const { pickSpecializedFields } = await freshRotation();
    const picked = await pickSpecializedFields([field("a"), field("b")], 9);
    expect(picked).toHaveLength(2);
    expect(picked.map((f) => f.id).sort()).toEqual(["a", "b"]);
  });

  it("is stable within a page session (no reshuffle on re-render)", async () => {
    storageState.clear();
    const { pickSpecializedFields } = await freshRotation();
    const first = await pickSpecializedFields(THREE_FIELDS, 3);
    const second = await pickSpecializedFields(THREE_FIELDS, 3);
    expect(first.map((f) => f.id)).toEqual(second.map((f) => f.id));
  });

  it("persists the shown arrangement for the next page visit", async () => {
    storageState.clear();
    const { pickSpecializedFields } = await freshRotation();
    const picked = await pickSpecializedFields(THREE_FIELDS, 3);
    const persisted = storageState.get(LAST_ARRANGEMENT_KEY);
    expect(persisted).not.toBeNull();
    expect(JSON.parse(persisted as string)).toEqual(picked.map((f) => f.id));
  });

  it("avoids repeating the last arrangement when an alternative exists", async () => {
    storageState.clear();
    storageState.set(LAST_ARRANGEMENT_KEY, JSON.stringify(FIELD_IDS));
    const { pickSpecializedFields } = await freshRotation();
    const picked = await pickSpecializedFields(THREE_FIELDS, 3);
    expect(picked.map((f) => f.id)).not.toEqual(FIELD_IDS);
  });

  it("falls back to the only arrangement when the persisted one is the only option", async () => {
    storageState.clear();
    storageState.set(LAST_ARRANGEMENT_KEY, JSON.stringify(["a"]));
    const { pickSpecializedFields } = await freshRotation();
    const picked = await pickSpecializedFields([field("a")], 3);
    expect(picked.map((f) => f.id)).toEqual(["a"]);
  });
});