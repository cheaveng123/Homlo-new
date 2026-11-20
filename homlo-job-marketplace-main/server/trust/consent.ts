import type { Request } from "express";

import type { Queryable } from "../hlPlanBoostService";
import { encryptField } from "./crypto";

export type ConsentType = "signup" | "job_posting" | "payment_terms" | "marketing_opt_in" | "marketing_opt_out";

/** What we know about the request that gave the consent. */
export type RequestMeta = { ip: string | null; userAgent: string | null; deviceId: string | null };

export function requestMeta(req: Request): RequestMeta {
  const device = req.headers["x-homlo-device-id"];
  const ua = req.headers["user-agent"];
  return {
    ip: req.ip ?? req.socket?.remoteAddress ?? null,
    userAgent: typeof ua === "string" ? ua.slice(0, 512) : null,
    deviceId: typeof device === "string" && /^[A-Za-z0-9_-]{8,128}$/.test(device) ? device : null,
  };
}

export async function getLegalVersions(db: Queryable): Promise<{ terms: string; privacy: string }> {
  const { rows } = await db.query<{ key: string; value: string }>(
    `select key, value from trust_settings where key in ('terms_version', 'privacy_version')`,
  );
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return { terms: map.terms_version ?? "1.0", privacy: map.privacy_version ?? "1.0" };
}

/**
 * Appends one row to consent_log. The versions are always the CURRENT ones
 * from trust_settings (never trusted from the client), so the record shows
 * exactly which text the user agreed to.
 */
export async function recordConsent(
  db: Queryable,
  input: { userId: string; type: ConsentType; meta: RequestMeta; listingId?: string | null; metadata?: Record<string, unknown> },
): Promise<{ id: string; createdAt: string }> {
  const versions = await getLegalVersions(db);
  const { rows } = await db.query<{ id: string; created_at: Date }>(
    `insert into consent_log (user_id, consent_type, terms_version, privacy_version, ip_address, user_agent, listing_id, metadata)
     values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
     returning id, created_at`,
    [
      input.userId,
      input.type,
      versions.terms,
      versions.privacy,
      encryptField(input.meta.ip),
      encryptField(input.meta.userAgent),
      input.listingId ?? null,
      input.metadata ? JSON.stringify(input.metadata) : null,
    ],
  );
  return { id: rows[0].id, createdAt: new Date(rows[0].created_at).toISOString() };
}
