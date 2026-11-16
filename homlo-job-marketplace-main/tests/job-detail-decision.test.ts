import { describe, expect, it } from "vitest";
import { isCanonicalJobId, jobDetailDecision, type JobDetailDecision } from "../lib/job-detail-decision";

describe("isCanonicalJobId", () => {
  it("accepts real UUID job ids", () => {
    expect(isCanonicalJobId("33333333-3333-4333-8333-333333333333")).toBe(true);
    expect(isCanonicalJobId("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  it("rejects curated/demo ids", () => {
    expect(isCanonicalJobId("restaurant-server")).toBe(false);
    expect(isCanonicalJobId("event-staff")).toBe(false);
    expect(isCanonicalJobId("")).toBe(false);
  });
});

describe("jobDetailDecision", () => {
  const canonical = "33333333-3333-4333-8333-333333333333";
  const curated = "restaurant-server";

  it("shows the detail when a live job is found", () => {
    expect(jobDetailDecision({ id: canonical } as { id: string }, canonical, null)).toBe("detail");
  });

  it("shows unavailable for a canonical backend id not found after load", () => {
    expect(jobDetailDecision(undefined, canonical, null)).toBe("unavailable");
  });

  it("shows retry when the jobs query errored for a canonical id", () => {
    expect(jobDetailDecision(undefined, canonical, new Error("boom"))).toBe("error");
  });

  it("keeps the curated/mock fallback for a non-canonical id", () => {
    expect(jobDetailDecision(undefined, curated, null)).toBe("detail");
  });

  it("never reports 'unavailable' for a curated id even with an error", () => {
    expect(jobDetailDecision(undefined, curated, new Error("boom"))).toBe("detail");
  });
});
