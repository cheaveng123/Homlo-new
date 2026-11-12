/**
 * finch_shared_shapes.ts
 * Shared types for the Homlo Jobs feed backend (Recommended / Popular / Jobs near you / Explore).
 * Pure types: no runtime code, no dependencies.
 */

export type Period = 'today' | 'week' | 'month';
export type WorkArrangement = 'on_site' | 'hybrid' | 'remote';
export type JobType = 'part_time' | 'full_time' | 'weekends';
export type PayPeriod = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly';
export type EventType = 'impression' | 'view' | 'dwell_15s' | 'save' | 'apply';

/** Time-decayed totals for one window. engagement = weighted views/dwells/saves/applies. */
export interface WindowAgg {
  engagement: number;
  impressions: number;
}

/** One job that is eligible to be shown, plus its precomputed aggregates. */
export interface JobCandidate {
  id: string;
  employerId: string;
  category: string | null;
  workArrangement: WorkArrangement;
  jobType: JobType | null;
  payMin: number | null;
  payMax: number | null;
  payPeriod: PayPeriod | null;
  createdAt: Date;
  /** null = unlimited / unknown. 0 = filled (never shown). */
  positionsLeft: number | null;
  /** 0..1, null = unknown (treated as neutral). */
  employerQuality: number | null;
  /** Straight-line km from the viewer. null when the viewer has no location, or the job is remote / has no location. */
  distanceKm: number | null;
  agg: Record<Period, WindowAgg>;
}

/** What the quick-search wizard saved. All optional. Used ONLY to compute the optional fitPercent. */
export interface QuickSearchPrefs {
  /** 'remote' is allowed here because the wizard's first step lists it next to part/full/weekends. */
  jobTypes?: Array<JobType | 'remote'>;
  payMin?: number | null;
  payMax?: number | null;
  payPeriod?: PayPeriod | null;
}

/** Anonymous viewer context. No user id, no profile, no history. */
export interface Viewer {
  lat: number | null;
  lng: number | null;
  preferences?: QuickSearchPrefs | null;
}

export interface FeedItem {
  jobId: string;
  /** Internal ranking score. Do NOT show this to users. */
  score: number;
  distanceKm: number | null;
  /** 55..98 or null. Only non-null when the user completed quick search AND enough fields were comparable. */
  fitPercent: number | null;
  /** True when the item is inside an active paid boost window and passed the quality gate. */
  isBoosted?: boolean;
  /** True only for the reserved sponsored positions (ranks 2 and 6 of each page of 10). */
  isSponsoredSlot?: boolean;
  /** Job-seeker safe ad flag. Never includes price, plan, or end time. */
  boost?: { isSponsored: true } | null;
  boostPackage?: string | null;
  boostMultiplier?: number;
}

export interface ActiveJobBoost {
  jobId: string;
  packageId: string | null;
  multiplier: number;
  startsAt: Date;
  endsAt: Date;
  status?: string | null;
}

export interface FeedPage {
  items: FeedItem[];
  nextCursor: string | null;
  /** 'no_location' => the near feed has nothing to show; the client keeps its own permission/empty UX. */
  status: 'ok' | 'no_location';
}

export interface HomeFeed {
  recommended: FeedPage;
  popular: FeedPage;
  near: FeedPage;
  explore: FeedPage;
}

export interface EventInput {
  jobId: string;
  type: EventType;
}

export interface GlobalRates {
  today: WindowAgg;
  week: WindowAgg;
  month: WindowAgg;
}

export interface CandidateQuery {
  viewer: Viewer;
  limit: number;
  /** Only jobs that have a distance (on-site/hybrid + viewer location). */
  onlyLocated?: boolean;
  /** Only jobs within this many km of the viewer. Implies onlyLocated. */
  radiusKm?: number | null;
}

/**
 * The ONLY thing the feed logic knows about the database.
 * Swap Supabase for AWS RDS/Aurora (or anything) by writing a new implementation of this.
 */
export interface FeedStore {
  getCandidates(query: CandidateQuery): Promise<JobCandidate[]>;
  getGlobalRates(): Promise<GlobalRates>;
  /** Returns how many events were actually stored (events for non-eligible jobs are dropped). */
  recordEvents(sessionId: string, events: EventInput[]): Promise<number>;
  /** Optional so non-Postgres stores and tests keep working without boost support. */
  getActiveBoosts?(jobIds: readonly string[], now: Date): Promise<ActiveJobBoost[]>;
}

/** Thrown for bad client input. The router turns this into HTTP 400. */
export class FeedInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FeedInputError';
  }
}
