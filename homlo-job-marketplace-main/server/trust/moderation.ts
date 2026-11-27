import type { PlanBoostDb, Queryable } from "../hlPlanBoostService";
import { TrustError, banIdentifiersOf } from "./accounts";
import { decryptField } from "./crypto";
import { queueEmailToUser } from "./outbound";

export type ModerationAction = "approve" | "remove" | "warn" | "suspend" | "ban" | "reinstate" | "dismiss_report";
export type ReportCategory = "scam" | "underage_user" | "discrimination" | "illegal" | "other";

export async function isAdmin(db: Queryable, userId: string): Promise<boolean> {
  const { rows } = await db.query<{ ok: boolean }>(`select homlo_is_admin($1) as ok`, [userId]);
  return Boolean(rows[0]?.ok);
}

// ---------------------------------------------------------------------------
// Reports (any signed-in user)
// ---------------------------------------------------------------------------

export async function createReport(
  db: Queryable,
  input: { reporterId: string; targetType: "job" | "user"; targetId: string; category: ReportCategory; details: string | null },
) {
  if (input.targetType === "user" && input.targetId === input.reporterId) throw new TrustError("You cannot report yourself.");
  const exists =
    input.targetType === "job"
      ? await db.query(`select 1 from jobs where id = $1 and deleted_at is null`, [input.targetId])
      : await db.query(`select 1 from users where id = $1 and deleted_at is null`, [input.targetId]);
  if (!exists.rows.length) throw new TrustError("This item is no longer available.");
  const duplicate = await db.query(
    `select 1 from reports where reporter_id = $1 and target_type = $2 and target_id = $3 and status = 'open' limit 1`,
    [input.reporterId, input.targetType, input.targetId],
  );
  // The insert trigger emails the owner (reports_notify_owner).
  if (!duplicate.rows.length) {
    await db.query(
      `insert into reports (reporter_id, target_type, target_id, reason, category, details)
       values ($1, $2, $3, $4, $4, $5)`,
      [input.reporterId, input.targetType, input.targetId, input.category, input.details],
    );
  }
  return { reported: true as const };
}

// ---------------------------------------------------------------------------
// Dashboard reads (admins only; callers check isAdmin first)
// ---------------------------------------------------------------------------

export async function listReviewQueue(db: Queryable) {
  const { rows } = await db.query(
    `select j.id, j.title, j.description, j.requirements, j.employer_id, j.employer_name, j.location_text, j.city,
            j.pay_type, j.pay_amount, j.pay_currency, j.contact_method, j.contact_value,
            j.moderation_reasons, j.first_submitted_at, u.created_at as account_created_at
       from jobs j join users u on u.id = j.employer_id
      where j.status = 'pending_review' and j.deleted_at is null
      order by j.first_submitted_at nulls last limit 200`,
  );
  return rows;
}

export async function listOpenReports(db: Queryable) {
  const { rows } = await db.query(
    `select r.id, r.target_type, r.target_id, coalesce(r.category, r.reason) as category, r.details, r.created_at,
            r.reporter_id,
            case when r.target_type = 'job' then (select title from jobs where id = r.target_id)
                 when r.target_type = 'user' then (select full_name from profiles where user_id = r.target_id) end as target_label,
            case when r.target_type = 'job' then (select status from jobs where id = r.target_id)
                 when r.target_type = 'user' then (select status from users where id = r.target_id) end as target_status
       from reports r where r.status = 'open' order by r.created_at limit 200`,
  );
  return rows;
}

export async function listAppeals(db: Queryable) {
  const { rows } = await db.query(
    `select id, user_id, contact_email, target_type, target_id, message, status, created_at
       from appeals where status = 'open' order by created_at limit 200`,
  );
  return rows;
}

export async function listActionHistory(db: Queryable, targetType: string, targetId: string) {
  const { rows } = await db.query(
    `select m.id, m.action, m.reason, m.created_at, m.actor_id, p.full_name as actor_name, m.snapshot is not null as has_snapshot
       from moderation_actions m left join profiles p on p.user_id = m.actor_id
      where m.target_type = $1 and m.target_id = $2 order by m.created_at desc`,
    [targetType, targetId],
  );
  return rows;
}

export async function chargebackEvidence(db: Queryable, paymentRef: string) {
  const { rows } = await db.query<{ evidence: Record<string, unknown> | null }>(
    `select homlo_chargeback_evidence($1) as evidence`,
    [paymentRef],
  );
  const evidence = rows[0]?.evidence;
  if (!evidence) throw new TrustError("No payment found for that reference.");
  const consents = (evidence.consents as Record<string, unknown>[] | undefined) ?? [];
  evidence.consents = consents.map((c) => ({
    ...c,
    ip_address: decryptField(c.ip_address as string | null),
    user_agent: decryptField(c.user_agent as string | null),
  }));
  return evidence;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

const APPEAL_HINT = (days: number) =>
  `If you think this is a mistake, you can appeal within ${days} days using the appeal form in the app or by replying to support.`;

async function appealDays(db: Queryable) {
  const { rows } = await db.query<{ v: number | null }>(`select trust_setting_int('appeal_window_days') as v`);
  return rows[0]?.v ?? 14;
}

export async function takeAction(
  db: PlanBoostDb,
  input: { actorId: string; action: ModerationAction; targetType: "job" | "user" | "report"; targetId: string; reason: string; reportId?: string | null },
) {
  const reason = input.reason.trim();
  if (!reason) throw new TrustError("A reason is required for every moderation action.");
  if (!db.transaction) throw new Error("Moderation needs a transactional database connection");

  return db.transaction(async (tx) => {
    // Lets moderator writes pass the listing gate trigger (jobs_trust_safety_gate).
    await tx.query(`select set_config('homlo.moderation_action', 'on', true)`);
    const days = await appealDays(tx);
    let snapshot: unknown = null;

    if (input.targetType === "job") {
      const { rows } = await tx.query<Record<string, unknown> & { employer_id: string; title: string }>(
        `select * from jobs where id = $1 for update`,
        [input.targetId],
      );
      const job = rows[0];
      if (!job) throw new TrustError("Listing not found.");

      if (input.action === "approve") {
        await tx.query(
          `update jobs set status = 'open', moderation_status = 'approved', moderation_reasons = '{}',
                  approved_text_hash = md5(homlo_listing_text(jobs)),
                  published_at = coalesce(published_at, now()),
                  expires_at = now() + make_interval(days => coalesce(trust_setting_int('listing_expiry_days'), 30))
            where id = $1`,
          [input.targetId],
        );
        await queueEmailToUser(tx, job.employer_id, {
          template: "listing_approved",
          subject: "Your listing is live",
          body: `Your listing "${job.title}" passed review and is now visible to job seekers.`,
        });
      } else if (input.action === "remove") {
        snapshot = job; // full content as it was at removal
        await tx.query(`update jobs set status = 'removed', moderation_status = 'removed' where id = $1`, [input.targetId]);
        await queueEmailToUser(tx, job.employer_id, {
          template: "listing_removed",
          subject: "Your listing was removed",
          body: `Your listing "${job.title}" was removed because it breaks our Terms of Service.\nReason: ${reason}\n\n${APPEAL_HINT(days)}`,
        });
      } else {
        throw new TrustError("Listings can be approved or removed. Use the account actions for the poster.");
      }
    } else if (input.targetType === "user") {
      const { rows } = await tx.query<{ id: string; status: string }>(`select id, status from users where id = $1 for update`, [input.targetId]);
      if (!rows[0]) throw new TrustError("Account not found.");
      if (input.targetId === input.actorId) throw new TrustError("You cannot moderate your own account.");
      const profile = await tx.query(`select * from profiles where user_id = $1`, [input.targetId]);

      if (input.action === "warn") {
        await tx.query(`update users set warning_count = warning_count + 1 where id = $1`, [input.targetId]);
        await queueEmailToUser(tx, input.targetId, {
          template: "account_warning",
          subject: "A warning about your account",
          body: `We reviewed activity on your account and found it breaks our Terms of Service.\nReason: ${reason}\n\nFurther problems may lead to suspension or a ban.`,
        });
      } else if (input.action === "suspend" || input.action === "ban") {
        snapshot = { profile: profile.rows[0] ?? null };
        const status = input.action === "suspend" ? "suspended" : "banned";
        await tx.query(`update users set status = $2 where id = $1`, [input.targetId, status]);
        // Take their live listings down too (content kept in the snapshot of each removal).
        const live = await tx.query<Record<string, unknown> & { id: string }>(
          `select * from jobs where employer_id = $1 and status in ('open', 'pending_review') and deleted_at is null`,
          [input.targetId],
        );
        for (const job of live.rows) {
          await tx.query(`update jobs set status = 'removed', moderation_status = 'removed' where id = $1`, [job.id]);
          await tx.query(
            `insert into moderation_actions (actor_id, action, target_type, target_id, reason, snapshot)
             values ($1, 'remove', 'job', $2, $3, $4::jsonb)`,
            [input.actorId, job.id, `Account ${status}: ${reason}`, JSON.stringify(job)],
          );
        }
        if (input.action === "ban") await banIdentifiersOf(tx, input.targetId);
        await queueEmailToUser(tx, input.targetId, {
          template: `account_${status}`,
          subject: `Your account was ${status}`,
          body: `Your account was ${status} because it breaks our Terms of Service.\nReason: ${reason}\n\n${APPEAL_HINT(days)}`,
        });
      } else if (input.action === "reinstate") {
        await tx.query(`update users set status = 'active' where id = $1`, [input.targetId]);
      } else {
        throw new TrustError("That action does not apply to accounts.");
      }
    } else if (input.action !== "dismiss_report") {
      throw new TrustError("Reports can only be dismissed. Act on the listing or account instead.");
    }

    const reportId = input.targetType === "report" ? input.targetId : input.reportId ?? null;
    if (reportId) {
      await tx.query(`update reports set status = $2 where id = $1`, [reportId, input.action === "dismiss_report" ? "dismissed" : "actioned"]);
    }

    const { rows } = await tx.query<{ id: string; created_at: Date }>(
      `insert into moderation_actions (actor_id, action, target_type, target_id, report_id, reason, snapshot)
       values ($1, $2, $3, $4, $5, $6, $7::jsonb) returning id, created_at`,
      [input.actorId, input.action, input.targetType, input.targetId, reportId, reason, snapshot ? JSON.stringify(snapshot) : null],
    );
    return { id: rows[0].id, createdAt: new Date(rows[0].created_at).toISOString() };
  });
}

// ---------------------------------------------------------------------------
// Appeals
// ---------------------------------------------------------------------------

export async function submitAppeal(
  db: Queryable,
  input: { userId: string | null; contactEmail: string; targetType: "job" | "account"; targetId: string | null; message: string },
) {
  const recent = await db.query<{ n: number }>(
    `select count(*)::int as n from appeals where lower(contact_email) = lower($1) and created_at > now() - interval '1 day'`,
    [input.contactEmail],
  );
  if ((recent.rows[0]?.n ?? 0) >= 3) throw new TrustError("You have sent several appeals today. We will reply to the ones we have.", "TOO_MANY_REQUESTS");
  await db.query(
    `insert into appeals (user_id, contact_email, target_type, target_id, message) values ($1, $2, $3, $4, $5)`,
    [input.userId, input.contactEmail, input.targetType, input.targetId, input.message.trim()],
  );
  return { submitted: true as const };
}

export async function decideAppeal(db: PlanBoostDb, input: { actorId: string; appealId: string; upheld: boolean; reason: string }) {
  if (!input.reason.trim()) throw new TrustError("A reason is required.");
  if (!db.transaction) throw new Error("Moderation needs a transactional database connection");
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('homlo.moderation_action', 'on', true)`);
    const { rows } = await tx.query<{ id: string; user_id: string | null; target_type: string; target_id: string | null; contact_email: string }>(
      `update appeals set status = $2, decided_at = now() where id = $1 and status = 'open' returning *`,
      [input.appealId, input.upheld ? "upheld" : "rejected"],
    );
    const appeal = rows[0];
    if (!appeal) throw new TrustError("Appeal not found or already decided.");
    if (input.upheld && appeal.target_id) {
      if (appeal.target_type === "job") {
        // Back to draft: the poster can fix and resubmit (it goes through review again).
        await tx.query(`update jobs set status = 'draft', moderation_status = 'none' where id = $1 and status = 'removed'`, [appeal.target_id]);
      } else {
        await tx.query(`update users set status = 'active' where id = $1 and status in ('suspended', 'banned')`, [appeal.target_id]);
        await tx.query(`delete from banned_identifiers where user_id = $1`, [appeal.target_id]);
      }
    }
    await tx.query(
      `insert into moderation_actions (actor_id, action, target_type, target_id, reason)
       values ($1, $2, 'appeal', $3, $4)`,
      [input.actorId, input.upheld ? "appeal_upheld" : "appeal_rejected", appeal.id, input.reason.trim()],
    );
    await tx.query(
      `insert into email_outbox (user_id, to_address, template, subject, body) values ($1, $2, 'appeal_decision', $3, $4)`,
      [
        appeal.user_id,
        appeal.contact_email,
        "Your appeal has been decided",
        input.upheld
          ? `We reviewed your appeal and reversed our decision.\n${input.reason.trim()}`
          : `We reviewed your appeal and our decision stays in place.\n${input.reason.trim()}`,
      ],
    );
    return { decided: true as const };
  });
}
