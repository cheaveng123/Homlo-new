import { describe, expect, it } from "vitest";

import { FALLBACK_JOB_IMAGE, hasBannerImage, resolveJobImage } from "@/lib/job-banner";

describe("resolveJobImage", () => {
  it("passes through a real untrimmed banner unchanged", () => {
    const banner = "data:image/jpeg;base64,QUJD";
    expect(resolveJobImage(banner)).toBe(banner);
  });

  it("trims surrounding whitespace from a banner value", () => {
    expect(resolveJobImage("  https://example.com/b.jpg  ")).toBe("https://example.com/b.jpg");
  });

  it("falls back to the brand image for null", () => {
    expect(resolveJobImage(null)).toBe(FALLBACK_JOB_IMAGE);
  });

  it("falls back to the brand image for undefined", () => {
    expect(resolveJobImage(undefined)).toBe(FALLBACK_JOB_IMAGE);
  });

  it("falls back to the brand image for an empty string", () => {
    expect(resolveJobImage("")).toBe(FALLBACK_JOB_IMAGE);
  });

  it("falls back to the brand image for whitespace-only strings", () => {
    expect(resolveJobImage("   ")).toBe(FALLBACK_JOB_IMAGE);
  });
});

describe("hasBannerImage", () => {
  it("is false for empty/whitespace-only values", () => {
    expect(hasBannerImage("")).toBe(false);
    expect(hasBannerImage("  ")).toBe(false);
    expect(hasBannerImage(null)).toBe(false);
    expect(hasBannerImage(undefined)).toBe(false);
  });

  it("is true for a trimmed real value", () => {
    expect(hasBannerImage("data:image/png;base64,QQ==")).toBe(true);
    expect(hasBannerImage("  https://example.com/a.jpg  ")).toBe(true);
  });
});