// Shape of a job listing as consumed by these screens. Map whatever the
// app's API/store already returns into this shape (or extend it) rather
// than restructuring the screens around a different shape.

export type JobDetails = {
  id: string;
  employerId?: string; // owner id used to deep-link to /employer/[id]; absent when unknown
  title: string;
  employmentType: string; // e.g. "Internship"
  scheduleType: string; // e.g. "Full-time"
  companyName: string;
  location: string;
  salary: string; // pre-formatted, e.g. "$150"
  salaryPeriod: string; // e.g. "Per month"
  salaryUnit?: string; // e.g. "/mo" — suffix shown under the bottom-bar price
  schedule: string; // e.g. "Flexible"
  spotsLabel: string; // accepted/total positions, e.g. "1/3 positions"
  spotsRemaining?: number; // drives position urgency; not displayed as "left"
  description: string;
  requirements: string[];
  employerVerified: boolean;
  employerSubtitle: string; // e.g. "Posts jobs often · Replies within a day"
  /**
   * The job's professional field, as the data layer spells it — a legacy
   * `category-data` title, a DB slug, or free text from `employer.industry`.
   * Never a cleaned-up name: run it through `resolveJobField` in
   * `@/lib/job-fields` to get an official field and its illustration.
   */
  category: string;
  coverImageUrl?: string | null;
  companyLogoUrl?: string | null;
  employerAvatarUrl?: string | null;
  /** Openness of the listing (open vs filled); feeds the JobStatusPill. */
  jobStatus?: "open" | "filled";
  /** Positions still available; shown on the pill when the job is open. */
  positionsAvailable?: number;
  /** Total positions the job is hiring for (workers_needed); drives PositionsProgress. */
  positionsTotal?: number;
  /** Positions already filled (workers_hired); drives PositionsProgress. */
  positionsFilled?: number;
  /** Full, untruncated location string (e.g. "Toul Kork, Phnom Penh") for the LocationPill. */
  locationFull: string;
};