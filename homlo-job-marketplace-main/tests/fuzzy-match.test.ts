import { describe, expect, it } from "vitest";

import { bestLocationMatch, normalizeQuery, resolveSearchTypos } from "../lib/fuzzy-match";

describe("normalizeQuery", () => {
  it("lowercases, trims, and collapses repeated spaces", () => {
    expect(normalizeQuery("  Phnom   Penh  ")).toBe("phnom penh");
  });

  it("strips punctuation to spaces", () => {
    expect(normalizeQuery("Siem-Reap, Cambodia!")).toBe("siem reap cambodia");
  });
});

describe("bestLocationMatch", () => {
  it("recognizes exact canonical locations without a correction", () => {
    expect(bestLocationMatch("Siem Reap")?.location).toBe("Siem Reap");
    expect(bestLocationMatch("Sen Sok")?.exact).toBe(true);
    expect(bestLocationMatch("Battambang")?.exact).toBe(true);
  });

  it("prefers exact matches over fuzzy ones", () => {
    expect(bestLocationMatch("Phnom Penh")).toMatchObject({ location: "Phnom Penh", exact: true });
  });

  it("returns null for low-confidence / non-location input", () => {
    expect(bestLocationMatch("cashier")).toBeNull();
    expect(bestLocationMatch("makeup word")).toBeNull();
    expect(bestLocationMatch("nonsensexyz")).toBeNull();
    expect(bestLocationMatch("")).toBeNull();
  });
});

describe("resolveSearchTypos", () => {
  it("corrects swapped letters in a location", () => {
    expect(resolveSearchTypos("Phnom Pehn")).toEqual({
      original: "Phnom Pehn",
      corrected: "Phnom Penh",
      correctedFuzzy: true,
    });
    expect(resolveSearchTypos("Phonm Penh")).toEqual({
      original: "Phonm Penh",
      corrected: "Phnom Penh",
      correctedFuzzy: true,
    });
  });

  it("corrects missing letters (drop a letter)", () => {
    expect(resolveSearchTypos("Pnom Penh").corrected).toBe("Phnom Penh");
    expect(resolveSearchTypos("Phnom Pen").corrected).toBe("Phnom Penh");
    expect(resolveSearchTypos("Siem Ream").corrected).toBe("Siem Reap");
  });

  it("corrects extra/mistyped letters", () => {
    expect(resolveSearchTypos("Siem Rep").corrected).toBe("Siem Reap");
    expect(resolveSearchTypos("Battambnag").corrected).toBe("Battambang");
    expect(resolveSearchTypos("Tuol Kolk").corrected).toBe("Tuol Kork");
  });

  it("preserves exact matches unchanged with no correction flag", () => {
    expect(resolveSearchTypos("Siem Reap")).toEqual({
      original: "Siem Reap",
      corrected: "Siem Reap",
      correctedFuzzy: false,
    });
    expect(resolveSearchTypos("Sen Sok")).toMatchObject({ corrected: "Sen Sok", correctedFuzzy: false });
  });

  it("maps Khmer location names to canonical English", () => {
    expect(resolveSearchTypos("ភ្នំពេញ").corrected).toBe("Phnom Penh");
  });

  it("keeps low-confidence typos and job keywords unchanged", () => {
    expect(resolveSearchTypos("cashier")).toEqual({ original: "cashier", corrected: "cashier", correctedFuzzy: false });
    expect(resolveSearchTypos("nonsensexyz")).toMatchObject({ corrected: "nonsensexyz", correctedFuzzy: false });
    // Mixed full query (not a pure location) is left untouched.
    expect(resolveSearchTypos("Phnom Pehn cashier").correctedFuzzy).toBe(false);
  });
});
