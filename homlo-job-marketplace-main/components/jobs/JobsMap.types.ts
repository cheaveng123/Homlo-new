export type JobsMapCoordinate = { latitude: number; longitude: number };

export type JobsMapJob = {
  id: string;
  pay: string;
  unit?: string;
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
};
