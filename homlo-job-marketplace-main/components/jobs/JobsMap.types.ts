export type JobsMapCoordinate = { latitude: number; longitude: number };

export type JobsMapJob = {
  id: string;
  pay: string;
  unit?: string;
  /** Job category / field; picks the pin glyph. */
  category?: string | null;
  km?: number | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type JobsMapProps = {
  radiusKm: number;
  jobs: JobsMapJob[];
  height?: number;
  /** Device / search origin. Defaults to Phnom Penh when the user denies location. */
  center?: JobsMapCoordinate | null;
  onPressJob?: (jobId: string) => void;
  /** Fill the parent instead of using `height` (full-screen map pages). */
  fill?: boolean;
  /** Highlights this job's pin and keeps it out of clusters. */
  selectedId?: string | null;
  /** Space taken by floating chrome, so centring and fits stay visible. */
  insets?: { top?: number; bottom?: number };
  /** The "Using your current location" pill. Default true. */
  showLocationBadge?: boolean;
};

export type JobsMapHandle = {
  /** Centre the map on a point (e.g. a tapped job). */
  centerOn: (coordinate: JobsMapCoordinate) => void;
  /** Back to the user / search origin at the current radius. */
  recenter: () => void;
};
