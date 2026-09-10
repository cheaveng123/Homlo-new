import { describe, expect, it } from "vitest";

import {
  buildJobSaveInput,
  defaultJobPosting,
  draftFromRemoteJob,
  validatePostingStep,
} from "../lib/job-posting";

describe("Homlo-only application channel", () => {
  it("has no external-contact or external-link fields on the draft type", () => {
    const keys = Object.keys(defaultJobPosting);
    expect(keys).not.toContain("applicationMethod");
    expect(keys).not.toContain("applicationUrl");
    expect(keys).not.toContain("contactEmail");
  });

  it("does not require an external link or contact email on the application step", () => {
    const errors = validatePostingStep(5, defaultJobPosting);
    expect(errors).toEqual({});
  });

  it("builds the save input without any external application fields", () => {
    const input = buildJobSaveInput(defaultJobPosting, "draft", null);
    expect(input).not.toHaveProperty("applicationMethod");
    expect(input).not.toHaveProperty("applicationUrl");
    expect(input).not.toHaveProperty("contactEmail");
  });

  it("hydrates a draft from a remote job without application-method fields", () => {
    const remote = {
      id: "job-1",
      title: "Waiter",
      description: "Serve guests",
      pay_amount: 500,
      pay_currency: "USD",
      pay_type: "fixed" as const,
      location_text: "Phnom Penh",
      latitude: null,
      longitude: null,
      status: "open",
      created_at: "2026-01-01T00:00:00.000Z",
    };
    const draft = draftFromRemoteJob(remote);
    expect(draft).not.toHaveProperty("applicationMethod");
    expect(draft).not.toHaveProperty("applicationUrl");
    expect(draft).not.toHaveProperty("contactEmail");
    // The sample used by employers for messaging remains the title.
    expect(draft.title).toBe("Waiter");
  });
});