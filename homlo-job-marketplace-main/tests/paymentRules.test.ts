import { describe, expect, it } from "vitest";
import {
  assertBoostCreateOwner,
  assertPaymentOwner,
  PaymentRuleError,
  serverBoostAmountCents,
  serverSubscriptionAmount,
} from "../lib/paymentRules";

describe("boost payment pricing", () => {
  const standard = { id: "standard", price_cents: 999, pro_price_cents: 799, active: true };

  it("charges the catalog price and ignores any client-supplied amount", () => {
    const clientPayload = { amount: 0.01 };
    const amountCents = serverBoostAmountCents(standard, false, clientPayload.amount);
    expect(amountCents).toBe(999);
    expect(amountCents).not.toBe(Math.round(clientPayload.amount * 100));
  });

  it("charges the pro catalog price for active pro accounts", () => {
    expect(serverBoostAmountCents(standard, true)).toBe(799);
  });

  it("rejects unknown, inactive, or unpriced packages", () => {
    expect(() => serverBoostAmountCents(null, false)).toThrow(PaymentRuleError);
    expect(() => serverBoostAmountCents({ ...standard, active: false }, false)).toThrow("Unknown or inactive");
    expect(() => serverBoostAmountCents({ id: "standard" }, false)).toThrow("price is not configured");
  });
});

describe("boost ownership", () => {
  const job = { id: "job-a", employer_id: "user-a", status: "open", deleted_at: null };

  it("allows the listing employer to boost a live job", () => {
    expect(() => assertBoostCreateOwner(job, "user-a")).not.toThrow();
  });

  it("denies user B boosting user A's job", () => {
    expect(() => assertBoostCreateOwner(job, "user-b")).toThrow("Only the listing employer");
  });

  it("denies boosting a closed or deleted job", () => {
    expect(() => assertBoostCreateOwner({ ...job, status: "closed" }, "user-a")).toThrow("Only live jobs");
    expect(() => assertBoostCreateOwner({ ...job, deleted_at: "2026-01-01" }, "user-a")).toThrow("Only live jobs");
  });
});

describe("payment ownership", () => {
  it("allows the payer to verify their own payment", () => {
    expect(() => assertPaymentOwner({ id: "payment-a", user_id: "user-a" }, "user-a")).not.toThrow();
  });

  it("denies user B verifying user A's payment", () => {
    expect(() => assertPaymentOwner({ id: "payment-a", user_id: "user-a" }, "user-b")).toThrow(
      "Boost payment not found",
    );
    expect(() => assertPaymentOwner(null, "user-b")).toThrow("Boost payment not found");
  });
});

describe("subscription payment pricing", () => {
  it("accepts matching plan amounts and returns the server price", () => {
    expect(serverSubscriptionAmount("pro", 19.99)).toBe(19.99);
    expect(serverSubscriptionAmount("enterprise", 499)).toBe(499);
  });

  it("uses the server price when the client omits an amount", () => {
    expect(serverSubscriptionAmount("pro")).toBe(19.99);
    expect(serverSubscriptionAmount("enterprise")).toBe(499);
  });

  it("rejects client amount mismatches", () => {
    expect(() => serverSubscriptionAmount("pro", 0.01)).toThrow("does not match plan price");
    expect(() => serverSubscriptionAmount("enterprise", 19.99)).toThrow("does not match plan price");
    expect(() => serverSubscriptionAmount("pro", "19.99")).toThrow("does not match plan price");
  });
});
