import {
  APPLICATION_COUNTED_STATUSES,
  billingPeriodEnd,
  billingPeriodStart,
  boostPriceCentsForPlan,
  enterpriseMonthlyPriceCents,
  freeStandardBoostAvailable,
  getBoostPackage,
  isBoostPackageId,
  isFreeStandardBoost,
  isPlanId,
  planLimitsEnforced,
  planLimitsFor,
  remaining,
  BOOST_PACKAGES,
  type BoostPackageId,
  type PlanId,
  type PlanLimits,
  type PlanSnapshot,
  type SubscriptionStatus,
} from "./hlPlanRules";
import { activateBoostInTransaction, boostTick } from "./boost/boostService";

export const SCHEMA = {
  jobsTable: "jobs",
  jobIdColumn: "id",
  jobEmployerColumn: "employer_id",
  jobStatusColumn: "status",
  jobDeletedAtColumn: "deleted_at",
  jobPublishedAtColumn: "published_at",
  jobLimitExemptColumn: "limit_exempt",
  jobDraftStatus: "draft",
  jobOpenStatus: "open",
  jobReviewStatus: null,
  jobActiveStatuses: ["open", "filled"],
  applicationsTable: "applications",
  applicationJobColumn: "job_id",
  applicationStatusColumn: "status",
  applicantColumn: "worker_id",
  applicationCountedStatuses: [...APPLICATION_COUNTED_STATUSES],
  profileUserIdColumn: "user_id",
  profileDeletedAtColumn: "deleted_at",
  accountSubscriptionsTable: "account_subscriptions",
  jobPostEventsTable: "job_post_events",
  boostPackagesTable: "boost_packages",
  jobBoostsTable: "job_boosts",
} as const;

export type Queryable = {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
};

export type PlanBoostDb = Queryable & {
  transaction?: <T>(fn: (tx: Queryable) => Promise<T>) => Promise<T>;
};

export type SubscriptionState = {
  userId: string;
  plan: PlanId;
  status: SubscriptionStatus;
  limits: PlanLimits;
  periodStart: Date;
  periodEnd: Date;
  freeStandardBoostUsedAt: Date | null;
};

export type JobState = {
  id: string;
  employerId: string;
  status: string;
  limitExempt: boolean;
  publishedAt: Date | null;
  deletedAt: Date | null;
};

export type JobBoostState = {
  id: string;
  jobId: string;
  employerId: string;
  packageId: BoostPackageId;
  status: "pending" | "active" | "expired" | "cancelled";
  priceCents: number;
  currency: string;
  paymentId: string | null;
  purchasedAt: Date;
  startsAt: Date | null;
  endsAt: Date | null;
  paidAt: Date | null;
};

export type PublishResult = {
  job: JobState;
  posted: boolean;
  usage: {
    activeJobs: number;
    postsThisPeriod: number;
  };
};

export type PurchaseBoostResult = {
  boost: JobBoostState;
  paymentRequired: boolean;
  amountCents: number;
  currency: string;
};

export type ApplicationPrecheckResult = {
  allowed: boolean;
  used: number;
  limit: number | null;
  remaining: number | null;
  employerId: string;
};

export type PlanBoostErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "JOB_NOT_FOUND"
  | "ACTIVE_JOB_LIMIT"
  | "MONTHLY_POST_LIMIT"
  | "APPLICATION_LIMIT"
  | "BOOST_ALREADY_LIVE"
  | "BOOST_NOT_FOUND"
  | "UNKNOWN_PACKAGE"
  | "INVALID_INPUT";

export class PlanBoostError extends Error {
  constructor(
    public readonly code: PlanBoostErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "PlanBoostError";
  }
}

type SubscriptionRow = {
  user_id: string;
  plan: string;
  status: string;
  active_jobs_limit: number | null;
  monthly_post_limit: number | null;
  current_period_start: Date | string;
  current_period_end: Date | string;
  free_standard_boost_used_at: Date | string | null;
};

type LegacySubscriptionRow = {
  plan: string | null;
  status: string | null;
  active_jobs_limit: number | null;
  monthly_posts: number | null;
  current_period_start: Date | string | null;
  current_period_end: Date | string | null;
};

type JobRow = {
  id: string;
  employer_id: string;
  status: string;
  limit_exempt: boolean;
  published_at: Date | string | null;
  deleted_at: Date | string | null;
};

type BoostRow = {
  id: string;
  job_id: string;
  employer_id: string;
  package_id: string;
  status: string;
  price_cents: number;
  currency: string;
  payment_id: string | null;
  purchased_at: Date | string;
  starts_at: Date | string | null;
  ends_at: Date | string | null;
  paid_at: Date | string | null;
};

export async function withTransaction<T>(db: PlanBoostDb, fn: (tx: Queryable) => Promise<T>): Promise<T> {
  if (typeof db.transaction === "function") return db.transaction(fn);
  return fn(db);
}

export async function ensureSubscription(
  db: Queryable,
  userId: string,
  now: Date = new Date(),
): Promise<SubscriptionState> {
  if (!userId) throw new PlanBoostError("UNAUTHORIZED", "Authentication is required");
  const existing = await loadSubscriptionRow(db, userId);
  const legacy = await loadLegacySubscription(db, userId);
  const desiredPlan = normalizePlan(legacy?.plan);
  const legacyPeriod = validPeriod(legacy?.current_period_start, legacy?.current_period_end, now);
  const legacyStatus = normalizeStatus(legacy?.status);

  if (existing) {
    const plan = desiredPlan ?? normalizePlan(existing.plan) ?? "free";
    const status = legacyStatus ?? normalizeStatus(existing.status) ?? "active";
    const limits = planLimitsFor(plan, {
      activeJobsLimit: legacy?.active_jobs_limit ?? existing.active_jobs_limit,
      postsPerMonthLimit: legacy?.monthly_posts ?? existing.monthly_post_limit,
    });
    const period = advancePeriod(
      legacyPeriod?.start ?? toDate(existing.current_period_start) ?? billingPeriodStart(now),
      now,
    );
    const periodChanged =
      period.start.getTime() !== toDate(existing.current_period_start)?.getTime() ||
      period.end.getTime() !== toDate(existing.current_period_end)?.getTime();
    const changed =
      plan !== existing.plan ||
      status !== existing.status ||
      limits.activeJobs !== existing.active_jobs_limit ||
      limits.postsPerMonth !== existing.monthly_post_limit ||
      periodChanged;
    if (changed) {
      const { rows } = await db.query<SubscriptionRow>(
        `update ${SCHEMA.accountSubscriptionsTable}
            set plan = $2,
                status = $3,
                active_jobs_limit = $4,
                monthly_post_limit = $5,
                current_period_start = $6,
                current_period_end = $7,
                updated_at = now()
          where user_id = $1
          returning *`,
        [userId, plan, status, limits.activeJobs, limits.postsPerMonth, period.start, period.end],
      );
      return mapSubscription(rows[0] ?? existing);
    }
    return mapSubscription(existing);
  }

  const plan = desiredPlan ?? "free";
  const status = legacyStatus ?? "active";
  const limits = planLimitsFor(plan, {
    activeJobsLimit: legacy?.active_jobs_limit ?? null,
    postsPerMonthLimit: legacy?.monthly_posts ?? null,
  });
  const period = advancePeriod(legacyPeriod?.start ?? billingPeriodStart(now), now);
  const { rows } = await db.query<SubscriptionRow>(
    `insert into ${SCHEMA.accountSubscriptionsTable}
       (user_id, plan, status, active_jobs_limit, monthly_post_limit, current_period_start, current_period_end)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (user_id) do update set updated_at = now()
     returning *`,
    [userId, plan, status, limits.activeJobs, limits.postsPerMonth, period.start, period.end],
  );
  if (rows[0]) return mapSubscription(rows[0]);
  const reloaded = await loadSubscriptionRow(db, userId);
  if (!reloaded) throw new PlanBoostError("JOB_NOT_FOUND", "Unable to create subscription");
  return mapSubscription(reloaded);
}

async function loadSubscriptionRow(db: Queryable, userId: string): Promise<SubscriptionRow | null> {
  const { rows } = await db.query<SubscriptionRow>(
    `select * from ${SCHEMA.accountSubscriptionsTable} where user_id = $1 limit 1`,
    [userId],
  );
  return rows[0] ?? null;
}

async function loadLegacySubscription(db: Queryable, userId: string): Promise<LegacySubscriptionRow | null> {
  try {
    const { rows } = await db.query<LegacySubscriptionRow>(
      `select plan, status, active_jobs_limit, monthly_posts, current_period_start, current_period_end
         from subscriptions where user_id = $1 limit 1`,
      [userId],
    );
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function getPlan(
  db: PlanBoostDb,
  userId: string,
  now: Date = new Date(),
): Promise<PlanSnapshot> {
  const subscription = await ensureSubscription(db, userId, now);
  const [activeJobs, postsThisPeriod, activeApplications] = await Promise.all([
    countActiveJobs(db, userId),
    countPostsThisPeriod(db, userId, subscription.periodStart),
    countActiveApplicationsForEmployer(db, userId),
  ]);
  const applicationLimit = applicationLimitForPlan(subscription.plan);
  return {
    plan: subscription.plan,
    status: subscription.status,
    limits: subscription.limits,
    usage: { activeJobs, postsThisPeriod, activeApplications },
    remainingActiveJobs: remaining(subscription.limits.activeJobs, activeJobs),
    remainingPosts: remaining(subscription.limits.postsPerMonth, postsThisPeriod),
    remainingActiveApplications: remaining(applicationLimit, activeApplications),
    periodStart: subscription.periodStart.toISOString(),
    periodEnd: subscription.periodEnd.toISOString(),
    freeStandardBoostAvailable: freeStandardBoostAvailable({
      plan: subscription.plan,
      freeStandardBoostUsedAt: subscription.freeStandardBoostUsedAt,
      periodStart: subscription.periodStart,
      periodEnd: subscription.periodEnd,
      now,
    }),
  };
}

export async function getEmployerJob(
  db: Queryable,
  employerId: string,
  jobId: string,
): Promise<JobState | null> {
  const { rows } = await db.query<JobRow>(
    `select id, employer_id, status, limit_exempt, published_at, deleted_at
       from ${SCHEMA.jobsTable}
      where ${SCHEMA.jobIdColumn} = $1
        and ${SCHEMA.jobEmployerColumn} = $2
        and ${SCHEMA.jobDeletedAtColumn} is null
      limit 1`,
    [jobId, employerId],
  );
  return rows[0] ? mapJob(rows[0]) : null;
}

export async function publishJob(
  db: PlanBoostDb,
  employerId: string,
  jobId: string,
  now: Date = new Date(),
  env: NodeJS.ProcessEnv = process.env,
): Promise<PublishResult> {
  return withTransaction(db, async (tx) => {
    const subscription = await ensureSubscription(tx, employerId, now);
    const { rows } = await tx.query<JobRow>(
      `select id, employer_id, status, limit_exempt, published_at, deleted_at
         from ${SCHEMA.jobsTable}
        where ${SCHEMA.jobIdColumn} = $1
        for update`,
      [jobId],
    );
    const jobRow = rows[0];
    if (!jobRow || jobRow.deleted_at) throw new PlanBoostError("JOB_NOT_FOUND", "Job not found");
    if (jobRow.employer_id !== employerId) {
      throw new PlanBoostError("FORBIDDEN", "Only the listing employer can publish this job");
    }

    if (jobRow.status === SCHEMA.jobOpenStatus) {
      const activeJobs = await countActiveJobs(tx, employerId);
      const postsThisPeriod = await countPostsThisPeriod(tx, employerId, subscription.periodStart);
      await onJobWentLive(tx, jobId, now);
      return { job: mapJob(jobRow), posted: false, usage: { activeJobs, postsThisPeriod } };
    }

    const previousPublishedAt = toDate(jobRow.published_at);
    const grandfatheredDraft =
      jobRow.limit_exempt === true && previousPublishedAt === null && jobRow.status === SCHEMA.jobDraftStatus;
    const consumesPost = !grandfatheredDraft;
    const enforce = planLimitsEnforced(env);

    const activeJobs = await countActiveJobs(tx, employerId, { excludeJobId: jobId });
    if (enforce && subscription.limits.activeJobs !== null && activeJobs >= subscription.limits.activeJobs) {
      throw new PlanBoostError(
        "ACTIVE_JOB_LIMIT",
        `Your ${subscription.plan} plan allows ${subscription.limits.activeJobs} active jobs. Upgrade to publish more.`,
        { activeJobs, limit: subscription.limits.activeJobs },
      );
    }

    const postsThisPeriod = await countPostsThisPeriod(tx, employerId, subscription.periodStart);
    if (
      consumesPost &&
      enforce &&
      subscription.limits.postsPerMonth !== null &&
      postsThisPeriod >= subscription.limits.postsPerMonth
    ) {
      throw new PlanBoostError(
        "MONTHLY_POST_LIMIT",
        `Your ${subscription.plan} plan allows ${subscription.limits.postsPerMonth} posts per billing period. Upgrade to publish more.`,
        { postsThisPeriod, limit: subscription.limits.postsPerMonth },
      );
    }

    const { rows: updatedRows } = await tx.query<JobRow>(
      `update ${SCHEMA.jobsTable}
          set ${SCHEMA.jobStatusColumn} = $2,
              ${SCHEMA.jobPublishedAtColumn} = $3,
              ${SCHEMA.jobLimitExemptColumn} = false,
              updated_at = now()
        where ${SCHEMA.jobIdColumn} = $1
        returning id, employer_id, status, limit_exempt, published_at, deleted_at`,
      [jobId, SCHEMA.jobOpenStatus, now],
    );
    const updated = updatedRows[0] ?? jobRow;

    if (consumesPost) {
      await tx.query(
        `insert into ${SCHEMA.jobPostEventsTable}
           (employer_id, job_id, event_type, billing_period_start, created_at)
         values ($1, $2, $3, $4, $5)`,
        [
          employerId,
          jobId,
          previousPublishedAt || jobRow.status !== SCHEMA.jobDraftStatus ? "republished" : "published",
          dateOnly(subscription.periodStart),
          now,
        ],
      );
    }

    await onJobWentLive(tx, jobId, now);

    const nextActiveJobs = await countActiveJobs(tx, employerId);
    const nextPosts = await countPostsThisPeriod(tx, employerId, subscription.periodStart);
    return {
      job: mapJob(updated),
      posted: consumesPost,
      usage: { activeJobs: nextActiveJobs, postsThisPeriod: nextPosts },
    };
  });
}

export async function purchaseBoost(
  db: PlanBoostDb,
  employerId: string,
  jobId: string,
  packageId: string,
  now: Date = new Date(),
): Promise<PurchaseBoostResult> {
  if (!isBoostPackageId(packageId)) throw new PlanBoostError("UNKNOWN_PACKAGE", "Unknown boost package");
  let freeBoostActivated = false;
  const result = await withTransaction(db, async (tx) => {
    const subscription = await ensureSubscription(tx, employerId, now);
    const { rows: jobRows } = await tx.query<JobRow>(
      `select id, employer_id, status, limit_exempt, published_at, deleted_at
         from ${SCHEMA.jobsTable}
        where ${SCHEMA.jobIdColumn} = $1
        for update`,
      [jobId],
    );
    const jobRow = jobRows[0];
    if (!jobRow || jobRow.deleted_at) throw new PlanBoostError("JOB_NOT_FOUND", "Job not found");
    if (jobRow.employer_id !== employerId) {
      throw new PlanBoostError("FORBIDDEN", "Only the listing employer can boost this job");
    }

    await expireJobBoosts(tx, jobId, now);

    const pkg = getBoostPackage(packageId);
    if (!pkg) throw new PlanBoostError("UNKNOWN_PACKAGE", "Unknown boost package");
    const free = isFreeStandardBoost({
      plan: subscription.plan,
      packageId,
      freeStandardBoostUsedAt: subscription.freeStandardBoostUsedAt,
      periodStart: subscription.periodStart,
      periodEnd: subscription.periodEnd,
      now,
    });
    const amountCents = free ? 0 : boostPriceCentsForPlan(packageId, subscription.plan) ?? pkg.priceCents;

    if (free) {
      await tx.query(
        `update ${SCHEMA.accountSubscriptionsTable}
            set free_standard_boost_used_at = $2, updated_at = now()
          where user_id = $1`,
        [employerId, now],
      );
    }

    const { rows: insertedRows } = await tx.query<BoostRow>(
      `insert into ${SCHEMA.jobBoostsTable}
         (job_id, employer_id, package_id, status, price_cents, currency, purchased_at, paid_at, created_at, updated_at)
       values ($1, $2, $3, 'pending', $4, 'USD', $5, $6, $5, now())
       returning *`,
      [jobId, employerId, packageId, amountCents, now, free ? now : null],
    );
    let boost = mapBoost(insertedRows[0]);
    if (free && jobRow.status === SCHEMA.jobOpenStatus) {
      const activated = await activateBoostInTransaction(tx, {
        paymentId: boost.id,
        jobId,
        employerUserId: employerId,
        planKey: packageId,
        pricePaidCents: 0,
      });
      if (activated) {
        const { rows: mirrored } = await tx.query<BoostRow>(
          `update ${SCHEMA.jobBoostsTable}
              set status = case when $2 = 'active' then 'active' else 'pending' end,
                  starts_at = $3,
                  ends_at = $4,
                  paid_at = coalesce(paid_at, $5),
                  updated_at = now()
            where id = $1
            returning *`,
          [boost.id, activated.status, activated.start_at, activated.expires_at, now],
        );
        boost = mapBoost(mirrored[0] ?? insertedRows[0]);
        freeBoostActivated = true;
      }
    }
    return { boost, paymentRequired: !free, amountCents, currency: boost.currency };
  });
  if (freeBoostActivated) await boostTick(db);
  return result;
}

export async function onBoostPaymentSucceeded(
  db: PlanBoostDb,
  boostId: string,
  paymentId: string,
  now: Date = new Date(),
): Promise<JobBoostState> {
  let activated = false;
  const state = await withTransaction(db, async (tx) => {
    const { rows } = await tx.query<BoostRow>(
      `select * from ${SCHEMA.jobBoostsTable} where id = $1 for update`,
      [boostId],
    );
    const row = rows[0];
    if (!row) throw new PlanBoostError("BOOST_NOT_FOUND", "Boost not found");
    const existing = mapBoost(row);
    if (existing.paymentId !== null && existing.paymentId !== paymentId) return existing;
    if (existing.status === "expired" || existing.status === "cancelled") return existing;

    const { rows: updatedRows } = await tx.query<BoostRow>(
      `update ${SCHEMA.jobBoostsTable}
          set payment_id = coalesce(payment_id, $2),
              paid_at = coalesce(paid_at, $3),
              updated_at = now()
        where id = $1
        returning *`,
      [boostId, paymentId, now],
    );
    const paid = mapBoost(updatedRows[0] ?? row);

    const { rows: jobRows } = await tx.query<JobRow>(
      `select id, employer_id, status, limit_exempt, published_at, deleted_at
         from ${SCHEMA.jobsTable} where ${SCHEMA.jobIdColumn} = $1 limit 1`,
      [paid.jobId],
    );
    const job = jobRows[0];
    if (!job || job.deleted_at || job.status !== SCHEMA.jobOpenStatus) return paid;

    const boost = await activateBoostInTransaction(tx, {
      paymentId: boostId,
      jobId: paid.jobId,
      employerUserId: paid.employerId,
      planKey: paid.packageId,
      pricePaidCents: paid.priceCents,
    });
    if (!boost) return paid;

    const { rows: mirrored } = await tx.query<BoostRow>(
      `update ${SCHEMA.jobBoostsTable}
          set status = case when $2 = 'active' then 'active' else 'pending' end,
              starts_at = $3,
              ends_at = $4,
              paid_at = coalesce(paid_at, $5),
              updated_at = now()
        where id = $1
        returning *`,
      [boostId, boost.status, boost.start_at, boost.expires_at, now],
    );
    activated = true;
    return mapBoost(mirrored[0] ?? updatedRows[0] ?? row);
  });
  if (activated) await boostTick(db);
  return state;
}

export async function onJobWentLive(
  db: PlanBoostDb,
  jobId: string,
  now: Date = new Date(),
): Promise<JobBoostState | null> {
  let activatedAny = false;
  const first = await withTransaction(db, async (tx) => {
    const { rows } = await tx.query<BoostRow>(
      `select * from ${SCHEMA.jobBoostsTable}
        where job_id = $1 and status = 'pending' and paid_at is not null
        order by purchased_at asc
        for update`,
      [jobId],
    );
    if (!rows[0]) return null;

    let firstState: JobBoostState | null = null;
    for (const row of rows) {
      const pending = mapBoost(row);
      const boost = await activateBoostInTransaction(tx, {
        paymentId: pending.id,
        jobId: pending.jobId,
        employerUserId: pending.employerId,
        planKey: pending.packageId,
        pricePaidCents: pending.priceCents,
      });
      if (!boost) continue;

      const { rows: mirrored } = await tx.query<BoostRow>(
        `update ${SCHEMA.jobBoostsTable}
            set status = case when $2 = 'active' then 'active' else 'pending' end,
                starts_at = $3,
                ends_at = $4,
                paid_at = coalesce(paid_at, $5),
                updated_at = now()
          where id = $1
          returning *`,
        [pending.id, boost.status, boost.start_at, boost.expires_at, now],
      );
      activatedAny = true;
      firstState ??= mapBoost(mirrored[0] ?? row);
    }
    return firstState;
  });
  if (activatedAny) await boostTick(db);
  return first;
}

export async function expireBoosts(db: PlanBoostDb, now: Date = new Date()): Promise<number> {
  const { rows } = await db.query<{ id: string }>(
    `update ${SCHEMA.jobBoostsTable}
        set status = 'expired', updated_at = now()
      where status = 'active' and ends_at is not null and ends_at <= $1
      returning id`,
    [now],
  );
  return rows.length;
}

export async function applicationPrecheck(
  db: PlanBoostDb,
  jobId: string,
  now: Date = new Date(),
  env: NodeJS.ProcessEnv = process.env,
  workerId: string | null = null,
): Promise<ApplicationPrecheckResult> {
  const { rows } = await db.query<{ employer_id: string }>(
    `select ${SCHEMA.jobEmployerColumn} as employer_id
       from ${SCHEMA.jobsTable}
      where ${SCHEMA.jobIdColumn} = $1 and ${SCHEMA.jobDeletedAtColumn} is null
      limit 1`,
    [jobId],
  );
  const employerId = rows[0]?.employer_id;
  if (!employerId) throw new PlanBoostError("JOB_NOT_FOUND", "Job not found");
  const subscription = await ensureSubscription(db, employerId, now);
  const limit = applicationLimitForPlan(subscription.plan);
  const used = await countActiveApplicationsForEmployer(db, employerId);
  if (workerId) {
    const existing = await db.query<{ id: string }>(
      `select id from ${SCHEMA.applicationsTable}
        where ${SCHEMA.applicationJobColumn} = $1
          and ${SCHEMA.applicantColumn} = $2
          and ${SCHEMA.applicationStatusColumn} = any($3::text[])
        limit 1`,
      [jobId, workerId, SCHEMA.applicationCountedStatuses],
    );
    if (existing.rows[0]) return { allowed: true, used, limit, remaining: remaining(limit, used), employerId };
  }
  if (planLimitsEnforced(env) && limit !== null && used >= limit) {
    return { allowed: false, used, limit, remaining: 0, employerId };
  }
  return { allowed: true, used, limit, remaining: remaining(limit, used), employerId };
}

export function enterprisePriceForSubscription(subscription: SubscriptionState): number {
  return enterpriseMonthlyPriceCents({
    activeJobs: subscription.limits.activeJobs ?? 0,
    postsPerMonth: subscription.limits.postsPerMonth ?? 0,
  });
}

export function catalogForPlan(plan: PlanId, freeStandard: boolean) {
  return BOOST_PACKAGES.map((pkg) => ({
    id: pkg.id,
    name: pkg.name,
    priceCents: plan === "pro" && freeStandard && pkg.id === "standard" ? 0 : boostPriceCentsForPlan(pkg.id, plan) ?? pkg.priceCents,
    listPriceCents: pkg.priceCents,
    durationDays: pkg.durationDays,
    multiplier: pkg.multiplier,
    free: plan === "pro" && freeStandard && pkg.id === "standard",
  }));
}

async function expireJobBoosts(tx: Queryable, jobId: string, now: Date): Promise<void> {
  await tx.query(
    `update ${SCHEMA.jobBoostsTable}
        set status = 'expired', updated_at = now()
      where job_id = $1 and status = 'active' and ends_at is not null and ends_at <= $2`,
    [jobId, now],
  );
}

async function countActiveJobs(
  db: Queryable,
  employerId: string,
  options: { excludeJobId?: string } = {},
): Promise<number> {
  const { rows } = await db.query<{ count: number | string }>(
    `select count(*)::int as count
       from ${SCHEMA.jobsTable}
      where ${SCHEMA.jobEmployerColumn} = $1
        and ${SCHEMA.jobDeletedAtColumn} is null
        and ${SCHEMA.jobLimitExemptColumn} = false
        and ${SCHEMA.jobStatusColumn} = any($2::text[])
        and (end_date is null or end_date >= current_date)
        and ($3::uuid is null or ${SCHEMA.jobIdColumn} <> $3::uuid)`,
    [employerId, SCHEMA.jobActiveStatuses, options.excludeJobId ?? null],
  );
  return Number(rows[0]?.count ?? 0);
}

async function countPostsThisPeriod(db: Queryable, employerId: string, periodStart: Date): Promise<number> {
  const { rows } = await db.query<{ count: number | string }>(
    `select count(*)::int as count
       from ${SCHEMA.jobPostEventsTable}
      where employer_id = $1 and billing_period_start = $2`,
    [employerId, dateOnly(periodStart)],
  );
  return Number(rows[0]?.count ?? 0);
}

async function countActiveApplicationsForEmployer(db: Queryable, employerId: string): Promise<number> {
  const { rows } = await db.query<{ count: number | string }>(
    `select count(*)::int as count
       from ${SCHEMA.applicationsTable} a
       join ${SCHEMA.jobsTable} j on j.${SCHEMA.jobIdColumn} = a.${SCHEMA.applicationJobColumn}
      where j.${SCHEMA.jobEmployerColumn} = $1
        and j.${SCHEMA.jobDeletedAtColumn} is null
        and a.${SCHEMA.applicationStatusColumn} = any($2::text[])`,
    [employerId, SCHEMA.applicationCountedStatuses],
  );
  return Number(rows[0]?.count ?? 0);
}

function applicationLimitForPlan(plan: PlanId): number | null {
  if (plan === "free") return 10;
  if (plan === "pro") return 30;
  return null;
}

function mapSubscription(row: SubscriptionRow): SubscriptionState {
  const plan = normalizePlan(row.plan) ?? "free";
  const status = normalizeStatus(row.status) ?? "active";
  return {
    userId: row.user_id,
    plan,
    status,
    limits: planLimitsFor(plan, {
      activeJobsLimit: row.active_jobs_limit,
      postsPerMonthLimit: row.monthly_post_limit,
    }),
    periodStart: toDate(row.current_period_start) ?? billingPeriodStart(),
    periodEnd: toDate(row.current_period_end) ?? billingPeriodEnd(billingPeriodStart()),
    freeStandardBoostUsedAt: toDate(row.free_standard_boost_used_at),
  };
}

function mapJob(row: JobRow): JobState {
  return {
    id: row.id,
    employerId: row.employer_id,
    status: row.status,
    limitExempt: row.limit_exempt === true,
    publishedAt: toDate(row.published_at),
    deletedAt: toDate(row.deleted_at),
  };
}

function mapBoost(row: BoostRow): JobBoostState {
  const packageId = (isBoostPackageId(row.package_id) ? row.package_id : "standard") as BoostPackageId;
  const status = ["pending", "active", "expired", "cancelled"].includes(row.status)
    ? (row.status as JobBoostState["status"])
    : "pending";
  return {
    id: row.id,
    jobId: row.job_id,
    employerId: row.employer_id,
    packageId,
    status,
    priceCents: Number(row.price_cents),
    currency: row.currency,
    paymentId: row.payment_id,
    purchasedAt: toDate(row.purchased_at) ?? new Date(0),
    startsAt: toDate(row.starts_at),
    endsAt: toDate(row.ends_at),
    paidAt: toDate(row.paid_at),
  };
}

function normalizePlan(value: string | null | undefined): PlanId | null {
  return isPlanId(value) ? value : null;
}

function normalizeStatus(value: string | null | undefined): SubscriptionStatus | null {
  return value === "active" || value === "past_due" || value === "canceled" ? value : null;
}

function validPeriod(
  startValue: Date | string | null | undefined,
  endValue: Date | string | null | undefined,
  now: Date,
): { start: Date; end: Date } | null {
  const start = toDate(startValue);
  const end = toDate(endValue);
  if (!start || !end || end.getTime() <= start.getTime() || now.getTime() >= end.getTime()) return null;
  return { start, end };
}

function advancePeriod(start: Date, now: Date): { start: Date; end: Date } {
  let currentStart = start;
  let currentEnd = billingPeriodEnd(currentStart);
  while (now.getTime() >= currentEnd.getTime()) {
    currentStart = currentEnd;
    currentEnd = billingPeriodEnd(currentStart);
  }
  return { start: currentStart, end: currentEnd };
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
