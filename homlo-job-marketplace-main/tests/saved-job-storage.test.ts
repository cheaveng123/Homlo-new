import { describe, expect, it } from "vitest";

import { parseSavedJobIds } from "../lib/saved-job-storage";

describe("parseSavedJobIds", () => {
  it("treats an absent or empty value as an empty, healthy list", () => {
    for (const raw of [null, undefined, ""]) {
      expect(parseSavedJobIds(raw)).toEqual({ ids: [], corrupted: false });
    }
  });

  it("recovers an empty list from unparseable JSON and flags it", () => {
    for (const raw of ["garbage", "{", "[1,2", "undefined"]) {
      expect(parseSavedJobIds(raw)).toEqual({ ids: [], corrupted: true });
    }
  });

  it("recovers an empty list from valid JSON of the wrong type", () => {
    for (const raw of ['{"a":1}', '"a-string"', "42", "null", "true"]) {
      expect(parseSavedJobIds(raw)).toEqual({ ids: [], corrupted: true });
    }
  });

  it("keeps the valid string ids from a partially corrupt array", () => {
    expect(parseSavedJobIds('["a", 1, null, "b", "", "c"]')).toEqual({
      ids: ["a", "b", "c"],
      corrupted: true,
    });
  });

  it("returns a clean list untouched", () => {
    expect(parseSavedJobIds('["a","b"]')).toEqual({ ids: ["a", "b"], corrupted: false });
  });

  it("de-duplicates repeated ids without flagging corruption", () => {
    expect(parseSavedJobIds('["a","a","b"]')).toEqual({ ids: ["a", "b"], corrupted: false });
  });
});
