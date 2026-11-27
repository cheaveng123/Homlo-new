/**
 * Client-side job-management repository for the employer job detail / edit
 * screens.
 *
 * Every function hits the real tRPC → edge-function → Postgres path; there
 * are no direct Supabase calls from screens. The screens call the trpc React
 * hooks for reads/mutations, and this module owns the row→domain
 * normalization plus the exact save payload so the detail and edit screens
 * cannot drift from each other.
 */
import { JOB_IMAGES_BUCKET } from "./job-images-shared";
import { computePositionsLeft } from "./positions";
import { getProfilePhotoUrl } from "./profile-photo";
import { trpcDirect } from "./trpc";
import type {
  ApplicationStatus,
  EditableJobFields,
  EmployerJob,
  JobApplicant,
  JobStatus,
  PayType,
} from "@/backend/domain/models";

export { JOB_IMAGES_BUCKET };

/** Raw row shape returned by the gateway's `employer.jobs` action. */
export type EmployerJobRow = {
  id: string;
  title: string | null;
  description: string | null;
  pay_amount: number | string | null;
  pay_currency: string | null;
  pay_type: string | null;
  location_text: string | null;
  latitude: number | null;
  longitude: number | null;
  workers_needed: number | null;
  workers_hired: number | null;
  banner_image: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
  requirements?: string | null;
  category?: string | null;
  views_count?: number | string | null;
  auto_close_enabled?: boolean | null;
  boost_id?: string | null;
  boost_expires_at?: string | null;
  boost_status?: string | null;
  boost_starts_at?: string | null;
  boost_rank_multiplier?: number | null;
  server_now?: string | null;
  queued_boosts?: number | null;
};

/** Normalizes a gateway `employer.jobs` row into the domain read model. */
export function normalizeEmployerJob(row: EmployerJobRow): EmployerJob {
  const locationLabel = row.location_text?.trim();
  const imageUrl = row.banner_image?.trim();
  const status = normalizeJobStatus(row.status);
  return {
    id: row.id,
    title: row.title ?? "Untitled job",
    description: row.description ?? "",
    requirements: row.requirements ?? null,
    category: row.category?.trim() ?? null,
    imageUrl: imageUrl || null,
    status,
    locationLabel: locationLabel || null,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    payAmount: Number(row.pay_amount ?? 0),
    payCurrency: row.pay_currency?.trim() || "USD",
    payType: normalizePayType(row.pay_type),
    rolesTotal: Number(row.workers_needed ?? 0),
    rolesFilled: Number(row.workers_hired ?? 0),
    viewsCount: Math.max(0, Number(row.views_count ?? 0)),
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? null,
    deletedAt: null,
    boosted: Boolean(row.boost_id),
    boost: row.boost_status || row.boost_id
      ? {
          status: (row.boost_status === 'active' || row.boost_status === 'scheduled') ? row.boost_status : 'none',
          startsAt: row.boost_starts_at ?? null,
          endsAt: row.boost_expires_at ?? null,
          serverNow: row.server_now ?? null,
          planKey: null,
          queued: Math.max(0, Number(row.queued_boosts ?? 0)),
        }
      : null,
  };
}

/** Raw row shape returned by the gateway's `employer.applications` action. */
export type JobApplicantRow = {
  id: string;
  worker_id: string;
  status: string | null;
  message: string | null;
  created_at: string | null;
  updated_at: string | null;
  /** Read receipt added by migration 042; null while the application is unread. */
  viewed_at: string | null;
  worker_full_name: string | null;
  worker_location: string | null;
  worker_bio: string | null;
  worker_photo_key: string | null;
};

/**
 * Normalizes a gateway applicant row into the domain read model. Avatar
 * storage keys are routed through getProfilePhotoUrl; rating / years-of-
 * experience are not exposed by the read model, so they stay absent and the
 * applicant card hides those rows.
 */
export function normalizeJobApplicant(row: JobApplicantRow): JobApplicant {
  return {
    id: row.id,
    fullName: row.worker_full_name ?? "Anonymous worker",
    avatarUrl: getProfilePhotoUrl(row.worker_photo_key),
    locationLabel: row.worker_location?.trim() || null,
    message: row.message ?? null,
    appliedAt: row.created_at ?? row.updated_at ?? new Date().toISOString(),
    status: normalizeApplicationStatus(row.status),
    isNew: !row.viewed_at,
    viewedAt: row.viewed_at ?? null,
  };
}

function normalizeApplicationStatus(status: string | null | undefined): ApplicationStatus {
  switch (status) {
    case "reviewed":
    case "interview":
    case "hired":
    case "declined":
    case "withdrawn":
    case "applied":
      return status;
    default:
      return "applied";
  }
}

function normalizeJobStatus(status: string | null | undefined): JobStatus {
  switch (status) {
    case "draft":
    case "open":
    case "filled":
    case "closed":
    case "expired":
    case "cancelled":
      return status;
    // Removed by moderators: never editable back to live from here.
    case "removed":
      return "closed";
    default:
      // Includes "pending_review": the database keeps it in review whatever the editor sends.
      return "open";
  }
}

function normalizePayType(payType: string | null | undefined): PayType {
  return payType === "hourly" || payType === "daily" || payType === "fixed" ? payType : "fixed";
}

/**
 * banner_image stores whatever the post-job wizard put there (legacy public
 * URLs or data URIs). Both render through ImageBackground `source={{uri}}`
 * without further processing.
 */

/** Derives the editable fields the Edit screen mutates from a job snapshot. */
export function editableFieldsFromJob(job: EmployerJob): EditableJobFields {
  return {
    title: job.title,
    description: job.description,
    requirements: job.requirements ?? "",
    category: job.category,
    imageUrl: job.imageUrl,
    locationLabel: job.locationLabel ?? "",
    latitude: job.latitude,
    longitude: job.longitude,
    payAmount: job.payAmount,
    payCurrency: job.payCurrency,
    payType: job.payType,
    rolesTotal: job.rolesTotal,
  };
}

export type PayableJobStatus = "draft" | "open" | "closed" | "cancelled";

/**
 * Builds the exact `homlo.employer.saveJob` payload from the editable fields
 * + the managed image URL. Mirror of the post-job wizard's payload mapping,
 * extended with `requirements`.
 */
export function buildJobSavePayload(
  fields: EditableJobFields,
  options: { jobId: string; imageUrl: string | null; status?: PayableJobStatus; autoCloseEnabled?: boolean },
): {
  jobId: string;
  categoryId?: string | null;
  title: string | null;
  description: string | null;
  requirements?: string | null;
  payAmount?: number | null;
  payCurrency?: string;
  payType?: PayType | null;
  locationText?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  workersNeeded?: number;
  bannerImage?: string | null;
  status?: PayableJobStatus;
  autoCloseEnabled?: boolean;
} {
  return {
    jobId: options.jobId,
    categoryId: null,
    title: fields.title,
    description: fields.description,
    requirements: fields.requirements,
    payAmount: fields.payAmount,
    payCurrency: fields.payCurrency,
    payType: fields.payType,
    locationText: fields.locationLabel || null,
    latitude: fields.latitude,
    longitude: fields.longitude,
    workersNeeded: fields.rolesTotal,
    bannerImage: options.imageUrl,
    ...(options.status ? { status: options.status } : {}),
    ...(typeof options.autoCloseEnabled === "boolean" ? { autoCloseEnabled: options.autoCloseEnabled } : {}),
  };
}

/**
 * Non-React action wrappers (used by callbacks that are not components).
 * Screens that want loading/error state should use the matching trpc hooks
 * instead.
 */
export async function saveJob(payload: ReturnType<typeof buildJobSavePayload>): Promise<unknown> {
  return trpcDirect.homlo.employer.saveJob.mutate(payload);
}

export async function softDeleteJob(jobId: string): Promise<unknown> {
  return trpcDirect.homlo.employer.softDeleteJob.mutate({ jobId });
}

export async function uploadJobImage(jobId: string, image: string): Promise<{ url: string }> {
  return trpcDirect.homlo.employer.uploadImage.mutate({ jobId, image });
}

export async function setApplicationStatus(
  applicationId: string,
  status: Exclude<ApplicationStatus, "applied">,
): Promise<unknown> {
  return trpcDirect.homlo.applications.changeStatus.mutate({ applicationId, status });
}

/**
 * Minimal shape needed by AutoCloseSetting / JobStatusPill on the employer
 * side. Merge with whatever `normalizeEmployerJob` / the wizard form state
 * already returns rather than making a second fetch.
 */
export interface JobStatusFields {
  status: "open" | "filled";
  positionsAvailable: number;
  autoCloseEnabled: boolean;
}

/**
 * Maps a gateway job row to the status fields. Anything that is not the
 * open-equivalent reads as "filled" for display purposes only (the real
 * row may carry draft/closed/expired/cancelled too).
 */
export function mapJobStatusFields(row: {
  status: string | null | undefined;
  workers_needed?: number | string | null | undefined;
  workers_hired?: number | string | null | undefined;
  auto_close_enabled?: boolean | null | undefined;
}): JobStatusFields {
  const needed = Number(row.workers_needed ?? 0);
  const hired = Number(row.workers_hired ?? 0);
  return {
    status: row.status === "open" ? "open" : "filled",
    positionsAvailable: computePositionsLeft(needed, hired),
    autoCloseEnabled: row.auto_close_enabled !== false,
  };
}

/**
 * Persists the auto-close toggle for an existing job. The actual auto-close
 * DECISION (counting hired vs positions, flipping the job to filled, firing
 * notifications) is owned by the database trigger — this only writes the
 * toggle through the existing tRPC → edge function → Postgres path.
 */
export async function updateAutoCloseSetting(jobId: string, autoCloseEnabled: boolean): Promise<unknown> {
  return trpcDirect.homlo.employer.setAutoClose.mutate({ jobId, autoCloseEnabled });
}