/** View-model shapes. Map your existing API/hook data into these in the route adapter. Never change the API. */
export type JobSummaryNew = {
  id: string;
  title: string;
  locationLabel: string; // e.g. "Toul Kork · 0.6 km"
  payLabel: string; // e.g. "$100 / day"
  positionsLeft: number;
  positionsTotal: number;
  employerInitials: string;
  imageUri?: string;
  typeLabel?: string;
  liked?: boolean;
  /** Sponsored listing: shows the public "Ads" tag. */
  boosted?: boolean;
};
export type ScreenStateNew = 'ready' | 'loading' | 'empty' | 'error';
