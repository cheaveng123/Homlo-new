import type { Express, Request, Response } from "express";
import { rateLimit } from "express-rate-limit";

import { getHomloDirectService } from "../homlo-direct-service";
import { getPlanBoostDb } from "../plan-boost-db";
import { confirmEmailToken } from "./accounts";
import { assertTrustSecretsConfigured } from "./crypto";
import { startTrustSweeper } from "./privacy";

// Plain text, not HTML: Supabase serves Edge Function responses on its own
// domain as text/plain, so an HTML page showed up as raw code in the browser.
function page(title: string, message: string) {
  return `${title}\n\n${message}\n`;
}

export function registerTrustRoutes(app: Express) {
  const limiter = rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: "draft-7", legacyHeaders: false });

  // Target of the confirmation link in the verification email.
  app.get("/api/trust/verify-email", limiter, async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    // The designed result page lives on the website (Supabase shows HTML from
    // Edge Functions as plain text). Without it configured, answer in plain text.
    const resultPage = (process.env.HOMLO_EMAIL_CONFIRM_PAGE_URL ?? "").trim();
    const reply = (status: number, state: "confirmed" | "expired" | "invalid" | "error", title: string, message: string) => {
      if (resultPage) return res.redirect(303, `${resultPage}${resultPage.includes("?") ? "&" : "?"}status=${state}`);
      return res.status(status).type("text/plain; charset=utf-8").send(page(title, message));
    };
    const token = typeof req.query.token === "string" ? req.query.token : "";
    if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) {
      return reply(400, "invalid", "Link not valid", "This confirmation link is not valid.");
    }
    try {
      const ok = await confirmEmailToken(getPlanBoostDb(), token);
      if (!ok) return reply(400, "expired", "Link expired", "This link has expired or was already used. Request a new one in the app.");
      return reply(200, "confirmed", "Email confirmed", "Thank you. Your email address is confirmed. You can go back to the app.");
    } catch (error) {
      console.error("[trust] verify-email failed", error);
      return reply(500, "error", "Something went wrong", "Please try again later.");
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
