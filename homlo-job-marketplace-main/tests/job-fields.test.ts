import { describe, expect, it } from "vitest";

import { jobs } from "../components/job-store";
import { JOB_FIELDS, normaliseFieldKey, resolveJobField, resolveJobFieldSvg } from "../lib/job-fields";
import { opportunityCategories } from "../lib/category-data";

describe("JOB_FIELDS", () => {
  it("publishes the 19 official fields, in order, with unique ids and titles", () => {
    expect(JOB_FIELDS).toHaveLength(19);
    expect(new Set(JOB_FIELDS.map((field) => field.id)).size).toBe(19);
    expect(new Set(JOB_FIELDS.map((field) => field.title)).size).toBe(19);
  });

  it("gives every field inline SVG artwork", () => {
    const missing = JOB_FIELDS.filter((field) => !field.svg.trim()).map((field) => field.id);
    expect(missing).toEqual([]);
  });

  it("uses a square 96x96 viewBox for every field illustration", () => {
    for (const field of JOB_FIELDS) {
      expect(field.svg, field.id).toContain('viewBox="0 0 96 96"');
    }
  });
});

describe("normaliseFieldKey", () => {
  it("folds case, ampersands, slugs and the 'jobs' suffix into one form", () => {
    expect(normaliseFieldKey("IT & Technology")).toBe("it and technology");
    expect(normaliseFieldKey("customer-service")).toBe("customer service");
    expect(normaliseFieldKey("  Retail & E-commerce  ")).toBe("retail and e commerce");
    expect(normaliseFieldKey("Hospitality & Service jobs")).toBe("hospitality and service");
  });
});

describe("resolveJobField", () => {
  it("resolves every official title to its own field", () => {
    for (const field of JOB_FIELDS) {
      expect(resolveJobField(field.title)?.id).toBe(field.id);
    }
  });

  it("resolves the legacy 16-category titles onto the new taxonomy", () => {
    // `category-data` is frozen as the back-compat layer, so every title still
    // in the feed has to land on a field or those jobs lose their icon.
    const expected: Record<string, string> = {
      Technology: "it-technology",
      Sales: "sales-business",
      Marketing: "marketing-media",
      Hospitality: "hospitality-food",
      Finance: "finance-accounting",
      Accounting: "finance-accounting",
      Design: "design-creative",
      "Customer Service": "customer-service",
      Education: "education-training",
      Healthcare: "healthcare",
      Engineering: "engineering-construction",
      Construction: "engineering-construction",
      Logistics: "logistics-delivery",
      Administration: "administration",
      Retail: "retail-ecommerce",
      Operations: "administration",
    };
    expect(Object.keys(expected).sort()).toEqual(opportunityCategories.map((c) => c.title).sort());
    for (const [title, id] of Object.entries(expected)) {
      expect(resolveJobField(title)?.id).toBe(id);
    }
  });

  it("resolves the slugs the seed script writes into the categories table", () => {
    const slugs = ["technology", "sales", "marketing", "hospitality", "construction", "finance", "accounting", "education", "customer-service", "logistics", "administration"];
    for (const slug of slugs) {
      expect(resolveJobField(slug), slug).toBeDefined();
    }
  });

  it("folds Operations into Administration, since it has no official counterpart", () => {
    expect(resolveJobField("Operations")?.title).toBe("Administration");
    expect(resolveJobField("operations")).toBe(resolveJobField("Administration"));
  });

  it("resolves every category present in the seed job store", () => {
    const unresolved = jobs.map((job) => job.category).filter((category) => !resolveJobField(category));
    expect(unresolved).toEqual([]);
  });

  it("returns the field for the data layers' sentinels only when they are real categories", () => {
    // "Job" and "Other" are what the stores fall back to when a record has no
    // category. They must stay unmapped so those rows draw the neutral glyph.
    expect(resolveJobField("Job")).toBeUndefined();
    expect(resolveJobField("Other")).toBeUndefined();
  });

  it("returns undefined for missing or empty values", () => {
    expect(resolveJobField(undefined)).toBeUndefined();
    expect(resolveJobField(null)).toBeUndefined();
    expect(resolveJobField("")).toBeUndefined();
    expect(resolveJobField("   ")).toBeUndefined();
    expect(resolveJobField("Interstellar Freight Hauling")).toBeUndefined();
  });
});

describe("resolveJobFieldSvg", () => {
  it("returns artwork for a mapped field", () => {
    expect(resolveJobFieldSvg("Technology")).toBeTypeOf("string");
  });

  it("returns the field's own artwork for every one of the 19 fields", () => {
    for (const field of JOB_FIELDS) {
      expect(resolveJobFieldSvg(field.title)).toBe(field.svg);
    }
  });

  it("resolves a Beauty's aliases onto the new artwork, not a neutral glyph", () => {
    // Beauty & Personal Care had no artwork until this field's illustration
    // landed, so these used to be the test that proved the null fallback.
    expect(resolveJobFieldSvg("Beauty & Personal Care")).toBeTypeOf("string");
    expect(resolveJobFieldSvg("Salon")).toBeTypeOf("string");
  });

  it("returns null for unmapped values", () => {
    expect(resolveJobFieldSvg("Other")).toBeNull();
    expect(resolveJobFieldSvg(undefined)).toBeNull();
  });
});
