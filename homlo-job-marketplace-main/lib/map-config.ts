/**
 * Centralised OpenStreetMap-ecosystem provider configuration.
 *
 * Every map, geocoder and router reads its endpoint from here so a deployment
 * can point at self-hosted infrastructure (or a paid tile provider) without
 * touching component code. All client-safe values use the `EXPO_PUBLIC_`
 * prefix because Expo inlines them at build time.
 */

export type MapRouteProfile = "driving" | "walking" | "cycling";

export type MapProviderConfig = {
  /** Raster tile template usable by react-native-maps `UrlTile`. */
  tileTemplate: string;
  /** Vector style URL usable by MapLibre GL JS. */
  styleUrl: string;
  /** Nominatim-compatible geocoding endpoint, without a trailing slash. */
  nominatimBaseUrl: string;
  /** OSRM-compatible routing endpoint, without a trailing slash. */
  osrmBaseUrl: string;
  /** Attribution shown over every map. */
  attribution: string;
  maxTileZoom: number;
  routeProfile: MapRouteProfile;
  routingTimeoutMs: number;
  geocodingTimeoutMs: number;
};

export const DEFAULT_TILE_TEMPLATE = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const DEFAULT_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
export const DEFAULT_NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org";
export const DEFAULT_OSRM_BASE_URL = "https://router.project-osrm.org";
export const DEFAULT_MAP_ATTRIBUTION = "© OpenStreetMap contributors";

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function readUrl(value: string | undefined, fallback: string) {
  const candidate = value?.trim();
  return trimTrailingSlash(candidate ? candidate : fallback);
}

function readNumber(value: string | undefined, fallback: number) {
  const candidate = Number(value);
  return Number.isFinite(candidate) && candidate > 0 ? candidate : fallback;
}

function readProfile(value: string | undefined, fallback: MapRouteProfile): MapRouteProfile {
  return value === "driving" || value === "walking" || value === "cycling" ? value : fallback;
}

export const mapProviderConfig: MapProviderConfig = {
  tileTemplate:
    process.env.EXPO_PUBLIC_MAP_TILE_URL?.trim() || DEFAULT_TILE_TEMPLATE,
  styleUrl: readUrl(process.env.EXPO_PUBLIC_MAP_STYLE_URL, DEFAULT_STYLE_URL),
  nominatimBaseUrl: readUrl(
    process.env.EXPO_PUBLIC_NOMINATIM_URL,
    DEFAULT_NOMINATIM_BASE_URL,
  ),
  osrmBaseUrl: readUrl(
    process.env.EXPO_PUBLIC_OSRM_URL,
    DEFAULT_OSRM_BASE_URL,
  ),
  attribution:
    process.env.EXPO_PUBLIC_MAP_ATTRIBUTION?.trim() || DEFAULT_MAP_ATTRIBUTION,
  maxTileZoom: readNumber(process.env.EXPO_PUBLIC_MAP_MAX_ZOOM, 19),
  routeProfile: readProfile(process.env.EXPO_PUBLIC_ROUTE_PROFILE, "driving"),
  routingTimeoutMs: readNumber(process.env.EXPO_PUBLIC_ROUTE_TIMEOUT_MS, 8000),
  geocodingTimeoutMs: readNumber(process.env.EXPO_PUBLIC_GEOCODING_TIMEOUT_MS, 8000),
};

export const MAP_TILE_URL = mapProviderConfig.tileTemplate;
export const MAP_STYLE_URL = mapProviderConfig.styleUrl;
export const MAP_ATTRIBUTION = mapProviderConfig.attribution;
export const NOMINATIM_BASE_URL = mapProviderConfig.nominatimBaseUrl;
export const OSRM_BASE_URL = mapProviderConfig.osrmBaseUrl;
export const MAP_MAX_TILE_ZOOM = mapProviderConfig.maxTileZoom;
export const MAP_ROUTE_PROFILE = mapProviderConfig.routeProfile;
