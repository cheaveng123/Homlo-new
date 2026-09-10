// =========================================================
// Geographic distance for scoring (backend-local).
//
// Mirrors the algorithm in lib/job-geography.ts (haversineDistance) so the
// recommendation pipeline and the app surface agree on what "close" means.
// Kept in the backend because scoring runs server-side with relative imports
// only (the client `lib/` folder uses the `@/` alias and forms part of the
// mobile bundle). Safe for NaN/out-of-range coordinates: anything unusable
// yields null so callers can apply their neutral fallback.
// =========================================================

export type Coordinate = { latitude: number; longitude: number };

const EARTH_RADIUS_KM = 6371;

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function isUsable(value: number): boolean {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

function isUsableLng(value: number): boolean {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

/**
 * Great-circle distance in kilometres, or null when either coordinate is
 * unusable. Mirrors the client haversine so distances are consistent.
 */
export function haversineKm(a: Coordinate | null | undefined, b: Coordinate | null | undefined): number | null {
  if (!a || !b) return null;
  if (!isUsable(a.latitude) || !isUsableLng(a.longitude)) return null;
  if (!isUsable(b.latitude) || !isUsableLng(b.longitude)) return null;

  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const deltaLat = toRadians(b.latitude - a.latitude);
  const deltaLng = toRadians(b.longitude - a.longitude);
  const value =
    Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(Math.max(0, value))));
}