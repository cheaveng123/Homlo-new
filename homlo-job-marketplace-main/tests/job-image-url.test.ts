import { describe, expect, it } from "vitest";

import { JOB_IMAGES_BUCKET, buildPublicJobImageUrl } from "../lib/job-images-shared";

describe("buildPublicJobImageUrl", () => {
  it("builds a public Supabase Storage URL", () => {
    expect(buildPublicJobImageUrl("https://example.supabase.co", "employer/job/file.jpg")).toBe(
      `https://example.supabase.co/storage/v1/object/public/${JOB_IMAGES_BUCKET}/employer/job/file.jpg`,
    );
  });

  it("normalizes trailing slashes and surrounding whitespace", () => {
    expect(buildPublicJobImageUrl("  https://example.supabase.co///  ", "a/b.jpg")).toBe(
      "https://example.supabase.co/storage/v1/object/public/job-images/a/b.jpg",
    );
  });

  it("rejects an empty Supabase URL", () => {
    expect(() => buildPublicJobImageUrl("", "a/b.jpg")).toThrow("SUPABASE_URL is required");
    expect(() => buildPublicJobImageUrl("   ", "a/b.jpg")).toThrow("SUPABASE_URL is required");
  });
});
