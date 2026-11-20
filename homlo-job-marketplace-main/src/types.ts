export type Coordinate = {
  latitude: number;
  longitude: number;
};

export type JobPin = {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  /** Job category / field, any spelling; picks the pin glyph. */
  category?: string | null;
  /** Secondary line in lists, e.g. "Brew Lab · Toul Kork". */
  subtitle?: string | null;
  /** Short pin text, e.g. "$180". */
  label?: string | null;
};

export type JobWithDistance = JobPin & {
  distanceKm: number;
};

export type RouteSummary = {
  distanceKm: number;
  durationMinutes: number;
  geometry: Coordinate[];
};

export type PermissionState = "unknown" | "requesting" | "granted" | "denied";

export type Bounds = {
  ne: [longitude: number, latitude: number];
  sw: [longitude: number, latitude: number];
};
