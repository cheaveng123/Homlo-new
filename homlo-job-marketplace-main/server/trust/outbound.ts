import type { Queryable } from "../hlPlanBoostService";

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

type Email = { to: string; subject: string; body: string };

async function sendEmailNow(email: Email): Promise<void> {
  const provider = process.env.EMAIL_PROVIDER ?? "log";
  if (provider === "resend") {
    const key = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!key || !from) throw new DeliveryUnavailableError("RESEND_API_KEY and EMAIL_FROM are required");
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [email.to], subject: email.subject, text: email.body }),
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
  const { rows } = await db.query<{ id: string; to_address: string; subject: string; body: string }>(
    `select id, to_address, subject, body from email_outbox
      where status = 'pending' and attempts < 5
      order by created_at limit $1`,
    [batch],
  );
  let sent = 0;
  for (const row of rows) {
    try {
      await sendEmailNow({ to: row.to_address, subject: row.subject, body: row.body });
      await db.query(`update email_outbox set status = 'sent', sent_at = now(), attempts = attempts + 1 where id = $1`, [row.id]);
      sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await db.query(
        `update email_outbox set attempts = attempts + 1, last_error = $2,
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
