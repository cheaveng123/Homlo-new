export type JobType = "full_time" | "part_time" | "weekends" | "remote";
export type WorkArrangement = "On-site" | "Hybrid" | "Remote";
export type JobStatus = "live" | "draft" | "review";
export type JobSortOption = "newest" | "price_high_low" | "price_low_high";
export type JobCategoryFilter = JobType | "all";

export interface EmployerStats {
  activeJobs: number;
  rating: number;
  yearsOnHomlo: number;
}

export interface EmployerReview {
  id: string;
  name: string;
  avatarUrl?: string;
  rating: number;
  text: string;
}

export interface EmployerReviewSummary {
  average: number;
  count: number;
  items: EmployerReview[];
}

export interface JobPreview {
  id: string;
  title: string;
  type: JobType;
  meta: string;
}

export interface Employer {
  id: string;
  name: string;
  verified: boolean;
  category: string;
  location: string;
  bannerUrl?: string;
  avatarUrl?: string;
  bio: string;
  industry: string;
  responseTime: string;
  stats: EmployerStats;
  jobsPreview: JobPreview[];
  reviews: EmployerReviewSummary;
}

export interface JobListing {
  id: string;
  employerId: string;
  title: string;
  type: JobType;
  status: JobStatus;
  location: string;
  workArrangement?: WorkArrangement;
  latitude?: number | null;
  longitude?: number | null;
  postedAt: string;
  photoUrl?: string;
  price: number;
  priceUnit: "mo" | "hr";
  spotsRemaining: number;
}

export interface GetJobsByEmployerOptions {
  type?: JobType | "all";
  sort?: JobSortOption;
  status?: JobStatus;
}