import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatAppliedDate, formatArrangement, formatPay } from "../src/new/applications/format";
import { labelForState, stateForStatus } from "../src/new/applications/statusMap";
import { mapBackendStatus } from "../src/new/applications/status";

describe("application status map", () => {
  it("groups backend statuses into the three worker-facing states", () => {
    expect(stateForStatus("applied")).toBe("waiting");
    expect(stateForStatus("reviewed")).toBe("waiting");
    expect(stateForStatus("interview")).toBe("accepted");
    expect(stateForStatus("hired")).toBe("accepted");
    expect(stateForStatus("declined")).toBe("declined");
    expect(stateForStatus("withdrawn")).toBe("declined");
  });

  it("fails closed to Waiting for unknown or missing statuses", () => {
    expect(stateForStatus("submitted")).toBe("waiting");
    expect(stateForStatus(null)).toBe("waiting");
    expect(stateForStatus(undefined)).toBe("waiting");
  });

  it("labels each presentation state", () => {
    expect(labelForState("waiting")).toBe("Waiting");
    expect(labelForState("accepted")).toBe("Accepted");
    expect(labelForState("declined")).toBe("Declined");
  });
});

describe("application status mapping (status.ts)", () => {
  it("maps all backend statuses to the three worker-facing states", () => {
    expect(mapBackendStatus("applied")).toBe("waiting");
    expect(mapBackendStatus("reviewed")).toBe("waiting");
    expect(mapBackendStatus("interview")).toBe("accepted");
    expect(mapBackendStatus("hired")).toBe("accepted");
    expect(mapBackendStatus("declined")).toBe("declined");
    expect(mapBackendStatus("withdrawn")).toBe("declined");
  });

  it("fails closed to Waiting for unknown, missing, or null statuses", () => {
    expect(mapBackendStatus("submitted")).toBe("waiting");
    expect(mapBackendStatus(null)).toBe("waiting");
    expect(mapBackendStatus(undefined)).toBe("waiting");
    expect(mapBackendStatus("")).toBe("waiting");
  });
});


describe("application formatting", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 29, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses compact relative dates near today", () => {
    expect(formatAppliedDate(new Date(2026, 9, 29, 8).toISOString())).toBe("Today");
    expect(formatAppliedDate(new Date(2026, 9, 28, 8).toISOString())).toBe("Yesterday");
    expect(formatAppliedDate(new Date(2026, 9, 26, 8).toISOString())).toBe("3 days ago");
  });

  it("falls back to a day and short month for older applications", () => {
    expect(formatAppliedDate(new Date(2026, 9, 12, 8).toISOString())).toMatch(/^12 \w+/);
  });

  it("omits invalid dates", () => {
    expect(formatAppliedDate("not-a-date")).toBe("");
    expect(formatAppliedDate(null)).toBe("");
  });

  it("formats pay with the job pay type", () => {
    expect(formatPay(15, "USD", "hourly")).toBe("$15/hr");
    expect(formatPay("40000", "KHR", "daily")).toContain("KHR");
    expect(formatPay("40000", "KHR", "daily")).toContain("/day");
    expect(formatPay(500, "USD", "fixed")).toBe("$500 fixed");
    expect(formatPay(null, "USD", "hourly")).toBeNull();
    expect(formatPay("nope", "USD", "hourly")).toBeNull();
  });

  it("joins location and arrangement, omitting missing halves", () => {
    expect(formatArrangement("Phnom Penh", "On-site")).toBe("Phnom Penh · On-site");
    expect(formatArrangement(null, "Remote")).toBe("Remote");
    expect(formatArrangement("Phnom Penh", null)).toBe("Phnom Penh");
    expect(formatArrangement(null, null)).toBeNull();
  });
});
