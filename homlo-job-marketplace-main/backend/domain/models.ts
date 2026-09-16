export type UUID = string;

export type UserStatus = "active" | "suspended" | "banned";
export type ProfileRole = "worker" | "employer" | "both";
export type JobStatus = "draft" | "open" | "filled" | "closed" | "expired" | "cancelled";
export type PayType = "hourly" | "daily" | "fixed";
export type ApplicationStatus = "applied" | "reviewed" | "interview" | "hired" | "declined" | "withdrawn";
/**
 * Salary period offered by a job. Reconciled to the real `jobs.pay_type`
 * column (`hourly | daily | fixed`) — the reference design's
 * `monthly/yearly` periods do not exist in the schema.
 */
export type SalaryPeriod = PayType;
export type BoostStatus = "active" | "expired" | "cancelled";
export type PaymentStatus = "pending" | "completed" | "failed" | "refunded";
export type ReportStatus = "open" | "reviewed" | "dismissed" | "actioned";
export type ReportTargetType = "job" | "user" | "review" | "message";

export type User = { id: UUID; status: UserStatus; createdAt: Date; updatedAt: Date; deletedAt: Date | null };
export type UserIdentity = { id: UUID; userId: UUID; provider: string; providerUserId: string; createdAt: Date; deletedAt: Date | null };
export type Profile = { userId: UUID; role: ProfileRole; fullName: string; phone: string | null; profilePhotoKey: string | null; bio: string | null; locationText: string | null; latitude: number | null; longitude: number | null; createdAt: Date; updatedAt: Date; deletedAt: Date | null };
export type Category = { id: UUID; name: string; slug: string };
export type Job = { id: UUID; employerId: UUID; categoryId: UUID | null; title: string; description: string; requirements: string | null; payAmount: number; payCurrency: string; payType: PayType; locationText: string | null; latitude: number | null; longitude: number | null; startDate: string | null; endDate: string | null; startTime: string | null; endTime: string | null; workersNeeded: number; workersHired: number; status: JobStatus; createdAt: Date; updatedAt: Date; deletedAt: Date | null };
export type JobMedia = { id: UUID; jobId: UUID; storageKey: string; mediaType: "image" | "video"; position: number; createdAt: Date };
export type Application = { id: UUID; jobId: UUID; workerId: UUID; status: ApplicationStatus; message: string | null; createdAt: Date; updatedAt: Date };
export type Conversation = { id: UUID; jobId: UUID | null; lastMessageAt: Date | null; createdAt: Date; updatedAt: Date; deletedAt: Date | null };
export type Message = { id: UUID; conversationId: UUID; senderId: UUID; message: string; readAt: Date | null; createdAt: Date };
export type Notification = { id: UUID; userId: UUID; type: string; title: string; body: string | null; read: boolean; createdAt: Date };
export type Review = { id: UUID; jobId: UUID; reviewerId: UUID; revieweeId: UUID; rating: number; comment: string | null; createdAt: Date; updatedAt: Date; deletedAt: Date | null };
export type Boost = { id: UUID; jobId: UUID; employerId: UUID; package: string; startAt: Date; expiresAt: Date; status: BoostStatus; createdAt: Date; updatedAt: Date };
export type Payment = { id: UUID; userId: UUID; jobId: UUID | null; boostId: UUID | null; amount: number; currency: string; provider: string; providerTransactionId: string | null; status: PaymentStatus; createdAt: Date; updatedAt: Date };
export type PaymentWebhookEvent = { id: UUID; provider: string; providerEventId: string; eventType: string; payload: Record<string, unknown>; receivedAt: Date; processedAt: Date | null };
export type Report = { id: UUID; reporterId: UUID; targetType: ReportTargetType; targetId: UUID; reason: string; details: string | null; status: ReportStatus; createdAt: Date; updatedAt: Date };
export type AuditLog = { id: UUID; actorUserId: UUID | null; action: string; entityType: string; entityId: UUID | null; metadata: Record<string, unknown> | null; createdAt: Date };

/**
 * Employer-side job read model (homlo_list_employer_jobs_with_boosts).
 * Snapshot/display shape used by the job-management detail + edit screens;
 * `category` is the joined categories.name and `viewsCount` is aggregated
 * from job_events. The repository layer normalizes the gateway rows into it.
 */
export type EmployerJob = {
  id: UUID;
  title: string;
  description: string;
  requirements: string | null;
  category: string | null;
  imageUrl: string | null;
  status: JobStatus;
  locationLabel: string | null;
  latitude: number | null;
  longitude: number | null;
  payAmount: number;
  payCurrency: string;
  payType: PayType;
  rolesTotal: number;
  rolesFilled: number;
  viewsCount: number;
  createdAt: string;
  deletedAt: string | null;
};

/**
 * Fields the employer can edit on the Edit job screen. Reconciled to real
 * `jobs` columns (pay_type, workers_needed, location_text, banner_image,
 * requirements); `category` is only the display name — the categories
 * lookup table is not seeded, so the reference screen's category picker
 * drives the session draft, and categoryId stays null on save (matching the
 * post-job wizard).
 */
export type EditableJobFields = {
  title: string;
  description: string;
  requirements: string;
  category: string | null;
  imageUrl: string | null;
  locationLabel: string;
  latitude: number | null;
  longitude: number | null;
  payAmount: number;
  payCurrency: string;
  payType: PayType;
  rolesTotal: number;
};

/**
 * Applicant row on the employer job-management screen
 * (homlo_list_employer_applications_detailed). Rating / years-of-experience
 * are not exposed by the read model today, so they stay optional; the card
 * hides those rows when absent.
 */
export type JobApplicant = {
  id: UUID;
  fullName: string;
  avatarUrl: string | null;
  locationLabel: string | null;
  message: string | null;
  appliedAt: string;
  status: ApplicationStatus;
  isNew: boolean;
};
