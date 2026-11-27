import { timingSafeEqual } from "node:crypto";
import type { Express, Request, Response } from "express";

import { planIdForProductId, productIdForPlan, type BoostProductPlanId } from "../lib/boost-products";
import { clientMayDecidePayment } from "../lib/paymentSession";
import { activateBoostInTransaction, boostTick, BoostError } from "./boost/boostService";
import { getHomloDirectService } from "./homlo-direct-service";
import type { PlanBoostDb, Queryable } from "./hlPlanBoostService";
import { getPlanBoostDb } from "./plan-boost-db";

const PURCHASE_EVENT_TYPES = new Set(["NON_RENEWING_PURCHASE", "INITIAL_PURCHASE"]);
const REFUND_EVENT_TYPES = new Set(["REFUND"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RevenueCatEvent = {
  id?: unknown;
  type?: unknown;
  app_user_id?: unknown;
  original_app_user_id?: unknown;
  product_id?: unknown;
  transaction_id?: unknown;
  original_transaction_id?: unknown;
  purchased_at_ms?: unknown;
  event_timestamp_ms?: unknown;
  price?: unknown;
  price_in_purchased_currency?: unknown;
  currency?: unknown;
  subscriber_attributes?: unknown;
  [key: string]: unknown;
};

type RevenueCatBody = {
  event?: RevenueCatEvent;
  subscriber_attributes?: unknown;
  [key: string]: unknown;
};

type PurchaseRow = {
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
  created_at?: string | Date;
};

export type RevenueCatProcessResult = {
  status: "activated" | "duplicate" | "unmatched" | "failed" | "refunded" | "ignored";
  purchaseId?: string;
  boostId?: string;
  reason?: string;
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function isUuid(value: string | null): value is string {
  return Boolean(value && UUID_PATTERN.test(value));
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function priceToCents(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

function attributesFrom(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  const output: Record<string, string> = {};

  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === "string") {
      output[key] = raw;
      continue;
    }
    if (raw && typeof raw === "object" && "value" in raw) {
      const attributeValue = (raw as { value?: unknown }).value;
      if (typeof attributeValue === "string") output[key] = attributeValue;
    }
  }

  return output;
}

function parseDateMs(value: unknown, fallback: Date): Date {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

async function withTransaction<T>(db: PlanBoostDb, fn: (tx: Queryable) => Promise<T>): Promise<T> {
  if (db.transaction) return db.transaction(fn);
  await db.query("begin");
  try {
    const result = await fn(db);
    await db.query("commit");
    return result;
  } catch (error) {
    await db.query("rollback").catch(() => undefined);
    throw error;
  }
}

async function recordUnmatched(
  db: PlanBoostDb,
  eventId: string,
  transactionId: string | null,
  appUserId: string | null,
  originalAppUserId: string | null,
  productId: string,
  planId: BoostProductPlanId | null,
  priceCents: number,
  currency: string,
  purchasedAt: Date,
  raw: string,
): Promise<RevenueCatProcessResult> {
  const inserted = await db.query<PurchaseRow>(
    `insert into public.revenuecat_boost_purchases
       (rc_event_id, rc_transaction_id, rc_app_user_id, rc_original_app_user_id,
        product_id, plan_id, status, price_cents, currency, purchased_at, raw_event)
     values ($1, $2, $3, $4, $5, $6, 'unmatched', $7, $8, $9, $10::jsonb)
     on conflict do nothing
     returning id, status`,
    [
      eventId,
      transactionId,
      // user_id is a uuid column; anonymous RC ids (e.g. $RCAnonymousID:…)
      // belong only in rc_app_user_id.
      isUuid(appUserId) ? appUserId : null,
      originalAppUserId,
      productId,
      planId,
      priceCents,
      currency,
      purchasedAt,
      raw,
    ],
  );

  if (inserted.rows[0]) {
    return { status: "unmatched", purchaseId: inserted.rows[0].id };
  }

  const existing = await db.query<PurchaseRow>(
    `select id, status, boost_id
       from public.revenuecat_boost_purchases
      where rc_event_id = $1 or ($2::text is not null and rc_transaction_id = $2)
      limit 1`,
    [eventId, transactionId],
  );
  const row = existing.rows[0];
  if (!row) return { status: "duplicate" };
  return {
    status: row.status === "activated" ? "duplicate" : "unmatched",
    purchaseId: row.id,
    boostId: row.boost_id ?? undefined,
  };
}

async function findIntent(
  db: PlanBoostDb,
  attributes: Record<string, string>,
  appUserId: string | null,
  productId: string,
): Promise<PurchaseRow | null> {
  const token = attributes.homlo_boost_token ?? null;
  if (isUuid(token)) {
    const byToken = await db.query<PurchaseRow>(
      `select *
         from public.revenuecat_boost_purchases
        where purchase_token = $1
        limit 1`,
      [token],
    );
    if (byToken.rows[0]) return byToken.rows[0];
  }

  if (!isUuid(appUserId)) return null;

  // Attribute delivery is best-effort. Fall back to the newest recent pending
  // intent for this RevenueCat user + product.
  const byPending = await db.query<PurchaseRow>(
    `select *
       from public.revenuecat_boost_purchases
      where user_id = $1
        and product_id = $2
        and status = 'pending'
        and created_at > now() - interval '2 hours'
      order by created_at desc
      limit 1`,
    [appUserId, productId],
  );
  return byPending.rows[0] ?? null;
}

async function activateMatchedPurchase(
  db: PlanBoostDb,
  row: PurchaseRow,
  eventId: string,
  transactionId: string | null,
  appUserId: string | null,
  originalAppUserId: string | null,
  planId: BoostProductPlanId,
  priceCents: number,
  currency: string,
  purchasedAt: Date,
  raw: string,
): Promise<RevenueCatProcessResult> {
  try {
    const result = await withTransaction(db, async (tx) => {
      const locked = await tx.query<PurchaseRow>(
        `select *
           from public.revenuecat_boost_purchases
          where id = $1
          for update`,
        [row.id],
      );
      const purchase = locked.rows[0];
      if (!purchase) return { status: "unmatched" as const };

      if (purchase.status === "activated") {
        return {
          status: "duplicate" as const,
          purchaseId: purchase.id,
          boostId: purchase.boost_id ?? undefined,
        };
      }
      if (purchase.status === "failed" || purchase.status === "refunded") {
        return {
          status: purchase.status === "refunded" ? ("refunded" as const) : ("failed" as const),
          purchaseId: purchase.id,
          reason: purchase.failure_reason ?? "INACTIVE_PURCHASE",
        };
      }
      if (!purchase.user_id || !purchase.job_id) {
        throw new BoostError("INTENT_INCOMPLETE", "Purchase intent is missing its user or job");
      }
      const jobId = purchase.job_id;
      const employerUserId = purchase.user_id;

      const updated = await tx.query<PurchaseRow>(
        `update public.revenuecat_boost_purchases
            set status = 'purchased',
                rc_app_user_id = $1,
                rc_original_app_user_id = $2,
                rc_event_id = coalesce(rc_event_id, $3),
                rc_transaction_id = coalesce(rc_transaction_id, $4),
                price_cents = $5,
                currency = $6,
                purchased_at = coalesce(purchased_at, $7),
                raw_event = $8::jsonb
          where id = $9
          returning *`,
        [
          appUserId,
          originalAppUserId,
          eventId,
          transactionId,
          priceCents,
          currency,
          purchasedAt,
          raw,
          purchase.id,
        ],
      );
      const purchased = updated.rows[0];
      if (!purchased) return { status: "unmatched" as const };

      const boost = await activateBoostInTransaction(tx, {
        paymentId: purchased.id,
        jobId,
        employerUserId,
        planKey: planId,
        pricePaidCents: priceCents > 0 ? priceCents : purchased.price_cents,
      });

      let boostId = boost?.id ?? null;
      if (!boostId) {
        const existingBoost = await tx.query<{ id: string }>(
          `select id from public.boosts where payment_id = $1 limit 1`,
          [purchased.id],
        );
        boostId = existingBoost.rows[0]?.id ?? null;
      }
      if (!boostId) {
        throw new BoostError("BOOST_ACTIVATION_FAILED", "Boost activation did not create a row");
      }

      await tx.query(
        `update public.revenuecat_boost_purchases
            set status = 'activated',
                boost_id = $1,
                activated_at = coalesce(activated_at, now()),
                failure_reason = null
          where id = $2`,
        [boostId, purchased.id],
      );

      return {
        status: "activated" as const,
        purchaseId: purchased.id,
        boostId,
      };
    });

    if (result.status === "activated") {
      try {
        await boostTick(db);
      } catch (error) {
        // The boost is already committed and will still be swept/ranked; do not
        // report the whole webhook as failed just because notifications lagged.
        console.error("[revenuecat webhook] boost tick failed", error);
      }
    }
    return result;
  } catch (error) {
    // Unexpected/infrastructure errors must bubble up so RevenueCat retries.
    // Only known business rejections are terminal for this payment.
    if (!(error instanceof BoostError)) {
      console.error("[revenuecat webhook] boost activation error", {
        purchaseId: row.id,
        eventId,
        error,
      });
      throw error;
    }

    console.error("[revenuecat webhook] boost activation rejected", {
      purchaseId: row.id,
      eventId,
      reason: error.code,
    });

    await db.query(
      `update public.revenuecat_boost_purchases
          set status = 'failed',
              failure_reason = $1
        where id = $2 and status <> 'activated'`,
      [error.code, row.id],
    );

    return { status: "failed", purchaseId: row.id, reason: error.code };
  }
}

/**
 * Idempotently records a RevenueCat event and, for a matched boost purchase,
 * activates the canonical public.boosts row. Exported for tests.
 */
// ---------------------------------------------------------------------------
// Direct confirmation (no webhook wait)
// ---------------------------------------------------------------------------
// Right after the store sheet succeeds, the app asks the server to confirm the
// purchase. The server checks RevenueCat's REST API with the SECRET key (the
// client can't fake this) and activates the boost through the same
// activateMatchedPurchase path the webhook uses, so a later webhook for the
// same purchase is a harmless duplicate.

type RevenueCatSubscriberResponse = {
  subscriber?: {
    non_subscriptions?: Record<string, { id?: string; store_transaction_id?: string; purchase_date?: string }[]>;
  };
};

/** Finds the store transaction for this product in a RevenueCat subscriber payload. */
export function findStoreTransaction(
  payload: RevenueCatSubscriberResponse,
  productId: string,
  transactionId: string,
): { transactionId: string; purchasedAt: Date } | null {
  const purchases = payload.subscriber?.non_subscriptions?.[productId] ?? [];
  const match = purchases.find(
    (purchase) => purchase.store_transaction_id === transactionId || purchase.id === transactionId,
  );
  if (!match) return null;
  const purchasedAt = match.purchase_date ? new Date(match.purchase_date) : new Date();
  return {
    transactionId: match.store_transaction_id ?? match.id ?? transactionId,
    purchasedAt: Number.isNaN(purchasedAt.getTime()) ? new Date() : purchasedAt,
  };
}

export type ConfirmResult =
  | { ok: true; result: RevenueCatProcessResult }
  | { ok: false; status: number; error: string };

export async function confirmPurchaseWithRevenueCat(
  db: PlanBoostDb,
  input: { userId: string; purchaseToken: string; transactionId: string },
  deps: { secretKey?: string; fetchImpl?: typeof fetch; trustTestStore?: boolean } = {},
): Promise<ConfirmResult> {
  const secretKey = (deps.secretKey ?? process.env.REVENUECAT_SECRET_API_KEY ?? "").trim();
  const hasSecret = Boolean(secretKey) && !secretKey.startsWith("PASTE_");
  // Local development with the RevenueCat Test Store: no secret key and no
  // reachable webhook, so the store's own "purchase succeeded" is treated as
  // the payment processor. Only when APP_ENV=development and
  // HOMLO_PAYMENT_VERIFICATION_MODE=simulated; never in production.
  const trustTestStore = deps.trustTestStore ?? clientMayDecidePayment();
  if (!hasSecret && !trustTestStore) {
    return { ok: false, status: 503, error: "REVENUECAT_SECRET_NOT_CONFIGURED" };
  }

  const rows = await db.query<PurchaseRow>(
    `select * from public.revenuecat_boost_purchases where purchase_token = $1 and user_id = $2 limit 1`,
    [input.purchaseToken, input.userId],
  );
  const row = rows.rows[0];
  if (!row) return { ok: false, status: 404, error: "NOT_FOUND" };
  if (row.status === "activated") {
    return { ok: true, result: { status: "duplicate", purchaseId: row.id, boostId: row.boost_id ?? undefined } };
  }
  if (row.status === "failed" || row.status === "refunded") {
    return { ok: true, result: { status: row.status, purchaseId: row.id, reason: row.failure_reason ?? undefined } };
  }

  const planId = planIdForProductId(row.product_id);
  if (!planId) return { ok: false, status: 400, error: "NOT_A_BOOST_PRODUCT" };

  if (trustTestStore) {
    const claimed = await db.query<{ id: string }>(
      `select id from public.revenuecat_boost_purchases where rc_transaction_id = $1 and id <> $2 limit 1`,
      [input.transactionId, row.id],
    );
    if (claimed.rows.length > 0) return { ok: false, status: 409, error: "TRANSACTION_ALREADY_USED" };
    const result = await activateMatchedPurchase(
      db,
      row,
      `test-store:${input.transactionId}`,
      input.transactionId,
      input.userId,
      null,
      planId,
      row.price_cents,
      row.currency,
      new Date(),
      JSON.stringify({ source: "test-store", transactionId: input.transactionId }),
    );
    return { ok: true, result };
  }

  const fetchImpl = deps.fetchImpl ?? fetch;
  const response = await fetchImpl(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(input.userId)}`,
    { headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" } },
  );
  if (!response.ok) return { ok: false, status: 502, error: `REVENUECAT_${response.status}` };
  const payload = (await response.json()) as RevenueCatSubscriberResponse;

  let found = findStoreTransaction(payload, row.product_id, input.transactionId);
  if (!found) {
    // Fallback: some stores (e.g. RevenueCat Web/Test Store in Expo Go) record a
    // different transaction id than the client sees. Accept the newest purchase
    // of this exact product made after this intent was created, as long as no
    // other boost has already claimed that transaction.
    const createdMs = row.created_at ? new Date(row.created_at).getTime() : Number.NaN;
    const candidates = (payload.subscriber?.non_subscriptions?.[row.product_id] ?? [])
      .filter((purchase) => purchase.purchase_date && !Number.isNaN(createdMs) && Date.parse(purchase.purchase_date) >= createdMs - 120_000)
      .sort((a, b) => Date.parse(b.purchase_date ?? "") - Date.parse(a.purchase_date ?? ""));
    for (const candidate of candidates) {
      const candidateTx = candidate.store_transaction_id ?? candidate.id;
      if (!candidateTx) continue;
      const claimed = await db.query<{ id: string }>(
        `select id from public.revenuecat_boost_purchases where rc_transaction_id = $1 and id <> $2 limit 1`,
        [candidateTx, row.id],
      );
      if (claimed.rows.length === 0) {
        found = { transactionId: candidateTx, purchasedAt: new Date(candidate.purchase_date ?? Date.now()) };
        break;
      }
    }
  }
  // Not visible yet: RevenueCat may still be processing the receipt. The app retries.
  if (!found) return { ok: false, status: 409, error: "NOT_CONFIRMED_YET" };

  const result = await activateMatchedPurchase(
    db,
    row,
    `confirm:${found.transactionId}`,
    found.transactionId,
    input.userId,
    null,
    planId,
    row.price_cents,
    row.currency,
    found.purchasedAt,
    JSON.stringify({ source: "client-confirm", transactionId: found.transactionId }),
  );
  return { ok: true, result };
}

export async function processRevenueCatEvent(
  db: PlanBoostDb,
  body: RevenueCatBody,
  now: Date = new Date(),
): Promise<RevenueCatProcessResult> {
  const event = body?.event;
  const eventType = asString(event?.type);
  const eventId = asString(event?.id);
  if (!event || !eventType || !eventId) {
    throw new Error("INVALID_REVENUECAT_EVENT");
  }

  // Dashboard “Send test event” and unrelated RC events should succeed without
  // creating a boost.
  if (eventType === "TEST" || (!PURCHASE_EVENT_TYPES.has(eventType) && !REFUND_EVENT_TYPES.has(eventType))) {
    return { status: "ignored" };
  }

  const appUserId = asString(event.app_user_id);
  const originalAppUserId = asString(event.original_app_user_id);
  const productId = asString(event.product_id);
  const transactionId =
    asString(event.transaction_id) ??
    asString(event.original_transaction_id) ??
    null;
  const attributes = {
    ...attributesFrom(body?.subscriber_attributes),
    ...attributesFrom(event.subscriber_attributes),
  };
  const raw = JSON.stringify(body);

  if (REFUND_EVENT_TYPES.has(eventType)) {
    if (!transactionId && !productId) return { status: "ignored" };

    const refunded = await db.query<PurchaseRow>(
      `update public.revenuecat_boost_purchases
          set status = 'refunded',
              raw_event = $1::jsonb
        where ($2::text is not null and rc_transaction_id = $2)
           or ($3::text is not null and rc_event_id = $3)
        returning id, boost_id`,
      [raw, transactionId, eventId],
    );
    const row = refunded.rows[0];
    if (!row) return { status: "ignored" };

    if (row.boost_id) {
      await db.query(
        `update public.boosts
            set status = 'cancelled', updated_at = now()
          where id = $1 and status in ('scheduled', 'active')`,
        [row.boost_id],
      );
    }

    return { status: "refunded", purchaseId: row.id, boostId: row.boost_id ?? undefined };
  }

  if (!productId) throw new Error("INVALID_REVENUECAT_PRODUCT");
  const planId = planIdForProductId(productId);
  const priceCents =
    priceToCents(event.price_in_purchased_currency) ??
    priceToCents(event.price) ??
    0;
  const currency = asString(event.currency) ?? "USD";
  const purchasedAt = parseDateMs(
    event.purchased_at_ms ?? event.event_timestamp_ms,
    now,
  );

  if (!planId) {
    return recordUnmatched(
      db,
      eventId,
      transactionId,
      appUserId,
      originalAppUserId,
      productId,
      null,
      priceCents,
      currency,
      purchasedAt,
      raw,
    );
  }

  const intent = await findIntent(db, attributes, appUserId, productId);
  if (!intent) {
    return recordUnmatched(
      db,
      eventId,
      transactionId,
      appUserId,
      originalAppUserId,
      productId,
      planId,
      priceCents,
      currency,
      purchasedAt,
      raw,
    );
  }

  // The intent token is unguessable, but still refuse to activate a different
  // account's intent when RevenueCat gives us a normal user id.
  if (isUuid(appUserId) && intent.user_id && intent.user_id !== appUserId) {
    return recordUnmatched(
      db,
      eventId,
      transactionId,
      appUserId,
      originalAppUserId,
      productId,
      planId,
      priceCents,
      currency,
      purchasedAt,
      raw,
    );
  }

  return activateMatchedPurchase(
    db,
    intent,
    eventId,
    transactionId,
    appUserId,
    originalAppUserId,
    planId,
    priceCents,
    currency,
    purchasedAt,
    raw,
  );
}

async function resolveUserId(req: Request): Promise<string | null> {
  const service = getHomloDirectService();
  const token = service.getAccessToken(req);
  if (!token) return null;
  try {
    const user = await service.resolveSession(token);
    return user.id;
  } catch {
    return null;
  }
}

export function registerRevenueCatRoutes(app: Express) {
  // Create a short-lived intent BEFORE the store sheet opens. The intent token
  // is written into RevenueCat subscriber attributes so the webhook can match
  // the event even if two boosts are bought close together.
  app.post("/api/revenuecat/boost-intents", async (req: Request, res: Response) => {
    const userId = await resolveUserId(req);
    if (!userId) {
      res.status(401).json({ error: "UNAUTHORIZED", message: "Sign in to buy a boost" });
      return;
    }

    const jobId = asString(req.body?.jobId);
    const planId = asString(req.body?.planId);
    const requestedProductId = asString(req.body?.productId);

    if (!jobId || !planId) {
      res.status(400).json({ error: "INVALID_REQUEST", message: "jobId and planId are required" });
      return;
    }
    if (!isUuid(jobId)) {
      res.status(400).json({ error: "INVALID_REQUEST", message: "jobId must be a UUID" });
      return;
    }

    const expectedProductId = productIdForPlan(planId);
    if (!expectedProductId) {
      res.status(400).json({ error: "INVALID_PLAN", message: "Unknown boost plan" });
      return;
    }

    const productId = requestedProductId ?? expectedProductId;
    if (planIdForProductId(productId) !== planId) {
      res.status(400).json({ error: "INVALID_PRODUCT", message: "Product does not match the boost plan" });
      return;
    }

    const db = getPlanBoostDb();

    const job = await db.query<{ id: string }>(
      `select id
         from public.jobs
        where id = $1
          and employer_id = $2
          and status = 'open'
          and deleted_at is null`,
      [jobId, userId],
    );
    if (job.rows.length === 0) {
      res.status(404).json({ error: "JOB_NOT_BOOSTABLE", message: "Job is closed, filled, or not yours" });
      return;
    }

    const plan = await db.query<{ price_cents: number }>(
      `select price_cents from public.boost_packages where id = $1 and active = true`,
      [planId],
    );
    if (plan.rows.length === 0) {
      res.status(400).json({ error: "INVALID_PLAN", message: "Unknown or inactive boost plan" });
      return;
    }

    // The database refuses this insert unless the user agreed to the payment
    // terms in the last few minutes (trust.acceptPaymentTerms) and the
    // new-account spend cap allows it (057_trust_safety.sql).
    let inserted: { rows: { purchase_token: string }[] };
    try {
      inserted = await db.query<{ purchase_token: string }>(
        `insert into public.revenuecat_boost_purchases
           (user_id, job_id, plan_id, product_id, price_cents, currency)
         values ($1, $2, $3, $4, $5, 'USD')
         returning purchase_token`,
        [userId, jobId, planId, productId, plan.rows[0].price_cents],
      );
    } catch (error) {
      const pg = error as { code?: string; message?: string } | null;
      if (pg?.code === "P0001" && pg.message) {
        res.status(402).json({ error: "PAYMENT_NOT_ALLOWED", message: pg.message });
        return;
      }
      throw error;
    }

    res.status(201).json({
      purchaseToken: inserted.rows[0].purchase_token,
      productId,
      planId,
      priceCents: plan.rows[0].price_cents,
      currency: "USD",
    });
  });

  // The paywall polls this after purchase so it can show “activated” only when
  // the webhook has actually written the public.boosts row.
  app.get("/api/revenuecat/boost-purchases/:token", async (req: Request, res: Response) => {
    const userId = await resolveUserId(req);
    if (!userId) {
      res.status(401).json({ error: "UNAUTHORIZED" });
      return;
    }

    const token = asString(req.params.token);
    if (!isUuid(token)) {
      res.status(400).json({ error: "INVALID_TOKEN" });
      return;
    }

    const db = getPlanBoostDb();
    const result = await db.query<{
      purchase_token: string;
      status: string;
      boost_id: string | null;
      job_id: string | null;
      plan_id: string | null;
      failure_reason: string | null;
    }>(
      `select purchase_token, status, boost_id, job_id, plan_id, failure_reason
         from public.revenuecat_boost_purchases
        where purchase_token = $1 and user_id = $2
        limit 1`,
      [token, userId],
    );

    const row = result.rows[0];
    if (!row) {
      res.status(404).json({ error: "NOT_FOUND" });
      return;
    }

    res.json({
      purchaseToken: row.purchase_token,
      status: row.status,
      boostId: row.boost_id,
      jobId: row.job_id,
      planId: row.plan_id,
      failureReason: row.failure_reason,
    });
  });

  // Fast path: confirm a just-finished store purchase directly with
  // RevenueCat and activate the boost immediately, instead of waiting for the
  // webhook. Safe to call repeatedly.
  app.post("/api/revenuecat/boost-purchases/:token/confirm", async (req: Request, res: Response) => {
    const userId = await resolveUserId(req);
    if (!userId) {
      res.status(401).json({ error: "UNAUTHORIZED" });
      return;
    }
    const token = asString(req.params.token);
    const transactionId = asString((req.body as { transactionId?: unknown } | undefined)?.transactionId);
    if (!isUuid(token) || !transactionId) {
      res.status(400).json({ error: "INVALID_REQUEST" });
      return;
    }
    try {
      const confirmed = await confirmPurchaseWithRevenueCat(getPlanBoostDb(), { userId, purchaseToken: token, transactionId });
      console.log("[revenuecat confirm]", {
        token,
        outcome: confirmed.ok ? confirmed.result.status : confirmed.error,
        boostId: confirmed.ok ? confirmed.result.boostId ?? null : null,
      });
      if (!confirmed.ok) {
        res.status(confirmed.status).json({ error: confirmed.error });
        return;
      }
      const { result } = confirmed;
      const status =
        result.status === "activated" || result.status === "duplicate"
          ? "activated"
          : result.status === "refunded"
            ? "refunded"
            : result.status === "failed"
              ? "failed"
              : "pending";
      res.json({ status, boostId: result.boostId ?? null });
    } catch (error) {
      console.error("[revenuecat confirm] failed", error);
      res.status(500).json({ error: "CONFIRM_FAILED" });
    }
  });

  app.post("/api/webhooks/revenuecat", async (req: Request, res: Response) => {
    const expected = process.env.REVENUECAT_WEBHOOK_AUTH?.trim();
    if (!expected || expected.startsWith("PASTE_")) {
      res.status(503).json({
        error: "WEBHOOK_DISABLED",
        message:
          "REVENUECAT_WEBHOOK_AUTH is missing or still a placeholder. " +
          "Generate one with `openssl rand -hex 32`, then set the same value here " +
          "and in the RevenueCat webhook Authorization header.",
      });
      return;
    }

    const provided = req.header("authorization") ?? "";
    if (!safeEqual(provided, expected)) {
      res.status(401).json({ error: "UNAUTHORIZED", message: "Invalid webhook authorization" });
      return;
    }

    try {
      const result = await processRevenueCatEvent(getPlanBoostDb(), req.body);
      res.status(200).json({ ok: true, ...result });
    } catch (error) {
      console.error("[revenuecat webhook] failed", error);
      res.status(500).json({ ok: false, error: "WEBHOOK_PROCESSING_FAILED" });
    }
  });
}
