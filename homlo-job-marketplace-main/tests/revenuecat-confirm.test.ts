import { describe, expect, it, vi } from "vitest";

import { confirmPurchaseWithRevenueCat, findStoreTransaction } from "../server/revenuecatWebhook";

// vi.mock is hoisted above the imports by Vitest.
vi.mock("../server/homlo-direct-service", () => ({ getHomloDirectService: vi.fn() }));
vi.mock("../server/plan-boost-db", () => ({ getPlanBoostDb: vi.fn() }));

const TOKEN = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";

function purchaseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "row-1",
    purchase_token: TOKEN,
    user_id: USER,
    job_id: "33333333-3333-4333-8333-333333333333",
    plan_id: "standard",
    product_id: "homlo_boost_standard",
    rc_event_id: null,
    rc_transaction_id: null,
    status: "pending",
    price_cents: 999,
    currency: "USD",
    boost_id: null,
    failure_reason: null,
    ...overrides,
  };
}

function fakeDb(row: Record<string, unknown> | null) {
  return { query: vi.fn(async () => ({ rows: row ? [row] : [] })) };
}

function rcResponse(body: unknown, ok = true, status = 200) {
  return vi.fn(async () => ({ ok, status, json: async () => body })) as unknown as typeof fetch;
}

describe("findStoreTransaction", () => {
  const payload = {
    subscriber: {
      non_subscriptions: {
        homlo_boost_standard: [
          { id: "rc-1", store_transaction_id: "test_123_abc", purchase_date: "2026-11-16T10:00:00Z" },
        ],
      },
    },
  };

  it("matches by store transaction id", () => {
    const found = findStoreTransaction(payload, "homlo_boost_standard", "test_123_abc");
    expect(found?.transactionId).toBe("test_123_abc");
    expect(found?.purchasedAt.toISOString()).toBe("2026-11-16T10:00:00.000Z");
  });

  it("does not match another product or an unknown transaction", () => {
    expect(findStoreTransaction(payload, "homlo_boost_maximum", "test_123_abc")).toBeNull();
    expect(findStoreTransaction(payload, "homlo_boost_standard", "someone-else")).toBeNull();
  });
});

describe("confirmPurchaseWithRevenueCat", () => {
  const input = { userId: USER, purchaseToken: TOKEN, transactionId: "test_123_abc" };

  it("refuses when the server secret key is not configured", async () => {
    const result = await confirmPurchaseWithRevenueCat(fakeDb(purchaseRow()) as never, input, { secretKey: "", trustTestStore: false });
    expect(result).toEqual({ ok: false, status: 503, error: "REVENUECAT_SECRET_NOT_CONFIGURED" });
  });

  it("returns 404 for a purchase that isn't this user's", async () => {
    const result = await confirmPurchaseWithRevenueCat(fakeDb(null) as never, input, { secretKey: "sk_test", trustTestStore: false });
    expect(result).toEqual({ ok: false, status: 404, error: "NOT_FOUND" });
  });

  it("treats an already-activated purchase as done without calling RevenueCat", async () => {
    const fetchImpl = rcResponse({});
    const result = await confirmPurchaseWithRevenueCat(
      fakeDb(purchaseRow({ status: "activated", boost_id: "boost-9" })) as never,
      input,
      { secretKey: "sk_test", fetchImpl, trustTestStore: false },
    );
    expect(result).toEqual({ ok: true, result: { status: "duplicate", purchaseId: "row-1", boostId: "boost-9" } });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("asks the app to retry while RevenueCat hasn't recorded the transaction", async () => {
    const fetchImpl = rcResponse({ subscriber: { non_subscriptions: {} } });
    const result = await confirmPurchaseWithRevenueCat(fakeDb(purchaseRow()) as never, input, { secretKey: "sk_test", fetchImpl, trustTestStore: false });
    expect(result).toEqual({ ok: false, status: 409, error: "NOT_CONFIRMED_YET" });
    expect(fetchImpl).toHaveBeenCalledWith(
      `https://api.revenuecat.com/v1/subscribers/${USER}`,
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer sk_test" }) }),
    );
  });
});

describe("confirmPurchaseWithRevenueCat fallback matching", () => {
  it("does not accept a purchase made before the intent was created", async () => {
    const db = { query: vi.fn(async () => ({ rows: [purchaseRow({ created_at: "2026-11-16T12:00:00Z" })] })) };
    const fetchImpl = rcResponse({
      subscriber: {
        non_subscriptions: {
          homlo_boost_standard: [{ id: "old", store_transaction_id: "old_tx", purchase_date: "2026-11-15T09:00:00Z" }],
        },
      },
    });
    const result = await confirmPurchaseWithRevenueCat(
      db as never,
      { userId: USER, purchaseToken: TOKEN, transactionId: "client_side_id" },
      { secretKey: "sk_test", fetchImpl, trustTestStore: false },
    );
    expect(result).toEqual({ ok: false, status: 409, error: "NOT_CONFIRMED_YET" });
  });

  it("skips a recent purchase another boost already claimed", async () => {
    const db = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [purchaseRow({ created_at: "2026-11-16T12:00:00Z" })] })
        .mockResolvedValueOnce({ rows: [{ id: "other-row" }] }),
    };
    const fetchImpl = rcResponse({
      subscriber: {
        non_subscriptions: {
          homlo_boost_standard: [{ id: "new", store_transaction_id: "taken_tx", purchase_date: "2026-11-16T12:00:30Z" }],
        },
      },
    });
    const result = await confirmPurchaseWithRevenueCat(
      db as never,
      { userId: USER, purchaseToken: TOKEN, transactionId: "client_side_id" },
      { secretKey: "sk_test", fetchImpl, trustTestStore: false },
    );
    expect(result).toEqual({ ok: false, status: 409, error: "NOT_CONFIRMED_YET" });
  });
});

describe("confirmPurchaseWithRevenueCat in Test Store mode", () => {
  const input = { userId: USER, purchaseToken: TOKEN, transactionId: "test_store_tx" };

  it("does not need the secret key and never calls RevenueCat", async () => {
    const fetchImpl = rcResponse({});
    const db = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [purchaseRow()] })
        .mockResolvedValueOnce({ rows: [{ id: "other-row" }] }),
    };
    const result = await confirmPurchaseWithRevenueCat(db as never, input, { secretKey: "", fetchImpl, trustTestStore: true });
    // The transaction was already claimed by another purchase, so it is refused.
    expect(result).toEqual({ ok: false, status: 409, error: "TRANSACTION_ALREADY_USED" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
