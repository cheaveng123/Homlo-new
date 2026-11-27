import type { NextFunction, Request, Response } from "express";
import { rateLimit, ipKeyGenerator, type Options, type RateLimitRequestHandler } from "express-rate-limit";

import { requestSourceIp } from "./requestIp";

export const RATE_LIMIT_ERROR_MESSAGE = "Too many attempts, please try again later";

const FIVE_MINUTES_MS = 5 * 60_000;
const FIFTEEN_MINUTES_MS = 15 * 60_000;

export function normalizeAuthEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized ? normalized : null;
}

function clientIpKey(req: Request): string {
  return ipKeyGenerator(requestSourceIp(req) ?? "unknown");
}

function rateLimitHandler(
  req: Request,
  res: Response,
  _next: NextFunction,
  options: Options,
): void {
  const info = (req as Request & { rateLimit?: { resetTime?: Date } }).rateLimit;
  const resetTime = info?.resetTime;
  const retryAfterSeconds = resetTime
    ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1_000))
    : Math.max(1, Math.ceil(options.windowMs / 1_000));

  res.setHeader("Retry-After", String(retryAfterSeconds));
  res.status(options.statusCode).json({ error: RATE_LIMIT_ERROR_MESSAGE });
}

function emailKey(req: Request): string {
  const body = req.body as { email?: unknown } | undefined;
  const email = normalizeAuthEmail(body?.email);
  if (email) return `email:${email}`;
  return `email-missing:${clientIpKey(req)}`;
}

export type AuthRateLimitConfig = {
  windowMs?: number;
  signInLimit?: number;
  signUpLimit?: number;
  refreshLimit?: number;
  logoutLimit?: number;
  emailWindowMs?: number;
  emailFailureLimit?: number;
};

export type AuthRateLimiters = {
  signIn: RateLimitRequestHandler;
  signUp: RateLimitRequestHandler;
  refresh: RateLimitRequestHandler;
  logout: RateLimitRequestHandler;
  signInEmailFailures: RateLimitRequestHandler;
};

/**
 * In-memory limiters (express-rate-limit's default MemoryStore), so limits are
 * per Node instance. If this server later runs as multiple instances, replace
 * the store with a shared one (e.g. Redis) so counters are shared.
 */
export function createAuthRateLimiters(config: AuthRateLimitConfig = {}): AuthRateLimiters {
  const {
    windowMs = FIVE_MINUTES_MS,
    signInLimit = 20,
    signUpLimit = 20,
    refreshLimit = 60,
    logoutLimit = 120,
    emailWindowMs = FIFTEEN_MINUTES_MS,
    emailFailureLimit = 5,
  } = config;

  const baseOptions = {
    windowMs,
    standardHeaders: "draft-7" as const,
    legacyHeaders: false,
    keyGenerator: clientIpKey,
    handler: rateLimitHandler,
    message: RATE_LIMIT_ERROR_MESSAGE,
  };

  return {
    signIn: rateLimit({ ...baseOptions, limit: signInLimit }),
    signUp: rateLimit({ ...baseOptions, limit: signUpLimit }),
    refresh: rateLimit({ ...baseOptions, limit: refreshLimit }),
    logout: rateLimit({ ...baseOptions, limit: logoutLimit }),
    signInEmailFailures: rateLimit({
      windowMs: emailWindowMs,
      limit: emailFailureLimit,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      skipSuccessfulRequests: true,
      keyGenerator: emailKey,
      handler: rateLimitHandler,
      message: RATE_LIMIT_ERROR_MESSAGE,
    }),
  };
}
