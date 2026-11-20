import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { publicProcedure, router, supabaseProtectedProcedure } from "../_core/trpc";
import { getPlanBoostDb } from "../plan-boost-db";
import { TrustError, sendEmailVerification, sendPhoneCode, verifyPhoneCode } from "./accounts";
import { getLegalVersions, recordConsent, requestMeta } from "./consent";
import {
  chargebackEvidence,
  createReport,
  decideAppeal,
  isAdmin,
  listActionHistory,
  listAppeals,
  listOpenReports,
  listReviewQueue,
  submitAppeal,
  takeAction,
} from "./moderation";
import { DeliveryUnavailableError } from "./outbound";
import { exportUserData } from "./privacy";

/** Converts rule violations into readable tRPC errors; hides everything else. */
export function trustErrorToTrpc(error: unknown): never {
  if (error instanceof TrustError) throw new TRPCError({ code: error.code, message: error.message });
  if (error instanceof DeliveryUnavailableError) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Verification messages are not set up yet. Please try again later." });
  }
  // Postgres RAISE EXCEPTION (P0001) messages from our triggers are written for users.
  const pg = error as { code?: string; message?: string } | null;
  if (pg?.code === "P0001" && pg.message) throw new TRPCError({ code: "BAD_REQUEST", message: pg.message });
  if (error instanceof TRPCError) throw error;
  console.error("[trust]", error);
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Request failed" });
}

async function guard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    trustErrorToTrpc(error);
  }
}

const adminProcedure = supabaseProtectedProcedure.use(async ({ ctx, next }) => {
  if (!(await isAdmin(getPlanBoostDb(), ctx.homloUser.id))) throw new TRPCError({ code: "FORBIDDEN", message: "Admins only" });
  return next();
});

export type TrustStatus = Awaited<ReturnType<typeof getTrustStatus>>;

/** Everything the app needs to explain what is still missing before posting / paying. */
export async function getTrustStatus(userId: string) {
  const db = getPlanBoostDb();
  const { rows } = await db.query<{
    status: string;
    email: string | null;
    email_verified_at: Date | null;
    phone_verified_at: Date | null;
    marketing_opt_in: boolean;
    created_at: Date;
    has_consent: boolean;
    submitted: number;
    new_days: number | null;
    max_new: number | null;
    admin: boolean;
  }>(
    `select u.status, homlo_user_email(u.id) as email, u.email_verified_at, u.phone_verified_at, u.marketing_opt_in, u.created_at,
            homlo_has_current_signup_consent(u.id) as has_consent,
            (select count(*)::int from jobs where employer_id = u.id and first_submitted_at is not null) as submitted,
            trust_setting_int('new_account_days') as new_days,
            trust_setting_int('new_account_max_listings') as max_new,
            homlo_is_admin(u.id) as admin
       from users u where u.id = $1`,
    [userId],
  );
  const row = rows[0];
  if (!row) throw new TrustError("Account not found");
  const newDays = row.new_days ?? 7;
  const isNew = new Date(row.created_at).getTime() > Date.now() - newDays * 86_400_000;
  return {
    accountStatus: row.status,
    email: row.email,
    emailVerified: Boolean(row.email_verified_at),
    phoneVerified: Boolean(row.phone_verified_at),
    acceptedCurrentTerms: row.has_consent,
    marketingOptIn: row.marketing_opt_in,
    isNewAccount: isNew,
    newAccountListingsLeft: isNew ? Math.max(0, (row.max_new ?? 3) - row.submitted) : null,
    hasPostedBefore: row.submitted > 0,
    isAdmin: row.admin,
    legal: await getLegalVersions(db),
  };
}

const reportCategory = z.enum(["scam", "underage_user", "discrimination", "illegal", "other"]);

export const trustRouter = router({
  legalVersions: publicProcedure.query(() => guard(() => getLegalVersions(getPlanBoostDb()))),

  status: supabaseProtectedProcedure.query(({ ctx }) => guard(() => getTrustStatus(ctx.homloUser.id))),

  /** Existing users (or after a Terms update) re-accept the current versions. */
  acceptCurrentTerms: supabaseProtectedProcedure
    .input(z.object({ confirmAdultAndTerms: z.literal(true) }))
    .mutation(({ ctx }) =>
      guard(() => recordConsent(getPlanBoostDb(), { userId: ctx.homloUser.id, type: "signup", meta: requestMeta(ctx.req) })),
    ),

  setMarketing: supabaseProtectedProcedure.input(z.object({ optIn: z.boolean() })).mutation(({ ctx, input }) =>
    guard(async () => {
      const db = getPlanBoostDb();
      await recordConsent(db, { userId: ctx.homloUser.id, type: input.optIn ? "marketing_opt_in" : "marketing_opt_out", meta: requestMeta(ctx.req) });
      await db.query(`update users set marketing_opt_in = $2 where id = $1`, [ctx.homloUser.id, input.optIn]);
      return { optIn: input.optIn };
    }),
  ),

  verification: router({
    sendEmail: supabaseProtectedProcedure.mutation(({ ctx }) =>
      guard(async () => {
        await sendEmailVerification(getPlanBoostDb(), ctx.homloUser.id);
        return { sent: true };
      }),
    ),
    sendPhoneCode: supabaseProtectedProcedure.input(z.object({ phone: z.string().trim().min(6).max(20) })).mutation(({ ctx, input }) =>
      guard(async () => {
        await sendPhoneCode(getPlanBoostDb(), ctx.homloUser.id, input.phone);
        return { sent: true };
      }),
    ),
    verifyPhone: supabaseProtectedProcedure
      .input(z.object({ phone: z.string().trim().min(6).max(20), code: z.string().trim().regex(/^\d{6}$/) }))
      .mutation(({ ctx, input }) =>
        guard(async () => {
          await verifyPhoneCode(getPlanBoostDb(), ctx.homloUser.id, input.phone, input.code);
          return { verified: true };
        }),
      ),
  }),

  /** Live pre-check for the post-job form. Uses the SAME SQL rules as the database trigger. */
  checkListing: supabaseProtectedProcedure
    .input(z.object({ text: z.string().max(20_000) }))
    .query(({ input }) =>
      guard(async () => {
        const { rows } = await getPlanBoostDb().query<{ kind: string; label: string }>(`select * from homlo_check_listing_text($1)`, [input.text]);
        return {
          blocked: rows.filter((r) => r.kind !== "scam").map((r) => r.label),
          needsReview: rows.filter((r) => r.kind === "scam").map((r) => r.label),
        };
      }),
    ),

  report: supabaseProtectedProcedure
    .input(
      z.object({
        targetType: z.enum(["job", "user"]),
        targetId: z.string().uuid(),
        category: reportCategory,
        details: z.string().trim().max(1000).optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      guard(() =>
        createReport(getPlanBoostDb(), {
          reporterId: ctx.homloUser.id,
          targetType: input.targetType,
          targetId: input.targetId,
          category: input.category,
          details: input.details || null,
        }),
      ),
    ),

  /**
   * Checkout step 1: record the payment-terms consent. The database refuses
   * to create a payment row without a recent one (homlo_assert_payment_allowed).
   */
  acceptPaymentTerms: supabaseProtectedProcedure
    .input(
      z.object({
        accepted: z.literal(true),
        kind: z.enum(["boost", "subscription"]),
        jobId: z.string().uuid().optional(),
        productId: z.string().max(120).optional(),
        amountCents: z.number().int().nonnegative().optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      guard(async () => {
        const db = getPlanBoostDb();
        let listingTitle: string | null = null;
        if (input.jobId) {
          const job = await db.query<{ title: string }>(`select title from jobs where id = $1 and employer_id = $2`, [input.jobId, ctx.homloUser.id]);
          if (!job.rows[0]) throw new TrustError("Listing not found.");
          listingTitle = job.rows[0].title;
        }
        return recordConsent(db, {
          userId: ctx.homloUser.id,
          type: "payment_terms",
          meta: requestMeta(ctx.req),
          listingId: input.jobId ?? null,
          metadata: { kind: input.kind, productId: input.productId ?? null, amountCents: input.amountCents ?? null, listingTitle },
        });
      }),
    ),

  subscription: supabaseProtectedProcedure.query(({ ctx }) =>
    guard(async () => {
      const { rows } = await getPlanBoostDb().query<{
        plan: string;
        status: string;
        provider: string | null;
        current_period_end: Date | null;
        cancel_at_period_end: boolean;
      }>(`select plan, status, provider, current_period_end, cancel_at_period_end from subscriptions where user_id = $1`, [ctx.homloUser.id]);
      const sub = rows[0];
      if (!sub) return null;
      return {
        plan: sub.plan,
        status: sub.status,
        provider: sub.provider,
        renewsAt: sub.cancel_at_period_end || !sub.current_period_end ? null : new Date(sub.current_period_end).toISOString(),
        endsAt: sub.cancel_at_period_end && sub.current_period_end ? new Date(sub.current_period_end).toISOString() : null,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        // App Store / Google Play subscriptions can only be cancelled in the store.
        managedByStore: sub.provider === "revenuecat" || sub.provider === "app_store" || sub.provider === "play_store",
      };
    }),
  ),

  /** One-click cancel: stops renewal; the plan stays until the paid period ends. */
  cancelSubscription: supabaseProtectedProcedure.mutation(({ ctx }) =>
    guard(async () => {
      const db = getPlanBoostDb();
      const { rows } = await db.query<{ current_period_end: Date | null }>(
        `update subscriptions set cancel_at_period_end = true
          where user_id = $1 and plan <> 'free' and status = 'active'
          returning current_period_end`,
        [ctx.homloUser.id],
      );
      if (!rows[0]) throw new TrustError("You have no active paid subscription.");
      if (!rows[0].current_period_end) {
        // No known period end: end it now rather than keep charging.
        await db.query(`update subscriptions set plan = 'free', status = 'canceled', cancel_at_period_end = false where user_id = $1`, [ctx.homloUser.id]);
      }
      await db.query(
        `insert into audit_logs (actor_user_id, action, entity_type, entity_id) values ($1, 'subscription.cancelled', 'subscription', $1)`,
        [ctx.homloUser.id],
      );
      return { cancelled: true };
    }),
  ),

  resumeSubscription: supabaseProtectedProcedure.mutation(({ ctx }) =>
    guard(async () => {
      await getPlanBoostDb().query(`update subscriptions set cancel_at_period_end = false where user_id = $1 and current_period_end > now()`, [
        ctx.homloUser.id,
      ]);
      return { resumed: true };
    }),
  ),

  exportMyData: supabaseProtectedProcedure.mutation(({ ctx }) => guard(() => exportUserData(getPlanBoostDb(), ctx.homloUser.id))),

  /** Public: removed or banned users can no longer sign in, so this needs no session. */
  submitAppeal: publicProcedure
    .input(
      z.object({
        contactEmail: z.string().trim().email().max(320),
        targetType: z.enum(["job", "account"]),
        targetId: z.string().uuid().optional(),
        message: z.string().trim().min(10).max(4000),
      }),
    )
    .mutation(({ ctx, input }) =>
      guard(() =>
        submitAppeal(getPlanBoostDb(), {
          userId: ctx.homloUser?.id ?? null,
          contactEmail: input.contactEmail,
          targetType: input.targetType,
          targetId: input.targetId ?? null,
          message: input.message,
        }),
      ),
    ),

  admin: router({
    reviewQueue: adminProcedure.query(() => guard(() => listReviewQueue(getPlanBoostDb()))),
    reports: adminProcedure.query(() => guard(() => listOpenReports(getPlanBoostDb()))),
    appeals: adminProcedure.query(() => guard(() => listAppeals(getPlanBoostDb()))),
    history: adminProcedure
      .input(z.object({ targetType: z.enum(["job", "user", "report", "appeal"]), targetId: z.string().uuid() }))
      .query(({ input }) => guard(() => listActionHistory(getPlanBoostDb(), input.targetType, input.targetId))),
    act: adminProcedure
      .input(
        z.object({
          action: z.enum(["approve", "remove", "warn", "suspend", "ban", "reinstate", "dismiss_report"]),
          targetType: z.enum(["job", "user", "report"]),
          targetId: z.string().uuid(),
          reportId: z.string().uuid().optional(),
          reason: z.string().trim().min(3).max(2000),
        }),
      )
      .mutation(({ ctx, input }) => guard(() => takeAction(getPlanBoostDb(), { actorId: ctx.homloUser.id, ...input }))),
    decideAppeal: adminProcedure
      .input(z.object({ appealId: z.string().uuid(), upheld: z.boolean(), reason: z.string().trim().min(3).max(2000) }))
      .mutation(({ ctx, input }) => guard(() => decideAppeal(getPlanBoostDb(), { actorId: ctx.homloUser.id, ...input }))),
    chargebackEvidence: adminProcedure
      .input(z.object({ paymentRef: z.string().trim().min(3).max(200) }))
      .query(({ input }) => guard(() => chargebackEvidence(getPlanBoostDb(), input.paymentRef))),
  }),
});
