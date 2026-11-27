import { describe, expect, it } from "vitest";

import { isNewApplicant } from "../lib/new-applicants";
import { mapBackendStatus } from "../src/new/applications/status";

describe("isNewApplicant", () => {
  it("keeps unread applicants that are still pending", () => {
    expect(isNewApplicant({ isNew: true, status: "applied" })).toBe(true);
    expect(isNewApplicant({ isNew: true, status: "reviewed" })).toBe(true);
  });

  it("drops accepted applicants even when the read receipt was never set", () => {
    expect(isNewApplicant({ isNew: true, status: "hired" })).toBe(false);
    expect(isNewApplicant({ isNew: true, status: "interview" })).toBe(false);
  });

  it("drops declined and withdrawn applicants", () => {
    expect(isNewApplicant({ isNew: true, status: "declined" })).toBe(false);
    expect(isNewApplicant({ isNew: true, status: "withdrawn" })).toBe(false);
  });

  it("drops anything already read", () => {
    expect(isNewApplicant({ isNew: false, status: "applied" })).toBe(false);
  });
});

describe("status pill mapping", () => {
  it("passes already-mapped states through and maps rejected to declined", () => {
    expect(mapBackendStatus("waiting")).toBe("waiting");
    expect(mapBackendStatus("accepted")).toBe("accepted");
    expect(mapBackendStatus("rejected")).toBe("declined");
  });
});
