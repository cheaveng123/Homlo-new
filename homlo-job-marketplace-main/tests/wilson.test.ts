import { describe, expect, it } from "vitest";

import { clamp01, wilsonLowerBound } from "../backend/ranking/wilson";

describe("wilsonLowerBound", () => {
  it("returns the neutral prior when there are no trials (no divide-by-zero)", () => {
    expect(wilsonLowerBound(0, 0)).toBeCloseTo(0.5, 5);
    expect(wilsonLowerBound(10, 0)).toBeCloseTo(0.5, 5);
  });

  it("honours a custom neutral prior", () => {
    expect(wilsonLowerBound(0, 0, { neutralPrior: 0.4 })).toBeCloseTo(0.4, 5);
  });

  it("stays slightly above zero with zero successes", () => {
    const bound = wilsonLowerBound(0, 100);
    expect(bound).toBeGreaterThanOrEqual(0);
    expect(bound).toBeLessThan(0.05);
  });

  it("returns the known all-success bound", () => {
    expect(wilsonLowerBound(100, 100)).toBeCloseTo(0.963, 3);
  });

  it("returns the known 50/100 bound (a Wilson lower bound, below the point estimate)", () => {
    const bound = wilsonLowerBound(50, 100);
    expect(bound).toBeCloseTo(0.4038, 4);
    expect(bound).toBeLessThan(0.5);
  });

  it("is monotonic in successes", () => {
    expect(wilsonLowerBound(30, 100)).toBeLessThan(wilsonLowerBound(60, 100));
  });

  it("clamps inconsistent and invalid inputs instead of producing NaN", () => {
    expect(wilsonLowerBound(200, 100)).toBe(1); // s > n
    expect(wilsonLowerBound(-5, 10)).toBe(0); // negative successes clamp to zero
    expect(wilsonLowerBound(2, -5)).toBeCloseTo(0.5, 5); // negative trials clamp to n=0
    expect(wilsonLowerBound(Number.NaN, Number.NaN)).toBeCloseTo(0.5, 5); // non-finite ⇒ n=0
  });

  it("defaults invalid options to the configured values", () => {
    const fallbackDefault = wilsonLowerBound(50, 100);
    expect(wilsonLowerBound(50, 100, { z: Number.NaN, neutralPrior: Number.NaN })).toBeCloseTo(fallbackDefault, 5);
  });
});

describe("clamp01", () => {
  it("clamps into [0, 1]", () => {
    expect(clamp01(1.5)).toBe(1);
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(0.4)).toBe(0.4);
  });

  it("coerces NaN to a fallback (default 0)", () => {
    expect(clamp01(Number.NaN)).toBe(0);
    expect(clamp01(Number.NaN, 0.5)).toBe(0.5);
  });
});