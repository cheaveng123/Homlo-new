import type { Job } from "@/components/job-store";
import type { HomeFeedSection } from "@/hooks/use-home-feed";
import type { SpecializedField } from "@/lib/specialized-fields";

/**
 * Shape of one specialized section as it arrives from `homlo.homeFeed`. Kept
 * structural (not `any`) so a malformed payload is a type error, not a crash.
 */
type RawSpecializedSection = {
  field?: unknown;
  jobs?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toField(value: unknown): SpecializedField | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || !value.id) return null;
  return value as unknown as SpecializedField;
}

/**
 * Normalizes the server's `specialized` array into renderable sections.
 *
 * A missing, null, non-array or malformed value yields an empty list instead of
 * throwing. It never invents a field, so a broken payload cannot masquerade as
 * real content; the caller keeps whatever it already had.
 */
export function toSpecializedSections(raw: unknown, normalizeJob: (job: never) => Job): HomeFeedSection[] {
  if (!Array.isArray(raw)) return [];
  const sections: HomeFeedSection[] = [];
  for (const entry of raw as RawSpecializedSection[]) {
    const field = toField(entry?.field);
    if (!field) continue;
    const jobs = Array.isArray(entry?.jobs) ? (entry.jobs as unknown[]).map((job) => normalizeJob(job as never)) : [];
    sections.push({ field, jobs });
  }
  return sections;
}
