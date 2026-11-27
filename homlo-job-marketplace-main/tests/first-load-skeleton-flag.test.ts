import { describe, expect, it } from "vitest";

import { canShowEmptyState, useFirstLoadSkeletonFlag } from "../lib/useFirstLoadSkeletonFlag";

// Pure function despite the `use` prefix (no React hooks inside), so it can be called directly.
describe("useFirstLoadSkeletonFlag", () => {
  it("shows the skeleton while the first load has no data", () => {
    expect(useFirstLoadSkeletonFlag({ loading: true, data: undefined })).toBe(true);
    expect(useFirstLoadSkeletonFlag({ isLoading: true, data: undefined })).toBe(true);
  });

  it("treats an empty list as no data while loading", () => {
    expect(useFirstLoadSkeletonFlag({ loading: true, data: [] })).toBe(true);
  });

  it("hides the skeleton once there is data or loading is done", () => {
    expect(useFirstLoadSkeletonFlag({ loading: true, data: [{ id: "1" }] })).toBe(false);
    expect(useFirstLoadSkeletonFlag({ loading: false, data: [] })).toBe(false);
  });
});

describe("canShowEmptyState", () => {
  it("allows the empty state for a finished, empty list", () => {
    expect(canShowEmptyState({ loading: false, data: [] })).toBe(true);
    expect(canShowEmptyState({ loading: true, data: [] })).toBe(false);
    expect(canShowEmptyState({ loading: false, data: [], error: new Error("x") })).toBe(false);
  });
});
