import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router, supabaseProtectedProcedure } from "./_core/trpc";
import { InvalidFeedCursorError } from "../backend/ranking/feed-assembly";
import { rankingConfig } from "../backend/config/rankingConfig";
import * as db from "./db";
import { getHomloDirectService } from "./homlo-direct-service";

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
  bannerImage: z.string().trim().max(2_000_000).nullable().optional(),
  requirements: z.string().trim().max(12_000).nullable().optional(),
});

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.homloUser),
  }),
  applications: router({
    list: protectedProcedure.query(({ ctx }) => db.listApplicationsForUser(ctx.user.id)),
    byJob: protectedProcedure.input(z.object({ jobId: z.string().min(1).max(120) })).query(({ ctx, input }) =>
      db.getApplicationForUser(ctx.user.id, input.jobId),
    ),
    forEmployerJob: protectedProcedure
      .input(z.object({ jobId: z.string().min(1).max(120) }))
      .query(({ input }) => db.listApplicationsForJob(input.jobId)),
    employerById: protectedProcedure
      .input(z.object({ applicationId: z.number().int().positive() }))
      .query(({ input }) => db.getApplicationForEmployer(input.applicationId)),
    updateStatus: protectedProcedure
      .input(z.object({ applicationId: z.number().int().positive(), status: z.enum(["submitted", "under_review", "interview", "accepted", "rejected"]) }))
      .mutation(({ input }) => db.updateApplicationStatus(input.applicationId, input.status)),
    submit: protectedProcedure
      .input(z.object({ jobId: z.string().min(1).max(120), availability: z.string().min(1).max(80), note: z.string().max(2000).optional() }))
      .mutation(({ ctx, input }) => db.submitApplication({ ...input, userId: ctx.user.id })),
  }),
  profile: router({
    me: protectedProcedure.query(({ ctx }) => db.getJobSeekerProfile(ctx.user.id)),
    save: protectedProcedure
      .input(z.object({
        headline: z.string().max(160).optional(),
        location: z.string().max(160).optional(),
        bio: z.string().max(1200).optional(),
        skills: z.string().max(600).optional(),
        availability: z.string().max(120).optional(),
      }))
      .mutation(({ ctx, input }) => db.saveJobSeekerProfile(ctx.user.id, input)),
  }),
  homlo: router({
    publicJobs: publicProcedure.query(() => getHomloDirectService().listPublishedJobs()),
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
        getHomloDirectService().invoke(ctx.supabaseAccessToken, "profile.get"),
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
        getHomloDirectService().invoke(ctx.supabaseAccessToken, "application.list"),
      ),
      byJob: supabaseProtectedProcedure
        .input(z.object({ jobId: z.string().min(1).max(120) }))
        .query(({ ctx, input }) => getHomloDirectService().invoke(ctx.supabaseAccessToken, "application.for-job", input)),
      submit: supabaseProtectedProcedure
        .input(z.object({ jobId: z.string().min(1).max(120), message: z.string().trim().max(4000).nullable().optional() }))
        .mutation(({ ctx, input }) => getHomloDirectService().invoke(ctx.supabaseAccessToken, "application.submit", input)),
      changeStatus: supabaseProtectedProcedure
        .input(z.object({ applicationId: z.string().min(1).max(120), status: z.enum(["reviewed", "interview", "hired", "declined", "withdrawn"]) }))
        .mutation(({ ctx, input }) => getHomloDirectService().invoke(ctx.supabaseAccessToken, "application.change-status", input)),
    }),
    account: router({
      get: supabaseProtectedProcedure.query(({ ctx }) =>
        getHomloDirectService().invoke(ctx.supabaseAccessToken, "account.get"),
      ),
      subscription: supabaseProtectedProcedure.query(({ ctx }) =>
        getHomloDirectService().invoke<{ account: { plan: string; plan_status: string } | null }>(ctx.supabaseAccessToken, "account.get").then(
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
      jobs: supabaseProtectedProcedure.query(({ ctx }) =>
        getHomloDirectService().invoke(ctx.supabaseAccessToken, "employer.jobs"),
      ),
      saveJob: supabaseProtectedProcedure.input(jobInput).mutation(({ ctx, input }) =>
        getHomloDirectService().invoke(ctx.supabaseAccessToken, "employer.save-job", input),
      ),
      deleteJob: supabaseProtectedProcedure.input(z.object({ jobId: z.string().uuid() })).mutation(({ ctx, input }) =>
        getHomloDirectService().invoke(ctx.supabaseAccessToken, "employer.delete-job", input),
      ),
      softDeleteJob: supabaseProtectedProcedure.input(z.object({ jobId: z.string().uuid() })).mutation(({ ctx, input }) =>
        getHomloDirectService().invoke(ctx.supabaseAccessToken, "employer.soft-delete-job", input),
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
      applications: supabaseProtectedProcedure.input(z.object({ jobId: z.string().uuid() })).query(({ ctx, input }) =>
        getHomloDirectService().invoke(ctx.supabaseAccessToken, "employer.applications", input),
      ),
    }),
    boost: router({
      create: supabaseProtectedProcedure
        .input(
          z.object({
            jobId: z.string().uuid(),
            package: z.enum(["starter", "local", "standard", "urgent", "strong", "maximum"]),
            amount: z.number().finite().nonnegative(),
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
        .mutation(({ ctx, input }) => getHomloDirectService().invoke(ctx.supabaseAccessToken, "boost.verify-payment", input)),
    }),
    messaging: router({
      conversations: supabaseProtectedProcedure.query(({ ctx }) =>
        getHomloDirectService().invoke(ctx.supabaseAccessToken, "messaging.conversations"),
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
