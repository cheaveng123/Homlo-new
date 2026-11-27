import { trpcDirect } from "@/lib/trpc";
import { BOOST_PLANS, type BoostPlanId } from "@/lib/boostData";

export type PayMethod = "apple_pay" | "google_pay" | "card";
export type FailReason = "declined" | "insufficient_funds" | "cancelled" | "network";
export type PayResult = { ok: true; receiptId: string } | { ok: false; reason: FailReason };

export type BoostPaymentInput = {
  jobId: string;
  planId: string;
  amount: number;
  method: PayMethod;
};

export interface BoostPaymentService {
  pay(input: BoostPaymentInput): Promise<PayResult>;
}

export const mock = { failWith: null as FailReason | null };

const PAYMENT_PROVIDER = "aba_payway";
const wait = (duration: number) => new Promise<void>((resolve) => setTimeout(resolve, duration));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function findString(value: unknown, keys: string[]): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findString(item, keys);
      if (found) return found;
    }
    return null;
  }
  if (!isRecord(value)) return null;
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.length > 0) return candidate;
  }
  for (const key of ["boost", "payment", "data", "result"]) {
    const found = findString(value[key], keys);
    if (found) return found;
  }
  return null;
}

function findStatus(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findStatus(item);
      if (found) return found;
    }
    return null;
  }
  if (!isRecord(value)) return null;
  for (const key of ["status", "payment_status"]) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.length > 0) return candidate;
  }
  for (const key of ["boost", "payment", "data", "result"]) {
    const found = findStatus(value[key]);
    if (found) return found;
  }
  return null;
}

function isBoostPlanId(value: string): value is BoostPlanId {
  return BOOST_PLANS.some((plan) => plan.id === value);
}

function reasonFromStatus(status: string | null): FailReason {
  const normalized = status?.toLowerCase() ?? "";
  if (normalized.includes("cancel")) return "cancelled";
  if (normalized.includes("insufficient") || normalized.includes("fund")) return "insufficient_funds";
  return "declined";
}

function reasonFromError(error: unknown): FailReason {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (message.includes("cancel")) return "cancelled";
  if (message.includes("insufficient") || message.includes("fund")) return "insufficient_funds";
  if (message.includes("network") || message.includes("offline") || message.includes("timeout") || message.includes("connection")) return "network";
  return "declined";
}

export const boostPayments: BoostPaymentService = {
  async pay(input) {
    if (mock.failWith) {
      await wait(1200);
      return { ok: false, reason: mock.failWith };
    }
    if (!input.jobId || !isBoostPlanId(input.planId) || !Number.isFinite(input.amount) || input.amount <= 0) {
      return { ok: false, reason: "network" };
    }

    try {
      const created = await trpcDirect.homlo.boost.create.mutate({
        jobId: input.jobId,
        package: input.planId,
        amount: input.amount,
        currency: "USD",
        provider: PAYMENT_PROVIDER,
      });
      const paymentId = findString(created, ["payment_id", "paymentId"]);
      if (!paymentId) return { ok: false, reason: "network" };

      const verified = await trpcDirect.homlo.boost.verifyPayment.mutate({ paymentId });
      const status = findStatus(verified);
      if (status !== "completed") return { ok: false, reason: reasonFromStatus(status) };
      const receiptId = findString(verified, ["provider_transaction_id", "providerTransactionId"]) ?? paymentId;
      return { ok: true, receiptId };
    } catch (error) {
      return { ok: false, reason: reasonFromError(error) };
    }
  },
};
