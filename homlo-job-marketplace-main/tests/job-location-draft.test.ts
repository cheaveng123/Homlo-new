import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { buildJobSaveInput, defaultJobPosting, draftFromRemoteJob, validatePostingStep, type JobPostingDraft } from "@/lib/job-posting";

const project = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const onSiteWithPin: JobPostingDraft = {
  ...defaultJobPosting,
  workArrangement: "On-site",
  title: "Graphic Designer",
  description: "Design marketing assets for our client work.",
  country: "Cambodia",
  province: "Phnom Penh",
  city: "Phnom Penh",
  district: "Daun Penh",
  address: "No. 12, Street 108",
  postalCode: "120210",
  latitude: 11.5621,
  longitude: 104.916,
};

const remoteDraft: JobPostingDraft = {
  ...defaultJobPosting,
  workArrangement: "Remote",
  title: "Remote Writer",
  latitude: 11.5621,
  longitude: 104.916,
};

describe("salary range validation rules", () => {
  const visible = { ...defaultJobPosting, salaryVisible: true };

  it("errors when the minimum is set higher than the maximum", () => {
    const errors = validatePostingStep(4, { ...visible, salaryMin: "700", salaryMax: "500" });
    expect(errors.salaryMin).toBe("Minimum must be lower than or equal to maximum.");
    expect(errors.salaryMax).toBe("Maximum must be higher than or equal to minimum.");
  });

  it("accepts an equal minimum and maximum", () => {
    const errors = validatePostingStep(4, { ...visible, salaryMin: "600", salaryMax: "600" });
    expect(errors.salaryMin).toBeUndefined();
    expect(errors.salaryMax).toBeUndefined();
  });

  it("accepts a valid ascending range", () => {
    const errors = validatePostingStep(4, { ...visible, salaryMin: "600", salaryMax: "900" });
    expect(errors.salaryMin).toBeUndefined();
    expect(errors.salaryMax).toBeUndefined();
  });

  it("rejects negative salary values", () => {
    const errors = validatePostingStep(4, { ...visible, salaryMin: "-50", salaryMax: "600" });
    expect(errors.salaryMin).toBe("Salary can't be negative.");
  });

  it("rejects non-numeric salary values", () => {
    const errors = validatePostingStep(4, { ...visible, salaryMin: "abc", salaryMax: "900" });
    expect(errors.salaryMin).toBe("Enter a valid number.");
  });

  it("skips salary rules when the range is hidden or fields are empty", () => {
    expect(Object.keys(validatePostingStep(4, { ...defaultJobPosting, salaryVisible: false, salaryMin: "700", salaryMax: "500" }))).not.toContain("salaryMin");
    expect(validatePostingStep(4, { ...visible, salaryMin: "", salaryMax: "900" })).toEqual({});
  });
});

describe("Job posting structured location", () => {
  it("maps the form draft into the gateway save payload with structured geodata", () => {
    const input = buildJobSaveInput(onSiteWithPin, "open", null);
    expect(input.latitude).toBe(11.5621);
    expect(input.longitude).toBe(104.916);
    expect(input.country).toBe("Cambodia");
    expect(input.city).toBe("Phnom Penh");
    expect(input.district).toBe("Daun Penh");
    expect(input.province).toBe("Phnom Penh");
    expect(input.postalCode).toBe("120210");
    expect(input.addressLine).toBe("No. 12, Street 108");
    expect(input.locationText).toBe("Daun Penh, Phnom Penh, Cambodia");
    expect(input.status).toBe("open");
  });

  it("keeps remote jobs coordinate-free with a Remote location text", () => {
    const input = buildJobSaveInput(remoteDraft, "open", null);
    expect(input.latitude).toBeNull();
    expect(input.longitude).toBeNull();
    expect(input.locationText).toBe("Remote");
    expect(input.addressLine).toBeNull();
  });

  it("allows an incomplete draft to be saved (partial title is a draft concern, not a schema concern)", () => {
    const partial = { ...defaultJobPosting, title: "", description: "" };
    const input = buildJobSaveInput(partial, "draft", null);
    expect(input.status).toBe("draft");
    expect(input.title).toBe("");
    expect(input.description).toBe("");
  });

  it("requires a map coordinate for on-site / hybrid jobs during step 2 validation", () => {
    const noPin = { ...onSiteWithPin, latitude: null, longitude: null };
    expect(JSON.stringify(validatePostingStep(2, noPin))).toContain("location");
    expect(Object.keys(validatePostingStep(2, onSiteWithPin))).not.toContain("location");
  });

  it("hydrates a form draft from a saved remote job row (continue draft)", () => {
    const draft = draftFromRemoteJob({
      id: "11111111-1111-1111-1111-111111111111",
      title: "Barista",
      description: "Make great coffee.",
      pay_amount: 300,
      pay_currency: "USD",
      pay_type: "hourly",
      location_text: "Kampot, Cambodia",
      latitude: 10.6093,
      longitude: 104.1811,
      status: "draft",
      created_at: "2026-09-01T00:00:00Z",
      city: "Kampot",
      country: "Cambodia",
      address_line: "Riverside Road",
      postal_code: "07401",
    });
    expect(draft.id).toBe("11111111-1111-1111-1111-111111111111");
    expect(draft.title).toBe("Barista");
    expect(draft.city).toBe("Kampot");
    expect(draft.country).toBe("Cambodia");
    expect(draft.address).toBe("Riverside Road");
    expect(draft.postalCode).toBe("07401");
    expect(draft.latitude).toBe(10.6093);
    expect(draft.longitude).toBe(104.1811);
    expect(draft.status).toBe("draft");
  });
});

describe("structured location database + gateway contract", () => {
  const migration = project("backend/database/migrations/025_structured_location_and_draft_support.sql");
  const gateway = project("supabase/functions/homlo-service-gateway/index.ts");

  it("adds the structured location columns and banner_image to jobs", () => {
    for (const column of ["address_line", "city", "district", "province", "country", "postal_code", "banner_image"]) {
      expect(migration).toContain(`add column if not exists ${column}`);
    }
  });

  it("extends homlo_save_job with the structured parameters", () => {
    for (const param of ["p_address_line", "p_city", "p_district", "p_province", "p_country", "p_postal_code", "p_banner_image"]) {
      expect(migration).toContain(param);
    }
  });

  it("keeps the gateway payload field names aligned with the RPC parameters", () => {
    const pairs: Array<[string, string]> = [
      ["payload.addressLine", "p_address_line"],
      ["payload.city", "p_city"],
      ["payload.district", "p_district"],
      ["payload.province", "p_province"],
      ["payload.country", "p_country"],
      ["payload.postalCode", "p_postal_code"],
      ["payload.bannerImage", "p_banner_image"],
    ];
    for (const [gatewayField, rpcParam] of pairs) {
      expect(gateway).toContain(`${rpcParam}: ${gatewayField} ?? null`);
      expect(migration).toContain(rpcParam);
    }
  });

  it("relaxes validation only for draft saves so partial posts are possible", () => {
    expect(migration).toMatch(/p_status <> 'draft'/i);
    expect(migration).toContain("incomplete form");
  });
});