import { describe, expect, it } from "vitest";
import { QueryClient, QueryObserver } from "@tanstack/react-query";

import {
  isAwaitingData,
  jobsJoinSettled,
  sectionLoadState,
} from "../lib/useFirstLoadSkeletonFlag";

// Home sections (and the /jobs/* lists) must show a skeleton until their data
// has genuinely settled, and disappear only when it settled with zero jobs.
// Regression: right after sign-in, the query cache is cleared; the feed's job
// ids stayed on screen but the job records were re-requested, the sections
// computed zero cards with `isLoading` false, and vanished.

describe("sectionLoadState", () => {
  it("shows cards whenever there are items, even mid-refetch", () => {
    expect(sectionLoadState({ settled: false, count: 3 })).toBe("ready");
    expect(sectionLoadState({ settled: true, count: 1 })).toBe("ready");
  });

  it("is loading (skeleton) while there are no items and data has not settled", () => {
    expect(sectionLoadState({ settled: false, count: 0 })).toBe("loading");
  });

  it("is empty only when settled with zero items", () => {
    expect(sectionLoadState({ settled: true, count: 0 })).toBe("empty");
  });
});

describe("jobsJoinSettled", () => {
  it("is not settled while the ranked ids are still loading", () => {
    expect(jobsJoinSettled({ idsSettled: false, idCount: 0, recordsLoaded: false })).toBe(false);
  });

  it("is not settled when ids are in but their job records are not (post-login case)", () => {
    expect(jobsJoinSettled({ idsSettled: true, idCount: 5, recordsLoaded: false })).toBe(false);
  });

  it("is settled once ids and records are both in", () => {
    expect(jobsJoinSettled({ idsSettled: true, idCount: 5, recordsLoaded: true })).toBe(true);
  });

  it("is settled with zero ids without waiting for records (records query is skipped)", () => {
    expect(jobsJoinSettled({ idsSettled: true, idCount: 0, recordsLoaded: false })).toBe(true);
  });

  it("feeds a skeleton, not an empty section, for ids-without-records", () => {
    const settled = jobsJoinSettled({ idsSettled: true, idCount: 5, recordsLoaded: false });
    expect(sectionLoadState({ settled, count: 0 })).toBe("loading");
  });
});

describe("isAwaitingData", () => {
  it("is true with no data and no error, false once either arrives", () => {
    expect(isAwaitingData({ data: undefined, isError: false })).toBe(true);
    expect(isAwaitingData({ data: { jobs: [] }, isError: false })).toBe(false);
    expect(isAwaitingData({ data: undefined, isError: true })).toBe(false);
  });

  it("stays true for a query rebuilt empty by queryClient.clear(), where isLoading is false", () => {
    const client = new QueryClient();
    const key = ["homlo", "publicJobs"];
    client.setQueryData(key, { jobs: [{ id: "1" }] });
    client.clear(); // what sign-in / sign-out does

    // A disabled observer never starts a fetch: `isLoading` (isPending &&
    // isFetching) is false although there is no data — the misleading state.
    const observer = new QueryObserver(client, { queryKey: key, queryFn: async () => ({ jobs: [] }), enabled: false });
    const result = observer.getCurrentResult();
    expect(result.data).toBeUndefined();
    expect(result.isLoading).toBe(false);
    expect(isAwaitingData(result)).toBe(true);
  });
});
