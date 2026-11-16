import type { Job } from "@/components/job-store";
import { jobCoordinate } from "@/lib/job-geography";
import { decodePolygon, isValidPolygon, pointInPolygon } from "@/lib/polygon";

export type GuidedPreferences = {
  salary: string;
  salaryMinimum?: number;
  salaryMaximum?: number;
  workType: string;
  field: string;
  city: string;
  radius?: string;
  locationLabel?: string;
  /** Serialised drawn-area polygon ("lat,lng|lat,lng|..."), if the user drew one. */
  polygon?: string;
};

const arrangementValues = ["On-site", "Hybrid", "Remote"] as const;
const statusValues = ["Featured", "New", "Hiring"] as const;

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : value == null ? fallback : String(value);
}

function optionalChoice<T extends readonly string[]>(value: unknown, values: T): T[number] | undefined {
  const normalized = text(value);
  return (values as readonly string[]).includes(normalized) ? normalized as T[number] : undefined;
}

/**
 * Converts external or partially populated records into the stable shape used by
 * marketplace UI. Records without a usable id are ignored rather than crashing a list.
 */
export function normalizeJob(value: unknown): Job | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<Job> & Record<string, unknown>;
  const id = text(item.id).trim();
  if (!id) return null;
  return {
    id,
    title: text(item.title, "Untitled role"),
    company: text(item.company, "Company not provided"),
    location: text(item.location, "Location not provided"),
    schedule: text(item.schedule, "Schedule not provided"),
    pay: text(item.pay, "Salary not disclosed"),
    tag: text(item.tag, "Opportunity"),
    category: text(item.category, "Other"),
    image: text(item.image),
    featured: Boolean(item.featured),
    description: text(item.description, "Role details are not available yet."),
    arrangement: optionalChoice(item.arrangement, arrangementValues),
    noExperience: Boolean(item.noExperience),
    experience: text(item.experience, "Experience not specified"),
    posted: text(item.posted, "Posted recently"),
    status: optionalChoice(item.status, statusValues),
  };
}

export function normalizeJobs(items: unknown): Job[] {
  if (!Array.isArray(items)) return [];
  return items.map(normalizeJob).filter((job): job is Job => Boolean(job));
}

export function filterJobs(items: unknown, query: string, filter: string) {
  const normalizedQuery = text(query).trim().toLowerCase();
  return normalizeJobs(items).filter((job) => {
    const matchesFilter = filter === "All" || job.tag === filter || job.category === filter || (filter === "Remote" && job.arrangement === "Remote") || (filter === "Internships" && job.tag === "Internship") || (filter === "No experience" && job.noExperience);
    const matchesQuery = !normalizedQuery || [job.title, job.company, job.category].some((value) => value.toLowerCase().includes(normalizedQuery));
    return matchesFilter && matchesQuery;
  });
}

const readPay = (value: unknown) => Number(text(value).match(/\d+/)?.[0] ?? 0);
const fieldCategories: Record<string, string[]> = {
  "Coffee & cafés": ["Hospitality"],
  "Cleaning & facilities": ["Operations"],
  "Restaurant & hospitality": ["Hospitality"],
  Retail: ["Retail"],
  Sales: ["Sales"],
  Marketing: ["Marketing"],
  Technology: ["Technology", "Design"],
  "Customer service": ["Customer Service"],
  "Office & admin": ["Administration", "Accounting"],
  "Delivery & logistics": ["Logistics"],
  Education: ["Education"],
  Construction: ["Construction", "Engineering"],
  Healthcare: ["Healthcare"],
};

export function filterGuidedJobs(items: unknown, preferences: GuidedPreferences) {
  const polygon = decodePolygon(preferences.polygon);
  const hasPolygon = isValidPolygon(polygon);
  const hasAny = Boolean(
    preferences.salaryMinimum !== undefined ||
      preferences.salaryMaximum !== undefined ||
      (preferences.workType && preferences.workType !== "Any work type") ||
      (preferences.field && preferences.field !== "Any field") ||
      (preferences.city && preferences.city !== "Anywhere") ||
      hasPolygon,
  );

  // Score each job by how many of the chosen steps it matches, then show jobs
  // closest to the preferences first. A job appears as long as at least one
  // criterion matches, but the best/closest matches rank at the top.
  const scored = normalizeJobs(items)
    .map((job) => {
      let score = 0;
      if (preferences.salaryMinimum !== undefined || preferences.salaryMaximum !== undefined) {
        const pay = readPay(job.pay);
        if (preferences.salaryMinimum === undefined || preferences.salaryMaximum === undefined || (pay >= preferences.salaryMinimum && pay <= preferences.salaryMaximum)) score += 1;
      }
      if (preferences.workType && preferences.workType !== "Any work type") {
        if (preferences.workType === job.arrangement || (preferences.workType === "Internship" && job.tag === "Internship")) score += 1;
      }
      if (preferences.field && preferences.field !== "Any field") {
        const allowedCategories = fieldCategories[preferences.field];
        if (allowedCategories?.includes(job.category)) score += 1;
      }
      if (preferences.city && preferences.city !== "Anywhere") {
        if (job.location.includes(preferences.city)) score += 1;
      }
      if (hasPolygon) {
        const coordinate = jobCoordinate(job);
        if (coordinate && pointInPolygon(coordinate, polygon)) score += 1;
      }
      return { job, score };
    })
    .filter((entry) => entry.score > 0 || !hasAny)
    .sort((a, b) => b.score - a.score);

  return scored.map((entry) => entry.job);
}
