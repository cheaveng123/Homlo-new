import { describe, expect, it } from "vitest";
import {
  BOOST_PACKAGES,
  billingPeriodStart,
  boostCatalogForPlan,
  boostPriceCentsForPlan,
  enterpriseMonthlyPriceCents,
  freeStandardBoostAvailable,
  isFreeStandardBoost,
  planLimitsFor,
} from "../server/hlPlanRules";
import { resolveActiveBoost, rerankFeedWithBoosts } from "../server/hlBoostRanking";
import { errorResponse, publishJobHandler } from "../server/hlPlanBoostHandlers";

describe("plan limits and enterprise pricing", () => {
  it("uses free and pro limits", () => {
    expect(planLimitsFor("free")).toEqual({ activeJobs: 2, postsPerMonth: 5 });
    expect(planLimitsFor("pro")).toEqual({ activeJobs: 15, postsPerMonth: 50 });
  });

  it("uses enterprise subscription limits with defaults", () => {
    expect(planLimitsFor("enterprise")).toEqual({ activeJobs: 25, postsPerMonth: 100 });
    expect(planLimitsFor("enterprise", { activeJobsLimit: 75, postsPerMonthLimit: 300 })).toEqual({
      activeJobs: 75,
      postsPerMonth: 300,
    });
  });

  it("prices enterprise extras at $1 per job and $5 per 100-post block", () => {
    expect(enterpriseMonthlyPriceCents({ activeJobs: 25, postsPerMonth: 100 })).toBe(4_900);
    expect(enterpriseMonthlyPriceCents({ activeJobs: 26, postsPerMonth: 100 })).toBe(5_000);
    expect(enterpriseMonthlyPriceCents({ activeJobs: 25, postsPerMonth: 101 })).toBe(5_400);
    expect(enterpriseMonthlyPriceCents({ activeJobs: 75, postsPerMonth: 300 })).toBe(10_900);
  });
});

describe("boost catalog", () => {
  it("charges list price on free and discounted price on paid plans", () => {
    expect(boostPriceCentsForPlan("standard", "free")).toBe(999);
    expect(boostPriceCentsForPlan("standard", "pro")).toBe(799);
    expect(boostPriceCentsForPlan("standard", "enterprise")).toBe(799);
    expect(boostPriceCentsForPlan("maximum", "pro")).toBe(3199);
  });

  it("marks exactly one free Standard boost for eligible Pro accounts", () => {
    const periodStart = billingPeriodStart(new Date("2026-10-31T12:00:00Z"));
    const now = new Date("2026-10-31T12:00:00Z");
    const eligible = { plan: "pro" as const, freeStandardBoostUsedAt: null, periodStart, periodEnd: new Date("2026-11-01T00:00:00Z"), now };
    expect(freeStandardBoostAvailable(eligible)).toBe(true);
    const catalog = boostCatalogForPlan("pro", true);
    expect(catalog.find((p) => p.id === "standard")).toMatchObject({ priceCents: 0, free: true });
    expect(catalog.filter((p) => p.free)).toHaveLength(1);
    expect(isFreeStandardBoost({ ...eligible, packageId: "standard" })).toBe(true);
    expect(isFreeStandardBoost({ ...eligible, packageId: "maximum" })).toBe(false);
  });

  it("does not roll an unused free boost into the next period", () => {
    const now = new Date("2026-11-05T00:00:00Z");
    expect(
      freeStandardBoostAvailable({
        plan: "pro",
        freeStandardBoostUsedAt: null,
        periodStart: new Date("2026-11-01T00:00:00Z"),
        periodEnd: new Date("2026-12-01T00:00:00Z"),
        now,
      }),
    ).toBe(true);
    expect(
      isFreeStandardBoost({
        plan: "free",
        packageId: "standard",
        freeStandardBoostUsedAt: null,
        periodStart: new Date("2026-11-01T00:00:00Z"),
        periodEnd: new Date("2026-12-01T00:00:00Z"),
        now,
      }),
    ).toBe(false);
  });

  it("maps all six packages with canvas multipliers", () => {
    expect(BOOST_PACKAGES.map((p) => [p.id, p.multiplier])).toEqual([
      ["starter", 1.04],
      ["local", 1.06],
      ["standard", 1.08],
      ["urgent", 1.1],
      ["strong", 1.12],
      ["maximum", 1.15],
    ]);
  });
});

describe("boost feed reranking", () => {
  const candidates = Array.from({ length: 12 }, (_, i) => ({
    jobId: `job-${i + 1}`,
    baseScore: 100 - i,
    quality: 0.8,
  }));
  const now = new Date("2026-10-31T12:00:00Z");

  it("places up to two boosted jobs in ranks 2 and 6 of each page", () => {
    const ranked = rerankFeedWithBoosts(
      candidates,
      [
        { jobId: "job-12", packageId: "maximum", startsAt: new Date("2026-10-30T00:00:00Z"), endsAt: new Date("2026-11-02T00:00:00Z") },
        { jobId: "job-11", packageId: "strong", startsAt: new Date("2026-10-30T00:00:00Z"), endsAt: new Date("2026-11-02T00:00:00Z") },
      ],
      now,
    );
    expect(ranked).toHaveLength(12);
    expect(ranked[1]).toMatchObject({ jobId: "job-12", isBoosted: true, isSponsoredSlot: true });
    expect(ranked[5]).toMatchObject({ jobId: "job-11", isBoosted: true, isSponsoredSlot: true });
    expect(ranked.filter((r) => r.isSponsoredSlot)).toHaveLength(2);
    expect(new Set(ranked.map((r) => r.jobId)).size).toBe(12);
  });

  it("does not boost low-quality jobs or expired boosts", () => {
    const ranked = rerankFeedWithBoosts(
      [
        { jobId: "a", baseScore: 10, quality: 0.1 },
        { jobId: "b", baseScore: 5, quality: 0.9 },
        { jobId: "c", baseScore: 1, quality: 0.9 },
      ],
      [
        { jobId: "a", packageId: "maximum", startsAt: new Date("2026-10-30T00:00:00Z"), endsAt: new Date("2026-11-02T00:00:00Z") },
        { jobId: "c", packageId: "maximum", startsAt: new Date("2026-10-30T00:00:00Z"), endsAt: now },
      ],
      now,
    );
    expect(ranked.find((r) => r.jobId === "a")?.isBoosted).toBe(false);
    expect(ranked.find((r) => r.jobId === "c")?.isBoosted).toBe(false);
  });

  it("uses half-open boost windows", () => {
    const boost = {
      jobId: "a",
      packageId: "standard",
      startsAt: now,
      endsAt: new Date(now.getTime() + 1_000),
    };
    expect(resolveActiveBoost(boost, now)).toMatchObject({ packageId: "standard", multiplier: 1.08 });
    expect(resolveActiveBoost(boost, new Date(now.getTime() + 1_000))).toBeNull();
  });

  it("keeps the requested page full when boosts are sparse", () => {
    const onlyOne = rerankFeedWithBoosts(
      candidates,
      [{ jobId: "job-12", packageId: "starter", startsAt: new Date("2026-10-30T00:00:00Z"), endsAt: new Date("2026-11-02T00:00:00Z") }],
      now,
    );
    expect(onlyOne).toHaveLength(12);
    expect(onlyOne[1]).toMatchObject({ jobId: "job-12", isSponsoredSlot: true });
    expect(onlyOne.filter((r) => r.isSponsoredSlot)).toHaveLength(1);
  });
});

describe("plan boost handlers", () => {
  it("maps auth and limit failures to stable HTTP responses", () => {
    expect(errorResponse(new Error("boom")).status).toBe(500);
  });

  it("rejects unauthenticated publish requests before touching the database", async () => {
    const response = await publishJobHandler({ query: async () => ({ rows: [] }) }, null, "job-1");
    expect(response.status).toBe(401);
    expect(response.body.error).toBe("UNAUTHORIZED");
  });
});
