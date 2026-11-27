import { describe, expect, it } from "vitest";
import { isCanonicalJobId, jobDetailDecision } from "../lib/job-detail-decision";

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

  it("shows sample content for a non-canonical id only in demo mode", () => {
    expect(jobDetailDecision(undefined, curated, null, true)).toBe("detail");
  });

  it("never shows sample content to real users (demo mode off)", () => {
    // App Store 2.3 / 5.6: no fake listings — unknown ids are "unavailable".
    expect(jobDetailDecision(undefined, curated, null, false)).toBe("unavailable");
    expect(jobDetailDecision(undefined, curated, new Error("boom"), false)).toBe("unavailable");
  });
});
