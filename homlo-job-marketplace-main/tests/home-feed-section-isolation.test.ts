import { describe, expect, it, vi } from "vitest";

import type { DatabaseAdapter, QueryResult, SqlParameter } from "../backend/infrastructure/database/DatabaseAdapter";
import { HomeFeedService } from "../server/home-feed";

/**
 * A home-feed database whose individual read models fail independently, so a
 * single broken query cannot take the rest of the homepage down with it.
 */
class SectionFailureDatabase implements DatabaseAdapter {
  constructor(private readonly failing: string) {}

  async query<Row extends Record<string, unknown> = Record<string, unknown>>(
    statement: string,
    _parameters: readonly SqlParameter[] = [],
  ): Promise<QueryResult<Row>> {
    if (statement.includes(this.failing)) {
      throw new Error(`simulated backend failure: ${this.failing}`);
    }
    if (statement.includes("homlo_list_public_published_jobs")) {
      const row = {
        id: "pool-1",
        title: "Pool Job",
        description: "Weekend warehouse shifts",
        pay_amount: 20,
        pay_currency: "USD",
        pay_type: "hourly",
        location_text: "Phnom Penh",
        work_arrangement: null,
        latitude: 11.5,
        longitude: 104.9,
        workers_needed: 2,
        created_at: new Date().toISOString(),
        category: "Hospitality",
        employer_name: "Acme",
        employer_photo_key: null,
        banner_image: null,
        relevance_score: 0,
      };
      return { rows: [row] as unknown as Row[], rowCount: 1 };
    }
    return { rows: [] as Row[], rowCount: 0 };
  }

  transaction<T>(work: (database: DatabaseAdapter) => Promise<T>): Promise<T> {
    return work(this);
  }
}

describe("HomeFeedService — section fault isolation", () => {
  it("omits sectionErrors entirely when every section loads", async () => {
    const database = new SectionFailureDatabase("never-matches");
    const feed = await new HomeFeedService(database).getHomeFeed({ now: new Date() });
    expect(feed.sectionErrors).toBeUndefined();
    expect("sectionErrors" in feed).toBe(false);
  });

  it("reports a failing Featured query instead of pretending it is empty", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const database = new SectionFailureDatabase("from boosts b");
    const feed = await new HomeFeedService(database).getHomeFeed({ now: new Date() });

    expect(feed.featured).toEqual([]);
    expect(feed.sectionErrors).toEqual([{ section: "featured", code: "SECTION_QUERY_FAILED" }]);
    expect(spy).toHaveBeenCalledWith(
      "[HomeFeed] Section failed",
      expect.objectContaining({ section: "featured", code: "SECTION_QUERY_FAILED" }),
    );
    spy.mockRestore();
  });

  it("keeps the rest of the homepage intact when the public pool fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const database = new SectionFailureDatabase("homlo_list_public_published_jobs");
    const feed = await new HomeFeedService(database).getHomeFeed({ now: new Date() });

    expect(feed.sectionErrors).toEqual([{ section: "publicPool", code: "SECTION_QUERY_FAILED" }]);
    expect(feed.total).toBe(0);
    expect(feed.specialized).toEqual([]);
    expect(feed.remote).toEqual([]);
    expect(feed.weekend).toEqual([]);
    expect(feed.more).toEqual([]);
    vi.restoreAllMocks();
  });

  it("still returns a well-formed response when the geo search fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const database = new SectionFailureDatabase("homlo_search_public_jobs");
    const feed = await new HomeFeedService(database).getHomeFeed({
      now: new Date(),
      latitude: 11.5,
      longitude: 104.9,
    });

    expect(feed.nearby).toEqual([]);
    expect(feed.sectionErrors).toEqual([{ section: "nearby", code: "SECTION_QUERY_FAILED" }]);
    expect(feed.total).toBe(1);
    vi.restoreAllMocks();
  });

  it("does not report a section as failed when it is legitimately empty", async () => {
    const database = new SectionFailureDatabase("never-matches");
    const feed = await new HomeFeedService(database).getHomeFeed({ now: new Date() });
    expect(feed.featured).toEqual([]);
    expect(feed.sectionErrors).toBeUndefined();
  });
});
