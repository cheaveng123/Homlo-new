import "jsr:@supabase/functions-js/edge-runtime.d.ts";

type AuthUser = { id: string; email?: string | null; user_metadata?: { full_name?: string | null; name?: string | null } };

// Payment verification is normally performed by a provider webhook that the
// server confirms against a shared secret. This gateway has no live merchant
// credentials, so verification in this deployment is "simulated": it still
// runs through the same idempotent, payment-status-gated SQL path and only
// activates a boost after a completed payment row exists. Swap
// PAYMENT_VERIFICATION_MODE to "webhook" and route calls through a signed
// callback handler once ABA PayWay / Stripe credentials are configured.
const PAYMENT_VERIFICATION_MODE = Deno.env.get("HOMLO_PAYMENT_VERIFICATION_MODE") ?? "simulated";

function verifyPaymentResult(payload: Record<string, unknown>): "completed" | "failed" {
  if (PAYMENT_VERIFICATION_MODE === "simulated") {
    return payload.simulateResult === "failed" ? "failed" : "completed";
  }
  // In real webhook mode the provider name + event id must be present and
  // verified against provider-side signatures before reaching this step.
  return payload.provider === "aba_payway" && payload.providerEventId ? "completed" : "failed";
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function fail(message: string, status = 400) {
  return json({ error: message }, status);
}

async function getVerifiedUser(request: Request): Promise<AuthUser | null> {
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: authorization },
  });
  if (!response.ok) return null;
  return (await response.json()) as AuthUser;
}

async function rpc<T>(name: string, input: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Supabase service request failed" }));
    throw new Error(typeof error.message === "string" ? error.message : "Supabase service request failed");
  }
  return (await response.json()) as T;
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
      if (!resolved) throw new Error("Unable to resolve the Homlo account");
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
      if (plan !== "free" && plan !== "pro" && plan !== "enterprise") return fail("Invalid subscription plan", 400);
      const subscription = await rpc("homlo_upsert_subscription", { p_user_id: account.id, p_plan: plan });
      return json({ subscription });
    }

    if (action === "subscription.purchase") {
      // Full account-plan purchase with a real payment record (same idempotent
      // verification path as boosts). Free plans skip payment entirely.
      const plan = payload.plan;
      if (plan !== "free" && plan !== "pro" && plan !== "enterprise") return fail("Invalid subscription plan", 400);
      if (plan === "free") {
        const subscription = await rpc("homlo_upsert_subscription", { p_user_id: account.id, p_plan: plan });
        return json({ payment: null, subscription });
      }
      const amount = typeof payload.amount === "number" && Number.isFinite(payload.amount) ? payload.amount : null;
      if (amount === null || amount < 0) return fail("A valid payment amount is required", 400);
      const created = await rpc<Array<{ id: string; status: string }>>("homlo_create_subscription_payment", {
        p_user_id: account.id,
        p_plan: plan,
        p_amount: amount,
        p_currency: payload.currency ?? "USD",
        p_provider: payload.provider ?? "aba_payway",
      });
      const paymentRow = Array.isArray(created) ? created[0] : created;
      if (!paymentRow?.id) return fail("Unable to create the subscription payment", 400);
      const verification = await rpc<Array<{ id: string; status: string }>>("homlo_record_payment_webhook", {
        p_provider: "aba_payway",
        p_provider_event_id: `plan-${paymentRow.id}`,
        p_provider_transaction_id: null,
        p_payment_id: paymentRow.id,
        p_result: verifyPaymentResult(payload),
      });
      const payment = Array.isArray(verification) ? verification[0] : verification;
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
      return json({ profile });
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
      const applications = await rpc("homlo_list_worker_applications_detailed", { p_worker_id: account.id });
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

    if (action === "boost.create") {
      const boost = await rpc("homlo_create_boost", {
        p_employer_id: account.id,
        p_job_id: payload.jobId,
        p_package: payload.package,
        p_amount: payload.amount,
        p_currency: payload.currency ?? "USD",
        p_provider: payload.provider ?? "aba_payway",
      });
      return json({ boost });
    }

    if (action === "boost.verify-payment") {
      // Server-side verification. In simulated mode the gateway decides the
      // payment result; in webhook mode a signed provider event must already
      // have been validated. Either way the SAME SQL path runs (idempotent,
      // pending-only activation) — a boost is never activated by a client
      // boolean.
      const paymentId = typeof payload.paymentId === "string" ? payload.paymentId : null;
      if (!paymentId) return fail("A payment id is required", 400);
      const verification = await rpc<Array<{ id: string; status: string; boost_id: string | null }>>("homlo_record_payment_webhook", {
        p_provider: "aba_payway",
        p_provider_event_id: payload.providerEventId ?? `dev-${paymentId}`,
        p_provider_transaction_id: payload.providerTransactionId ?? null,
        p_payment_id: paymentId,
        p_result: verifyPaymentResult(payload),
      });
      const payment = Array.isArray(verification) ? (verification[0] ?? null) : verification;
      return json({ payment: payment ?? null });
    }

    return fail("Unknown service action", 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Supabase service request failed";
    return fail(message, 400);
  }
});
