export type EmploymentType = "Full-time" | "Part-time" | "Contract" | "Internship";
export type WorkArrangement = "On-site" | "Hybrid" | "Remote";
export type SalaryPeriod = "Per month" | "Per year" | "Per day" | "Per hour";
export type JobPostingStatus = "draft" | "active" | "closed";

export type JobPostingDraft = {
  id: string;
  employerId: string;
  companyId: string;
  companyName: string;
  title: string;
  category: string;
  employmentType: EmploymentType | "";
  workArrangement: WorkArrangement | "";
  country: string;
  province: string;
  city: string;
  district: string;
  address: string;
  postalCode: string;
  latitude: number | null;
  longitude: number | null;
  salaryMin: string;
  salaryMax: string;
  salaryCurrency: string;
  salaryPeriod: SalaryPeriod;
  salaryVisible: boolean;
  description: string;
  responsibilities: string;
  requirements: string;
  skills: string;
  benefits: string;
  deadline: string;
  bannerImage: string;
  bannerImageMimeType: string;
  bannerImageName: string;
  status: JobPostingStatus;
  createdAt: string;
  updatedAt: string;
};

export const jobPostingDraftKey = "homlo-employer-job-draft";
export const jobPostingLiveKey = "homlo-employer-live-job";

export const defaultJobPosting: JobPostingDraft = {
  id: `draft-${Date.now()}`,
  employerId: "local-employer",
  companyId: "local-company",
  companyName: "Your company",
  title: "",
  category: "",
  employmentType: "",
  workArrangement: "",
  country: "Cambodia",
  province: "",
  city: "Phnom Penh",
  district: "",
  address: "",
  postalCode: "",
  latitude: null,
  longitude: null,
  salaryMin: "",
  salaryMax: "",
  salaryCurrency: "USD",
  salaryPeriod: "Per month",
  salaryVisible: true,
  description: "",
  responsibilities: "",
  requirements: "",
  skills: "",
  benefits: "",
  deadline: "",
  bannerImage: "",
  bannerImageMimeType: "",
  bannerImageName: "",
  status: "draft",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export function validatePostingStep(step: number, draft: JobPostingDraft) {
  const errors: Record<string, string> = {};
  if (step === 1) {
    if (!draft.title.trim()) errors.title = "Add a job title.";
    if (!draft.category) errors.category = "Choose a category.";
    if (!draft.employmentType) errors.employmentType = "Select an employment type.";
    if (!draft.workArrangement) errors.workArrangement = "Choose a work arrangement.";
  }
  if (step === 2 && draft.workArrangement !== "Remote") {
    if (!draft.city.trim()) errors.city = "Add the city where candidates will work.";
    if (draft.latitude == null || draft.longitude == null) {
      errors.location = "Mark the exact place on the map so candidates can find you.";
    }
  }
  if (step === 3 && !draft.description.trim()) errors.description = "Add a short description of the role.";
  if (step === 4 && draft.salaryVisible) {
    const hasMin = draft.salaryMin.trim() !== "";
    const hasMax = draft.salaryMax.trim() !== "";
    const min = Number(draft.salaryMin);
    const max = Number(draft.salaryMax);
    if (hasMin && !Number.isFinite(min)) errors.salaryMin = "Enter a valid number.";
    if (hasMax && !Number.isFinite(max)) errors.salaryMax = "Enter a valid number.";
    if (hasMin && Number.isFinite(min) && min < 0) errors.salaryMin = "Salary can't be negative.";
    if (hasMax && Number.isFinite(max) && max < 0) errors.salaryMax = "Salary can't be negative.";
    if (hasMin && hasMax && Number.isFinite(min) && Number.isFinite(max) && min > max) {
      errors.salaryMin = "Minimum must be lower than or equal to maximum.";
      errors.salaryMax = "Maximum must be higher than or equal to minimum.";
    }
  }
  if (step === 5) {
    // Homlo is the only application channel — no external link / email is
    // offered to candidates. Step 5 still needs at least the deadline field
    // to exist so the form can advance; validation is intentionally empty.
  }
  return errors;
}

export function formatPostingSalary(draft: JobPostingDraft) {
  if (!draft.salaryVisible) return "Salary not disclosed";
  if (!draft.salaryMin && !draft.salaryMax) return "Salary negotiable";
  const range = draft.salaryMin && draft.salaryMax ? `${draft.salaryMin}–${draft.salaryMax}` : draft.salaryMin || draft.salaryMax;
  return `${draft.salaryCurrency} ${range} · ${draft.salaryPeriod.replace("Per ", "per ")}`;
}

/**
 * Maps a JobPostingDraft to the tRPC `homlo.employer.saveJob` input. Single
 * source of truth used by the form (Save Draft / Publish) and by tests so the
 * structured location data a job carries is always consistent with what the
 * gateway persists:
 *
 *   - On-site / hybrid jobs always carry latitude + longitude (from the map).
 *   - Remote jobs deliberately send null coordinates (distance/geo sources
 *     ignore them, as they already do today) and a "Remote" location text.
 */
export type JobSaveInput = {
  jobId: string | null;
  categoryId: string | null;
  title: string;
  description: string;
  payAmount: number;
  payCurrency: string;
  payType: "hourly" | "daily" | "fixed";
  locationText: string | null;
  addressLine: string | null;
  city: string | null;
  district: string | null;
  province: string | null;
  country: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  workersNeeded: number;
  status: "draft" | "open";
  bannerImage: string | null;
};

export function buildJobSaveInput(draft: JobPostingDraft, status: "draft" | "open", jobId: string | null): JobSaveInput {
  const remote = draft.workArrangement === "Remote";
  const locationText = remote
    ? "Remote"
    : [draft.district, draft.city, draft.country].filter(Boolean).join(", ") || null;
  return {
    jobId,
    categoryId: null,
    title: draft.title.trim(),
    description: [draft.description, draft.responsibilities && `Responsibilities: ${draft.responsibilities}`, draft.requirements && `Requirements: ${draft.requirements}`, draft.skills && `Skills: ${draft.skills}`].filter(Boolean).join("\n\n"),
    payAmount: Number(draft.salaryMin || draft.salaryMax || 0),
    payCurrency: draft.salaryCurrency?.trim() || "USD",
    payType: draft.salaryPeriod === "Per hour" ? "hourly" as const : draft.salaryPeriod === "Per day" ? "daily" as const : "fixed" as const,
    locationText,
    addressLine: remote ? null : draft.address.trim() || null,
    city: remote ? null : draft.city.trim() || null,
    district: remote ? null : draft.district.trim() || null,
    province: remote ? null : draft.province.trim() || null,
    country: remote ? null : draft.country.trim() || null,
    postalCode: remote ? null : draft.postalCode.trim() || null,
    latitude: remote ? null : draft.latitude,
    longitude: remote ? null : draft.longitude,
    workersNeeded: 1,
    status,
    bannerImage: draft.bannerImage || null,
  };
}

/** Shape of a job record returned by `homlo_list_employer_jobs` (setof jobs). */
export type RemoteJobRecord = {
  id: string;
  title: string | null;
  description: string | null;
  pay_amount: number | string | null;
  pay_currency: string | null;
  pay_type: "hourly" | "daily" | "fixed" | null;
  location_text: string | null;
  latitude: number | null;
  longitude: number | null;
  address_line?: string | null;
  city?: string | null;
  district?: string | null;
  province?: string | null;
  country?: string | null;
  postal_code?: string | null;
  banner_image?: string | null;
  status: string | null;
  created_at: string;
};

/**
 * Hydrates a form draft from a saved remote job row so "Continue draft"
 * restores the employer's progress. Structured location fields added by
 * migration 025 are preferred; `location_text` is the fallback for jobs saved
 * before the migration. Coordinates are preserved as-is; if the old row only
 * has a text location (no lat/lng), the form requires a fresh map selection
 * before publish (validation in `validatePostingStep`).
 */
export function draftFromRemoteJob(job: RemoteJobRecord): JobPostingDraft {
  const base = defaultJobPosting;
  return {
    ...base,
    id: job.id,
    title: job.title ?? "",
    description: job.description ?? "",
    companyName: base.companyName,
    salaryMin: job.pay_amount != null && job.pay_amount !== "" ? String(Number(job.pay_amount) || "") : "",
    salaryCurrency: job.pay_currency ?? base.salaryCurrency,
    country: job.country ?? (job.location_text && job.location_text !== "Remote" ? job.location_text.split(", ").pop() ?? "" : ""),
    province: job.province ?? "",
    city: job.city ?? (job.location_text && job.location_text !== "Remote" ? job.location_text.split(", ").slice(-2)[0] ?? "" : ""),
    district: job.district ?? "",
    address: job.address_line ?? "",
    postalCode: job.postal_code ?? "",
    latitude: job.latitude,
    longitude: job.longitude,
    status: (job.status === "open" ? "active" : "draft") as JobPostingStatus,
    createdAt: job.created_at,
    updatedAt: job.created_at,
  };
}
