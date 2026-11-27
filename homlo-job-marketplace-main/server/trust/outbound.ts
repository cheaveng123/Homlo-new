import type { Queryable } from "../hlPlanBoostService";
import { renderEmailHtml } from "./email-html";

/**
 * Email and SMS delivery.
 *
 * No email or SMS provider exists in this project yet, and choosing one is
 * the owner's decision (it costs money and needs an account). So:
 *
 *   EMAIL_PROVIDER=log     (default) emails stay in email_outbox and are
 *                          printed to the server log. Nothing is sent.
 *   EMAIL_PROVIDER=resend  sends through the Resend HTTP API
 *                          (RESEND_API_KEY, EMAIL_FROM).
 *
 *   SMS_PROVIDER=log       (default, development only) the code is printed
 *                          to the server log.
 *   SMS_PROVIDER=twilio    sends through Twilio (TWILIO_ACCOUNT_SID,
 *                          TWILIO_AUTH_TOKEN, TWILIO_FROM).
 *
 * In production the "log" transports refuse to run, so verification fails
 * closed instead of pretending to send.
 */

function isProduction() {
  return process.env.NODE_ENV === "production" || process.env.APP_ENV === "production";
}

export class DeliveryUnavailableError extends Error {}

/** True when an email would actually be delivered (or logged, outside production). */
export function emailDeliveryReady(): boolean {
  const provider = process.env.EMAIL_PROVIDER ?? "log";
  if (provider === "resend") return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
  return !isProduction();
}

/** True when an SMS would actually be delivered (or logged, outside production). */
export function smsDeliveryReady(): boolean {
  const provider = process.env.SMS_PROVIDER ?? "log";
  if (provider === "twilio") return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM);
  return !isProduction();
}

type Email = { to: string; subject: string; body: string; template?: string | null; id?: string };

async function sendEmailNow(email: Email): Promise<void> {
  const provider = process.env.EMAIL_PROVIDER ?? "log";
  if (provider === "resend") {
    const key = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!key || !from) throw new DeliveryUnavailableError("RESEND_API_KEY and EMAIL_FROM are required");
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [email.to],
        subject: email.subject,
        text: email.body,
        html: renderEmailHtml(email),
        // A unique id per email stops Gmail from stacking every "Confirm your
        // email" into one conversation, where the newest link is hard to find.
        ...(email.id ? { headers: { "X-Entity-Ref-ID": email.id } } : {}),
      }),
    });
    if (!response.ok) throw new Error(`Resend responded ${response.status}`);
    return;
  }
  if (isProduction()) throw new DeliveryUnavailableError("EMAIL_PROVIDER is not configured for production");
  console.log(`[email:log] to=${email.to} subject=${JSON.stringify(email.subject)}\n${email.body}`);
}

/** Puts an email in the outbox. The sweeper delivers it (see deliverPendingEmails). */
export async function queueEmail(
  db: Queryable,
  input: { userId: string | null; to: string; template: string; subject: string; body: string; dedupeKey?: string },
) {
  await db.query(
    `insert into email_outbox (user_id, to_address, template, subject, body, dedupe_key)
     values ($1, $2, $3, $4, $5, $6) on conflict (dedupe_key) do nothing`,
    [input.userId, input.to, input.template, input.subject, input.body, input.dedupeKey ?? null],
  );
}

export async function queueEmailToUser(
  db: Queryable,
  userId: string,
  input: { template: string; subject: string; body: string; dedupeKey?: string },
) {
  await db.query(`select homlo_queue_email($1, $2, $3, $4, $5)`, [
    userId,
    input.template,
    input.subject,
    input.body,
    input.dedupeKey ?? null,
  ]);
}

export async function deliverPendingEmails(db: Queryable, batch = 25): Promise<number> {
  // Claim rows atomically before sending. Several workers can run at once (the
  // immediate send after "send the link again", the pg_cron sweep, a dev
  // server's timer); without the claim two of them picked the same row and the
  // user got the email twice. status only allows pending/sent/failed, so a
  // claimed row stays 'pending' with sent_at set to the claim time; one left
  // behind by a crashed worker is retried after 5 minutes.
  const { rows } = await db.query<{ id: string; to_address: string; subject: string; body: string; template: string | null }>(
    `update email_outbox set sent_at = now()
      where id in (
        select id from email_outbox
         where status = 'pending' and attempts < 5
           and (sent_at is null or sent_at < now() - interval '5 minutes')
         order by created_at limit $1
         for update skip locked)
      returning id, to_address, subject, body, template`,
    [batch],
  );
  let sent = 0;
  for (const row of rows) {
    try {
      await sendEmailNow({ to: row.to_address, subject: row.subject, body: row.body, template: row.template, id: row.id });
      await db.query(`update email_outbox set status = 'sent', sent_at = now(), attempts = attempts + 1 where id = $1`, [row.id]);
      sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await db.query(
        `update email_outbox set attempts = attempts + 1, last_error = $2, sent_at = null,
                status = case when attempts + 1 >= 5 then 'failed' else 'pending' end
          where id = $1`,
        [row.id, message.slice(0, 500)],
      );
      if (error instanceof DeliveryUnavailableError) break; // misconfigured: stop this round
    }
  }
  return sent;
}

export async function sendSms(to: string, body: string): Promise<void> {
  const provider = process.env.SMS_PROVIDER ?? "log";
  if (provider === "twilio") {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM;
    if (!sid || !token || !from) throw new DeliveryUnavailableError("Twilio credentials are not configured");
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
    });
    if (!response.ok) throw new Error(`Twilio responded ${response.status}`);
    return;
  }
  if (isProduction()) throw new DeliveryUnavailableError("SMS_PROVIDER is not configured for production");
  console.log(`[sms:log] to=${to} body=${JSON.stringify(body)}`);
}
