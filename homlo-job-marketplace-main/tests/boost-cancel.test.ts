import { describe, expect, it } from "vitest";

import { cancelOwnerBoosts } from "../server/boost/boostService";

type Call = { text: string; params: unknown[] };

function fakeDb(boostRowsCancelled: number) {
  const calls: Call[] = [];
  return {
    calls,
    async query<T>(text: string, params: unknown[] = []) {
      calls.push({ text, params });
      if (/update public\.boosts/.test(text)) {
        return { rows: Array.from({ length: boostRowsCancelled }, (_, i) => ({ id: `boost-${i}` })) as T[] };
      }
      return { rows: [] as T[] };
    },
  };
}

describe("cancelOwnerBoosts", () => {
  it("cancels the job's active and queued boosts for the owner only", async () => {
    const db = fakeDb(2);
    const result = await cancelOwnerBoosts(db, "job-1", "employer-1");

    expect(result).toEqual({ cancelled: 2 });
    const [boosts, ledger] = db.calls;
    expect(boosts.text).toContain("employer_id = $2");
    expect(boosts.text).toContain("status in ('active', 'scheduled')");
    expect(boosts.params).toEqual(["job-1", "employer-1"]);
    expect(ledger.text).toContain("update public.job_boosts");
    expect(ledger.params).toEqual(["job-1", "employer-1"]);
  });

  it("leaves purchase records alone when there was nothing to cancel", async () => {
    const db = fakeDb(0);
    const result = await cancelOwnerBoosts(db, "job-1", "someone-else");

    expect(result).toEqual({ cancelled: 0 });
    expect(db.calls).toHaveLength(1);
  });
});
