import type { Express, Request, Response } from "express";
import { z } from "zod";

import { createAuthRateLimiters } from "./authRateLimit";
import { getSessionCookieOptions } from "./cookies";
import { getPlanBoostDb } from "../plan-boost-db";
import { ipMatchesBannedAccount, isBlockedFromSignup, recordDevice, sendEmailVerification } from "../trust/accounts";
import { recordConsent, requestMeta } from "../trust/consent";
import { getHomloDirectService, SUPABASE_ACCESS_COOKIE, SUPABASE_REFRESH_COOKIE, type HomloAuthResult, type HomloSessionUser } from "../homlo-direct-service";

const signInSchema = z.object({ email: z.string().trim().email().max(320), password: z.string().min(8).max(128) });
const signUpSchema = signInSchema.extend({
  fullName: z.string().trim().min(2).max(120).optional(),
  /** "I confirm that I am 18 years old or older ... agree to the Terms of Service and Privacy Policy." Required, never pre-ticked. */
  acceptTerms: z.literal(true),
  /** Optional, separate, unticked by default. */
  marketingOptIn: z.boolean().optional().default(false),
});

/**
 * Runs right after a new account exists: records the sign-up (and optional
 * marketing) consent, the device signals, and sends the email confirmation
 * link. A failure here is logged, not fatal: the posting gate in the database
 * still requires the consent row and the verified email, so nothing unsafe
 * can happen without them.
 */
async function afterSignUp(req: Request, userId: string, marketingOptIn: boolean) {
  const db = getPlanBoostDb();
  const meta = requestMeta(req);
  try {
    await recordConsent(db, { userId, type: "signup", meta });
    if (marketingOptIn) {
      await recordConsent(db, { userId, type: "marketing_opt_in", meta });
      await db.query(`update users set marketing_opt_in = true where id = $1`, [userId]);
    }
    await recordDevice(db, userId, meta);
    if (await ipMatchesBannedAccount(db, meta)) {
      await db.query(
        `insert into audit_logs (action, entity_type, entity_id, metadata) values ('signup.ip_matches_banned', 'user', $1, '{}'::jsonb)`,
        [userId],
      );
    }
    await sendEmailVerification(db, userId);
  } catch (error) {
    console.error("[supabase-auth] post sign-up trust steps failed", error);
  }
}
const refreshSchema = z.object({ refreshToken: z.string().min(20).max(4096).optional() });

function isNativeRequest(req: Request) {
  return req.headers["x-homlo-client"] === "native";
}

function setSessionCookies(req: Request, res: Response, result: HomloAuthResult) {
  const cookieOptions = getSessionCookieOptions(req);
  const accessMaxAge = Math.max(60_000, (result.session.expiresIn ?? 3_600) * 1_000);
  res.cookie(SUPABASE_ACCESS_COOKIE, result.session.accessToken, { ...cookieOptions, maxAge: accessMaxAge });
  res.cookie(SUPABASE_REFRESH_COOKIE, result.session.refreshToken, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1_000 });
}

function clearSessionCookies(req: Request, res: Response) {
  const cookieOptions = getSessionCookieOptions(req);
  res.clearCookie(SUPABASE_ACCESS_COOKIE, cookieOptions);
  res.clearCookie(SUPABASE_REFRESH_COOKIE, cookieOptions);
}

function publicAuthResponse(req: Request, result: HomloAuthResult) {
  return {
    user: result.user,
    session: isNativeRequest(req) ? result.session : null,
  };
}

type AuthErrorCarrier = {
  code?: unknown;
  status?: unknown;
  statusCode?: unknown;
  httpStatus?: unknown;
  data?: { code?: unknown; httpStatus?: unknown };
};

function isHttpStatus(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 400 && value <= 599;
}

function authErrorStatus(error: unknown, fallback: number): number {
  const candidate = error as AuthErrorCarrier | null;
  const statuses = [candidate?.httpStatus, candidate?.data?.httpStatus, candidate?.status, candidate?.statusCode];
  for (const status of statuses) {
    if (isHttpStatus(status)) return status;
  }
  if (candidate?.code === "UNAUTHORIZED" || candidate?.data?.code === "UNAUTHORIZED") return 401;
  if (error instanceof Error && /invalid login credentials|invalid credentials|invalid grant|invalid token|jwt|refresh token|session/i.test(error.message)) return 401;
  return fallback;
}

function sendAuthError(res: Response, error: unknown, scope: string, message: string, status: number) {
  console.error(`[supabase-auth] ${scope} failed`, error);
  return res.status(status).json({ error: message });
}

export function registerSupabaseAuthRoutes(app: Express) {
  const authRateLimiters = createAuthRateLimiters();

  app.post("/api/supabase-auth/sign-up", authRateLimiters.signUp, async (req: Request, res: Response) => {
    const input = signUpSchema.safeParse(req.body);
    if (!input.success) {
      const missingConsent = input.error.issues.some((issue) => issue.path[0] === "acceptTerms");
      return res.status(400).json({
        error: missingConsent
          ? "Confirm that you are 18 or older and agree to the Terms of Service and Privacy Policy"
          : "Enter a valid email and a password with at least 8 characters",
      });
    }
    try {
      // Banned people may not register again (email / device match).
      if (await isBlockedFromSignup(getPlanBoostDb(), input.data.email, requestMeta(req))) {
        return res.status(403).json({ error: "Unable to create account" });
      }
      const result = await getHomloDirectService().signUp(input.data.email, input.data.password, input.data.fullName);
      if ("confirmationRequired" in result) {
        return res.status(202).json({ confirmationRequired: true, message: "Your Homlo account is ready. Log in with your new email and password." });
      }
      await afterSignUp(req, result.user.id, input.data.marketingOptIn);
      setSessionCookies(req, res, result);
      return res.status(201).json(publicAuthResponse(req, result));
    } catch (error) {
      if (error instanceof Error && /rate limit|too many requests/i.test(error.message)) {
        return sendAuthError(res, error, "sign-up", "Please try again later", 429);
      }
      return sendAuthError(res, error, "sign-up", "Unable to create account", 400);
    }
  });

  app.post(
    "/api/supabase-auth/sign-in",
    authRateLimiters.signIn,
    authRateLimiters.signInEmailFailures,
    async (req: Request, res: Response) => {
      const input = signInSchema.safeParse(req.body);
      if (!input.success) return res.status(400).json({ error: "Enter a valid email and password" });
      try {
        const result = await getHomloDirectService().signIn(input.data.email, input.data.password);
        void recordDevice(getPlanBoostDb(), result.user.id, requestMeta(req)).catch(() => undefined);
        setSessionCookies(req, res, result);
        return res.json(publicAuthResponse(req, result));
      } catch (error) {
        return sendAuthError(res, error, "sign-in", "Invalid email or password", authErrorStatus(error, 401));
      }
    },
  );

  app.post("/api/supabase-auth/refresh", authRateLimiters.refresh, async (req: Request, res: Response) => {
    const input = refreshSchema.safeParse(req.body);
    if (!input.success) return res.status(400).json({ error: "Invalid session refresh request" });
    const refreshToken = input.data.refreshToken ?? getHomloDirectService().getRefreshToken(req);
    if (!refreshToken) return res.status(401).json({ error: "No refresh session is available" });
    try {
      const result = await getHomloDirectService().refresh(refreshToken);
      setSessionCookies(req, res, result);
      return res.json(publicAuthResponse(req, result));
    } catch (error) {
      const status = authErrorStatus(error, 401);
      // Only drop the cookies when the refresh token was actually rejected;
      // an outage (5xx) must not sign the user out.
      if (status < 500) clearSessionCookies(req, res);
      return sendAuthError(res, error, "refresh", "Unable to refresh session", status);
    }
  });

  app.get("/api/supabase-auth/me", async (req: Request, res: Response) => {
    const accessToken = getHomloDirectService().getAccessToken(req);
    if (!accessToken) return res.status(401).json({ error: "Not authenticated", user: null });
    try {
      // Authoritative "who am I" check: always bypass the short session cache.
      const user = await getHomloDirectService().resolveSession(accessToken, { fresh: true });
      return res.json({ user: user satisfies HomloSessionUser });
    } catch (error) {
      // Auth provider unreachable: keep the session; the app retries.
      if ((error as { authUnavailable?: boolean } | null)?.authUnavailable) {
        return res.status(503).json({ error: "Authentication is temporarily unavailable", user: null });
      }
      clearSessionCookies(req, res);
      return res.status(401).json({ error: "Not authenticated", user: null });
    }
  });

  app.post("/api/supabase-auth/logout", authRateLimiters.logout, async (req: Request, res: Response) => {
    const directService = getHomloDirectService();
    const accessToken = directService.getAccessToken(req);
    try {
      if (accessToken) await directService.signOut(accessToken);
    } catch {
      // Clearing the local secure session remains safe when a remote token is already expired.
    }
    clearSessionCookies(req, res);
    return res.json({ success: true });
  });
}
