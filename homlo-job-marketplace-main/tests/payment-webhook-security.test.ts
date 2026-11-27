import { afterEach, describe, expect, it, vi } from "vitest";
import { boostPaymentWebhookHandler, errorResponse } from "../server/hlPlanBoostHandlers";
import { PlanBoostError } from "../server/hlPlanBoostService";
import type { PlanBoostDb } from "../server/hlPlanBoostService";

function makeDb(boostRows: any[], jobRows: any[]): PlanBoostDb {
  return {
    query: async (text: string, params?: unknown[]) => {
      const rows: any[] = [];
      if (text.includes("job_boosts") && text.includes("where id = $1")) {
        rows.push(...boostRows.filter((b) => b.id === params?.[0]));
      } else if (text.includes("job_boosts") && text.includes("where job_id = $1")) {
        rows.push(...boostRows.filter((b) => b.job_id === params?.[0]));
      } else if (text.includes("jobs") && text.includes("where id = $1")) {
        rows.push(...jobRows.filter((j) => j.id === params?.[0]));
      } else if (text.includes("boosts") && text.includes("returning")) {
        rows.push({ ...boostRows[0], id: params?.[7] ?? "boost-new" });
      }
      return { rows };
    },
  };
}

const now = new Date("2026-11-14T12:00:00.000Z");

describe("boostPaymentWebhookHandler security", () => {
  it("rejects missing boostId and paymentId", async () => {
    const response = await boostPaymentWebhookHandler(
      makeDb([], []),
      { boostId: "", paymentId: "" },
      now,
    );
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("INVALID_INPUT");
  });

  it("rejects missing boostId only", async () => {
    const response = await boostPaymentWebhookHandler(
      makeDb([], []),
      { boostId: "", paymentId: "pay-1" },
      now,
    );
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("INVALID_INPUT");
  });

  it("rejects missing paymentId only", async () => {
    const response = await boostPaymentWebhookHandler(
      makeDb([], []),
      { boostId: "boost-1", paymentId: "" },
      now,
    );
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("INVALID_INPUT");
  });

  it("returns BOOST_NOT_FOUND for non-existent boost", async () => {
    const response = await boostPaymentWebhookHandler(
      makeDb([], []),
      { boostId: "boost-missing", paymentId: "pay-1" },
      now,
    );
    expect(response.status).toBe(404);
    expect(response.body.error).toBe("BOOST_NOT_FOUND");
  });

  it("does not activate an expired boost on payment success", async () => {
    const boostRows = [
      {
        id: "boost-1",
        job_id: "job-1",
        employer_id: "emp-1",
        package_id: "standard",
        status: "expired",
        price_cents: 999,
        currency: "USD",
        payment_id: null,
        purchased_at: now,
        paid_at: null,
        created_at: now,
        updated_at: now,
      },
    ];
    const jobRows = [
      { id: "job-1", employer_id: "emp-1", status: "open", deleted_at: null },
    ];
    const response = await boostPaymentWebhookHandler(
      makeDb(boostRows, jobRows),
      { boostId: "boost-1", paymentId: "pay-1" },
      now,
    );
    const boost = response.body.boost as { status: string };
    expect(response.status).toBe(200);
    expect(boost.status).toBe("expired");
  });

  it("does not activate a cancelled boost on payment success", async () => {
    const boostRows = [
      {
        id: "boost-1",
        job_id: "job-1",
        employer_id: "emp-1",
        package_id: "standard",
        status: "cancelled",
        price_cents: 999,
        currency: "USD",
        payment_id: null,
        purchased_at: now,
        paid_at: null,
        created_at: now,
        updated_at: now,
      },
    ];
    const jobRows = [
      { id: "job-1", employer_id: "emp-1", status: "open", deleted_at: null },
    ];
    const response = await boostPaymentWebhookHandler(
      makeDb(boostRows, jobRows),
      { boostId: "boost-1", paymentId: "pay-1" },
      now,
    );
    const boost = response.body.boost as { status: string };
    expect(response.status).toBe(200);
    expect(boost.status).toBe("cancelled");
  });

  it("maps PlanBoostError to stable HTTP responses", () => {
    expect(errorResponse(new PlanBoostError("UNAUTHORIZED", "no auth"))).toEqual({
      status: 401,
      body: { error: "UNAUTHORIZED", message: "no auth" },
    });
    expect(errorResponse(new PlanBoostError("FORBIDDEN", "not yours"))).toEqual({
      status: 403,
      body: { error: "FORBIDDEN", message: "not yours" },
    });
    expect(errorResponse(new PlanBoostError("BOOST_NOT_FOUND", "missing"))).toEqual({
      status: 404,
      body: { error: "BOOST_NOT_FOUND", message: "missing" },
    });
    expect(errorResponse(new Error("unexpected"))).toEqual({
      status: 500,
      body: { error: "INTERNAL_ERROR", message: "Internal error" },
    });
  });
});

describe("payment fail-closed integration", () => {
  const originalEnv = { APP_ENV: process.env.APP_ENV, MODE: process.env.HOMLO_PAYMENT_VERIFICATION_MODE };
  afterEach(() => {
    // Don't leak production settings into other tests.
    if (originalEnv.APP_ENV === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = originalEnv.APP_ENV;
    if (originalEnv.MODE === undefined) delete process.env.HOMLO_PAYMENT_VERIFICATION_MODE;
    else process.env.HOMLO_PAYMENT_VERIFICATION_MODE = originalEnv.MODE;
    vi.resetModules();
  });

  it("rejects payment when verifyPaymentResult returns failed", async () => {
    // Simulates the gateway's boost.verify-payment path: the client supplies
    // simulateResult=completed but production mode ignores it.
    // lib/paymentSession reads env at import time: set it first, then load a fresh copy.
    process.env.APP_ENV = "production";
    process.env.HOMLO_PAYMENT_VERIFICATION_MODE = "simulated";
    vi.resetModules();
    const { verifyPaymentResult } = await import("../lib/paymentSession");

    expect(verifyPaymentResult({ simulateResult: "completed" })).toBe("failed");
    expect(verifyPaymentResult({ provider: "aba_payway", providerEventId: "evt-1" })).toBe("failed");
  });

  it("rejects payment in webhook mode (real verification not implemented)", async () => {
    process.env.APP_ENV = "production";
    process.env.HOMLO_PAYMENT_VERIFICATION_MODE = "webhook";
    vi.resetModules();
    const { verifyPaymentResult } = await import("../lib/paymentSession");

    expect(verifyPaymentResult({ simulateResult: "completed" })).toBe("failed");
    expect(verifyPaymentResult({ provider: "aba_payway", providerEventId: "evt-1" })).toBe("failed");
  });
});
