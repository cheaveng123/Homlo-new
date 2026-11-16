import {
  ORS_API_KEY,
  ORS_BASE_URL,
  ORS_PROFILE,
  ROUTE_TIMEOUT_MS,
} from "../config";
import type { Coordinate, RouteSummary } from "../types";
import { isValidCoordinate } from "../utils/geo";

export type RoutingFailure =
  | "missing-key"
  | "invalid-coordinate"
  | "network"
  | "timeout"
  | "http"
  | "malformed"
  | "no-route";

export type RoutingResult =
  { ok: true; route: RouteSummary } | { ok: false; reason: RoutingFailure };

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

type OrsSummary = {
  distance?: unknown;
  duration?: unknown;
};

type OrsFeature = {
  type?: unknown;
  properties?: {
    summary?: OrsSummary;
  };
  geometry?: {
    type?: unknown;
    coordinates?: unknown;
  };
};

type OrsResponse = {
  type?: unknown;
  features?: unknown;
  error?: unknown;
  code?: unknown;
  message?: unknown;
};

export type RoutingOptions = {
  signal?: AbortSignal;
  fetchImpl?: FetchLike;
};

function parseGeometry(value: unknown): Coordinate[] {
  if (!value || typeof value !== "object") return [];

  const coordinates = (value as { coordinates?: unknown }).coordinates;
  if (!Array.isArray(coordinates)) return [];

  const points: Coordinate[] = [];

  for (const entry of coordinates) {
    if (!Array.isArray(entry) || entry.length < 2) continue;

    const [longitude, latitude] = entry;
    const point = { latitude, longitude } as Coordinate;

    if (isValidCoordinate(point)) points.push(point);
  }

  return points;
}

function readRouteFeature(payload: OrsResponse): OrsFeature | null {
  if (Array.isArray(payload.features)) {
    return (payload.features[0] as OrsFeature | undefined) ?? null;
  }

  if (payload.type === "Feature") {
    return payload as OrsFeature;
  }

  return null;
}

/**
 * Requests a driving-car route from OpenRouteService's GeoJSON endpoint.
 *
 * Summary distance/duration always come from the API response. If this returns
 * a failure the caller must show the straight-line fallback, not a fabricated
 * road route.
 */
export async function fetchDrivingRoute(
  origin: Coordinate,
  destination: Coordinate,
  options: RoutingOptions = {},
): Promise<RoutingResult> {
  if (!ORS_API_KEY) {
    return { ok: false, reason: "missing-key" };
  }

  if (!isValidCoordinate(origin) || !isValidCoordinate(destination)) {
    return { ok: false, reason: "invalid-coordinate" };
  }

  const fetchImpl: FetchLike =
    options.fetchImpl ?? ((input, init) => fetch(input, init));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ROUTE_TIMEOUT_MS);
  const onExternalAbort = () => controller.abort();

  options.signal?.addEventListener("abort", onExternalAbort, { once: true });

  let response: Response;

  try {
    response = await fetchImpl(
      `${ORS_BASE_URL}/v2/directions/${ORS_PROFILE}/geojson`,
      {
        method: "POST",
        headers: {
          Accept: "application/geo+json",
          "Content-Type": "application/json",
          Authorization: ORS_API_KEY,
        },
        body: JSON.stringify({
          coordinates: [
            [origin.longitude, origin.latitude],
            [destination.longitude, destination.latitude],
          ],
          instructions: false,
        }),
        signal: controller.signal,
      },
    );
  } catch (error) {
    const aborted =
      controller.signal.aborted ||
      (error instanceof Error && error.name === "AbortError");

    return { ok: false, reason: aborted ? "timeout" : "network" };
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onExternalAbort);
  }

  if (!response.ok) {
    return { ok: false, reason: response.status === 404 ? "no-route" : "http" };
  }

  let payload: OrsResponse;

  try {
    payload = (await response.json()) as OrsResponse;
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (payload.error || payload.code !== undefined) {
    return { ok: false, reason: "no-route" };
  }

  const feature = readRouteFeature(payload);
  if (!feature) {
    return { ok: false, reason: "no-route" };
  }

  const summary = feature.properties?.summary;
  const distance = summary?.distance;
  const duration = summary?.duration;

  if (
    typeof distance !== "number" ||
    typeof duration !== "number" ||
    !Number.isFinite(distance) ||
    !Number.isFinite(duration) ||
    distance < 0 ||
    duration < 0
  ) {
    return { ok: false, reason: "malformed" };
  }

  const geometry = parseGeometry(feature.geometry);
  if (geometry.length < 2) {
    return { ok: false, reason: "malformed" };
  }

  return {
    ok: true,
    route: {
      distanceKm: distance / 1000,
      durationMinutes: duration / 60,
      geometry,
    },
  };
}
