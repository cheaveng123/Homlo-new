// =========================================================
// HomeFeedService — server-side composition of the homepage job feed.
//
// Sections (in canonical display order):
//   1. Jobs Near You   — DB-level geo search (radiusKm around a real lng/lat).
//   2. Recommended     — the existing Phase 3→7 recommendation pipeline for
//                        signed-in users; data-driven editorial (best of the
//                        public pool, boosted & fresh first) for anonymous or
//                        when the pipeline has no signal yet.
//   3. Featured        — active `boosts` joined to open, non-deleted listings.
//   4. Specialized     — config-driven field sections that only ship when a
//                        field's categories actually have published jobs.
//   5. Remote          — the canonical jobs.work_arrangement = 'Remote' rows.
//   6. Weekend         — the same keyword convention the search function uses
//                        (title/description mention weekend, Saturday or Sunday).
//   7. More            — everything left over, best availability first.
//
// Every section is filtered/ranked server-side against real rows (through the
// existing homlo_list_public_published_jobs / homlo_search_public_jobs read
// models or the boosts join) — nothing is hardcoded, and the payload carries
// the same display shape the rest of the app already normalizes. Dedupe order
// is Near → Recommended → Featured → Specialized → Remote → Weekend → More,
// applied to whichever section needs freshness while later sections top up when
// a pool is small.
// =========================================================

import type { DatabaseAdapter } from "../backend/infrastructure/database/DatabaseAdapter";
import type { WorkArrangement } from "../backend/domain/work-arrangement";
import { SearchService } from "../backend/search/search-service";
import {
  RecommendationFeedService,
} from "../backend/ranking/recommendation-feed";
import type { FeedItem } from "../backend/ranking/feed-assembly";
import {
  specializedFields,
  fieldCategoryNames,
  type SpecializedField,
} from "../lib/specialized-fields";

export const HOME_FEED_DEFAULT_RADIUS_KM = 50;
export const HOME_FEED_DEFAULT_SECTION_SIZE = 4;
export const HOME_FEED_DEFAULT_MORE_SIZE = 8;
export const HOME_FEED_SPECIALIZED_COUNT = 3;

/** Canonical display record for every home-feed section (mirrors search records). */
export type HomeFeedJobRecord = {
  id: string;
  title: string;
  description: string;
  pay_amount: number | string;
  pay_currency: string;
  pay_type: "hourly" | "daily" | "fixed";
  location_text: string | null;
  work_arrangement: WorkArrangement | null;
  latitude: number | null;
  longitude: number | null;
  workers_needed: number | string;
  workers_hired: number | string;
  created_at: string;
  category: string;
  employer_name: string | null;
  employer_photo_key: string | null;
  banner_image: string | null;
  relevance_score: number;
  boosted?: boolean;
};

export type HomeFeedSpecializedSection = {
  field: SpecializedField;
  jobs: HomeFeedJobRecord[];
  /** Number of published jobs this field's categories had before slicing. */
  available: number;
};

/** Why a section is absent. Absent `code` means the section is legitimately empty. */
export type HomeFeedSectionError = {
  section: string;
  code: string;
};

/**
 * A section's load result. A failed section is reported and degraded to empty
 * data, never silently presented as "there is nothing to show".
 */
type SectionOutcome<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string };

export type HomeFeedResult = {
  nearby: HomeFeedJobRecord[];
  recommended: HomeFeedJobRecord[];
  featured: HomeFeedJobRecord[];
  specialized: HomeFeedSpecializedSection[];
  remote: HomeFeedJobRecord[];
  weekend: HomeFeedJobRecord[];
  more: HomeFeedJobRecord[];
  total: number;
  /** Omitted entirely on a healthy feed, so success responses are unchanged. */
  sectionErrors?: HomeFeedSectionError[];
};

export type HomeFeedInput = {
  latitude?: number | null;
  longitude?: number | null;
  radiusKm?: number | null;
  sectionSize?: number;
  moreSize?: number;
  userId?: string | null;
  userLocation?: { latitude: number; longitude: number } | null;
  now?: Date;
};

type PublicJobRow = {
  id: string;
  title: string;
  description: string;
  pay_amount: number | string;
  pay_currency: string;
  pay_type: "hourly" | "daily" | "fixed";
  location_text: string | null;
  work_arrangement: WorkArrangement | null;
  latitude: number | null;
  longitude: number | null;
  workers_needed: number | string;
  workers_hired: number | string;
  created_at: string | Date;
  category: string;
  employer_name: string | null;
  employer_photo_key: string | null;
  banner_image: string | null;
  relevance_score?: number | string | null;
  boosted?: boolean | null;
};

export class HomeFeedService {
  constructor(private readonly database: DatabaseAdapter) {}

  async getHomeFeed(input: HomeFeedInput): Promise<HomeFeedResult> {
    const now =
      input.now instanceof Date && !Number.isNaN(input.now.getTime())
        ? input.now
        : new Date();
    const sectionSize = clamp(input.sectionSize, 1, 8, HOME_FEED_DEFAULT_SECTION_SIZE);
    const moreSize = clamp(input.moreSize, 1, 16, HOME_FEED_DEFAULT_MORE_SIZE);
    const radiusKm = Number.isFinite(input.radiusKm ?? NaN)
      ? Math.min(Math.max(input.radiusKm ?? HOME_FEED_DEFAULT_RADIUS_KM, 1), 200)
      : HOME_FEED_DEFAULT_RADIUS_KM;
    const hasCoords =
      Number.isFinite(input.latitude ?? NaN) &&
      Number.isFinite(input.longitude ?? NaN) &&
      Math.abs(input.latitude ?? 0) <= 90 &&
      Math.abs(input.longitude ?? 0) <= 180;

    const sectionErrors: HomeFeedSectionError[] = [];
    const collect = <T>(section: string, work: Promise<T>): Promise<SectionOutcome<T>> =>
      work.then(
        (data) => ({ ok: true, data }) as SectionOutcome<T>,
        (cause: unknown) => {
          console.error("[HomeFeed] Section failed", {
            section,
            code: "SECTION_QUERY_FAILED",
            cause: cause instanceof Error ? cause.message : String(cause),
          });
          sectionErrors.push({ section, code: "SECTION_QUERY_FAILED" });
          return {
            ok: false,
            code: "SECTION_QUERY_FAILED",
            message: cause instanceof Error ? cause.message : String(cause),
          } as SectionOutcome<T>;
        },
      );

    const [nearbyOutcome, poolOutcome, featuredOutcome] = await Promise.all([
      hasCoords
        ? collect(
            "nearby",
            new SearchService(this.database)
              .search({
                latitude: input.latitude as number,
                longitude: input.longitude as number,
                radiusKm,
                sort: "closest",
                limit: sectionSize,
                offset: 0,
              })
              .then(({ jobs }) => jobs.map((row) => toHomeFeedJob(row))),
          )
        : Promise.resolve<SectionOutcome<HomeFeedJobRecord[]>>({ ok: true, data: [] }),
      collect("publicPool", this.loadPublicPool()),
      collect("featured", this.loadFeatured(sectionSize)),
    ]);

    const nearby = nearbyOutcome.ok ? nearbyOutcome.data : [];
    const pool = poolOutcome.ok ? poolOutcome.data : [];
    const featured = featuredOutcome.ok ? featuredOutcome.data : [];

    const boostedIds = new Set(featured.map((job) => job.id));

    // Recommended for a signed-in worker comes from the Phase 3→7 pipeline;
    // everyone else (anonymous, or a pipeline with nothing to rank yet) gets a
    // data-driven editorial slice so the row never silently disappears: the
    // freshest open jobs that aren't already in the higher-priority
    // Nearby/Featured sections.
    const recommendedOutcome = await collect("recommended", this.buildRecommended({ ...input, sectionSize, now }));
    const pipelineRecommended = recommendedOutcome.ok ? recommendedOutcome.data : [];
    const recommended =
      pipelineRecommended.length > 0
        ? pipelineRecommended
        : pickRecommendedEditorial(pool, sectionSize, {
            avoidIds: new Set([...nearby, ...featured].map((job) => job.id)),
            boostedIds,
            now,
          });

    // Dedupe order: near → recommended → featured → specialized → remote → weekend → more.
    const used = new Set<string>();
    nearby.forEach((job) => used.add(job.id));
    recommended.forEach((job) => used.add(job.id));
    featured.forEach((job) => used.add(job.id));

    const specialized = this.buildSpecialized(pool, {
      sectionSize,
      boostedIds,
      used,
      now,
    });
    specialized.forEach((section) => section.jobs.forEach((job) => used.add(job.id)));

    const remote = pickSection(
      pool.filter((job) => isRemote(job)),
      sectionSize,
      {
        avoidIds: used,
        boostedIds,
        now,
      },
    ).picked;
    remote.forEach((job) => used.add(job.id));

    const weekend = pickSection(
      pool.filter((job) => isWeekend(job)),
      sectionSize,
      {
        avoidIds: used,
        boostedIds,
        now,
      },
    ).picked;
    weekend.forEach((job) => used.add(job.id));

    const more = pickSection(pool, moreSize, {
      avoidIds: used,
      boostedIds,
      now,
    }).picked;

    const result: HomeFeedResult = {
      nearby,
      recommended,
      featured,
      specialized,
      remote,
      weekend,
      more,
      total: pool.length,
    };
    if (sectionErrors.length > 0) result.sectionErrors = sectionErrors;
    return result;
  }

  /** The bounded public read-model pool (single function call, ≤ 200 open jobs). */
  private async loadPublicPool(): Promise<HomeFeedJobRecord[]> {
    const { rows } = await this.database.query<PublicJobRow>(
      `select * from homlo_list_public_published_jobs()`,
    );
    return rows.map((row) => toHomeFeedJob(row));
  }

  /** Active boosts joined to open, non-deleted listings, promotions first. */
  private async loadFeatured(limit: number): Promise<HomeFeedJobRecord[]> {
    const { rows } = await this.database.query<PublicJobRow>(
      `select
         j.id, j.title, j.description, j.pay_amount, j.pay_currency, j.pay_type,
         j.location_text, j.latitude, j.longitude, j.workers_needed, j.workers_hired, j.created_at,
         j.work_arrangement,
         coalesce(c.name, 'Other') as category,
         p.full_name as employer_name,
         p.profile_photo_key as employer_photo_key,
         j.banner_image,
         true as boosted
       from boosts b
       join jobs j on j.id = b.job_id
       left join categories c on c.id = j.category_id
       left join profiles p on p.user_id = j.employer_id and p.deleted_at is null
      where b.status = 'active'
        and b.expires_at > now()
        and j.deleted_at is null
        and j.status = 'open'
        and (j.workers_needed = 0 or j.workers_hired < j.workers_needed)
        and (j.end_date is null or j.end_date >= current_date)
      order by b.start_at desc, j.created_at desc
      limit $1`,
      [limit],
    );
    return rows.map((row) => toHomeFeedJob(row));
  }

  /**
   * Recommended: the canonical Phase 3→7 pipeline when a worker is signed in
   * (user id always derives from the session, never the request body); the
   * pipeline's ranking slice. An empty result falls back to data-driven
   * editorial in `getHomeFeed`, so anonymous visitors still get a section.
   */
  private async buildRecommended(input: {
    userId?: string | null;
    userLocation?: { latitude: number; longitude: number } | null;
    sectionSize: number;
    now: Date;
  }): Promise<HomeFeedJobRecord[]> {
    if (input.userId) {
      const feed = await new RecommendationFeedService(this.database).getFeed({
        userId: input.userId,
        userLocation: input.userLocation ?? null,
        preferences: null,
        pageSize: input.sectionSize,
        cursor: null,
        now: input.now,
      });
      if (feed.jobs.length > 0) {
        return feed.jobs.map(toFeedItemJob);
      }
    }
    return [];
  }

/**
   * Fields that currently have ≥1 published job in their categories, most
   * available first.
   */
  private buildSpecialized(
    pool: HomeFeedJobRecord[],
    options: {
      sectionSize: number;
      boostedIds: ReadonlySet<string>;
      used: ReadonlySet<string>;
      now: Date;
    },
  ): HomeFeedSpecializedSection[] {
    const sections: HomeFeedSpecializedSection[] = [];
    for (const field of specializedFields) {
      const names = new Set(fieldCategoryNames(field).map((name) => name.toLowerCase()));
      const matches = pool.filter((job) => names.has((job.category || "").toLowerCase()));
      if (matches.length === 0) continue;
      const { picked, available } = pickSection(matches, options.sectionSize, {
        avoidIds: options.used,
        boostedIds: options.boostedIds,
        now: options.now,
      });
      sections.push({ field, jobs: picked, available });
    }
    // Most available first so a sparse category is never prioritized by the
    // client before a rich one when selection is limited.
    sections.sort((a, b) => b.available - a.available || a.field.title.localeCompare(b.field.title));
    return sections;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number | null | undefined, min: number, max: number, fallback: number): number {
  if (value == null || !Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.floor(value), min), max);
}

function toHomeFeedJob(row: PublicJobRow): HomeFeedJobRecord {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    pay_amount: row.pay_amount,
    pay_currency: row.pay_currency,
    pay_type: row.pay_type,
    location_text: row.location_text,
    work_arrangement: row.work_arrangement ?? null,
    latitude: row.latitude,
    longitude: row.longitude,
    workers_needed: row.workers_needed,
    workers_hired: row.workers_hired ?? 0,
    created_at:
      row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    category: row.category || "Other",
    employer_name: row.employer_name,
    employer_photo_key: row.employer_photo_key,
    banner_image: row.banner_image,
    relevance_score: toNumber(row.relevance_score) ?? 0,
    boosted: row.boosted === true,
  };
}

function toFeedItemJob(item: FeedItem): HomeFeedJobRecord {
  const job = item.job;
  return {
    id: job.jobId,
    title: job.title,
    description: job.description,
    pay_amount: job.payAmount,
    pay_currency: job.payCurrency,
    pay_type: job.payType,
    location_text: job.locationText,
    work_arrangement: job.workArrangement,
    latitude: job.latitude,
    longitude: job.longitude,
    workers_needed: job.workersNeeded,
    workers_hired: job.workersHired ?? 0,
    created_at: job.createdAt,
    category: job.category || "Other",
    employer_name: job.employerName,
    employer_photo_key: job.employerPhotoKey,
    banner_image: job.bannerImage,
    relevance_score: item.rankingMetadata.finalRankingScore,
    boosted: false,
  };
}

function isRemote(job: HomeFeedJobRecord): boolean {
  return job.work_arrangement === "Remote";
}

/**
 * Weekend shifts are inferred from the same keywords the SQL search function
 * uses (see `homlo_search_public_jobs`, Weekend branch), so home and search
 * agree on what "weekend" means.
 */
function isWeekend(job: HomeFeedJobRecord): boolean {
  const haystack = `${job.title} ${job.description}`.toLowerCase();
  return /weekend|saturday|sunday/.test(haystack);
}

/**
 * Editorial fallback for a visitor with no ranking identity (anonymous) or a
 * pipeline that has no signal yet: the freshest promoted/open jobs that aren't
 * already shown in a higher-priority section, so the Recommended row renders
 * something real instead of silently disappearing.
 */
function pickRecommendedEditorial(
  pool: HomeFeedJobRecord[],
  size: number,
  options: {
    avoidIds: ReadonlySet<string>;
    boostedIds: ReadonlySet<string>;
    now: Date;
  },
): HomeFeedJobRecord[] {
  return rankJobs(pool, options.now, options.boostedIds)
    .filter((job) => !options.avoidIds.has(job.id))
    .slice(0, size);
}

/**
 * Ranks candidates (promoted first, then freshest) and prefers job ids not
 * already shown in a higher-priority section. When the fresh slice is too
 * small it tops up with the already-shown-in-this-pool remainder so a scarce
 * category still renders something rather than an empty card.
 */
function pickSection(
  candidates: HomeFeedJobRecord[],
  size: number,
  options: {
    avoidIds: ReadonlySet<string>;
    boostedIds: ReadonlySet<string>;
    now: Date;
  },
): { picked: HomeFeedJobRecord[]; available: number } {
  const ranked = rankJobs(candidates, options.now, options.boostedIds);
  const fresh: HomeFeedJobRecord[] = [];
  const rest: HomeFeedJobRecord[] = [];
  for (const job of ranked) {
    (options.avoidIds.has(job.id) ? rest : fresh).push(job);
  }
  return { picked: [...fresh, ...rest].slice(0, size), available: candidates.length };
}

function rankJobs(
  jobs: HomeFeedJobRecord[],
  now: Date,
  boostedIds: ReadonlySet<string>,
): HomeFeedJobRecord[] {
  return [...jobs].sort((a, b) => {
    const boostDiff = Number(boostedIds.has(b.id)) - Number(boostedIds.has(a.id));
    if (boostDiff !== 0) return boostDiff;
    return freshness(b, now) - freshness(a, now);
  });
}

function freshness(job: HomeFeedJobRecord, now: Date): number {
  const ms = new Date(String(job.created_at ?? "")).getTime();
  return Number.isFinite(ms) ? ms : now.getTime();
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}