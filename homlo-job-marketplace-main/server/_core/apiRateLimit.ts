import type { NextFunction, Request, RequestHandler, Response } from "express";
import rateLimit, { ipKeyGenerator, type Options, type RateLimitRequestHandler } from "express-rate-limit";

const RATE_LIMIT_ERROR_MESSAGE = "Too many requests";

const ONE_MINUTE_MS = 60_000;
const FIVE_MINUTES_MS = 5 * 60_000;
const TEN_MINUTES_MS = 10 * 60_000;

// Batched tRPC calls join procedure names with commas in the path, so each
// name is matched with `includes` rather than an exact comparison.
const PUBLIC_TRPC_PROCEDURES = [
  "homlo.publicJobs",
  "homlo.categories",
  "homlo.employerProfile",
  "homlo.homeFeed",
  "homlo.searchJobs",
  "auth.me",
] as const;

function clientIpKey(req: Request): string {
  return ipKeyGenerator(req.ip ?? "unknown");
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

function isPublicTrpcPath(path: string): boolean {
  return PUBLIC_TRPC_PROCEDURES.some((name) => path.includes(name));
}

export type ApiRateLimiters = {
  trpcGeneral: RateLimitRequestHandler;
  trpcPublic: RequestHandler;
  upload: RateLimitRequestHandler;
  feed: RateLimitRequestHandler;
};

/**
 * In-memory limiters (express-rate-limit's default MemoryStore), so limits are
 * per Node instance. If this server later runs as multiple instances, replace
 * the store with a shared one (e.g. Redis) so counters are shared.
 */
export function createApiRateLimiters(): ApiRateLimiters {
  const baseOptions = {
    standardHeaders: "draft-7" as const,
    legacyHeaders: false,
    keyGenerator: clientIpKey,
    handler: rateLimitHandler,
    message: RATE_LIMIT_ERROR_MESSAGE,
    statusCode: 429,
  };

  const trpcGeneral = rateLimit({
    ...baseOptions,
    windowMs: FIVE_MINUTES_MS,
    limit: 300,
  });

  const trpcPublicLimiter = rateLimit({
    ...baseOptions,
    windowMs: FIVE_MINUTES_MS,
    limit: 60,
  });

  const trpcPublic: RequestHandler = (req, res, next) => {
    if (!isPublicTrpcPath(req.path)) return next();
    return trpcPublicLimiter(req, res, next);
  };

  const upload = rateLimit({
    ...baseOptions,
    windowMs: TEN_MINUTES_MS,
    limit: 20,
  });

  const feed = rateLimit({
    ...baseOptions,
    windowMs: ONE_MINUTE_MS,
    limit: 100,
  });

  return { trpcGeneral, trpcPublic, upload, feed };
}
