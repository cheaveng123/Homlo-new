import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, supabaseProtectedProcedure } from "./_core/trpc";
import { InvalidFeedCursorError } from "../backend/ranking/feed-assembly";
import { rankingConfig } from "../backend/config/rankingConfig";
import { getHomloDirectService } from "./homlo-direct-service";
import { applicationPrecheck, getEmployerJob, onJobWentLive, PlanBoostError, publishJob, withTransaction } from "./hlPlanBoostService";
import { getPlanBoostDb } from "./plan-boost-db";
import { activateBoostForPayment, cancelOwnerBoosts } from "./boost/boostService";
import { isBoostPlanKey } from "./boost/boostConfig";
import { AGE_MAX, AGE_MIN } from "../lib/age";
import { trustRouter, trustErrorToTrpc } from "./trust/router";
import { recordConsent, requestMeta } from "./trust/consent";
import type { Request } from "express";

type AgeRecord = { age: number | null; recordedAt: string | null };

/**
 * Input schema for `homlo.recommendations.feed`. Exported so the Phase 9
 * end-to-end suite can prove the userId can never be supplied/overridden from
 * the request body: the schema only accepts cursor/pageSize, so a malicious
 * `userId` payload is stripped by zod (non-strict) and identity always comes
 * from ctx.homloUser.id.
 */
export const recommendationsFeedInputSchema = z.object({
  cursor: z.string().trim().min(1).max(512).optional(),
  pageSize: z.number().int().positive().max(rankingConfig.feed.pageSizeMax).optional(),
});

const profileInput = z.object({
  role: z.enum(["worker", "employer", "both"]),
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(40).nullable().optional(),
  bio: z.string().trim().max(1_200).nullable().optional(),
  locationText: z.string().trim().max(160).nullable().optional(),
  latitude: z.number().finite().nullable().optional(),
  longitude: z.number().finite().nullable().optional(),
  profilePhotoKey: z.string().trim().max(2_000_000).nullable().optional(),
  bannerImage: z.string().trim().max(2_000_000).nullable().optional(),
});

type WorkerApplicationSummary = { id: string; status: string | null };

const jobInput = z.object({
  jobId: z.string().uuid().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  title: z.string().trim().max(350).nullable().optional(),
  description: z.string().trim().max(12_000).nullable().optional(),
  payAmount: z.number().finite().nonnegative().nullable().optional(),
  payCurrency: z.string().trim().min(3).max(6).optional(),
  payType: z.enum(["hourly", "daily", "fixed"]).nullable().optional(),
  locationText: z.string().trim().max(300).nullable().optional(),
  addressLine: z.string().trim().max(300).nullable().optional(),
  city: z.string().trim().max(160).nullable().optional(),
  district: z.string().trim().max(160).nullable().optional(),
  province: z.string().trim().max(160).nullable().optional(),
  country: z.string().trim().max(160).nullable().optional(),
  postalCode: z.string().trim().max(40).nullable().optional(),
  latitude: z.number().finite().gte(-90).lte(90).nullable().optional(),
  longitude: z.number().finite().gte(-180).lte(180).nullable().optional(),
  workersNeeded: z.number().int().min(1).max(500).optional(),
  status: z.enum(["draft", "open", "closed", "cancelled"]).optional(),
  workArrangement: z.enum(["On-site", "Hybrid", "Remote"]).nullable().optional(),
  bannerImage: z.string().trim().max(2_000_000).nullable().optional(),
  requirements: z.string().trim().max(12_000).nullable().optional(),
  autoCloseEnabled: z.boolean().optional(),
  // Work time + pay range (059_job_work_time.sql). null = not set ("N/A").
  workDays: z.array(z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"])).max(7).nullable().optional(),
  clockIn: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  clockOut: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  payMax: z.number().finite().nonnegative().nullable().optional(),
  // Trust & safety (057_trust_safety.sql). Required by the database when a listing is submitted.
  employerName: z.string().trim().min(2).max(160).nullable().optional(),
  contactMethod: z.enum(["in_app", "email", "phone"]).nullable().optional(),
  contactValue: z.string().trim().max(320).nullable().optional(),
  /** The job-posting declaration checkbox. Must be true each time a listing is submitted. */
  postingConsent: z.boolean().optional(),
});

type PlanGuardContext = {
  homloUser: { id: string } | null;
  supabaseAccessToken: string | null;
  req: Request;
};

/** Writes the trust & safety columns the edge gateway does not know about. */
async function saveTrustFields(employerId: string, jobId: string, input: z.infer<typeof jobInput>) {
  if (input.employerName === undefined && input.contactMethod === undefined && input.contactValue === undefined) return;
  await getPlanBoostDb().query(
    `update jobs set employer_name = coalesce($3, employer_name),
                     contact_method = coalesce($4, contact_method),
                     contact_value = case when coalesce($4, contact_method) = 'in_app' then null else coalesce($5, contact_value) end
      where id = $1 and employer_id = $2`,
    [jobId, employerId, input.employerName ?? null, input.contactMethod ?? null, input.contactValue ?? null],
  );
}

type WorkTimeFields = Pick<z.infer<typeof jobInput>, "workDays" | "clockIn" | "clockOut" | "payMax">;

/**
 * Writes the work-time and pay-range columns (059_job_work_time.sql), which
 * the edge gateway's homlo_save_job does not know about. Only fields the client
 * sent are touched; null clears a value ("N/A"). An unpaired clock time is
 * dropped so the jobs_clock_pair_check constraint never rejects the save.
 */
async function saveWorkTimeFields(employerId: string, jobId: string, fields: WorkTimeFields) {
  const { workDays, payMax } = fields;
  let { clockIn, clockOut } = fields;
  if (workDays === undefined && clockIn === undefined && clockOut === undefined && payMax === undefined) return;
  if ((clockIn ?? null) === null || (clockOut ?? null) === null) {
    if (clockIn !== undefined || clockOut !== undefined) { clockIn = null; clockOut = null; }
  }
  const touchClock = clockIn !== undefined || clockOut !== undefined;
  const days = workDays === undefined ? undefined : workDays && workDays.length ? Array.from(new Set(workDays)) : null;
  await getPlanBoostDb().query(
    `update jobs set
        work_days = case when $3 then $4::text[] else work_days end,
        clock_in = case when $5 then $6::time else clock_in end,
        clock_out = case when $5 then $7::time else clock_out end,
        pay_amount_max = case when $8 then $9::numeric else pay_amount_max end
      where id = $1 and employer_id = $2`,
    [
      jobId, employerId,
      days !== undefined, days ?? null,
      touchClock, clockIn ?? null, clockOut ?? null,
      payMax !== undefined, payMax ?? null,
    ],
  );
}

async function currentJobStatus(jobId: string): Promise<{ status: string; moderation_reasons: string[] } | null> {
  const { rows } = await getPlanBoostDb().query<{ status: string; moderation_reasons: string[] }>(
    `select status, moderation_reasons from jobs where id = $1`,
    [jobId],
  );
  return rows[0] ?? null;
}

function planErrorToTrpc(error: unknown): never {
  if (error instanceof PlanBoostError) {
    const code =
      error.code === "UNAUTHORIZED"
        ? "UNAUTHORIZED"
        : error.code === "FORBIDDEN" || error.code === "ACTIVE_JOB_LIMIT" || error.code === "MONTHLY_POST_LIMIT" || error.code === "APPLICATION_LIMIT"
          ? "FORBIDDEN"
          : error.code === "JOB_NOT_FOUND" || error.code === "BOOST_NOT_FOUND"
            ? "NOT_FOUND"
            : "BAD_REQUEST";
    throw new TRPCError({ code, message: error.message, cause: error });
  }
  throw error;
}

async function saveJobWithPlanEnforcement(ctx: PlanGuardContext, rawInput: z.infer<typeof jobInput>) {
  const { employerName, contactMethod, contactValue, postingConsent, workDays, clockIn, clockOut, payMax, ...input } = rawInput;
  const trustFields = { employerName, contactMethod, contactValue } as z.infer<typeof jobInput>;
  const workTime: WorkTimeFields = { workDays, clockIn, clockOut, payMax };
  const saveExtras = async (employerId: string, jobId: string) => {
    await saveTrustFields(employerId, jobId, trustFields);
    await saveWorkTimeFields(employerId, jobId, workTime);
  };
  if (!ctx.homloUser) throw new TRPCError({ code: "UNAUTHORIZED" });
  const employerId = ctx.homloUser.id;
  const savedJobId = (saved: unknown) => {
    const job = (saved as { job?: { id?: unknown } } | null)?.job;
    return input.jobId ?? (typeof job?.id === "string" ? job.id : null);
  };

  try {
    if (input.status !== "open") {
      const saved = await getHomloDirectService().invoke(ctx.supabaseAccessToken!, "employer.save-job", input);
      const jobId = savedJobId(saved);
      if (jobId) await saveExtras(employerId, jobId);
      return saved;
    }
    const db = getPlanBoostDb();
    const existing = input.jobId ? await getEmployerJob(db, employerId, input.jobId) : null;
    if (existing?.status === "open") {
      // Editing a live listing: the database re-checks the text (and may send it to review).
      const saved = await getHomloDirectService().invoke(ctx.supabaseAccessToken!, "employer.save-job", input);
      await saveExtras(employerId, existing.id);
      await onJobWentLive(db, existing.id);
      return saved;
    }
    if (postingConsent !== true) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Confirm the job posting declaration before submitting this listing." });
    }
    const saved = await getHomloDirectService().invoke<Record<string, unknown>>(
      ctx.supabaseAccessToken!,
      "employer.save-job",
      { ...input, status: "draft" },
    );
    const savedJob = saved?.job as Record<string, unknown> | undefined;
    const jobId = savedJobId(saved);
    if (!jobId) return saved;
    await saveExtras(employerId, jobId);
    // One consent row per submission, tied to this listing. The database gate
    // (jobs_trust_safety_gate) refuses to publish without it.
    await recordConsent(db, {
      userId: employerId,
      type: "job_posting",
      meta: requestMeta(ctx.req),
      listingId: jobId,
      metadata: { title: input.title ?? null },
    });
    const published = await publishJob(db, employerId, jobId);
    const after = await currentJobStatus(jobId);
    return {
      ...saved,
      job: {
        ...(savedJob ?? {}),
        id: jobId,
        status: after?.status ?? "open",
        published_at: published.job.publishedAt?.toISOString() ?? null,
      },
      // "pending_review" means a moderator must approve it before it is shown.
      moderation: after?.status === "pending_review" ? { pendingReview: true, reasons: after.moderation_reasons } : null,
      planUsage: published.usage,
    };
  } catch (error) {
    if (error instanceof PlanBoostError) planErrorToTrpc(error);
    if ((error as { code?: string } | null)?.code === "P0001") trustErrorToTrpc(error);
    throw error;
  }
}

async function assertCanApply(ctx: PlanGuardContext, jobId: string) {
  if (!ctx.homloUser) throw new TRPCError({ code: "UNAUTHORIZED" });
  const result = await applicationPrecheck(getPlanBoostDb(), jobId, new Date(), process.env, ctx.homloUser.id);
  if (!result.allowed) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `This employer's ${result.limit ?? "application"} application limit has been reached for this billing period.`,
    });
  }
}

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  trust: trustRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.homloUser),
  }),
  applications: router({
    list: supabaseProtectedProcedure.query(({ ctx }) =>
      getHomloDirectService().read(ctx.supabaseAccessToken, ctx.homloUser, "application.list"),
    ),
    byJob: supabaseProtectedProcedure
      .input(z.object({ jobId: z.string().min(1).max(120) }))
      .query(({ ctx, input }) =>
        getHomloDirectService().read(ctx.supabaseAccessToken, ctx.homloUser, "application.for-job", {
          jobId: input.jobId,
        }),
      ),
    forEmployerJob: supabaseProtectedProcedure
      .input(z.object({ jobId: z.string().uuid() }))
      .query(({ ctx, input }) =>
        getHomloDirectService().invoke(ctx.supabaseAccessToken, "employer.applications", input),
      ),
    employerById: supabaseProtectedProcedure
      .input(z.object({ jobId: z.string().uuid(), applicationId: z.string().uuid() }))
      .query(({ ctx, input }) =>
        getHomloDirectService()
          .invoke(ctx.supabaseAccessToken, "employer.applications", { jobId: input.jobId })
          .then((result: any) => result.applications?.find((a: any) => a.id === input.applicationId)),
      ),
    updateStatus: supabaseProtectedProcedure
      .input(
        z.object({
          applicationId: z.string().uuid(),
          status: z.enum(["submitted", "under_review", "interview", "accepted", "rejected"]),
        }),
      )
      .mutation(({ ctx, input }) =>
        getHomloDirectService().invoke(ctx.supabaseAccessToken, "application.change-status", {
          applicationId: input.applicationId,
          status: input.status,
        }),
      ),
    submit: supabaseProtectedProcedure
      .input(
        z.object({
          jobId: z.string().uuid(),
          availability: z.string().min(1).max(80),
          note: z.string().max(2000).optional(),
        }),
      )
      .mutation(({ ctx, input }) =>
        getHomloDirectService().invoke(ctx.supabaseAccessToken, "application.submit", {
          jobId: input.jobId,
          availability: input.availability,
          note: input.note,
        }),
      ),
  }),
  profile: router({
    me: supabaseProtectedProcedure.query(({ ctx }) =>
      getHomloDirectService().read(ctx.supabaseAccessToken, ctx.homloUser, "profile.get"),
    ),
    save: supabaseProtectedProcedure
      .input(z.object({
        headline: z.string().max(160).optional(),
        location: z.string().max(160).optional(),
        bio: z.string().max(1200).optional(),
        skills: z.string().max(600).optional(),
        availability: z.string().max(120).optional(),
      }))
      .mutation(({ ctx, input }) =>
        getHomloDirectService().invoke(ctx.supabaseAccessToken, "profile.upsert", input),
      ),
  }),
    homlo: router({
    publicJobs: publicProcedure.query(() => getHomloDirectService().listPublishedJobs()),
    /** PERF: one public job by id (job detail) instead of the whole list. */
    publicJob: publicProcedure
      .input(z.object({ id: z.string().trim().min(1).max(120) }))
      .query(({ input }) => getHomloDirectService().getPublishedJob(input.id)),
    categories: publicProcedure.query(() => getHomloDirectService().listCategories()),
    employerProfile: publicProcedure
      .input(z.object({ name: z.string().trim().min(1).max(120) }))
      .query(({ input }) => getHomloDirectService().getEmployerProfile(input.name)),
    homeFeed: publicProcedure
      .input(
        z.object({
          latitude: z.number().finite().gte(-90).lte(90).nullable().optional(),
          longitude: z.number().finite().gte(-180).lte(180).nullable().optional(),
          radiusKm: z.number().finite().positive().max(200).optional(),
          sectionSize: z.number().int().min(1).max(8).optional(),
        })
      )
      .query(({ ctx, input }) =>
        getHomloDirectService().getHomeFeed({
          latitude: input.latitude,
          longitude: input.longitude,
          radiusKm: input.radiusKm,
          sectionSize: input.sectionSize,
          userId: ctx.homloUser?.id ?? null,
        })
      ),
    searchJobs: publicProcedure
      .input(
        z.object({
          query: z.string().max(500).optional(),
          category: z.string().max(100).optional(),
          employmentType: z.string().max(50).optional(),
          arrangement: z.string().max(50).optional(),
          experience: z.string().max(50).optional(),
          location: z.string().max(160).optional(),
          salaryMin: z.number().finite().nonnegative().optional(),
          salaryMax: z.number().finite().nonnegative().optional(),
          posted: z.string().max(50).optional(),
          sort: z.enum(["recommended", "newest", "salary_high_to_low", "closest"]).optional(),
          latitude: z.number().finite().optional(),
          longitude: z.number().finite().optional(),
          radiusKm: z.number().finite().positive().max(200).optional(),
          bbox: z.string().max(120).optional(),
          limit: z.number().int().positive().max(50).optional(),
          offset: z.number().int().nonnegative().optional(),
        })
      )
      .query(async ({ input }) => {
        return getHomloDirectService().searchJobs(input);
      }),
    session: supabaseProtectedProcedure.query(({ ctx }) => ctx.homloUser),
    recommendations: router({
      // Phase 7 personalized job feed. Authenticated only; the user id is taken
      // from the session context (ctx.homloUser.id) and NEVER accepted from the
      // request body. Pagination is cursor-based over the bounded phase 6 pool.
      feed: supabaseProtectedProcedure
        .input(recommendationsFeedInputSchema)
        .query(({ ctx, input }) => {
          try {
            return getHomloDirectService().getRecommendedJobs({
              userId: ctx.homloUser.id,
              pageSize: input.pageSize,
              cursor: input.cursor ?? null,
            });
          } catch (error) {
            if (error instanceof InvalidFeedCursorError) {
              throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
            }
            throw error;
          }
        }),
    }),
    profile: router({
      get: supabaseProtectedProcedure.query(({ ctx }) =>
        getHomloDirectService().read(ctx.supabaseAccessToken, ctx.homloUser, "profile.get"),
      ),
      upsert: supabaseProtectedProcedure.input(profileInput).mutation(({ ctx, input }) =>
        getHomloDirectService().invoke(ctx.supabaseAccessToken, "profile.upsert", input),
      ),
      /**
       * Uploads the profile photo BYTES to the public `profile-photos` bucket
       * and returns only the Storage object key. The key is persisted on the
       * next `profile.upsert`; the local picker URI/data URL is never stored.
       */
      uploadPhoto: supabaseProtectedProcedure
        .input(z.object({ photo: z.string().trim().min(1) }))
        .mutation(({ ctx, input }) => getHomloDirectService().uploadProfilePhoto(ctx.supabaseAccessToken, input.photo)),
    }),
    applications: router({
      list: supabaseProtectedProcedure.query(({ ctx }) =>
        getHomloDirectService().read(ctx.supabaseAccessToken, ctx.homloUser, "application.list"),
      ),
      byJob: supabaseProtectedProcedure
        .input(z.object({ jobId: z.string().min(1).max(120) }))
        .query(({ ctx, input }) =>
          getHomloDirectService().read<{ application: WorkerApplicationSummary | null }>(ctx.supabaseAccessToken, ctx.homloUser, "application.for-job",
            input,
          ),
        ),
      submit: supabaseProtectedProcedure
        .input(z.object({ jobId: z.string().min(1).max(120), message: z.string().trim().max(4000).nullable().optional() }))
        .mutation(async ({ ctx, input }) => {
          await assertCanApply(ctx, input.jobId);
          return getHomloDirectService().invoke(ctx.supabaseAccessToken, "application.submit", input);
        }),
      changeStatus: supabaseProtectedProcedure
        .input(z.object({ applicationId: z.string().min(1).max(120), status: z.enum(["reviewed", "interview", "hired", "declined", "withdrawn"]) }))
        .mutation(({ ctx, input }) => getHomloDirectService().invoke(ctx.supabaseAccessToken, "application.change-status", input)),
      // Records that the listing employer opened an application. Deliberately not
      // part of changeStatus: a read receipt is not a pipeline move, it is
      // idempotent, and it must not overwrite the original viewed timestamp.
      markViewed: supabaseProtectedProcedure
        .input(z.object({ applicationId: z.string().min(1).max(120) }))
        .mutation(({ ctx, input }) => getHomloDirectService().invoke(ctx.supabaseAccessToken, "application.mark-viewed", input)),
    }),
    notifications: router({
      list: supabaseProtectedProcedure.query(({ ctx }) =>
        getHomloDirectService().read(ctx.supabaseAccessToken, ctx.homloUser, "notifications.list"),
      ),
      markRead: supabaseProtectedProcedure
        .input(z.object({ notificationId: z.string().uuid() }))
        .mutation(({ ctx, input }) =>
          getHomloDirectService().invoke(ctx.supabaseAccessToken, "notifications.mark-read", input),
        ),
    }),
    /** App Store 1.2: report a job listing (spam, scam, offensive…) for moderation. */
    reportJob: supabaseProtectedProcedure
      .input(
        z.object({
          jobId: z.string().uuid(),
          reason: z.enum(["scam", "underage_user", "discrimination", "illegal", "other"]),
          details: z.string().trim().max(1000).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        if (!ctx.homloUser.profileComplete) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Finish setting up your profile to report a listing." });
        }
        return getHomloDirectService().reportJob(ctx.homloUser.id, input.jobId, input.reason, input.details || null);
      }),
    account: router({
      /** App Store 5.1.1(v): permanently delete the signed-in account. */
      delete: supabaseProtectedProcedure
        .input(z.object({ confirm: z.literal("DELETE") }))
        .mutation(({ ctx }) => getHomloDirectService().deleteAccount(ctx.supabaseAccessToken, ctx.homloUser.id)),
      get: supabaseProtectedProcedure.query(({ ctx }) =>
        getHomloDirectService().read(ctx.supabaseAccessToken, ctx.homloUser, "account.get"),
      ),
      /** The age given right after sign-up (null until the age step is done). */
      // Served by the app server straight from Postgres (not the edge gateway),
      // keyed by the session user that requireHomloUser already verified.
      age: supabaseProtectedProcedure.query(({ ctx }): Promise<AgeRecord> =>
        getHomloDirectService().getUserAge(ctx.homloUser.id),
      ),
      /** "Are you 18 or older?" — the member's own answer, plus a suggestion from their sign-up age. */
      adultStatus: supabaseProtectedProcedure.query(({ ctx }) =>
        getHomloDirectService().getAdultStatus(ctx.homloUser.id),
      ),
      setAdultStatus: supabaseProtectedProcedure
        .input(z.object({ isAdult: z.boolean() }))
        .mutation(({ ctx, input }) => getHomloDirectService().setAdultStatus(ctx.homloUser.id, input.isAdult)),
      setAge: supabaseProtectedProcedure
        .input(z.object({ age: z.number().int().min(AGE_MIN).max(AGE_MAX) }))
        .mutation(({ ctx, input }): Promise<AgeRecord> =>
          getHomloDirectService().setUserAge(ctx.homloUser.id, input.age),
        ),
      subscription: supabaseProtectedProcedure.query(({ ctx }) =>
        getHomloDirectService().read<{ account: { plan: string; plan_status: string } | null }>(ctx.supabaseAccessToken, ctx.homloUser, "account.get").then(
          (res) => res.account ?? { plan: "free" as const, plan_status: "active" as const },
        ),
      ),
      upsertSubscription: supabaseProtectedProcedure
        .input(z.object({ plan: z.enum(["free", "pro", "enterprise"]) }))
        .mutation(({ ctx, input }) => getHomloDirectService().invoke(ctx.supabaseAccessToken, "subscription.upsert", input)),
      purchasePlan: supabaseProtectedProcedure
        .input(
          z.object({
            plan: z.enum(["free", "pro", "enterprise"]),
            amount: z.number().finite().nonnegative(),
            currency: z.string().trim().min(3).max(6).default("USD"),
            provider: z.string().trim().max(60).optional(),
            simulateResult: z.enum(["completed", "failed"]).optional(),
          }),
        )
        .mutation(({ ctx, input }) => getHomloDirectService().invoke(ctx.supabaseAccessToken, "subscription.purchase", input)),
    }),
    employer: router({
      jobs: supabaseProtectedProcedure.query(async ({ ctx }) => {
        if (ctx.homloUser.status !== "active") {
          throw new TRPCError({ code: "FORBIDDEN", message: "This Homlo account is unavailable" });
        }
        try {
          return await getHomloDirectService().listEmployerJobsDirect(ctx.homloUser.id);
        } catch (error) {
          console.warn("[employer.jobs] direct read failed; using gateway", error instanceof Error ? error.message : error);
          return getHomloDirectService().invoke(ctx.supabaseAccessToken, "employer.jobs");
        }
      }),
      saveJob: supabaseProtectedProcedure.input(jobInput).mutation(({ ctx, input }) =>
        saveJobWithPlanEnforcement(ctx, input),
      ),
      deleteJob: supabaseProtectedProcedure.input(z.object({ jobId: z.string().uuid() })).mutation(({ ctx, input }) =>
        getHomloDirectService().invoke(ctx.supabaseAccessToken, "employer.delete-job", input),
      ),
      softDeleteJob: supabaseProtectedProcedure.input(z.object({ jobId: z.string().uuid() })).mutation(({ ctx, input }) =>
        getHomloDirectService().invoke(ctx.supabaseAccessToken, "employer.soft-delete-job", input),
      ),
      setAutoClose: supabaseProtectedProcedure
        .input(z.object({ jobId: z.string().uuid(), autoCloseEnabled: z.boolean() }))
        .mutation(({ ctx, input }) =>
          getHomloDirectService().invoke(ctx.supabaseAccessToken, "employer.set-auto-close", input),
        ),
      /**
       * Uploads the job image BYTES to the public `job-images` bucket and
       * returns the public URL. The URL is persisted on the next
       * `employer.saveJob` (jobs.banner_image); the local picker URI/data URL
       * is never stored.
       */
      uploadImage: supabaseProtectedProcedure
        .input(z.object({ jobId: z.string().uuid(), image: z.string().trim().min(1) }))
        .mutation(({ ctx, input }) =>
          getHomloDirectService().uploadJobImage(ctx.supabaseAccessToken, input.jobId, input.image),
        ),
      applications: supabaseProtectedProcedure.input(z.object({ jobId: z.string().uuid() })).query(async ({ ctx, input }) => {
        // Same rule the gateway applies before any action.
        if (ctx.homloUser.status !== "active") {
          throw new TRPCError({ code: "FORBIDDEN", message: "This Homlo account is unavailable" });
        }
        try {
          return await getHomloDirectService().listEmployerApplicationsDirect(ctx.homloUser.id, input.jobId);
        } catch (error) {
          console.warn("[employer.applications] direct read failed; using gateway", error instanceof Error ? error.message : error);
          return getHomloDirectService().invoke(ctx.supabaseAccessToken, "employer.applications", input);
        }
      }),
      /**
       * PERF: every applicant across all of the caller's jobs in one query,
       * replacing the dashboard's one-`applications`-call-per-job fan-out.
       * Rows carry `job_id`. If the direct read fails, falls back to the
       * gateway per job (the previous behaviour).
       */
      allApplications: supabaseProtectedProcedure.query(async ({ ctx }) => {
        if (ctx.homloUser.status !== "active") {
          throw new TRPCError({ code: "FORBIDDEN", message: "This Homlo account is unavailable" });
        }
        const service = getHomloDirectService();
        try {
          return await service.listAllEmployerApplicationsDirect(ctx.homloUser.id);
        } catch (error) {
          console.warn("[employer.allApplications] direct read failed; using gateway", error instanceof Error ? error.message : error);
          const { jobs } = await service.invoke<{ jobs?: { id: string }[] }>(ctx.supabaseAccessToken, "employer.jobs");
          const perJob = await Promise.all(
            (jobs ?? []).map((job) =>
              service.invoke<{ applications?: Record<string, unknown>[] }>(ctx.supabaseAccessToken, "employer.applications", { jobId: job.id }),
            ),
          );
          return { applications: perJob.flatMap((result) => result.applications ?? []) };
        }
      }),
    }),
    boost: router({
      create: supabaseProtectedProcedure
        .input(
          z.object({
            jobId: z.string().uuid(),
            package: z.enum(["starter", "local", "standard", "urgent", "strong", "maximum"]),
            amount: z.number().finite().positive(),
            currency: z.string().trim().min(3).max(6).default("USD"),
            provider: z.string().trim().max(60).optional(),
          }),
        )
        .mutation(({ ctx, input }) => getHomloDirectService().invoke(ctx.supabaseAccessToken, "boost.create", input)),
      verifyPayment: supabaseProtectedProcedure
        .input(
          z.object({
            paymentId: z.string().uuid(),
            providerEventId: z.string().trim().max(200).optional(),
            providerTransactionId: z.string().trim().max(200).optional(),
            simulateResult: z.enum(["completed", "failed"]).optional(),
          }),
        )
        .mutation(async ({ ctx, input }) => {
          const verified = await getHomloDirectService().invoke<{
            payment?: { status?: string };
          }>(ctx.supabaseAccessToken, "boost.verify-payment", input);

          if (verified?.payment?.status === "completed") {
            try {
              const db = getPlanBoostDb();
              const { rows } = await db.query<{
                id: string;
                job_id: string;
                package_id: string;
                price_cents: number;
              }>(
                `select id, job_id, package_id, price_cents
                   from public.job_boosts
                  where payment_id = $1
                  limit 1`,
                [input.paymentId],
              );
              const row = rows[0];
              if (row && isBoostPlanKey(row.package_id)) {
                const boost = await activateBoostForPayment(db, {
                  paymentId: row.id,
                  jobId: row.job_id,
                  employerUserId: ctx.homloUser.id,
                  planKey: row.package_id,
                  pricePaidCents: Number(row.price_cents) || 0,
                });
                if (boost) {
                  await db.query(
                    `update public.job_boosts
                        set status = case when $2 = 'active' then 'active' else 'pending' end,
                            starts_at = $3,
                            ends_at = $4,
                            paid_at = coalesce(paid_at, now()),
                            updated_at = now()
                      where id = $1`,
                    [row.id, boost.status, boost.start_at, boost.expires_at],
                  );
                }
              }
            } catch (error) {
              console.error("[boost] activation failed after payment", error);
            }
          }

          return verified;
        }),
      /** Stops the job's running boost (and any queued after it). Owner only. */
      cancel: supabaseProtectedProcedure
        .input(z.object({ jobId: z.string().uuid() }))
        .mutation(async ({ ctx, input }) => {
          const result = await withTransaction(getPlanBoostDb(), (tx) =>
            cancelOwnerBoosts(tx, input.jobId, ctx.homloUser.id),
          );
          if (result.cancelled === 0) {
            throw new TRPCError({ code: "NOT_FOUND", message: "This job has no active boost to cancel." });
          }
          return result;
        }),
    }),
    messaging: router({
      conversations: supabaseProtectedProcedure.query(({ ctx }) =>
        getHomloDirectService().read(ctx.supabaseAccessToken, ctx.homloUser, "messaging.conversations"),
      ),
      conversation: supabaseProtectedProcedure
        .input(z.object({ applicationId: z.string().uuid() }))
        .query(({ ctx, input }) =>
          getHomloDirectService().invoke(ctx.supabaseAccessToken, "messaging.conversation", input),
        ),
      messages: supabaseProtectedProcedure
        .input(z.object({ conversationId: z.string().uuid(), before: z.string().datetime().optional(), limit: z.number().int().min(1).max(1000).optional() }))
        .query(({ ctx, input }) =>
          getHomloDirectService().invoke(ctx.supabaseAccessToken, "messaging.messages", input),
        ),
      send: supabaseProtectedProcedure
        .input(z.object({ conversationId: z.string().uuid(), message: z.string().trim().min(1).max(4000) }))
        .mutation(({ ctx, input }) =>
          getHomloDirectService().invoke(ctx.supabaseAccessToken, "messaging.send", input),
        ),
      markRead: supabaseProtectedProcedure
        .input(z.object({ conversationId: z.string().uuid() }))
        .mutation(({ ctx, input }) =>
          getHomloDirectService().invoke(ctx.supabaseAccessToken, "messaging.mark-read", input),
        ),
      unreadCount: supabaseProtectedProcedure.query(({ ctx }) =>
        getHomloDirectService().invoke(ctx.supabaseAccessToken, "messaging.unread-count"),
      ),
      block: supabaseProtectedProcedure
        .input(z.object({ conversationId: z.string().uuid(), targetId: z.string().uuid() }))
        .mutation(({ ctx, input }) =>
          getHomloDirectService().invoke(ctx.supabaseAccessToken, "messaging.block", input),
        ),
      unblock: supabaseProtectedProcedure
        .input(z.object({ conversationId: z.string().uuid(), targetId: z.string().uuid() }))
        .mutation(({ ctx, input }) =>
          getHomloDirectService().invoke(ctx.supabaseAccessToken, "messaging.unblock", input),
        ),
      report: supabaseProtectedProcedure
        .input(z.object({ conversationId: z.string().uuid(), reason: z.string().trim().min(1).max(500), details: z.string().trim().max(2000).optional() }))
        .mutation(({ ctx, input }) =>
          getHomloDirectService().invoke(ctx.supabaseAccessToken, "messaging.report", input),
        ),
      hide: supabaseProtectedProcedure
        .input(z.object({ messageId: z.string().uuid() }))
        .mutation(({ ctx, input }) =>
          getHomloDirectService().invoke(ctx.supabaseAccessToken, "messaging.hide", input),
        ),
    }),
  }),
});

export type AppRouter = typeof appRouter;
