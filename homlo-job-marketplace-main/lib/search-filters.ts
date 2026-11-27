import type { Job } from "@/components/job-store";
import { defaultSearchCenter, distanceFromCenter, jobCoordinate } from "@/lib/job-geography";
import type { MapCoordinate } from "@/lib/openstreetmap-geocoding";
import { isValidPolygon, pointInPolygon, polygonToBboxString } from "@/lib/polygon";

export type SortOption = "Recommended" | "Newest" | "Salary high to low" | "Closest";
export const sortOptions: SortOption[] = ["Recommended", "Newest", "Salary high to low", "Closest"];

export type ArrangementFilter = "Any" | "On-site" | "Hybrid" | "Remote";
export const arrangementFilters: ArrangementFilter[] = ["Any", "On-site", "Hybrid", "Remote"];

export type EmploymentFilter = "Any" | "Full-time" | "Part-time" | "Contract" | "Temporary" | "Internship" | "Weekend";
export const employmentFilters: EmploymentFilter[] = ["Any", "Full-time", "Part-time", "Contract", "Temporary", "Internship", "Weekend"];

export type ExperienceFilter = "Any" | "No experience" | "Entry level" | "1–2 years" | "2–3 years" | "Internship";
export const experienceFilters: ExperienceFilter[] = ["Any", "No experience", "Entry level", "1–2 years", "2–3 years", "Internship"];

export type PostedFilter = "Any time" | "Today" | "This week" | "This month";
export const postedFilters: PostedFilter[] = ["Any time", "Today", "This week", "This month"];

export type PayPeriodFilter = "Per hour" | "Per day" | "Per week" | "Per month";
export const payPeriods: PayPeriodFilter[] = ["Per hour", "Per day", "Per week", "Per month"];

/** Hours per period used to convert salary bounds to an hourly-equivalent. */
export function hourlyEquivalent(amount: number, period: PayPeriodFilter | undefined): number {
  const multipliers: Record<PayPeriodFilter, number> = { "Per hour": 1, "Per day": 8, "Per week": 40, "Per month": 160 };
  return amount * (multipliers[period ?? "Per hour"]);
}

export type SearchFilters = {
  category: string;
  employmentType: EmploymentFilter;
  arrangement: ArrangementFilter;
  experience: ExperienceFilter;
  posted: PostedFilter;
  location: string;
  salaryMin: string;
  salaryMax: string;
  /** Pay period the salary bounds are expressed in. */
  payPeriod: PayPeriodFilter;
  sort: SortOption;
  /** "Near me" is on: geographic filters use a resolved center. */
  nearMe: boolean;
  /** Radius in km ("5".."50"); empty means no distance constraint. */
  radiusKm: string;
  /** Center used for the distance filter when nearMe is on. */
  nearCenter?: MapCoordinate;
  /** User-drawn map area; when valid it filters results to that region. */
  polygon?: MapCoordinate[];
  /** Short, human-friendly label for the drawn area (kept in sync with polygon). */
  polygonLabel?: string;
};

export const defaultSearchFilters: SearchFilters = {
  category: "All",
  employmentType: "Any",
  arrangement: "Any",
  experience: "Any",
  posted: "Any time",
  location: "",
  salaryMin: "",
  salaryMax: "",
  payPeriod: "Per hour",
  sort: "Recommended",
  nearMe: false,
  radiusKm: "",
};

export function nearSearchCenter(filters: SearchFilters): MapCoordinate {
  return filters.nearCenter ?? defaultSearchCenter;
}

const postedMatches = (job: Job, posted: PostedFilter) => {
  if (posted === "Any time" || posted === "This month") return true;
  const value = (job.posted ?? "").toLowerCase();
  if (posted === "Today") return value.includes("today") || value.includes("h ago") || value.includes("just now");
  if (posted === "This week") {
    if (value.includes("today") || value.includes("just now")) return true;
    const hours = Number(value.match(/(\d+)h ago/)?.[1] ?? Number.POSITIVE_INFINITY);
    if (Number.isFinite(hours) && hours <= 168) return true;
    const days = Number(value.match(/(\d+) days ago/)?.[1] ?? Number.POSITIVE_INFINITY);
    return value.includes("yesterday") || (Number.isFinite(days) && days <= 7);
  }
  return true;
};

const payValue = (job: Job) => Number(job.pay.match(/\d+/)?.[0] ?? 0);

export function applyClientFilters(jobs: Job[], filters: SearchFilters) {
  const minimum = Number(filters.salaryMin);
  const maximum = Number(filters.salaryMax);
  const radius = filters.nearMe ? Number(filters.radiusKm) : 0;
  const hasMin = Number.isFinite(minimum) && minimum > 0;
  const hasMax = Number.isFinite(maximum) && maximum > 0;
  const hasRadius = filters.nearMe && Number.isFinite(radius) && radius > 0;
  const filterCenter = nearSearchCenter(filters);
  const location = filters.location.trim().toLowerCase();
  const enriched = jobs.map((job) => {
    const { coordinate, distanceKm } = distanceFromCenter(job, filterCenter);
    return { job, coordinate, distanceKm };
  });
  const filtered = enriched.filter(({ job, coordinate, distanceKm }) => {
    const matchesCategory = filters.category === "All" || job.category === filters.category;
    const pay = payValue(job);
    const matchesPay = (!hasMin || pay >= minimum) && (!hasMax || pay <= maximum);
    const matchesType = filters.employmentType === "Any" || job.tag === filters.employmentType;
    const matchesArrangement = filters.arrangement === "Any" || job.arrangement === filters.arrangement;
    const matchesExperience = filters.experience === "Any" || job.experience === filters.experience || (filters.experience === "No experience" && job.noExperience);
    const matchesLocation = !location || job.location.toLowerCase().includes(location);
    const matchesRadius = !hasRadius || distanceKm <= radius;
    const matchesPolygon = !isValidPolygon(filters.polygon) || (coordinate !== null && pointInPolygon(coordinate, filters.polygon));
    return matchesCategory && matchesPay && matchesType && matchesArrangement && matchesExperience && matchesLocation && matchesRadius && matchesPolygon && postedMatches(job, filters.posted);
  });
  if (filters.sort === "Salary high to low") {
    filtered.sort((a, b) => payValue(b.job) - payValue(a.job));
  } else if (filters.sort === "Closest") {
    filtered.sort((a, b) => a.distanceKm - b.distanceKm);
  } else if (filters.sort === "Newest") {
    const postedHours = (job: Job) => {
      const value = (job.posted ?? "").toLowerCase();
      const hours = Number(value.match(/(\d+)h ago/)?.[1] ?? Number.POSITIVE_INFINITY);
      if (Number.isFinite(hours)) return hours;
      if (value.includes("just now") || value.includes("today")) return 0;
      if (value.includes("yesterday")) return 24;
      const days = Number(value.match(/(\d+) days ago/)?.[1] ?? 999);
      return days * 24;
    };
    filtered.sort((a, b) => postedHours(a.job) - postedHours(b.job));
  }
  return filtered.map(({ job, coordinate, distanceKm }) => ({ job, coordinate, distanceKm }));
}

export function countActiveFilters(filters: SearchFilters) {
  return [
    filters.category !== "All",
    filters.employmentType !== "Any",
    filters.arrangement !== "Any",
    filters.experience !== "Any",
    filters.posted !== "Any time",
    Boolean(filters.location),
    Boolean(filters.salaryMin),
    Boolean(filters.salaryMax),
    filters.payPeriod !== "Per hour",
    filters.nearMe && Boolean(filters.radiusKm),
    filters.sort !== "Recommended",
    isValidPolygon(filters.polygon),
  ].filter(Boolean).length;
}

export function filtersEqual(a: SearchFilters, b: SearchFilters) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export type EnrichedJob = ReturnType<typeof applyClientFilters>[number];

export { jobCoordinate };
export type { MapCoordinate };
export const defaultCenter = defaultSearchCenter;

/** Serialises a validated polygon to the DB bounding-box string (or undefined). */
export function filtersBbox(filters: SearchFilters): string | undefined {
  return isValidPolygon(filters.polygon) ? polygonToBboxString(filters.polygon) : undefined;
}