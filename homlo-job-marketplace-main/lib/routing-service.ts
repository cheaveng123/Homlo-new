import { mapProviderConfig, type MapRouteProfile } from "@/lib/map-config";
import type { MapCoordinate } from "@/lib/openstreetmap-geocoding";

/**
 * OSRM-compatible road routing.
 *
 * A route is only ever returned when the routing server actually answered with
 * a route. Callers must NOT fabricate a "road distance" from straight-line
 * geometry: if this returns a failure, show the direct/haversine distance and
 * label it honestly as straight-line.
 */

export type RoadRoute = {
  distanceKm: number;
  durationMinutes: number;
  geometry: MapCoordinate[];
  profile: MapRouteProfile;
  provider: "osrm";
};

export type RoutingFailureReason =
  | "invalid-coordinate"
  | "network"
  | "timeout"
  | "http"
  | "malformed"
  | "no-route";

export type RoutingResult =
  | { ok: true; route: RoadRoute }
  | { ok: false; reason: RoutingFailureReason };

type OSRMRoute = {
  distance?: unknown;
  duration?: unknown;
  geometry?: { type?: unknown; coordinates?: unknown };
};

type OSRMResponse = {
  code?: unknown;
  routes?: unknown;
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type RoutingServiceOptions = {
  baseUrl?: string;
  profile?: MapRouteProfile;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
};

export type RoutingService = {
  getRoute: (
    origin: MapCoordinate,
    destination: MapCoordinate,
    options?: { signal?: AbortSignal; profile?: MapRouteProfile },
  ) => Promise<RoutingResult>;
  buildRequestUrl: (
    origin: MapCoordinate,
    destination: MapCoordinate,
    profile?: MapRouteProfile,
  ) => string;
};

function isValidCoordinate(value: MapCoordinate | null | undefined): value is MapCoordinate {
  if (!value) return false;
  const { latitude, longitude } = value;
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function parseGeometry(value: unknown): MapCoordinate[] {
  if (!value || typeof value !== "object") return [];
  const coordinates = (value as { coordinates?: unknown }).coordinates;
  if (!Array.isArray(coordinates)) return [];
  const points: MapCoordinate[] = [];
  for (const entry of coordinates) {
    if (!Array.isArray(entry) || entry.length < 2) continue;
    const [longitude, latitude] = entry;
    if (typeof latitude !== "number" || typeof longitude !== "number") continue;
    const point = { latitude, longitude };
    if (isValidCoordinate(point)) points.push(point);
  }
  return points;
}

export function createRoutingService(options: RoutingServiceOptions = {}): RoutingService {
  const baseUrl = (options.baseUrl ?? mapProviderConfig.osrmBaseUrl).replace(/\/+$/, "");
  const defaultProfile = options.profile ?? mapProviderConfig.routeProfile;
  const timeoutMs = options.timeoutMs ?? mapProviderConfig.routingTimeoutMs;
  const fetchImpl: FetchLike = options.fetchImpl ?? ((input, init) => fetch(input, init));

  const buildRequestUrl = (
    origin: MapCoordinate,
    destination: MapCoordinate,
    profile: MapRouteProfile = defaultProfile,
  ) => {
    const coordinates = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
    const params = new URLSearchParams({
      overview: "full",
      geometries: "geojson",
      alternatives: "false",
      steps: "false",
    });
    return `${baseUrl}/route/v1/${profile}/${coordinates}?${params.toString()}`;
  };

  const getRoute = async (
    origin: MapCoordinate,
    destination: MapCoordinate,
    requestOptions: { signal?: AbortSignal; profile?: MapRouteProfile } = {},
  ): Promise<RoutingResult> => {
    if (!isValidCoordinate(origin) || !isValidCoordinate(destination)) {
      return { ok: false, reason: "invalid-coordinate" };
    }

    const profile = requestOptions.profile ?? defaultProfile;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onExternalAbort = () => controller.abort();
    requestOptions.signal?.addEventListener("abort", onExternalAbort, { once: true });

    let response: Response;
    try {
      response = await fetchImpl(buildRequestUrl(origin, destination, profile), {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
    } catch (error) {
      const aborted =
        controller.signal.aborted ||
        (error instanceof Error && error.name === "AbortError");
      return { ok: false, reason: aborted ? "timeout" : "network" };
    } finally {
      clearTimeout(timer);
      requestOptions.signal?.removeEventListener("abort", onExternalAbort);
    }

    if (!response.ok) {
      return { ok: false, reason: response.status === 404 ? "no-route" : "http" };
    }

    let payload: OSRMResponse;
    try {
      payload = (await response.json()) as OSRMResponse;
    } catch {
      return { ok: false, reason: "malformed" };
    }

    if (payload?.code !== "Ok") {
      return { ok: false, reason: "no-route" };
    }

    const routes = Array.isArray(payload.routes) ? (payload.routes as OSRMRoute[]) : [];
    const first = routes[0];
    if (!first) {
      return { ok: false, reason: "no-route" };
    }

    if (typeof first.distance !== "number" || typeof first.duration !== "number") {
      return { ok: false, reason: "malformed" };
    }

    const geometry = parseGeometry(first.geometry);
    if (geometry.length < 2) {
      return { ok: false, reason: "malformed" };
    }

    return {
      ok: true,
      route: {
        distanceKm: first.distance / 1000,
        durationMinutes: first.duration / 60,
        geometry,
        profile,
        provider: "osrm",
      },
    };
  };

  return { getRoute, buildRequestUrl };
}

export const roadRoutingService = createRoutingService();

export function formatRouteDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 0) return "—";
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = Math.round(minutes % 60);
  return remaining === 0 ? `${hours} hr` : `${hours} hr ${remaining} min`;
}
