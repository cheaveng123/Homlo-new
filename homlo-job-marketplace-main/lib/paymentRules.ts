// KEEP IN SYNC with supabase/functions/_shared/paymentRules.ts.
// This file is duplicated because the edge function cannot import files outside supabase/functions. Change both together.
export type SubscriptionPlan = "free" | "pro" | "enterprise";

export const SUBSCRIPTION_PLAN_PRICE_CENTS: Record<SubscriptionPlan, number> = {
  free: 0,
  pro: 1_999,
  enterprise: 49_900,
};

export class PaymentRuleError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "PaymentRuleError";
  }
}

export function isSubscriptionPlan(value: unknown): value is SubscriptionPlan {
  return value === "free" || value === "pro" || value === "enterprise";
}

export function serverSubscriptionAmount(plan: SubscriptionPlan, clientAmount?: unknown): number {
  const expectedCents = SUBSCRIPTION_PLAN_PRICE_CENTS[plan];
  if (clientAmount !== undefined && clientAmount !== null) {
    if (typeof clientAmount !== "number" || !Number.isFinite(clientAmount)) {
      throw new PaymentRuleError("Subscription amount does not match plan price", 400);
    }
    if (Math.round(clientAmount * 100) !== expectedCents) {
      throw new PaymentRuleError("Subscription amount does not match plan price", 400);
    }
  }
  return expectedCents / 100;
}

export type BoostPackageRow = {
  id?: string;
  price_cents?: number;
  pro_price_cents?: number;
  active?: boolean;
};

export function serverBoostAmountCents(
  packageRow: BoostPackageRow | null | undefined,
  isPro: boolean,
  _clientAmount?: unknown,
): number {
  if (!packageRow || packageRow.active === false) {
    throw new PaymentRuleError("Unknown or inactive boost package", 400);
  }
  const cents = isPro ? packageRow.pro_price_cents : packageRow.price_cents;
  if (typeof cents !== "number" || !Number.isInteger(cents) || cents <= 0) {
    throw new PaymentRuleError("Boost package price is not configured", 400);
  }
  return cents;
}

export type BoostJobRow = {
  id?: string;
  employer_id?: string;
  status?: string;
  deleted_at?: string | null;
};

export function assertBoostCreateOwner(job: BoostJobRow | null | undefined, userId: string): void {
  if (!job?.id) throw new PaymentRuleError("Job not found", 404);
  if (job.employer_id !== userId) {
    throw new PaymentRuleError("Only the listing employer can boost this job", 403);
  }
  if (job.deleted_at || job.status !== "open") {
    throw new PaymentRuleError("Only live jobs can be boosted", 400);
  }
}

export type PaymentOwnershipRow = {
  id?: string;
  user_id?: string;
};

export function assertPaymentOwner(payment: PaymentOwnershipRow | null | undefined, userId: string): void {
  if (!payment?.id || payment.user_id !== userId) {
    throw new PaymentRuleError("Boost payment not found", 404);
  }
}
