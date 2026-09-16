// Shape of a job listing as consumed by these screens. Map whatever the
// app's API/store already returns into this shape (or extend it) rather
// than restructuring the screens around a different shape.

export type JobDetails = {
  id: string;
  title: string;
  employmentType: string; // e.g. "Internship"
  scheduleType: string; // e.g. "Full-time"
  companyName: string;
  location: string;
  salary: string; // pre-formatted, e.g. "$150"
  salaryPeriod: string; // e.g. "Per month"
  salaryUnit?: string; // e.g. "/mo" — suffix shown under the bottom-bar price
  schedule: string; // e.g. "Flexible"
  spotsLabel: string; // e.g. "2-5"
  spotsRemaining?: number; // drives the "Only X spots left" urgency line
  description: string;
  requirements: string[];
  employerVerified: boolean;
  employerSubtitle: string; // e.g. "Posts jobs often · Replies within a day"
  coverImageUrl?: string | null;
  companyLogoUrl?: string | null;
  employerAvatarUrl?: string | null;
};