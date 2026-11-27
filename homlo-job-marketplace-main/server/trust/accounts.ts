import type { Queryable } from "../hlPlanBoostService";
import { hashIdentifier, normalizePhone, randomSixDigitCode, randomToken, sha256 } from "./crypto";
import type { RequestMeta } from "./consent";
import { DeliveryUnavailableError, deliverPendingEmails, emailDeliveryReady, queueEmail, sendSms, smsDeliveryReady } from "./outbound";

/** A message safe to show the user (raised for rule violations). */
export class TrustError extends Error {
  constructor(message: string, readonly code: "BAD_REQUEST" | "FORBIDDEN" | "TOO_MANY_REQUESTS" | "PRECONDITION_FAILED" = "BAD_REQUEST") {
    super(message);
  }
}

const EMAIL_TOKEN_TTL_HOURS = 48;
const SMS_CODE_TTL_MINUTES = 10;
const SMS_MAX_ATTEMPTS = 5;
const SMS_MAX_SENDS_PER_HOUR = 5;
const E164 = /^\+[1-9]\d{7,14}$/;

function publicBaseUrl() {
  return (process.env.HOMLO_PUBLIC_BASE_URL || process.env.PUBLIC_API_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
}

// ---------------------------------------------------------------------------
// Ban evasion
// ---------------------------------------------------------------------------

/**
 * True when the email or device belongs to a banned account. IP matches are
 * NOT blocking (shared Wi-Fi, carrier NAT), they are only recorded so a
 * moderator can see the link. Device/IP matching may need a legal basis
 * (e.g. GDPR legitimate interest + disclosure): owner decision.
 */
export async function isBlockedFromSignup(db: Queryable, email: string, meta: RequestMeta): Promise<boolean> {
  const hashes: [string, string][] = [["email", hashIdentifier("email", email)]];
  if (meta.deviceId) hashes.push(["device", hashIdentifier("device", meta.deviceId)]);
  const { rows } = await db.query<{ n: number }>(
    `select count(*)::int as n from banned_identifiers
      where (kind, value_hash) in (select * from unnest($1::text[], $2::text[]))`,
    [hashes.map((h) => h[0]), hashes.map((h) => h[1])],
  );
  return (rows[0]?.n ?? 0) > 0;
}

export async function ipMatchesBannedAccount(db: Queryable, meta: RequestMeta): Promise<boolean> {
  if (!meta.ip) return false;
  const { rows } = await db.query(`select 1 from banned_identifiers where kind = 'ip' and value_hash = $1 limit 1`, [
    hashIdentifier("ip", meta.ip),
  ]);
  return rows.length > 0;
}

/** Remembers which (hashed) device and network an account uses. */
export async function recordDevice(db: Queryable, userId: string, meta: RequestMeta) {
  const device = meta.deviceId ? hashIdentifier("device", meta.deviceId) : "";
  const ip = meta.ip ? hashIdentifier("ip", meta.ip) : "";
  if (!device && !ip) return;
  await db.query(
    `insert into user_devices (user_id, device_hash, ip_hash) values ($1, $2, $3)
     on conflict (user_id, device_hash, ip_hash) do update set last_seen = now()`,
    [userId, device, ip],
  );
}

/** Copies every identifier of a banned account into banned_identifiers. */
export async function banIdentifiersOf(db: Queryable, userId: string) {
  await db.query(
    `insert into banned_identifiers (kind, value_hash, user_id)
     select kind, value_hash, $1::uuid from (
       select 'phone' as kind, phone_hash as value_hash from users where id = $1::uuid and phone_hash is not null
       union select 'device', device_hash from user_devices where user_id = $1::uuid and device_hash <> ''
       union select 'ip', ip_hash from user_devices where user_id = $1::uuid and ip_hash <> ''
     ) ids
     on conflict (kind, value_hash) do nothing`,
    [userId],
  );
  const { rows } = await db.query<{ email: string | null }>(`select homlo_user_email($1) as email`, [userId]);
  if (rows[0]?.email) {
    await db.query(
      `insert into banned_identifiers (kind, value_hash, user_id) values ('email', $1, $2) on conflict (kind, value_hash) do nothing`,
      [hashIdentifier("email", rows[0].email), userId],
    );
  }
}

// ---------------------------------------------------------------------------
// Email confirmation link
// ---------------------------------------------------------------------------

export async function sendEmailVerification(db: Queryable, userId: string): Promise<void> {
  const { rows } = await db.query<{ email: string | null; verified: Date | null }>(
    `select homlo_user_email(id) as email, email_verified_at as verified from users where id = $1`,
    [userId],
  );
  const row = rows[0];
  if (!row?.email) throw new TrustError("No email address is linked to this account.");
  if (row.verified) return;
  // Say so instead of pretending: without a provider the email would sit in
  // the outbox forever while the app claims it was sent.
  if (!emailDeliveryReady()) throw new DeliveryUnavailableError("email delivery is not configured");
  const token = randomToken();
  await db.query(
    `insert into verification_codes (user_id, channel, target_hash, code_hash, expires_at)
     values ($1, 'email', $2, $3, now() + make_interval(hours => $4))`,
    [userId, hashIdentifier("email", row.email), sha256(token), EMAIL_TOKEN_TTL_HOURS],
  );
  const link = `${publicBaseUrl()}/api/trust/verify-email?token=${encodeURIComponent(token)}`;
  await queueEmail(db, {
    userId,
    to: row.email,
    template: "verify_email",
    subject: "Confirm your email address",
    body: `One last step before you can post jobs on HireNow: confirm that this is your email address.\n\n${link}\n\nThe link works once and expires in ${EMAIL_TOKEN_TTL_HOURS} hours. If you did not create a HireNow account, you can ignore this email.`,
  });
  // Send right away rather than waiting for the next background sweep, so the
  // link arrives while the user is still looking at the verify screen.
  await deliverPendingEmails(db).catch((error) => console.error("[trust] immediate email delivery failed", error));
}

export async function confirmEmailToken(db: Queryable, token: string): Promise<boolean> {
  const found = await db.query<{ id: string; user_id: string; target_hash: string; consumed: boolean; verified: boolean }>(
    `select v.id, v.user_id, v.target_hash, v.consumed_at is not null as consumed,
            u.email_verified_at is not null as verified
       from verification_codes v join users u on u.id = v.user_id
      where v.channel = 'email' and v.code_hash = $1
        and (v.consumed_at is not null or v.expires_at > now())
      limit 1`,
    [sha256(token)],
  );
  const code = found.rows[0];
  if (!code) return false;
  // Mail apps and browsers often open a link twice (preview, then the tap).
  // The first open confirms; a repeat of the same, already used link should
  // still say "confirmed" while the account is confirmed, not "expired".
  if (code.consumed) return code.verified;
  // The link only counts for the email address the account still has.
  const current = await db.query<{ email: string | null }>(`select homlo_user_email($1) as email`, [code.user_id]);
  if (!current.rows[0]?.email || hashIdentifier("email", current.rows[0].email) !== code.target_hash) return false;
  await db.query(`update verification_codes set consumed_at = now() where id = $1`, [code.id]);
  await db.query(`update users set email_verified_at = coalesce(email_verified_at, now()) where id = $1`, [code.user_id]);
  return true;
}

// ---------------------------------------------------------------------------
// SMS phone code
// ---------------------------------------------------------------------------

/** Refuses banned numbers and numbers already verified on another account. */
async function assertPhoneUsable(db: Queryable, userId: string, phoneHash: string): Promise<void> {
  const banned = await db.query(`select 1 from banned_identifiers where kind = 'phone' and value_hash = $1 limit 1`, [phoneHash]);
  if (banned.rows.length) throw new TrustError("This phone number cannot be used.", "FORBIDDEN");
  const taken = await db.query(
    `select 1 from users where phone_hash = $1 and id <> $2 and deleted_at is null limit 1`,
    [phoneHash, userId],
  );
  if (taken.rows.length) throw new TrustError("This phone number is already linked to another account.", "FORBIDDEN");
}

async function markPhoneVerified(db: Queryable, userId: string, phone: string, phoneHash: string): Promise<void> {
  await db.query(`update users set phone_verified_at = now(), phone_hash = $2 where id = $1`, [userId, phoneHash]);
  // Keep the visible profile phone in sync with the verified one.
  await db.query(`update profiles set phone = $2 where user_id = $1 and deleted_at is null`, [userId, phone]);
}

export async function sendPhoneCode(db: Queryable, userId: string, rawPhone: string): Promise<void> {
  const phone = normalizePhone(rawPhone);
  if (!E164.test(phone)) throw new TrustError("Enter your phone number in international format, for example +85512345678.");
  if (!smsDeliveryReady()) throw new DeliveryUnavailableError("SMS delivery is not configured");
  const phoneHash = hashIdentifier("phone", phone);
  await assertPhoneUsable(db, userId, phoneHash);

  const recent = await db.query<{ n: number }>(
    `select count(*)::int as n from verification_codes
      where user_id = $1 and channel = 'sms' and created_at > now() - interval '1 hour'`,
    [userId],
  );
  if ((recent.rows[0]?.n ?? 0) >= SMS_MAX_SENDS_PER_HOUR) throw new TrustError("Too many codes requested. Try again later.", "TOO_MANY_REQUESTS");

  const code = randomSixDigitCode();
  await db.query(
    `insert into verification_codes (user_id, channel, target_hash, code_hash, expires_at)
     values ($1, 'sms', $2, $3, now() + make_interval(mins => $4))`,
    [userId, phoneHash, sha256(`${phoneHash}:${code}`), SMS_CODE_TTL_MINUTES],
  );
  await sendSms(phone, `Your Homlo verification code is ${code}. It expires in ${SMS_CODE_TTL_MINUTES} minutes.`);
}

export async function verifyPhoneCode(db: Queryable, userId: string, rawPhone: string, code: string): Promise<void> {
  const phone = normalizePhone(rawPhone);
  const phoneHash = hashIdentifier("phone", phone);
  const { rows } = await db.query<{ id: string; code_hash: string; attempts: number }>(
    `select id, code_hash, attempts from verification_codes
      where user_id = $1 and channel = 'sms' and target_hash = $2 and consumed_at is null and expires_at > now()
      order by created_at desc limit 1`,
    [userId, phoneHash],
  );
  const row = rows[0];
  if (!row || row.attempts >= SMS_MAX_ATTEMPTS) throw new TrustError("This code has expired. Request a new one.");
  if (row.code_hash !== sha256(`${phoneHash}:${code.trim()}`)) {
    await db.query(`update verification_codes set attempts = attempts + 1 where id = $1`, [row.id]);
    throw new TrustError("That code is not correct.");
  }
  await db.query(`update verification_codes set consumed_at = now() where id = $1`, [row.id]);
  await markPhoneVerified(db, userId, phone, phoneHash);
}
