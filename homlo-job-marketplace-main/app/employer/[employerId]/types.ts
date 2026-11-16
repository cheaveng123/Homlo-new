// types.ts
// Shared types for the Employer Profile (visitor view) and All Jobs screens.

import type { WorkArrangement } from "@/types/employer";

export type JobStatus = 'live' | 'draft' | 'review';
export type EmploymentType = 'full-time' | 'part-time' | 'weekends' | 'remote';
export type PriceUnit = 'mo' | 'hr' | 'yr';

export interface Employer {
  id: string;
  name: string;
  verified: boolean;
  category: string;
  location: string;
  /** undefined/null = no banner set yet -> render blank, not a placeholder */
  bannerUrl?: string | null;
  avatarUrl?: string | null;
  activeJobsCount: number;
  rating: number; // e.g. 4.8
  reviewCount: number;
  yearsOnHomlo: string; // display string, e.g. "2yr"
  about: string;
  industry: string;
  responseTime: string; // display string, e.g. "Within a day"
}

export interface JobListing {
  id: string;
  employerId: string;
  title: string;
  employmentType: EmploymentType;
  status: JobStatus;
  location: string;
  workArrangement?: WorkArrangement | null;
  latitude?: number | null;
  longitude?: number | null;
  postedAt: string; // display string, e.g. "3 days ago"
  price: number;
  priceUnit: PriceUnit;
  spotsLabel: string; // accepted/total, e.g. "1/3 positions"
  /** undefined/null = no job photo -> render neutral placeholder icon */
  photoUrl?: string | null;
}

export interface Review {
  id: string;
  authorName: string;
  rating: number; // 1-5
  text: string;
}

export type SortOption = 'newest' | 'price_high' | 'price_low';

// Expo Router treats every file under app/ as a route, so this types-only
// module needs a default export. The names above are type-only (erased at
// bundle time) — exporting them as a value threw ReferenceError at runtime.
// Render nothing if this path is ever navigated to.
export default function EmployerTypesRoute() {
  return null;
}