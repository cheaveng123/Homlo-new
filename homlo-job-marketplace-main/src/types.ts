export type Coordinate = {
  latitude: number;
  longitude: number;
};

export type JobPin = {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
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
