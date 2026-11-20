import type { Express, Request, Response } from "express";
import { rateLimit } from "express-rate-limit";

import { getHomloDirectService } from "../homlo-direct-service";
import { getPlanBoostDb } from "../plan-boost-db";
import { confirmEmailToken } from "./accounts";
import { assertTrustSecretsConfigured } from "./crypto";
import { startTrustSweeper } from "./privacy";

function page(title: string, message: string) {
  const esc = (v: string) => v.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><style>body{font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 16px;color:#1f2937}h1{font-size:1.4rem}</style>
</head><body><h1>${esc(title)}</h1><p>${esc(message)}</p></body></html>`;
}

export function registerTrustRoutes(app: Express) {
  const limiter = rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: "draft-7", legacyHeaders: false });

  // Target of the confirmation link in the verification email.
  app.get("/api/trust/verify-email", limiter, async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    const token = typeof req.query.token === "string" ? req.query.token : "";
    if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) {
      return res.status(400).send(page("Link not valid", "This confirmation link is not valid."));
    }
    try {
      const ok = await confirmEmailToken(getPlanBoostDb(), token);
      if (!ok) return res.status(400).send(page("Link expired", "This link has expired or was already used. Request a new one in the app."));
      return res.send(page("Email confirmed", "Thank you. Your email address is confirmed. You can go back to the app."));
    } catch (error) {
      console.error("[trust] verify-email failed", error);
      return res.status(500).send(page("Something went wrong", "Please try again later."));
    }
  });
}

/** Called once at boot: checks secrets, then starts listing expiry, emails and retention. */
export function startTrustBackgroundJobs() {
  assertTrustSecretsConfigured();
  if (process.env.HOMLO_DISABLE_TRUST_SWEEPER === "true") return;
  try {
    const service = getHomloDirectService();
    startTrustSweeper(getPlanBoostDb(), (userId) => service.closeAccountById(userId));
  } catch (error) {
    console.error("[trust] sweeper not started", error);
  }
}

// Throttled "last active" stamp for the inactive-account rule (once per user per hour).
const lastTouch = new Map<string, number>();
export function touchActivity(userId: string) {
  const now = Date.now();
  if ((lastTouch.get(userId) ?? 0) > now - 3_600_000) return;
  lastTouch.set(userId, now);
  if (lastTouch.size > 50_000) lastTouch.clear();
  void getPlanBoostDb()
    .query(`update users set last_active_at = now(), inactivity_warning_sent_at = null where id = $1`, [userId])
    .catch(() => undefined);
}
