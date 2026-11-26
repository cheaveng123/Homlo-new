import { MAP_THEME } from "./theme/mapTheme";
import type { Coordinate } from "./types";

// Public values from .env, inlined at bundle time (see babel/public-env.js).
const nativeConfig = {
  MAPTILER_KEY: process.env.PUBLIC_MAPTILER_KEY,
  ORS_API_KEY: process.env.PUBLIC_ORS_API_KEY,
  MAPTILER_STYLE_URL: process.env.PUBLIC_MAPTILER_STYLE_URL,
  ORS_BASE_URL: process.env.PUBLIC_ORS_BASE_URL,
};

export const MAPTILER_KEY = nativeConfig.MAPTILER_KEY?.trim() ?? "";
export const ORS_API_KEY = nativeConfig.ORS_API_KEY?.trim() ?? "";

// Free, keyless vector style from OpenFreeMap.
// Other options: "bright" or "positron" (light and minimal).
const OPENFREEMAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

const explicitStyleUrl = nativeConfig.MAPTILER_STYLE_URL?.trim() ?? "";

// If MAPTILER_STYLE_URL is set in .env it wins, otherwise OpenFreeMap is used.
export const MAP_STYLE_URL =
  explicitStyleUrl.length > 0 ? explicitStyleUrl : OPENFREEMAP_STYLE_URL;

// OpenFreeMap needs no key, so the map is always allowed to load.
export const HAS_MAPTILER_KEY = true;

export const ORS_BASE_URL = (
  nativeConfig.ORS_BASE_URL?.trim() || "https://api.openrouteservice.org"
).replace(/\/+$/, "");

export const ORS_PROFILE = "driving-car";

export const ROUTE_TIMEOUT_MS = 12_000;

export const DEFAULT_NEARBY_RADIUS_KM = 10;
export const MAX_NEARBY_RADIUS_KM = 50;
export const MAX_NEARBY_PINS = 50;

export const FALLBACK_MAP_CENTER: Coordinate = {
  latitude: 11.5564,
  longitude: 104.9282,
};

export const COLORS = {
  primary: MAP_THEME.primary,
  primarySoft: MAP_THEME.primarySoft,
  onPrimary: MAP_THEME.onPrimary,
  surface: MAP_THEME.surface,
  text: MAP_THEME.text,
  textMuted: MAP_THEME.textMuted,
  border: MAP_THEME.border,
  userDot: MAP_THEME.userDot,
  routeCasing: MAP_THEME.routeCasing,
  shadow: MAP_THEME.shadow,
} as const;