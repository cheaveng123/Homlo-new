/* eslint-disable-next-line import/no-unresolved -- jsr: specifiers are resolved by the Deno edge runtime, not the Node resolver */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

type AuthUser = { id: string; email?: string | null; user_metadata?: { full_name?: string | null; name?: string | null } };

type WorkerApplicationRow = {
  id: string;
  job_id: string;
  status: string;
  message: string | null;
  created_at: string;
  updated_at: string;
  job_title: string;
  job_location_text: string | null;
  employer_id: string;
  employer_name: string | null;
  banner_image: string | null;
  pay_amount: number | string | null;
  pay_currency: string | null;
  pay_type: string | null;
  work_arrangement: string | null;
};

// Payment verification is normally performed by a provider webhook that the
// server confirms against a shared secret. This gateway has no live merchant
// credentials, so verification in this deployment is "simulated": it still
// runs through the same idempotent, payment-status-gated SQL path and only
// activates a boost after a completed payment row exists. Swap
// HOMLO_PAYMENT_VERIFICATION_MODE to "webhook" and route calls through a signed
// callback handler once ABA PayWay / Stripe credentials are configured.
//
// Production safety: if HOMLO_PAYMENT_VERIFICATION_MODE is "simulated" (or
// unset) while APP_ENV is "production", the gateway refuses to activate any
// boost or subscription. Payments fail closed — a missing or misconfigured
// provider must never result in free activation. In development, simulated
// mode is allowed and simulateResult may be set by the client.
import { verifyPaymentResult } from "../_shared/paymentSession.ts";
import {
  assertBoostCreateOwner,
  assertPaymentOwner,
  isSubscriptionPlan,
  PaymentRuleError,
  serverBoostAmountCents,
  serverSubscriptionAmount,
  type BoostJobRow,
  type BoostPackageRow,
  type PaymentOwnershipRow,
  type SubscriptionPlan,
} from "../_shared/paymentRules.ts";

const WORK_ARRANGEMENTS: readonly string[] = ["On-site", "Hybrid", "Remote"];

function normalizeWorkArrangement(value: unknown): string | null {
  return typeof value === "string" && WORK_ARRANGEMENTS.includes(value) ? value : null;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

function loadSecretKey(): string {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!raw) throw new Error("SUPABASE_SECRET_KEYS is not set");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("SUPABASE_SECRET_KEYS is not valid JSON");
  }
  const key = (parsed as Record<string, unknown> | null)?.default;
  if (typeof key !== "string" || !key.startsWith("sb_secret_")) {
    throw new Error('SUPABASE_SECRET_KEYS needs a "default" entry starting with sb_secret_');
  }
  return key;
}

const SECRET_KEY = loadSecretKey();

const RPC_TIMEOUT_MS = 30_000;

/** Fetch with an AbortController-based timeout; rejects after deadline. */
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/** An error whose message was written for end users (for example a SQL RAISE EXCEPTION). */
class SafeError extends Error {}

/** PostgREST reports a plain RAISE EXCEPTION as SQLSTATE P0001. Only those messages may reach clients. */
function dbError(body: unknown, fallback: string): Error {
  const b = body as { code?: unknown; message?: unknown } | null;
  if (b?.code === "P0001" && typeof b.message === "string") return new SafeError(b.message);
  return new Error(fallback);
}

function fail(message: string, status = 400) {
  return json({ error: message }, status);
}

async function getVerifiedUser(request: Request): Promise<AuthUser | null> {
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const response = await fetchWithTimeout(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SECRET_KEY, Authorization: authorization },
  }, RPC_TIMEOUT_MS);
  if (!response.ok) return null;
  return (await response.json()) as AuthUser;
}

async function rpc<T>(name: string, input: Record<string, unknown>): Promise<T> {
  const response = await fetchWithTimeout(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: SECRET_KEY,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(input),
  }, RPC_TIMEOUT_MS);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Supabase service request failed" }));
    console.error("[homlo-service-gateway:rpc] database call failed", {
      name,
      status: response.status,
      statusText: response.statusText,
      response: error,
    });
    throw dbError(error, "Supabase service request failed");
  }
  return (await response.json()) as T;
}

async function rest<T>(path: string, opts: { method?: string; body?: unknown; query?: Record<string, string> } = {}): Promise<T> {
  const qs = opts.query ? `?${new URLSearchParams(opts.query).toString()}` : "";
  const response = await fetchWithTimeout(`${SUPABASE_URL}/rest/v1/${path}${qs}`, {
    method: opts.method ?? "GET",
    headers: {
      apikey: SECRET_KEY,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  }, RPC_TIMEOUT_MS);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: `Supabase REST ${opts.method ?? "GET"} ${path} failed` }));
    console.error("[homlo-service-gateway:rest] database call failed", {
      path,
      method: opts.method ?? "GET",
      status: response.status,
      statusText: response.statusText,
      response: error,
    });
    throw dbError(error, `Supabase REST request failed (${response.status})`);
  }
  return (await response.json()) as T;
}

async function createSubscriptionPayment(
  accountId: string,
  plan: Exclude<SubscriptionPlan, "free">,
  payload: Record<string, unknown>,
): Promise<{ id: string; status: string } | null> {
  const amount = serverSubscriptionAmount(plan, payload.amount);
  const currency = typeof payload.currency === "string" ? payload.currency : "USD";
  const provider = typeof payload.provider === "string" ? payload.provider : "aba_payway";
  const created = await rpc<Array<{ id: string; status: string }>>("homlo_create_subscription_payment", {
    p_user_id: accountId,
    p_plan: plan,
    p_amount: amount,
    p_currency: currency,
    p_provider: provider,
  });
  const paymentRow = Array.isArray(created) ? created[0] : created;
  if (!paymentRow?.id) throw new PaymentRuleError("Unable to create the subscription payment", 400);

  const providerEventId =
    typeof payload.providerEventId === "string" && payload.providerEventId.length > 0
      ? payload.providerEventId
      : `plan-${paymentRow.id}`;
  const verification = await rpc<Array<{ id: string; status: string }>>("homlo_record_payment_webhook", {
    p_provider: provider,
    p_provider_event_id: providerEventId,
    p_provider_transaction_id:
      typeof payload.providerTransactionId === "string" ? payload.providerTransactionId : null,
    p_payment_id: paymentRow.id,
    p_result: verifyPaymentResult(payload),
  });
  const payment = Array.isArray(verification) ? verification[0] : verification;
  return payment?.id ? payment : null;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return fail("Method not allowed", 405);
  const user = await getVerifiedUser(request);
  if (!user) return fail("Unauthorized", 401);

  try {
    const { action, payload = {} } = await request.json() as { action?: string; payload?: Record<string, unknown> };
    const session = async () => {
      const account = await rpc<Array<{ user_id: string; user_status: string; profile_complete: boolean; profile_role: string | null; profile_full_name: string | null }>>(
        "homlo_resolve_authenticated_user",
        { p_provider: "supabase", p_provider_user_id: user.id },
      );
      const resolved = account[0];
      if (!resolved) throw new SafeError("Unable to resolve the Homlo account");
      return {
        id: resolved.user_id,
        status: resolved.user_status,
        profileComplete: resolved.profile_complete,
        role: resolved.profile_role,
        fullName: resolved.profile_full_name ?? user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
        email: user.email ?? null,
      };
    };

    if (action === "session") return json(await session());

    const account = await session();
    if (account.status !== "active") return fail("This Homlo account is unavailable", 403);

    if (action === "account.get") {
      const accountInfo = await rpc<Array<{ user_id: string; role: string; full_name: string; phone: string | null; bio: string | null; location_text: string | null; latitude: number | null; longitude: number | null; profile_photo_key: string | null; verified: boolean; plan: string; plan_status: string }>>(
        "homlo_get_account",
        { p_user_id: account.id },
      );
      const resolvedAccount = accountInfo[0] ?? null;
      let recentActivity: { application_count: number; posted_job_count: number } | null = null;
      if (resolvedAccount) {
        const activity = await rpc<Array<{ application_count: number; posted_job_count: number }>>("homlo_get_recent_activity", { p_user_id: account.id });
        recentActivity = activity[0] ?? null;
      }
      return json({ account: resolvedAccount, recentActivity });
    }

    if (action === "subscription.upsert") {
      const plan = payload.plan;
      if (!isSubscriptionPlan(plan)) return fail("Invalid subscription plan", 400);
      if (plan !== "free") {
        const payment = await createSubscriptionPayment(account.id, plan, payload);
        if (payment?.status !== "completed") return fail("Payment was not completed", 402);
      }
      const subscription = await rpc("homlo_upsert_subscription", { p_user_id: account.id, p_plan: plan });
      return json({ subscription });
    }

    if (action === "subscription.purchase") {
      const plan = payload.plan;
      if (!isSubscriptionPlan(plan)) return fail("Invalid subscription plan", 400);
      if (plan === "free") {
        const subscription = await rpc("homlo_upsert_subscription", { p_user_id: account.id, p_plan: plan });
        return json({ payment: null, subscription });
      }
      const payment = await createSubscriptionPayment(account.id, plan, payload);
      if (payment?.status !== "completed") return fail("Payment was not completed", 402);
      const subscription = await rpc("homlo_upsert_subscription", { p_user_id: account.id, p_plan: plan });
      return json({ payment, subscription });
    }

    if (action === "profile.upsert") {
      const profile = await rpc("homlo_upsert_profile", {
        p_user_id: account.id,
        p_role: payload.role,
        p_full_name: payload.fullName,
        p_phone: payload.phone ?? null,
        p_bio: payload.bio ?? null,
        p_location_text: payload.locationText ?? null,
        p_latitude: payload.latitude ?? null,
        p_longitude: payload.longitude ?? null,
      });
      let mediaProfile = profile;
      if (payload.profilePhotoKey != null || payload.bannerImage != null) {
        mediaProfile = await rpc("homlo_upsert_profile_media", {
          p_user_id: account.id,
          p_profile_photo_key: payload.profilePhotoKey ?? null,
          p_banner_image: payload.bannerImage ?? null,
        });
      }
      return json({ profile: mediaProfile });
    }

    if (action === "profile.get") {
      const profile = await rpc("homlo_get_profile", { p_user_id: account.id });
      return json({ profile });
    }

    if (action === "application.submit") {
      const application = await rpc("homlo_submit_application", {
        p_worker_id: account.id,
        p_job_id: payload.jobId,
        p_message: payload.message ?? null,
      });
      return json({ application });
    }

    if (action === "application.for-job") {
      const application = await rpc("homlo_get_application_for_worker", {
        p_worker_id: account.id,
        p_job_id: payload.jobId,
      });
      // Guard against Postgres null-composite: language sql functions declared
      // as RETURNS <table> (not SETOF) return an all-null object when no row
      // matches, not a true SQL NULL. Explicitly normalize to null here so the
      // client contract (application: null = no application) holds.
      const normalized = application?.id ? application : null;
      return json({ application: normalized });
    }

    if (action === "application.list") {
      const applications = await rpc<WorkerApplicationRow[]>("homlo_list_worker_applications_detailed", {
        p_worker_id: account.id,
      });
      return json({ applications });
    }

    if (action === "application.change-status") {
      const application = await rpc("homlo_change_application_status", {
        p_actor_id: account.id,
        p_application_id: payload.applicationId,
        p_target_status: payload.status,
      });
      return json({ application });
    }

    // Read receipt for an application. Separate from change-status on purpose:
    // opening an applicant should not push them along the pipeline, and this is
    // idempotent, so the client can fire it freely and roll back on failure.
    if (action === "application.mark-viewed") {
      const rows = await rpc<Record<string, unknown>[]>("homlo_mark_application_viewed", {
        p_actor_id: account.id,
        p_application_id: payload.applicationId,
      });
      return json({ application: rows[0] ?? null });
    }

    if (action === "employer.jobs") {
      const jobs = await rpc("homlo_list_employer_jobs_with_boosts", { p_employer_id: account.id });
      return json({ jobs });
    }

    if (action === "employer.save-job") {
      const job = await rpc("homlo_save_job", {
        p_employer_id: account.id,
        p_job_id: payload.jobId ?? null,
        p_category_id: payload.categoryId ?? null,
        p_title: payload.title,
        p_description: payload.description,
        p_pay_amount: payload.payAmount,
        p_pay_currency: payload.payCurrency ?? "USD",
        p_pay_type: payload.payType,
        p_location_text: payload.locationText ?? null,
        p_latitude: payload.latitude ?? null,
        p_longitude: payload.longitude ?? null,
        p_workers_needed: payload.workersNeeded ?? 1,
        p_status: payload.status ?? "draft",
        p_address_line: payload.addressLine ?? null,
        p_city: payload.city ?? null,
        p_district: payload.district ?? null,
        p_province: payload.province ?? null,
        p_country: payload.country ?? null,
        p_postal_code: payload.postalCode ?? null,
        p_banner_image: payload.bannerImage ?? null,
        p_requirements: payload.requirements ?? null,
        p_auto_close_enabled: typeof payload.autoCloseEnabled === "boolean" ? payload.autoCloseEnabled : null,
        p_work_arrangement: normalizeWorkArrangement(payload.workArrangement),
      });
      return json({ job });
    }

    if (action === "employer.set-auto-close") {
      const jobId = typeof payload.jobId === "string" ? payload.jobId : null;
      if (!jobId) return fail("jobId is required", 400);
      const job = await rpc("homlo_set_job_auto_close", {
        p_employer_id: account.id,
        p_job_id: jobId,
        p_auto_close_enabled: payload.autoCloseEnabled === false ? false : true,
      });
      return json({ job });
    }

    if (action === "employer.delete-job") {
      const jobId = await rpc<string>("homlo_delete_job", {
        p_employer_id: account.id,
        p_job_id: payload.jobId,
      });
      return json({ jobId });
    }

    if (action === "employer.soft-delete-job") {
      const jobId = await rpc<string>("homlo_soft_delete_job", {
        p_employer_id: account.id,
        p_job_id: payload.jobId,
      });
      return json({ jobId });
    }

    if (action === "employer.applications") {
      const applications = await rpc("homlo_list_employer_applications_detailed", {
        p_employer_id: account.id,
        p_job_id: payload.jobId,
      });
      return json({ applications });
    }

    // ------------------------------------------------------------------
    // Messaging
    // ------------------------------------------------------------------

    if (action === "messaging.conversations") {
      const conversations = await rpc("homlo_list_conversations", { p_user_id: account.id });
      return json({ conversations });
    }

    if (action === "messaging.conversation") {
      const applicationId = typeof payload.applicationId === "string" ? payload.applicationId : null;
      if (!applicationId) return fail("applicationId is required", 400);
      const conversation = await rpc("homlo_get_or_create_conversation", {
        p_actor_id: account.id,
        p_application_id: applicationId,
      });
      return json({ conversation });
    }

    if (action === "messaging.messages") {
      const conversationId = typeof payload.conversationId === "string" ? payload.conversationId : null;
      if (!conversationId) return fail("conversationId is required", 400);
      const messages = await rpc("homlo_list_messages", {
        p_conversation_id: conversationId,
        p_user_id: account.id,
        p_before: payload.before ?? null,
        p_limit: typeof payload.limit === "number" ? payload.limit : 500,
      });
      return json({ messages });
    }

    if (action === "messaging.send") {
      const conversationId = typeof payload.conversationId === "string" ? payload.conversationId : null;
      const message = typeof payload.message === "string" ? payload.message : null;
      if (!conversationId || !message) return fail("conversationId and message are required", 400);
      const sent = await rpc("homlo_send_message", {
        p_conversation_id: conversationId,
        p_sender_id: account.id,
        p_message: message,
      });
      return json({ message: sent });
    }

    if (action === "messaging.mark-read") {
      const conversationId = typeof payload.conversationId === "string" ? payload.conversationId : null;
      if (!conversationId) return fail("conversationId is required", 400);
      await rpc("homlo_mark_conversation_read", {
        p_conversation_id: conversationId,
        p_user_id: account.id,
      });
      return json({ ok: true });
    }

    if (action === "messaging.unread-count") {
      const result = await rpc<Array<{ count: string }>>("homlo_get_unread_count", { p_user_id: account.id });
      return json({ count: result[0]?.count ?? "0" });
    }

    if (action === "messaging.block") {
      const conversationId = typeof payload.conversationId === "string" ? payload.conversationId : null;
      const targetId = typeof payload.targetId === "string" ? payload.targetId : null;
      if (!conversationId || !targetId) return fail("conversationId and targetId are required", 400);
      await rpc("homlo_block_user", {
        p_conversation_id: conversationId,
        p_user_id: account.id,
        p_target_id: targetId,
      });
      return json({ ok: true });
    }

    if (action === "messaging.unblock") {
      const conversationId = typeof payload.conversationId === "string" ? payload.conversationId : null;
      const targetId = typeof payload.targetId === "string" ? payload.targetId : null;
      if (!conversationId || !targetId) return fail("conversationId and targetId are required", 400);
      await rpc("homlo_unblock_user", {
        p_conversation_id: conversationId,
        p_user_id: account.id,
        p_target_id: targetId,
      });
      return json({ ok: true });
    }

    if (action === "messaging.report") {
      const conversationId = typeof payload.conversationId === "string" ? payload.conversationId : null;
      const reason = typeof payload.reason === "string" ? payload.reason : null;
      if (!conversationId || !reason) return fail("conversationId and reason are required", 400);
      const report = await rpc("homlo_report_conversation", {
        p_conversation_id: conversationId,
        p_reporter_id: account.id,
        p_reason: reason,
        p_details: payload.details ?? null,
      });
      return json({ report });
    }

    if (action === "messaging.hide") {
      const messageId = typeof payload.messageId === "string" ? payload.messageId : null;
      if (!messageId) return fail("messageId is required", 400);
      await rpc("homlo_hide_message", {
        p_message_id: messageId,
        p_user_id: account.id,
      });
      return json({ ok: true });
    }

    // ------------------------------------------------------------------
    // Notifications (applicant status updates, job-filled)
    // ------------------------------------------------------------------

    if (action === "notifications.list") {
      const notifications = await rpc("homlo_list_user_notifications", { p_user_id: account.id });
      return json({ notifications });
    }

    if (action === "notifications.mark-read") {
      const notificationId = typeof payload.notificationId === "string" ? payload.notificationId : null;
      if (!notificationId) return fail("notificationId is required", 400);
      await rpc("homlo_mark_notification_read", {
        p_user_id: account.id,
        p_notification_id: notificationId,
      });
      return json({ ok: true });
    }

    if (action === "boost.create") {
      const jobId = typeof payload.jobId === "string" ? payload.jobId : null;
      const packageId = typeof payload.package === "string" ? payload.package : null;
      const currency = typeof payload.currency === "string" ? payload.currency : "USD";
      const provider = typeof payload.provider === "string" ? payload.provider : "aba_payway";
      if (!jobId || !packageId) return fail("Invalid boost input", 400);

      const [jobRows, packageRows, subscriptionRows] = await Promise.all([
        rest<BoostJobRow[]>("jobs", {
          query: { select: "id,employer_id,status,deleted_at", id: `eq.${jobId}`, limit: "1" },
        }),
        rest<BoostPackageRow[]>("boost_packages", {
          query: { select: "id,price_cents,pro_price_cents,active", id: `eq.${packageId}`, limit: "1" },
        }),
        rest<Array<{ plan: string; status: string }>>("subscriptions", {
          query: { select: "plan,status", user_id: `eq.${account.id}`, limit: "1" },
        }),
      ]);

      assertBoostCreateOwner(jobRows[0], account.id);
      const isPro = subscriptionRows[0]?.plan === "pro" && subscriptionRows[0]?.status === "active";
      const amountCents = serverBoostAmountCents(packageRows[0], isPro, payload.amount);
      const created = await rpc<Array<{
        boost_id: string;
        payment_id: string;
        payment_status: string;
        amount: number | string;
        currency: string;
      }>>("homlo_create_boost", {
        p_employer_id: account.id,
        p_job_id: jobId,
        p_package: packageId,
        p_amount: amountCents / 100,
        p_currency: currency,
        p_provider: provider,
      });

      return json({ boost: created });
    }

    if (action === "boost.verify-payment") {
      const paymentId = typeof payload.paymentId === "string" ? payload.paymentId : null;
      if (!paymentId) return fail("A payment id is required", 400);

      const paymentRows = await rest<Array<PaymentOwnershipRow & { status?: string; boost_id?: string | null; provider?: string | null }>>(
        "payments",
        { query: { select: "id,user_id,status,boost_id,provider", id: `eq.${paymentId}`, user_id: `eq.${account.id}`, limit: "1" } },
      );
      const paymentRow = paymentRows[0];
      assertPaymentOwner(paymentRow, account.id);

      const providerEventId =
        typeof payload.providerEventId === "string" && payload.providerEventId.length > 0
          ? payload.providerEventId
          : `boost-${paymentId}`;
      const verification = await rpc<Array<{ id: string; status: string; boost_id: string | null }>>(
        "homlo_record_payment_webhook",
        {
          p_provider: typeof paymentRow.provider === "string" ? paymentRow.provider : "aba_payway",
          p_provider_event_id: providerEventId,
          p_provider_transaction_id:
            typeof payload.providerTransactionId === "string" ? payload.providerTransactionId : null,
          p_payment_id: paymentId,
          p_result: verifyPaymentResult(payload),
        },
      );
      const payment = Array.isArray(verification) ? verification[0] : verification;
      if (!payment?.id) return fail("Unable to verify the boost payment", 400);

      return json({ payment: { id: payment.id, status: payment.status, boost_id: payment.boost_id } });
    }

    return fail("Unknown service action", 404);
  } catch (error) {
    console.error("[homlo-service-gateway] action failed", error);
    if (error instanceof PaymentRuleError) return fail(error.message, error.status);
    if (error instanceof SafeError) return fail(error.message, 400);
    return fail("Request failed", 400);
  }
});
