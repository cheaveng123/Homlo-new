export const WORK_ARRANGEMENTS = ["On-site", "Hybrid", "Remote"] as const;

export type WorkArrangement = (typeof WORK_ARRANGEMENTS)[number];

export const WORK_ARRANGEMENT_NOT_SPECIFIED = "Not specified";

export function isWorkArrangement(value: unknown): value is WorkArrangement {
  return typeof value === "string" && (WORK_ARRANGEMENTS as readonly string[]).includes(value);
}

export function normalizeWorkArrangement(value: unknown): WorkArrangement | null {
  return isWorkArrangement(value) ? value : null;
}

export function workArrangementLabel(value: WorkArrangement | null | undefined): string {
  return isWorkArrangement(value) ? value : WORK_ARRANGEMENT_NOT_SPECIFIED;
}

export type WorkArrangementLocation = {
  workArrangement: WorkArrangement | null;
  latitude: number | null;
  longitude: number | null;
};

export function mapCoordinateForJob(job: WorkArrangementLocation): { latitude: number; longitude: number } | null {
  if (job.workArrangement !== "On-site") return null;
  const { latitude, longitude } = job;
  if (typeof latitude !== "number" || typeof longitude !== "number") return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

export function isMapableJobLocation(job: WorkArrangementLocation): boolean {
  return mapCoordinateForJob(job) !== null;
}
