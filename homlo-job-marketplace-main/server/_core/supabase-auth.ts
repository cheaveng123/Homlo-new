import type { Express, Request, Response } from "express";
import { z } from "zod";

import { createAuthRateLimiters } from "./authRateLimit";
import { getSessionCookieOptions } from "./cookies";
import { getHomloDirectService, SUPABASE_ACCESS_COOKIE, SUPABASE_REFRESH_COOKIE, type HomloAuthResult, type HomloSessionUser } from "../homlo-direct-service";

const signInSchema = z.object({ email: z.string().trim().email().max(320), password: z.string().min(8).max(128) });
const signUpSchema = signInSchema.extend({ fullName: z.string().trim().min(2).max(120).optional() });
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
    if (!input.success) return res.status(400).json({ error: "Enter a valid email and a password with at least 8 characters" });
    try {
      const result = await getHomloDirectService().signUp(input.data.email, input.data.password, input.data.fullName);
      if ("confirmationRequired" in result) {
        return res.status(202).json({ confirmationRequired: true, message: "Check your email to confirm your Homlo account, then sign in." });
      }
      setSessionCookies(req, res, result);
      return res.status(201).json(publicAuthResponse(req, result));
    } catch (error) {
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
      clearSessionCookies(req, res);
      return sendAuthError(res, error, "refresh", "Unable to refresh session", authErrorStatus(error, 401));
    }
  });

  app.get("/api/supabase-auth/me", async (req: Request, res: Response) => {
    const accessToken = getHomloDirectService().getAccessToken(req);
    if (!accessToken) return res.status(401).json({ error: "Not authenticated", user: null });
    try {
      const user = await getHomloDirectService().resolveSession(accessToken);
      return res.json({ user: user satisfies HomloSessionUser });
    } catch {
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
