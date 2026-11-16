import type {
  Feature,
  FeatureCollection,
  LineString,
  Point,
  Polygon,
} from "geojson";

import type { Bounds, Coordinate, JobPin } from "../types";

const EARTH_RADIUS_KM = 6371.0088;

export function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export function toDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

export function isValidCoordinate(value: unknown): value is Coordinate {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<Coordinate>;
  const latitude = candidate.latitude;
  const longitude = candidate.longitude;

  return (
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

/**
 * Accepts only numeric coordinates. Job records must already be numbers; string
 * values are rejected instead of being coerced so latitude/longitude swaps and
 * accidental text values show up immediately during integration.
 */
export function toCoordinate(
  latitude: unknown,
  longitude: unknown,
): Coordinate | null {
  const coordinate = { latitude, longitude } as Coordinate;
  return isValidCoordinate(coordinate) ? coordinate : null;
}

export function normalizeJobPin(
  job: Pick<JobPin, "id" | "title"> & {
    latitude: unknown;
    longitude: unknown;
  },
): JobPin | null {
  const coordinate = toCoordinate(job.latitude, job.longitude);
  if (
    !coordinate ||
    typeof job.id !== "string" ||
    typeof job.title !== "string"
  ) {
    return null;
  }

  return {
    id: job.id,
    title: job.title,
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
  };
}

export function haversineKm(a: Coordinate, b: Coordinate): number {
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const deltaLat = toRadians(b.latitude - a.latitude);
  const deltaLng = toRadians(b.longitude - a.longitude);

  const value =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

  return (
    2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(Math.max(0, value))))
  );
}

export function haversineMeters(a: Coordinate, b: Coordinate): number {
  return haversineKm(a, b) * 1000;
}

export function formatDistanceKm(distanceKm: number): string {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) return "—";
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m`;
  if (distanceKm < 10) return `${distanceKm.toFixed(1)} km`;
  return `${Math.round(distanceKm)} km`;
}

export function formatDurationMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 0) return "—";
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${Math.round(minutes)} min`;

  const hours = Math.floor(minutes / 60);
  const remaining = Math.round(minutes % 60);

  return remaining === 0 ? `${hours} hr` : `${hours} hr ${remaining} min`;
}

export function toPosition(coordinate: Coordinate): [number, number] {
  return [coordinate.longitude, coordinate.latitude];
}

export function pointFeature(
  coordinate: Coordinate,
  properties: Record<string, unknown> = {},
): Feature<Point> {
  return {
    type: "Feature",
    properties,
    geometry: {
      type: "Point",
      coordinates: toPosition(coordinate),
    },
  };
}

export function lineFeature(
  coordinates: Coordinate[],
  properties: Record<string, unknown> = {},
): Feature<LineString> {
  return {
    type: "Feature",
    properties,
    geometry: {
      type: "LineString",
      coordinates: coordinates.map(toPosition),
    },
  };
}

export function jobsFeatureCollection(
  jobs: Array<JobPin & { distanceKm: number }>,
): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: jobs.map((job) =>
      pointFeature(
        { latitude: job.latitude, longitude: job.longitude },
        {
          id: job.id,
          title: job.title,
          distanceKm: job.distanceKm,
        },
      ),
    ),
  };
}

function destinationPoint(
  center: Coordinate,
  distanceKm: number,
  bearingRadians: number,
): Coordinate {
  const angularDistance = distanceKm / EARTH_RADIUS_KM;
  const lat1 = toRadians(center.latitude);
  const lon1 = toRadians(center.longitude);

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearingRadians),
  );

  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearingRadians) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2),
    );

  return {
    latitude: toDegrees(lat2),
    longitude: ((toDegrees(lon2) + 540) % 360) - 180,
  };
}

/**
 * Builds a polygon approximation of a location accuracy circle. MapLibre's
 * CircleLayer radius is screen-space, so a geographic ring keeps the accuracy
 * visualization honest across zoom levels.
 */
export function circlePolygon(
  center: Coordinate,
  radiusMeters: number,
  steps = 64,
): Feature<Polygon> {
  const safeRadiusMeters = Math.max(0, Math.min(radiusMeters, 100_000));
  const radiusKm = safeRadiusMeters / 1000;
  const ring: [number, number][] = [];

  for (let index = 0; index <= steps; index += 1) {
    const bearing = (index / steps) * Math.PI * 2;
    ring.push(toPosition(destinationPoint(center, radiusKm, bearing)));
  }

  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [ring],
    },
  };
}

export function boundsForCoordinates(coordinates: Coordinate[]): Bounds | null {
  const valid = coordinates.filter(isValidCoordinate);
  if (valid.length === 0) return null;

  let minLat = valid[0].latitude;
  let maxLat = valid[0].latitude;
  let minLng = valid[0].longitude;
  let maxLng = valid[0].longitude;

  for (const coordinate of valid.slice(1)) {
    minLat = Math.min(minLat, coordinate.latitude);
    maxLat = Math.max(maxLat, coordinate.latitude);
    minLng = Math.min(minLng, coordinate.longitude);
    maxLng = Math.max(maxLng, coordinate.longitude);
  }

  return {
    ne: [maxLng, maxLat],
    sw: [minLng, minLat],
  };
}
