// employerRepository.ts
//
// Data-access layer for the Employer Profile (visitor view) and All Jobs
// screens. Screens call these functions only — never a data source directly.
//
// Data strategy (real-first, curated fallback):
//   * Employer-scoped content that the live backend cannot express yet (about,
//     response time, reviews) falls back to the curated employer data in
//     `lib/mock/employerMockData.ts` for the seeded demo employers (emp-1..3).
//   * Live jobs come from the same public Supabase-backed feed the rest of the
//     app consumes (`homlo.publicJobs`, via the shared `trpcDirect` client).
//     Public records expose only `employer_name` (no employer_id), so a job is
//     attributed to an employer by matching that name against the employer's
//     known names/company aliases — or by slug for derived ids such as
//     `emp-meng-cheaveng`.
//   * If the backend is unreachable the feed silently resolves to [] and the
//     curated jobs for the requested employer are returned instead.

import { trpcDirect } from "@/lib/trpc";
import { DEMO_CONTENT_ENABLED } from "@/lib/demo-content";
import { formatPostedAt, type JobRecord } from "@/lib/job-record";
import { getProfilePhotoUrl } from "@/lib/profile-photo";
import { hasBannerImage, resolveJobImage } from "@/lib/job-banner";
import { formatPositionsLabel } from "@/lib/positions";
import {
  COMPANY_TO_EMPLOYER_ID,
  MOCK_EMPLOYERS,
  MOCK_JOBS,
} from "@/lib/mock/employerMockData";
import { allExploreMockJobs, type ExploreMockJob } from "@/lib/mock/exploreMockJobs";

import type { Employer, EmploymentType, JobListing, PriceUnit, Review } from "./types";

/** Public published-job record shape (mirrors hooks/use-published-jobs). */
type PublicJobRecord = Omit<JobRecord, "workers_needed" | "banner_image"> & {
  workers_needed?: number;
  banner_image?: string | null;
  employer_photo_key?: string | null;
};

let publicJobsCache: PublicJobRecord[] | null = null;

async function loadPublicJobs(): Promise<PublicJobRecord[]> {
  if (publicJobsCache) return publicJobsCache;
  try {
    const response = await trpcDirect.homlo.publicJobs.query();
    publicJobsCache = response?.jobs ?? [];
  } catch {
    publicJobsCache = [];
  }
  return publicJobsCache;
}

/** Accepts both the old `emp_1` badge and the app's push-param `emp-1`. */
function normalizeEmployerId(employerId: string): string {
  return (employerId ?? "").trim().replace(/^emp_/i, "emp-");
}

function slugify(value: string): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Known display names (employer + its company aliases) for name matching. */
function companyAliases(employerId: string): Set<string> {
  const names = new Set<string>();
  const curated = MOCK_EMPLOYERS[employerId];
  if (curated) names.add(curated.name);
  for (const [company, id] of Object.entries(COMPANY_TO_EMPLOYER_ID)) {
    if (id === employerId) names.add(company);
  }
  return names;
}

function employerMatches(name: string | null, aliases: Set<string>): boolean {
  const value = (name ?? "").trim();
  if (!value) return false;
  const lower = value.toLowerCase();
  for (const alias of aliases) if (alias.toLowerCase() === lower) return true;
  return false;
}

function spotsLabel(
  filled: number | null | undefined,
  total: number | null | undefined,
): string {
  return formatPositionsLabel(filled, total);
}

function toEmploymentType(record: PublicJobRecord): EmploymentType {
  const hay = `${record.title} ${record.location_text ?? ""}`.toLowerCase();
  if (hay.includes("remote")) return "remote";
  if (hay.includes("weekend")) return "weekends";
  if (record.pay_type === "fixed") return "full-time";
  return "part-time";
}

function toPriceUnit(record: PublicJobRecord): PriceUnit {
  return record.pay_type === "hourly" ? "hr" : "mo";
}

function realToJobListing(record: PublicJobRecord, employerId: string): JobListing {
  const photoKey = (record as { banner_image?: string | null }).banner_image;
  return {
    id: record.id,
    employerId,
    title: record.title,
    employmentType: toEmploymentType(record),
    status: "live",
    location: record.location_text?.trim() || "Location to be confirmed",
    postedAt: formatPostedAt(record.created_at),
    price: Number(record.pay_amount),
    priceUnit: toPriceUnit(record),
    spotsLabel: spotsLabel(record.workers_hired, record.workers_needed),
    photoUrl: hasBannerImage(photoKey) ? resolveJobImage(photoKey) : null,
  };
}

function curatedToJobListing(job: (typeof MOCK_JOBS)[number]): JobListing {
  return {
    id: job.id,
    employerId: job.employerId,
    title: job.title,
    employmentType: job.type.replace("_", "-") as EmploymentType,
    status: "live",
    location: job.location,
    postedAt: formatPostedAt(job.postedAt),
    price: job.price,
    priceUnit: job.priceUnit as PriceUnit,
    spotsLabel: spotsLabel(0, job.spotsRemaining),
    photoUrl: null,
  };
}

function exploreMockToJobListing(mock: ExploreMockJob, employerId: string): JobListing {
  const isRemote = mock.distance.trim().toLowerCase() === "remote";
  return {
    id: mock.id,
    employerId,
    title: mock.title,
    employmentType: isRemote ? "remote" : "full-time",
    status: "live",
    location: isRemote ? "Remote" : "Phnom Penh",
    postedAt: "Posted recently",
    price: Number(mock.pay.replace(/[^0-9.]/g, "")) || 0,
    priceUnit: "mo",
    spotsLabel: spotsLabel(0, 1),
    photoUrl: null,
  };
}

/** Placeholder listings for demo employers (Explore "Top employers"). */
function demoListingsFor(slug: string, employerId: string): JobListing[] {
  if (!slug) return [];
  return allExploreMockJobs
    .filter((mock) => {
      const companySlug = slugify(mock.company);
      return companySlug === slug || companySlug.startsWith(`${slug}-`);
    })
    .map((mock) => exploreMockToJobListing(mock, employerId));
}

function firstProfilePhotoKey(records: PublicJobRecord[]): string | null {
  for (const record of records) {
    const key = (record as { employer_photo_key?: string | null }).employer_photo_key;
    if (key) return key;
  }
  return null;
}

type RealEmployerProfile = {
  fullName: string | null;
  profilePhotoKey: string | null;
  bannerImage: string | null;
  verified: boolean;
  about: string | null;
  locationText: string | null;
  latitude: number | null;
  longitude: number | null;
};

/**
 * `homlo.employerProfile` matches on the public display name (profiles.full_name),
 * not on the route slug (`emp-meng-cheaveng`). Always pass the real employer name
 * from a matched job (or the curated record), never `normalizedId`.
 */
async function loadRealProfile(name?: string | null): Promise<RealEmployerProfile | null> {
  const query = name?.trim();
  if (!query) return null;
  try {
    return await trpcDirect.homlo.employerProfile.query({ name: query });
  } catch {
    return null;
  }
}

export async function getEmployerById(employerId: string): Promise<Employer | null> {
  const normalizedId = normalizeEmployerId(employerId);
  const publicJobs = await loadPublicJobs();
  // Sample employers (with sample ratings/reviews) are demo-only.
  const curated = DEMO_CONTENT_ENABLED ? MOCK_EMPLOYERS[normalizedId] : undefined;

  if (curated) {
    const matched = publicJobs.filter((r) => employerMatches(r.employer_name, companyAliases(normalizedId)));
    const photoKey = firstProfilePhotoKey(matched);
    // Fetch the real employer profile from public_profiles (role='employer') so
    // visitor profiles show actual valid data (name, photo, banner, verified)
    // instead of only mock/curated fallback values.
    const profileName = matched.find((record) => record.employer_name?.trim())?.employer_name ?? curated.name;
    const realProfile = await loadRealProfile(profileName);
    return {
      id: normalizedId,
      name: realProfile?.fullName ?? curated.name,
      verified: realProfile?.verified ?? curated.verified,
      category: curated.category,
      location: realProfile ? (realProfile.locationText?.trim() || "Location not set") : curated.location,
      bannerUrl: realProfile ? realProfile.bannerImage : curated.bannerUrl,
      avatarUrl: realProfile?.profilePhotoKey ? getProfilePhotoUrl(realProfile.profilePhotoKey) : (photoKey ? getProfilePhotoUrl(photoKey) : null),
      activeJobsCount: Math.max(curated.stats.activeJobs, matched.length),
      rating: curated.stats.rating,
      reviewCount: curated.reviews.count,
      yearsOnHomlo: `${curated.stats.yearsOnHomlo}yr`,
      about: realProfile ? (realProfile.about?.trim() || "No about added yet.") : curated.bio,
      industry: curated.industry,
      responseTime: curated.responseTime,
    };
  }

  // Derived id (e.g. emp-meng-cheaveng from a live-feed employer name):
  // synthesize a profile from the employer's live jobs.
  const slug = normalizedId.replace(/^emp[-_]?/i, "").trim();
  const matched = publicJobs.filter((r) => {
    const nameSlug = slugify(r.employer_name ?? "");
    if (!slug || !nameSlug) return false;
    return nameSlug === slug || nameSlug.startsWith(`${slug}-`);
  });
  if (matched.length > 0) {
    const first = matched[0];
    const photoKey = firstProfilePhotoKey(matched);
    const realProfile = await loadRealProfile(first.employer_name);
    return {
      id: normalizedId,
      name: realProfile?.fullName ?? first.employer_name ?? "Homlo employer",
      verified: realProfile?.verified ?? false,
      category: first.category ?? "Other",
      location: realProfile
        ? (realProfile.locationText?.trim() || "Location not set")
        : (first.location_text?.trim() || "Location to be confirmed"),
      avatarUrl: realProfile?.profilePhotoKey ? getProfilePhotoUrl(realProfile.profilePhotoKey) : (photoKey ? getProfilePhotoUrl(photoKey) : null),
      bannerUrl: realProfile?.bannerImage ?? null,
      activeJobsCount: matched.length,
      rating: 0,
      reviewCount: 0,
      yearsOnHomlo: "New",
      about: realProfile
        ? (realProfile.about?.trim() || "No about added yet.")
        : "This employer posts jobs on Homlo Jobs — reach out through the listing for day-to-day updates.",
      industry: first.category ?? "Other",
      // Not measured yet: never show an invented response time.
      responseTime: "",
    };
  }

  // No live record and no curated entry (removed employer): outside demo mode
  // there is nothing real to show — the screen renders its "not found" state.
  if (!DEMO_CONTENT_ENABLED) return null;

  // Demo mode: synthesize a profile so sample employers still render.
  const label = slug.replace(/[-_]+/g, " ").trim();
  const name = label ? label.charAt(0).toUpperCase() + label.slice(1) : "Homlo employer";
  const realProfile = await loadRealProfile(name);
  return {
    id: normalizedId,
    name: realProfile?.fullName ?? name,
    verified: realProfile?.verified ?? false,
    category: "General",
    location: realProfile?.locationText?.trim() || "Phnom Penh",
    bannerUrl: realProfile?.bannerImage ?? null,
    avatarUrl: realProfile?.profilePhotoKey ? getProfilePhotoUrl(realProfile.profilePhotoKey) : null,
    activeJobsCount: demoListingsFor(slug, normalizedId).length,
    rating: 0,
    reviewCount: 0,
    yearsOnHomlo: "New",
    about: realProfile
      ? (realProfile.about?.trim() || "No about added yet.")
      : `${name} is hiring on Homlo Jobs. Open one of the listings to see the full description and apply directly.`,
    industry: "General",
    responseTime: "Within a day",
  };
}

export async function getEmployerJobs(employerId: string): Promise<JobListing[]> {
  const normalizedId = normalizeEmployerId(employerId);
  const [publicJobs, curated] = await Promise.all([
    loadPublicJobs(),
    Promise.resolve(DEMO_CONTENT_ENABLED ? MOCK_JOBS.filter((j) => j.employerId === normalizedId).map(curatedToJobListing) : []),
  ]);

  const aliases = companyAliases(normalizedId);
  const slug = normalizedId.replace(/^emp[-_]?/i, "").trim();
  const real: JobListing[] = [];
  for (const record of publicJobs) {
    if (employerMatches(record.employer_name, aliases)) {
      real.push(realToJobListing(record, normalizedId));
    } else if (slug && slugify(record.employer_name ?? "") === slug) {
      real.push(realToJobListing(record, normalizedId));
    }
  }

  // Live feed jobs first (newest-first), then curated, deduped by id.
  const seen = new Set<string>();
  const combined = [...real, ...curated].filter((job) => {
    if (seen.has(job.id)) return false;
    seen.add(job.id);
    return true;
  });
  if (combined.length > 0) return combined;

  // Demo employers (Explore "Top employers") have no database record: fall back
  // to the matching placeholder listings so the profile has content.
  return DEMO_CONTENT_ENABLED ? demoListingsFor(slug, normalizedId) : [];
}

/** Short preview (2-3) for the Employer Profile screen's inline list */
export async function getEmployerJobsPreview(
  employerId: string,
  limit = 3
): Promise<JobListing[]> {
  const jobs = await getEmployerJobs(employerId);
  return jobs.slice(0, limit);
}

export async function getEmployerReviews(employerId: string): Promise<Review[]> {
  // There is no real review system yet; sample reviews are demo-only.
  if (!DEMO_CONTENT_ENABLED) return [];
  const curated = MOCK_EMPLOYERS[normalizeEmployerId(employerId)];
  if (!curated) return [];
  return curated.reviews.items.map((item) => ({
    id: item.id,
    authorName: item.name,
    rating: item.rating,
    text: item.text,
  }));
}

// Satisfies Expo Router's requirement that every file under app/ exports a
// default (this module is a data layer, not a route component).
export default {
  getEmployerById,
  getEmployerJobs,
  getEmployerJobsPreview,
  getEmployerReviews,
};