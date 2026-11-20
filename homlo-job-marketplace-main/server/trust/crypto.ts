import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt } from "node:crypto";

/**
 * Small crypto helpers for trust & safety data.
 *
 * - hashIdentifier: keyed HMAC for emails / phones / device ids / IPs we must
 *   match later (ban list) but never need to read back.
 * - encryptField / decryptField: AES-256-GCM for values we store and may need
 *   to read later (IP address and user agent in consent_log, for disputes).
 *
 * Keys come from the environment. In production both are required (see
 * assertTrustSecretsConfigured). In development a fixed fallback is used so the
 * app runs without setup, and values are clearly marked as dev-encrypted.
 */

const DEV_FALLBACK = "homlo-dev-only-not-secret";

function isProduction(env: NodeJS.ProcessEnv = process.env) {
  return env.NODE_ENV === "production" || env.APP_ENV === "production";
}

export function assertTrustSecretsConfigured(env: NodeJS.ProcessEnv = process.env) {
  if (!isProduction(env)) return;
  const missing = ["FIELD_ENCRYPTION_KEY", "HOMLO_IDENTIFIER_HASH_SECRET"].filter((k) => !env[k] || env[k]!.length < 32);
  if (missing.length) {
    throw new Error(`Trust & safety secrets missing or too short (need 32+ chars): ${missing.join(", ")}`);
  }
}

function hashSecret() {
  return process.env.HOMLO_IDENTIFIER_HASH_SECRET || DEV_FALLBACK;
}

function encryptionKey(): Buffer {
  // Any string works; it is stretched to 32 bytes with SHA-256.
  return createHash("sha256").update(process.env.FIELD_ENCRYPTION_KEY || DEV_FALLBACK).digest();
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

/** Keeps digits and a leading +. Callers validate E.164 shape separately. */
export function normalizePhone(phone: string) {
  const trimmed = phone.trim();
  return (trimmed.startsWith("+") ? "+" : "") + trimmed.replace(/\D/g, "");
}

export function hashIdentifier(kind: "email" | "phone" | "device" | "ip", value: string) {
  const normalized = kind === "email" ? normalizeEmail(value) : kind === "phone" ? normalizePhone(value) : value.trim();
  return createHmac("sha256", hashSecret()).update(`${kind}:${normalized}`).digest("hex");
}

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function randomToken() {
  return randomBytes(32).toString("base64url");
}

export function randomSixDigitCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function encryptField(plain: string | null | undefined): string | null {
  if (plain == null || plain === "") return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${Buffer.concat([iv, tag, data]).toString("base64")}`;
}

export function decryptField(stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (!stored.startsWith("enc:v1:")) return stored;
  try {
    const raw = Buffer.from(stored.slice("enc:v1:".length), "base64");
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    return null; // wrong key or tampered value
  }
}
