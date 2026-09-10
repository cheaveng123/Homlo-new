import { describe, expect, it } from "vitest";

import {
  isValidPolygon,
  pointInPolygon,
  polygonAreaKm2,
  polygonBoundingBox,
  polygonCentroid,
  polygonToBboxString,
} from "../lib/polygon";

// A rough square around Phnom Penh (BKK1), clockwise.
const square = [
  { latitude: 11.56, longitude: 104.92 },
  { latitude: 11.56, longitude: 104.94 },
  { latitude: 11.54, longitude: 104.94 },
  { latitude: 11.54, longitude: 104.92 },
];

describe("pointInPolygon", () => {
  it("returns true for a point inside the polygon", () => {
    expect(pointInPolygon({ latitude: 11.55, longitude: 104.93 }, square)).toBe(true);
  });

  it("returns false for a point outside the polygon", () => {
    expect(pointInPolygon({ latitude: 11.58, longitude: 104.93 }, square)).toBe(false);
  });

  it("treats a point just inside the boundary as inside", () => {
    expect(pointInPolygon({ latitude: 11.555, longitude: 104.9205 }, square)).toBe(true);
  });

  it("returns false for polygons with fewer than three points", () => {
    expect(pointInPolygon({ latitude: 1, longitude: 1 }, [square[0], square[1]])).toBe(false);
  });

  it("is null-safe for invalid coordinates", () => {
    expect(pointInPolygon({ latitude: Number.NaN, longitude: 104.93 }, square)).toBe(false);
  });
});

describe("polygonBoundingBox", () => {
  it("computes the min/max bounds", () => {
    expect(polygonBoundingBox(square)).toEqual({ minLat: 11.54, minLng: 104.92, maxLat: 11.56, maxLng: 104.94 });
  });

  it("returns null for an empty polygon", () => {
    expect(polygonBoundingBox([])).toBeNull();
  });
});

describe("polygonToBboxString", () => {
  it("serialises as minLat,minLng,maxLat,maxLng", () => {
    expect(polygonToBboxString(square)).toBe("11.54,104.92,11.56,104.94");
  });

  it("returns undefined for an empty polygon", () => {
    expect(polygonToBboxString([])).toBeUndefined();
  });
});

describe("polygonCentroid", () => {
  it("averages the vertices", () => {
    const centroid = polygonCentroid(square);
    expect(centroid.latitude).toBeCloseTo(11.55);
    expect(centroid.longitude).toBeCloseTo(104.93);
  });
});

describe("polygonAreaKm2 / isValidPolygon", () => {
  it("reports a positive area for a drawn area", () => {
    expect(polygonAreaKm2(square)).toBeGreaterThan(0.0001);
    expect(isValidPolygon(square)).toBe(true);
  });

  it("rejects degenerate/too-small polygons", () => {
    expect(isValidPolygon(undefined)).toBe(false);
    expect(isValidPolygon([square[0], square[1]])).toBe(false);
    const tiny = [
      { latitude: 11.5600001, longitude: 104.9200001 },
      { latitude: 11.5600002, longitude: 104.9200002 },
      { latitude: 11.5600003, longitude: 104.9200003 },
    ];
    expect(isValidPolygon(tiny)).toBe(false);
  });
});
