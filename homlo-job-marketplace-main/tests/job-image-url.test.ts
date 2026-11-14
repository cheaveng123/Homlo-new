import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { JOB_IMAGES_BUCKET, buildPublicJobImageUrl } from "../lib/job-images-shared";
import { publicBannerUrl } from "../supabase/functions/_shared/public-job-feed";

const feedSource = readFileSync(
  resolve(process.cwd(), "supabase/functions/homlo-public-job-feed/index.ts"),
  "utf8",
);

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

describe("publicBannerUrl", () => {
  it("keeps public HTTP(S) URLs", () => {
    expect(publicBannerUrl("https://example.supabase.co/a.jpg")).toBe(
      "https://example.supabase.co/a.jpg",
    );
    expect(publicBannerUrl("  http://example.com/a.jpg  ")).toBe("http://example.com/a.jpg");
  });

  it("drops local, non-HTTP, and non-string values", () => {
    expect(publicBannerUrl("file:///var/mobile/tmp/photo.jpg")).toBeNull();
    expect(publicBannerUrl("data:image/jpeg;base64,abc")).toBeNull();
    expect(publicBannerUrl("images/photo.jpg")).toBeNull();
    expect(publicBannerUrl(null)).toBeNull();
    expect(publicBannerUrl(undefined)).toBeNull();
    expect(publicBannerUrl(42)).toBeNull();
  });

  it("wires sanitization into the public feed", () => {
    expect(feedSource).toContain(
      "banner_image: publicBannerUrl(job?.banner_image) ?? publicBannerUrl(job?.bannerImage)",
    );
  });
});
