import {
  applicationPrecheck,
  ensureSubscription,
  getPlan,
  onBoostPaymentSucceeded,
  onJobWentLive,
  PlanBoostError,
  publishJob,
  purchaseBoost,
  type JobBoostState,
  type PlanBoostDb,
} from "./hlPlanBoostService";
import { boostCatalogForPlan, freeStandardBoostAvailable, type BoostPackageView } from "./hlPlanRules";

export type HandlerResponse = {
  status: number;
  body: Record<string, unknown>;
};

export type BoostPaymentWebhookInput = {
  boostId: string;
  paymentId: string;
};

export async function publishJobHandler(
  db: PlanBoostDb,
  userId: string | null | undefined,
  jobId: string,
  now: Date = new Date(),
): Promise<HandlerResponse> {
  try {
    if (!userId) throw new PlanBoostError("UNAUTHORIZED", "Authentication is required");
    const result = await publishJob(db, userId, jobId, now);
    return {
      status: 200,
      body: {
        job: serializeJob(result.job),
        posted: result.posted,
        usage: result.usage,
      },
    };
  } catch (error) {
    return errorResponse(error);
  }
}

export async function getMyPlanHandler(
  db: PlanBoostDb,
  userId: string | null | undefined,
  now: Date = new Date(),
): Promise<HandlerResponse> {
  try {
    if (!userId) throw new PlanBoostError("UNAUTHORIZED", "Authentication is required");
    const plan = await getPlan(db, userId, now);
    return { status: 200, body: { plan } };
  } catch (error) {
    return errorResponse(error);
  }
}

export async function boostCatalogHandler(
  db: PlanBoostDb,
  userId: string | null | undefined,
  now: Date = new Date(),
): Promise<HandlerResponse> {
  try {
    if (!userId) throw new PlanBoostError("UNAUTHORIZED", "Authentication is required");
    const subscription = await ensureSubscription(db, userId, now);
    const free = freeStandardBoostAvailable({
      plan: subscription.plan,
      freeStandardBoostUsedAt: subscription.freeStandardBoostUsedAt,
      periodStart: subscription.periodStart,
      periodEnd: subscription.periodEnd,
      now,
    });
    const packages = boostCatalogForPlan(subscription.plan, free);
    return { status: 200, body: { plan: subscription.plan, packages, freeStandardBoostAvailable: free } };
  } catch (error) {
    return errorResponse(error);
  }
}

export async function purchaseBoostHandler(
  db: PlanBoostDb,
  userId: string | null | undefined,
  jobId: string,
  packageId: string,
  now: Date = new Date(),
): Promise<HandlerResponse> {
  try {
    if (!userId) throw new PlanBoostError("UNAUTHORIZED", "Authentication is required");
    const result = await purchaseBoost(db, userId, jobId, packageId, now);
    return {
      status: 201,
      body: {
        boost: serializeBoost(result.boost),
        paymentRequired: result.paymentRequired,
        amountCents: result.amountCents,
        currency: result.currency,
      },
    };
  } catch (error) {
    return errorResponse(error);
  }
}

export async function applicationPrecheckHandler(
  db: PlanBoostDb,
  jobId: string,
  now: Date = new Date(),
  workerId: string | null = null,
): Promise<HandlerResponse> {
  try {
    const result = await applicationPrecheck(db, jobId, now, process.env, workerId);
    return { status: result.allowed ? 200 : 402, body: { ...result } };
  } catch (error) {
    return errorResponse(error);
  }
}

export async function boostPaymentWebhookHandler(
  db: PlanBoostDb,
  input: BoostPaymentWebhookInput,
  now: Date = new Date(),
): Promise<HandlerResponse> {
  try {
    if (!input.boostId || !input.paymentId) {
      throw new PlanBoostError("INVALID_INPUT", "boostId and paymentId are required");
    }
    const boost = await onBoostPaymentSucceeded(db, input.boostId, input.paymentId, now);
    return { status: 200, body: { boost: serializeBoost(boost) } };
  } catch (error) {
    return errorResponse(error);
  }
}

export async function jobWentLiveHandler(
  db: PlanBoostDb,
  jobId: string,
  now: Date = new Date(),
): Promise<HandlerResponse> {
  try {
    const boost = await onJobWentLive(db, jobId, now);
    return { status: 200, body: { boost: boost ? serializeBoost(boost) : null } };
  } catch (error) {
    return errorResponse(error);
  }
}

export function errorResponse(error: unknown): HandlerResponse {
  if (error instanceof PlanBoostError) {
    return {
      status: httpStatusForPlanBoostError(error.code),
      body: { error: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) },
    };
  }
  console.error("[plans] unhandled error", error);
  return { status: 500, body: { error: "INTERNAL_ERROR", message: "Internal error" } };
}

export function httpStatusForPlanBoostError(code: PlanBoostError["code"]): number {
  switch (code) {
    case "UNAUTHORIZED":
      return 401;
    case "FORBIDDEN":
      return 403;
    case "JOB_NOT_FOUND":
    case "BOOST_NOT_FOUND":
      return 404;
    case "ACTIVE_JOB_LIMIT":
    case "MONTHLY_POST_LIMIT":
    case "APPLICATION_LIMIT":
      return 402;
    case "BOOST_ALREADY_LIVE":
      return 409;
    case "UNKNOWN_PACKAGE":
    case "INVALID_INPUT":
      return 400;
    default:
      return 500;
  }
}

export function serializeBoost(boost: JobBoostState): Record<string, unknown> {
  return {
    id: boost.id,
    jobId: boost.jobId,
    packageId: boost.packageId,
    status: boost.status,
    priceCents: boost.priceCents,
    currency: boost.currency,
    paymentId: boost.paymentId,
    purchasedAt: boost.purchasedAt.toISOString(),
    startsAt: boost.startsAt?.toISOString() ?? null,
    endsAt: boost.endsAt?.toISOString() ?? null,
    paidAt: boost.paidAt?.toISOString() ?? null,
  };
}

export function serializeCatalog(packages: BoostPackageView[]): BoostPackageView[] {
  return packages.map((pkg) => ({ ...pkg }));
}

function serializeJob(job: { id: string; employerId: string; status: string; limitExempt: boolean; publishedAt: Date | null }) {
  return {
    id: job.id,
    employerId: job.employerId,
    status: job.status,
    limitExempt: job.limitExempt,
    publishedAt: job.publishedAt?.toISOString() ?? null,
  };
}
