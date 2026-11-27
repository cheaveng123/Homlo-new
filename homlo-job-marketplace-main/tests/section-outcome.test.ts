import { describe, expect, it } from "vitest";

import { toSpecializedSections } from "../lib/home-feed-sections";
import type { SpecializedField } from "../lib/specialized-fields";

const identity = (job: unknown) => job as never;

const field = (id: string) => ({ id, title: id, categories: [] }) as unknown as SpecializedField;

describe("toSpecializedSections", () => {
  it("returns an empty list for every non-array shape without throwing", () => {
    for (const raw of [undefined, null, {}, "specialized", 42, true]) {
      expect(() => toSpecializedSections(raw, identity)).not.toThrow();
      expect(toSpecializedSections(raw, identity)).toEqual([]);
    }
  });

  it("keeps well-formed sections and maps their jobs", () => {
    const sections = toSpecializedSections(
      [{ field: field("a"), jobs: [{ id: "j1" }] }, { field: field("b"), jobs: [] }],
      identity,
    );
    expect(sections).toHaveLength(2);
    expect(sections[0].field.id).toBe("a");
    expect(sections[0].jobs).toEqual([{ id: "j1" }]);
  });

  it("drops entries whose field is missing, malformed or has no id", () => {
    const sections = toSpecializedSections(
      [
        { field: null, jobs: [] },
        { field: {}, jobs: [] },
        { field: { id: 7 }, jobs: [] },
        { jobs: [] },
        null,
        "nope",
        { field: field("ok"), jobs: [{ id: "j1" }] },
      ],
      identity,
    );
    expect(sections).toHaveLength(1);
    expect(sections[0].field.id).toBe("ok");
  });

  it("treats a non-array jobs value as an empty section rather than crashing", () => {
    const sections = toSpecializedSections(
      [
        { field: field("a"), jobs: null },
        { field: field("b"), jobs: { nope: true } },
      ],
      identity,
    );
    expect(sections.map((section) => section.jobs)).toEqual([[], []]);
  });
});
