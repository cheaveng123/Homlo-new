import type { NextFunction, Request, Response } from "express";

const ALLOWED_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
const ALLOWED_HEADERS =
  "Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Homlo-Client, X-Homlo-Device-Id";

export interface CorsOptions {
  /** Defaults to process.env.NODE_ENV. */
  nodeEnv?: string;
  /** Defaults to process.env.ALLOWED_ORIGINS. Comma-separated. */
  allowedOrigins?: string;
}

function normalizeOrigin(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

function isLocalhostOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

export function parseAllowedOrigins(raw: string | undefined): string[] {
  if (!raw) return [];
  const origins = raw
    .split(",")
    .map((entry) => normalizeOrigin(entry))
    .filter((entry): entry is string => entry !== null);
  return [...new Set(origins)];
}

/**
 * Strict CORS: only origins that are explicitly allowlisted (plus localhost in
 * non-production) receive CORS headers. The request Origin is never reflected
 * back blindly, and credentials are only enabled for allowlisted origins.
 */
export function createCorsMiddleware(options: CorsOptions = {}) {
  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV;
  const isProduction = nodeEnv === "production";
  const configuredOrigins = parseAllowedOrigins(
    options.allowedOrigins ?? process.env.ALLOWED_ORIGINS,
  ).filter((origin) => !isProduction || !isLocalhostOrigin(origin));
  const allowedOrigins = new Set(configuredOrigins);

  return function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
    if (typeof res.vary === "function") res.vary("Origin");
    else res.setHeader("Vary", "Origin");

    const requestOrigin = normalizeOrigin(req.headers.origin ?? "");
    const originAllowed =
      requestOrigin !== null &&
      (allowedOrigins.has(requestOrigin) || (!isProduction && isLocalhostOrigin(requestOrigin)));

    if (originAllowed) {
      res.setHeader("Access-Control-Allow-Origin", requestOrigin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Methods", ALLOWED_METHODS);
      res.setHeader("Access-Control-Allow-Headers", ALLOWED_HEADERS);
    }

    if (req.method === "OPTIONS") {
      if (req.headers.origin && !originAllowed) {
        res.status(403).json({ error: "Origin not allowed" });
        return;
      }
      res.status(204).end();
      return;
    }

    next();
  };
}
