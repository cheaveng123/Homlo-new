import express from "express";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";

import type { PlanBoostDb } from "../server/hlPlanBoostService";
import { processRevenueCatEvent, registerRevenueCatRoutes } from "../server/revenuecatWebhook";

const employerId = "11111111-1111-4111-8111-111111111111";
const jobId = "33333333-3333-4333-8333-333333333333";
const token = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

type FakePurchase = {
  id: string;
  purchase_token: string;
  user_id: string | null;
  job_id: string | null;
  plan_id: string | null;
  product_id: string;
  rc_event_id: string | null;
  rc_transaction_id: string | null;
  status: string;
  price_cents: number;
  currency: string;
  boost_id: string | null;
  failure_reason: string | null;
  raw_event?: string | null;
  purchased_at?: Date | null;
};

function normalize(statement: string): string {
  return statement.replace(/\s+/g, " ").trim();
}

async function postWebhookWithAuth(
  configured: string | undefined,
): Promise<{ status: number; body: { error?: string; message?: string } }> {
  const previous = process.env.REVENUECAT_WEBHOOK_AUTH;
  if (configured === undefined) {
    delete process.env.REVENUECAT_WEBHOOK_AUTH;
  } else {
    process.env.REVENUECAT_WEBHOOK_AUTH = configured;
  }

  const app = express();
  app.use(express.json());
  registerRevenueCatRoutes(app);
  const server = app.listen(0);

  try {
    await new Promise<void>((resolve, reject) => {
      server.once("listening", () => resolve());
      server.once("error", reject);
    });
    const { port } = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${port}/api/webhooks/revenuecat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event: { id: "evt-auth-check", type: "TEST" } }),
    });
    return { status: response.status, body: (await response.json()) as { error?: string; message?: string } };
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    if (previous === undefined) {
      delete process.env.REVENUECAT_WEBHOOK_AUTH;
    } else {
      process.env.REVENUECAT_WEBHOOK_AUTH = previous;
    }
  }
}

class FakeBoostDb implements PlanBoostDb {
  purchases: FakePurchase[] = [];
  boosts: { id: string; payment_id: string; status: string }[] = [];
  tickCalls = 0;

  seedIntent(overrides: Partial<FakePurchase> = {}): FakePurchase {
    const row: FakePurchase = {
      id: "intent-1",
      purchase_token: token,
      user_id: employerId,
      job_id: jobId,
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
    this.purchases.push(row);
    return row;
  }

  async query<T = Record<string, unknown>>(
    statement: string,
    parameters: unknown[] = [],
  ): Promise<{ rows: T[] }> {
    const text = normalize(statement);
    const params = parameters;
    const rows = this.handle(text, params);
    return { rows: rows as T[] };
  }

  async transaction<T>(work: (database: PlanBoostDb) => Promise<T>): Promise<T> {
    return work(this);
  }

  private handle(text: string, params: unknown[]): unknown[] {
    if (text.startsWith("select * from public.revenuecat_boost_purchases where purchase_token")) {
      return this.purchases.filter((row) => row.purchase_token === params[0]);
    }

    if (text.startsWith("select * from public.revenuecat_boost_purchases where user_id = $1 and product_id = $2")) {
      return this.purchases.filter(
        (row) => row.user_id === params[0] && row.product_id === params[1] && row.status === "pending",
      );
    }

    if (text.startsWith("insert into public.revenuecat_boost_purchases (rc_event_id")) {
      const eventId = params[0] as string;
      const transactionId = params[1] as string | null;
      if (
        this.purchases.some(
          (row) => row.rc_event_id === eventId || (transactionId && row.rc_transaction_id === transactionId),
        )
      ) {
        return [];
      }

      const row: FakePurchase = {
        id: `unmatched-${this.purchases.length + 1}`,
        purchase_token: `bbbbbbbb-bbbb-4bbb-8bbb-${String(this.purchases.length + 1).padStart(12, "0")}`,
        user_id: params[2] as string | null,
        job_id: null,
        plan_id: params[5] as string | null,
        product_id: params[4] as string,
        rc_event_id: eventId,
        rc_transaction_id: transactionId,
        status: "unmatched",
        price_cents: params[6] as number,
        currency: params[7] as string,
        boost_id: null,
        failure_reason: null,
        purchased_at: params[8] as Date,
        raw_event: params[9] as string,
      };
      this.purchases.push(row);
      return [row];
    }

    if (text.startsWith("select id, status, boost_id from public.revenuecat_boost_purchases where rc_event_id")) {
      const eventId = params[0] as string;
      const transactionId = params[1] as string | null;
      return this.purchases.filter(
        (row) => row.rc_event_id === eventId || (transactionId && row.rc_transaction_id === transactionId),
      );
    }

    if (text.startsWith("select * from public.revenuecat_boost_purchases where id = $1 for update")) {
      return this.purchases.filter((row) => row.id === params[0]);
    }

    if (text.startsWith("update public.revenuecat_boost_purchases set status = 'purchased'")) {
      const row = this.purchases.find((candidate) => candidate.id === params[8]);
      if (!row) return [];
      row.status = "purchased";
      row.rc_event_id = params[2] as string;
      row.rc_transaction_id = params[3] as string | null;
      row.price_cents = params[4] as number;
      row.currency = params[5] as string;
      row.purchased_at = params[6] as Date;
      row.raw_event = params[7] as string;
      return [row];
    }

    if (text.startsWith("select id from public.jobs")) {
      return [{ id: jobId }];
    }

    if (text.startsWith("with base as")) {
      const paymentId = params[6] as string;
      if (this.boosts.some((boost) => boost.payment_id === paymentId)) return [];
      const boost = {
        id: `boost-${this.boosts.length + 1}`,
        payment_id: paymentId,
        status: "active",
        start_at: new Date(),
        expires_at: new Date(),
      };
      this.boosts.push(boost);
      return [boost];
    }

    if (text.startsWith("select id from public.boosts where payment_id")) {
      return this.boosts.filter((boost) => boost.payment_id === params[0]);
    }

    if (text.startsWith("update public.revenuecat_boost_purchases set status = 'activated'")) {
      const row = this.purchases.find((candidate) => candidate.id === params[1]);
      if (!row) return [];
      row.status = "activated";
      row.boost_id = params[0] as string;
      return [row];
    }

    if (text.startsWith("select * from public.boost_tick()")) {
      this.tickCalls += 1;
      return [{ activated: 1, expired: 0, notified_started: 1, notified_ended: 0 }];
    }

    if (text.startsWith("update public.revenuecat_boost_purchases set status = 'failed'")) {
      const row = this.purchases.find((candidate) => candidate.id === params[1]);
      if (row && row.status !== "activated") {
        row.status = "failed";
        row.failure_reason = params[0] as string;
      }
      return [];
    }

    if (text.startsWith("update public.revenuecat_boost_purchases set status = 'refunded'")) {
      const transactionId = params[1] as string | null;
      const eventId = params[2] as string;
      const row = this.purchases.find(
        (candidate) =>
          (transactionId && candidate.rc_transaction_id === transactionId) || candidate.rc_event_id === eventId,
      );
      if (!row) return [];
      row.status = "refunded";
      return [{ id: row.id, boost_id: row.boost_id }];
    }

    if (text.startsWith("update public.boosts")) {
      const boost = this.boosts.find((candidate) => candidate.id === params[0]);
      if (boost) boost.status = "cancelled";
      return [];
    }

    throw new Error(`Unhandled fake SQL: ${text}`);
  }
}

function purchaseBody(eventId = "evt-1", transactionId = "tx-1") {
  return {
    event: {
      id: eventId,
      type: "NON_RENEWING_PURCHASE",
      app_user_id: employerId,
      product_id: "homlo_boost_standard",
      transaction_id: transactionId,
      purchased_at_ms: Date.UTC(2026, 10, 16, 12, 0, 0),
      price_in_purchased_currency: 9.99,
      currency: "USD",
      subscriber_attributes: {
        homlo_boost_token: { value: token },
      },
    },
  };
}

describe("RevenueCat boost webhook", () => {
  it("disables the webhook when the auth secret is missing", async () => {
    const result = await postWebhookWithAuth(undefined);

    expect(result.status).toBe(503);
    expect(result.body.error).toBe("WEBHOOK_DISABLED");
    expect(result.body.message).toContain("missing");
  });

  it("disables the webhook when the auth secret is still a placeholder", async () => {
    const result = await postWebhookWithAuth("PASTE_A_LONG_RANDOM_VALUE_HERE");

    expect(result.status).toBe(503);
    expect(result.body.error).toBe("WEBHOOK_DISABLED");
    expect(result.body.message).toContain("placeholder");
  });

  it("activates the canonical boost once and treats a duplicate delivery as a no-op", async () => {
    const db = new FakeBoostDb();
    db.seedIntent();

    const first = await processRevenueCatEvent(db, purchaseBody());
    const duplicate = await processRevenueCatEvent(db, purchaseBody());

    expect(first.status).toBe("activated");
    expect(first.boostId).toBe("boost-1");
    expect(duplicate.status).toBe("duplicate");
    expect(db.boosts).toHaveLength(1);
    expect(db.tickCalls).toBe(1);
  });

  it("stores an unmatched event instead of dropping it", async () => {
    const db = new FakeBoostDb();

    const first = await processRevenueCatEvent(db, purchaseBody("evt-unmatched", "tx-unmatched"));
    const duplicate = await processRevenueCatEvent(db, purchaseBody("evt-unmatched", "tx-unmatched"));

    expect(first.status).toBe("unmatched");
    expect(duplicate.status).toBe("unmatched");
    expect(db.purchases).toHaveLength(1);
    expect(db.purchases[0].status).toBe("unmatched");
    expect(db.boosts).toHaveLength(0);
  });

  it("cancels the activated boost when RevenueCat sends a refund", async () => {
    const db = new FakeBoostDb();
    const intent = db.seedIntent({
      status: "activated",
      boost_id: "boost-1",
      rc_transaction_id: "tx-refund",
      rc_event_id: "evt-purchase",
    });
    db.boosts.push({ id: "boost-1", payment_id: intent.id, status: "active" });

    const result = await processRevenueCatEvent(db, {
      event: {
        id: "evt-refund",
        type: "REFUND",
        app_user_id: employerId,
        product_id: "homlo_boost_standard",
        transaction_id: "tx-refund",
      },
    });

    expect(result.status).toBe("refunded");
    expect(intent.status).toBe("refunded");
    expect(db.boosts[0].status).toBe("cancelled");
  });
});
