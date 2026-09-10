import { describe, expect, it } from "vitest";

import { currencyCode, currencyLabel, currencyOptions, validCurrencies } from "@/lib/currencies";

describe("valid currencies", () => {
  it("exposes ISO 4217 codes that are unique, 3-letter and uppercase", () => {
    const codes = validCurrencies.map((entry) => entry.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) {
      expect(code).toMatch(/^[A-Z]{3}$/);
    }
  });

  it("includes USD and KHR (the app defaults and local context)", () => {
    const codes = validCurrencies.map((entry) => entry.code);
    expect(codes).toContain("USD");
    expect(codes).toContain("KHR");
  });

  it("builds one display label per currency", () => {
    expect(currencyOptions.length).toBe(validCurrencies.length);
    for (const option of currencyOptions) {
      expect(option).toMatch(/^[A-Z]{3} · .+$/);
    }
  });
});

describe("currencyLabel", () => {
  it("formats a code into a display label", () => {
    expect(currencyLabel("USD")).toBe("USD · US Dollar");
  });

  it("is case-insensitive and normalizes to the canonical code", () => {
    expect(currencyLabel("khr")).toBe("KHR · Cambodian Riel");
    expect(currencyLabel(" usd ")).toBe("USD · US Dollar");
  });

  it("returns an empty string for an empty value", () => {
    expect(currencyLabel("")).toBe("");
    expect(currencyLabel("   ")).toBe("");
  });

  it("returns the raw text for an unknown code so existing drafts keep visible", () => {
    expect(currencyLabel("USDollars")).toBe("USDollars");
  });
});

describe("currencyCode", () => {
  it("extracts the code from a display label", () => {
    expect(currencyCode("KHR · Cambodian Riel")).toBe("KHR");
    expect(currencyCode("EUR · Euro")).toBe("EUR");
  });

  it("round-trips with currencyLabel for every valid currency", () => {
    for (const currency of validCurrencies) {
      const label = currencyLabel(currency.code);
      expect(currencyCode(label)).toBe(currency.code);
    }
  });

  it("returns the input unchanged when it is not a currency label", () => {
    expect(currencyCode("USDollars")).toBe("USDollars");
  });

  it("keeps the default draft currency selectable", () => {
    expect(currencyOptions).toContain(currencyLabel("USD"));
    expect(currencyCode(currencyLabel("USD"))).toBe("USD");
  });
});