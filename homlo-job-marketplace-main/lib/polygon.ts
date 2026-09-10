import type { MapCoordinate } from "@/lib/openstreetmap-geocoding";

/**
 * Pure geometry helpers for polygon location filtering. A polygon is an ordered
 * list of coordinates (latitude/longitude) drawn by the user on a map. These
 * helpers are framework-agnostic so they can be unit tested in isolation.
 */

/**
 * Ray-casting point-in-polygon test (works for convex and concave polygons).
 * Vertices on an edge are treated as inside to keep behaviour forgiving.
 */
export function pointInPolygon(point: MapCoordinate, polygon: readonly MapCoordinate[]): boolean {
  if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) return false;
  if (polygon.length < 3) return false;
  const x = point.longitude;
  const y = point.latitude;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].longitude;
    const yi = polygon[i].latitude;
    const xj = polygon[j].longitude;
    const yj = polygon[j].latitude;
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function polygonCentroid(polygon: readonly MapCoordinate[]): MapCoordinate {
  if (polygon.length === 0) return { latitude: 0, longitude: 0 };
  const sum = polygon.reduce(
    (acc, point) => ({ lat: acc.lat + point.latitude, lng: acc.lng + point.longitude }),
    { lat: 0, lng: 0 },
  );
  return { latitude: sum.lat / polygon.length, longitude: sum.lng / polygon.length };
}

export function polygonBoundingBox(polygon: readonly MapCoordinate[]) {
  if (polygon.length === 0) return null;
  let minLat = Number.POSITIVE_INFINITY;
  let minLng = Number.POSITIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;
  for (const point of polygon) {
    if (point.latitude < minLat) minLat = point.latitude;
    if (point.latitude > maxLat) maxLat = point.latitude;
    if (point.longitude < minLng) minLng = point.longitude;
    if (point.longitude > maxLng) maxLng = point.longitude;
  }
  return { minLat, minLng, maxLat, maxLng };
}

/**
 * Serialises a polygon's bounding box to the compact string the DB search
 * function expects: "minLat,minLng,maxLat,maxLng".
 */
export function polygonToBboxString(polygon: readonly MapCoordinate[]): string | undefined {
  const box = polygonBoundingBox(polygon);
  if (!box) return undefined;
  return `${box.minLat},${box.minLng},${box.maxLat},${box.maxLng}`;
}

/** Approximate area (km^2) used only to reject near-point polygons. */
export function polygonAreaKm2(polygon: readonly MapCoordinate[]): number {
  if (polygon.length < 3) return 0;
  let sum = 0;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    sum += polygon[i].longitude * polygon[j].latitude - polygon[j].longitude * polygon[i].latitude;
  }
  const areaDeg2 = Math.abs(sum / 2);
  const avgLat = polygon.reduce((acc, p) => acc + p.latitude, 0) / polygon.length;
  const kmPerLat = 111.32;
  const kmPerLng = 111.32 * Math.cos((avgLat * Math.PI) / 180);
  return areaDeg2 * kmPerLat * kmPerLng;
}

/** True when the polygon is a usable, non-degenerate area. */
export function isValidPolygon(polygon: readonly MapCoordinate[] | undefined): polygon is MapCoordinate[] {
  return Boolean(polygon && polygon.length >= 3 && polygonAreaKm2(polygon) > 0.0001);
}

/** Compares two polygons by their serialised coordinates (order-insensitive). */
export function polygonsEqual(
  a: readonly MapCoordinate[] | undefined,
  b: readonly MapCoordinate[] | undefined,
): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every((point, index) => point.latitude === b[index].latitude && point.longitude === b[index].longitude);
}

/**
 * Serialises a polygon to a compact, URL-safe string ("lat,lng|lat,lng|...")
 * so it can travel through route params. Decoding is lossy up to ~6 decimal
 * places which is far finer than a tap target on a map.
 */
export function encodePolygon(polygon: readonly MapCoordinate[]): string {
  return polygon.map((point) => `${point.latitude.toFixed(6)},${point.longitude.toFixed(6)}`).join("|");
}

export function decodePolygon(value: string | undefined | null): MapCoordinate[] {
  if (!value) return [];
  return value
    .split("|")
    .map((pair) => {
      const [lat, lng] = pair.split(",").map(Number);
      return Number.isFinite(lat) && Number.isFinite(lng) ? { latitude: lat, longitude: lng } : null;
    })
    .filter((point): point is MapCoordinate => point !== null);
}
