import { describe, expect, it } from "vitest";

import { addSearchHistory, parseSearchHistory, SEARCH_HISTORY_MAX } from "../lib/search-history-core";

describe("addSearchHistory", () => {
  it("adds a new search at the top", () => {
    const next = addSearchHistory([], { original: "Phnom Penh", corrected: "Phnom Penh" });
    expect(next).toHaveLength(1);
    expect(next[0].original).toBe("Phnom Penh");
    expect(next[0].corrected).toBe("Phnom Penh");
    expect(typeof next[0].at).toBe("string");
  });

  it("puts the newest search first", () => {
    let h = addSearchHistory([], { original: "Phnom Penh", corrected: "Phnom Penh" });
    h = addSearchHistory(h, { original: "Siem Reap", corrected: "Siem Reap" });
    h = addSearchHistory(h, { original: "Battambang", corrected: "Battambang" });
    expect(h.map((x) => x.original)).toEqual(["Battambang", "Siem Reap", "Phnom Penh"]);
  });

  it("removes duplicates and re-inserts the same query at the top", () => {
    let h = addSearchHistory([], { original: "Phnom Penh", corrected: "Phnom Penh" });
    h = addSearchHistory(h, { original: "Siem Reap", corrected: "Siem Reap" });
    h = addSearchHistory(h, { original: "Phnom Penh", corrected: "Phnom Penh" });
    expect(h).toHaveLength(2);
    expect(h[0].original).toBe("Phnom Penh");
  });

  it("dedupes case-insensitively and with repeated spaces", () => {
    let h = addSearchHistory([], { original: "Siem Reap", corrected: "Siem Reap" });
    h = addSearchHistory(h, { original: "  siem   reap ", corrected: "Siem Reap" });
    expect(h).toHaveLength(1);
  });

  it("keeps the user's original text while storing the corrected value", () => {
    let h = addSearchHistory([], { original: "Phnom Pehn", corrected: "Phnom Penh" });
    h = addSearchHistory(h, { original: "Siem Reap", corrected: "Siem Reap" });
    const entry = h.find((x) => x.original === "Phnom Pehn");
    expect(entry?.original).toBe("Phnom Pehn");
    expect(entry?.corrected).toBe("Phnom Penh");
  });

  it("caps the list at a reasonable maximum", () => {
    let h: ReturnType<typeof parseSearchHistory> = [];
    for (let i = 0; i < 40; i += 1) {
      h = addSearchHistory(h, { original: `Search ${i}`, corrected: `Search ${i}` });
    }
    expect(h.length).toBeLessThanOrEqual(SEARCH_HISTORY_MAX);
    expect(h[0].original).toBe("Search 39");
  });

  it("ignores empty searches", () => {
    expect(addSearchHistory([], { original: "   ", corrected: "" })).toHaveLength(0);
  });
});

describe("parseSearchHistory", () => {
  it("parses a valid JSON history", () => {
    const raw = JSON.stringify([{ id: "a", original: "Siem Reap", corrected: "Siem Reap", at: "2026-01-01T00:00:00.000Z" }]);
    const parsed = parseSearchHistory(raw);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].original).toBe("Siem Reap");
  });

  it("returns an empty list for null or bad data", () => {
    expect(parseSearchHistory(null)).toEqual([]);
    expect(parseSearchHistory("")).toEqual([]);
    expect(parseSearchHistory("not json")).toEqual([]);
    expect(parseSearchHistory("{}")).toEqual([]);
  });

  it("filters out malformed entries and survives restarts", () => {
    const raw = JSON.stringify([
      { id: "good", original: "Phnom Penh", corrected: "Phnom Penh", at: "2026-01-01T00:00:00.000Z" },
      { original: "missing-fields" },
      42,
    ]);
    const parsed = parseSearchHistory(raw);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].original).toBe("Phnom Penh");
  });
});
