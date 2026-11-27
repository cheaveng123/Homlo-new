import { describe, expect, it } from "vitest";

import { jobTypeImageKey } from "@/components/shared/jobTypeImageKey";
import { JOB_CATEGORIES } from "@/constants/jobCategories";

// The keys the home row's artwork is registered under, in
// components/shared/jobTypeImage.ts. That module is not importable here because
// requiring a PNG is invalid JS to a node runner, so the key list is asserted
// literally and the mapping is checked through the asset-free normaliser.
const IMAGE_KEYS = ["part-time", "full-time", "remote", "weekends"];

describe("job type image mapping", () => {
  it("resolves every category slug used by the category pages", () => {
    for (const category of JOB_CATEGORIES) {
      const key = jobTypeImageKey(category.slug);
      expect(key, category.slug).not.toBeNull();
      expect(IMAGE_KEYS, category.slug).toContain(key);
    }
  });

  it("maps the route's singular 'weekend' slug onto the weekends artwork", () => {
    // constants/jobCategories.ts uses 'weekend'; the artwork is keyed
    // 'weekends'. Without the prefix match this row would render no image.
    expect(jobTypeImageKey("weekend")).toBe("weekends");
    expect(jobTypeImageKey("weekends")).toBe("weekends");
  });

  it("resolves the spellings the data layer actually produces", () => {
    expect(jobTypeImageKey("Part-time")).toBe("part-time");
    expect(jobTypeImageKey("Full-time")).toBe("full-time");
    expect(jobTypeImageKey("Remote")).toBe("remote");
    expect(jobTypeImageKey("part_time")).toBe("part-time");
    expect(jobTypeImageKey("full_time")).toBe("full-time");
    expect(jobTypeImageKey("weekends")).toBe("weekends");
  });

  it("ignores case, surrounding space and separators", () => {
    expect(jobTypeImageKey("  PART TIME  ")).toBe("part-time");
    expect(jobTypeImageKey("Part-Time")).toBe("part-time");
    expect(jobTypeImageKey("FULL_TIME")).toBe("full-time");
    expect(jobTypeImageKey("full  time")).toBe("full-time");
    expect(jobTypeImageKey(" Remote ")).toBe("remote");
  });

  it("still resolves a qualified label rather than giving up", () => {
    expect(jobTypeImageKey("Full-time (Permanent)")).toBe("full-time");
    expect(jobTypeImageKey("Part-time — Evenings")).toBe("part-time");
  });

  it("returns null for a type with no home artwork, so callers can omit it", () => {
    for (const label of ["Contract", "Internship", "Temporary", "", "   ", null, undefined]) {
      expect(jobTypeImageKey(label), String(label)).toBeNull();
    }
  });
});
