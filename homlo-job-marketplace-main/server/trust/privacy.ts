import type { PlanBoostDb, Queryable } from "../hlPlanBoostService";
import { decryptField } from "./crypto";
import { deliverPendingEmails, queueEmailToUser } from "./outbound";

// ---------------------------------------------------------------------------
// "Download my data" (JSON)
// ---------------------------------------------------------------------------

/** Everything we hold about one account, as plain JSON. */
export async function exportUserData(db: Queryable, userId: string) {
  const one = async (sql: string) => (await db.query<{ data: unknown }>(sql, [userId])).rows[0]?.data ?? null;
  const many = async (sql: string) => (await db.query<{ data: unknown }>(`select coalesce(jsonb_agg(x), '[]'::jsonb) as data from (${sql}) x`, [userId])).rows[0]?.data ?? [];

  const consents = (await many(
    `select id, consent_type, terms_version, privacy_version, created_at, ip_address, user_agent, listing_id from consent_log where user_id = $1 order by created_at`,
  )) as Record<string, unknown>[];

  return {
    exportedAt: new Date().toISOString(),
    account: await one(
      `select jsonb_build_object('id', id, 'email', homlo_user_email(id), 'status', status, 'created_at', created_at,
              'age', age, 'is_adult', is_adult, 'email_verified_at', email_verified_at,
              'phone_verified_at', phone_verified_at, 'marketing_opt_in', marketing_opt_in, 'last_active_at', last_active_at) as data
         from users where id = $1`,
    ),
    profile: await one(`select to_jsonb(p) as data from profiles p where user_id = $1`),
    subscription: await one(`select to_jsonb(s) as data from subscriptions s where user_id = $1`),
    jobsPosted: await many(`select id, title, description, requirements, status, location_text, pay_amount, pay_currency, pay_type, created_at, published_at, expires_at from jobs where employer_id = $1`),
    applications: await many(`select id, job_id, status, message, created_at from applications where worker_id = $1`),
    messagesSent: await many(`select id, conversation_id, message, created_at from messages where sender_id = $1`),
    savedJobs: await many(`select job_id, created_at from saved_jobs where user_id = $1`),
    reportsFiled: await many(`select id, target_type, target_id, coalesce(category, reason) as category, details, status, created_at from reports where reporter_id = $1`),
    appeals: await many(`select id, target_type, target_id, message, status, created_at from appeals where user_id = $1`),
    payments: await many(`select id, amount, currency, status, provider, provider_transaction_id, created_at from payments where user_id = $1`),
    storePurchases: await many(`select id, product_id, price_cents, currency, status, rc_transaction_id, created_at from revenuecat_boost_purchases where user_id = $1`),
    consents: consents.map((c) => ({ ...c, ip_address: decryptField(c.ip_address as string), user_agent: decryptField(c.user_agent as string) })),
  };
}

// ---------------------------------------------------------------------------
// Scheduled jobs: listing expiry, emails, subscriptions, retention
// ---------------------------------------------------------------------------

export type CloseAccount = (userId: string) => Promise<void>;

async function setting(db: Queryable, key: string, fallback: number) {
  const { rows } = await db.query<{ v: number | null }>(`select trust_setting_int($1) as v`, [key]);
  return rows[0]?.v ?? fallback;
}

export async function expireListings(db: Queryable) {
  const { rows } = await db.query(
    `update jobs set status = 'expired'
      where status = 'open' and deleted_at is null and expires_at is not null and expires_at < now()
      returning id`,
  );
  return rows.length;
}

export async function runSubscriptionTasks(db: Queryable) {
  const days = await setting(db, "renewal_reminder_days", 3);
  const due = await db.query<{ user_id: string; plan: string; current_period_end: Date }>(
    `select user_id, plan, current_period_end from subscriptions
      where plan <> 'free' and status = 'active' and not cancel_at_period_end
        and current_period_end between now() and now() + make_interval(days => $1)
        and renewal_reminder_sent_for is distinct from current_period_end`,
    [days],
  );
  for (const sub of due.rows) {
    const when = new Date(sub.current_period_end).toISOString().slice(0, 10);
    await queueEmailToUser(db, sub.user_id, {
      template: "renewal_reminder",
      subject: "Your Homlo subscription renews soon",
      body: `Your ${sub.plan} plan renews automatically on ${when} (UTC). To stop it, open Account settings and tap "Cancel subscription" before then.`,
      dedupeKey: `renewal:${sub.user_id}:${when}`,
    });
    await db.query(`update subscriptions set renewal_reminder_sent_for = current_period_end where user_id = $1`, [sub.user_id]);
  }
  // Cancelled subscriptions end at the end of the paid period.
  await db.query(
    `update subscriptions set plan = 'free', status = 'canceled', cancel_at_period_end = false
      where cancel_at_period_end and current_period_end is not null and current_period_end < now()`,
  );
}

export async function runRetention(db: PlanBoostDb, closeAccount: CloseAccount) {
  const purgeDays = await setting(db, "closed_account_purge_days", 90);
  const inactiveMonths = await setting(db, "inactive_account_months", 24);
  const warnDays = await setting(db, "inactive_warning_days", 30);

  // 1. Closed accounts: remove what is left after the purge period.
  const closed = await db.query<{ id: string }>(
    `select id from users where closed_at is not null and anonymized_at is null
        and closed_at < now() - make_interval(days => $1) limit 50`,
    [purgeDays],
  );
  for (const { id } of closed.rows) {
    await db.query(`update applications set message = null where worker_id = $1`, [id]);
    await db.query(`update messages set message = 'Message removed' where sender_id = $1`, [id]);
    await db.query(`delete from saved_jobs where user_id = $1`, [id]);
    await db.query(`delete from notifications where user_id = $1`, [id]);
    await db.query(`delete from user_devices where user_id = $1`, [id]);
    await db.query(`delete from verification_codes where user_id = $1`, [id]);
    await db.query(`delete from email_outbox where user_id = $1`, [id]);
    await db.query(`update users set anonymized_at = now(), age = null, phone_hash = null where id = $1`, [id]);
  }

  // 2. Inactive accounts: warn first, delete after the warning period.
  const toWarn = await db.query<{ id: string }>(
    `select id from users
      where deleted_at is null and inactivity_warning_sent_at is null
        and coalesce(last_active_at, created_at) < now() - make_interval(months => $1) + make_interval(days => $2)
      limit 100`,
    [inactiveMonths, warnDays],
  );
  for (const { id } of toWarn.rows) {
    await queueEmailToUser(db, id, {
      template: "inactivity_warning",
      subject: "Your Homlo account will be deleted",
      body: `You have not used your Homlo account for a long time. To keep it, just sign in within ${warnDays} days. Otherwise we will delete it, as our Privacy Policy explains.`,
      dedupeKey: `inactive:${id}`,
    });
    await db.query(`update users set inactivity_warning_sent_at = now() where id = $1`, [id]);
  }
  const toDelete = await db.query<{ id: string }>(
    `select id from users
      where deleted_at is null and inactivity_warning_sent_at < now() - make_interval(days => $1)
        and coalesce(last_active_at, created_at) < inactivity_warning_sent_at
      limit 25`,
    [warnDays],
  );
  for (const { id } of toDelete.rows) {
    await closeAccount(id).catch((error) => console.error("[retention] inactive close failed", id, error));
  }

  // 3. Consent and moderation records past their retention period.
  if (db.transaction) {
    await db.transaction(async (tx) => {
      await tx.query(`select set_config('homlo.retention_purge', 'on', true)`);
      await tx.query(`delete from consent_log where created_at < now() - make_interval(years => coalesce(trust_setting_int('consent_retention_years'), 5))`);
      await tx.query(`delete from moderation_actions where created_at < now() - make_interval(years => coalesce(trust_setting_int('moderation_retention_years'), 5))`);
    });
  }

  // 4. Housekeeping for short-lived data.
  await db.query(`delete from verification_codes where created_at < now() - interval '30 days'`);
  await db.query(`delete from email_outbox where status <> 'pending' and created_at < now() - interval '90 days'`);
}

/** Start once at server boot (like the boost sweeper). */
export function startTrustSweeper(db: PlanBoostDb, closeAccount: CloseAccount, everyMs = 5 * 60_000): () => void {
  let lastRetention = 0;
  const run = async () => {
    try {
      await expireListings(db);
      await runSubscriptionTasks(db);
      if (Date.now() - lastRetention > 6 * 60 * 60_000) {
        lastRetention = Date.now();
        await runRetention(db, closeAccount);
      }
      await deliverPendingEmails(db);
    } catch (error) {
      console.error("[trust sweeper]", error);
    }
  };
  void run();
  const timer = setInterval(run, everyMs);
  timer.unref?.();
  return () => clearInterval(timer);
}
