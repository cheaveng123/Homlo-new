import type { Request } from "express";

export const DEFAULT_TRUST_PROXY_HOPS = 0;

type AppWithSettings = {
  set(setting: string, value: unknown): unknown;
};

/**
 * Parses TRUST_PROXY_HOPS. Only non-negative integers are accepted; anything
 * else falls back to 0 so we never accidentally trust X-Forwarded-For.
 */
export function parseTrustProxyHops(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") return DEFAULT_TRUST_PROXY_HOPS;
  const parsed = Number(raw.trim());
  if (!Number.isInteger(parsed) || parsed < 0) return DEFAULT_TRUST_PROXY_HOPS;
  return parsed;
}

/**
 * Configures Express `trust proxy` from the number of reverse proxies that
 * actually sit in front of this server. With the default of 0, Express ignores
 * X-Forwarded-For and req.ip is the direct socket address.
 */
export function configureTrustProxy(
  app: AppWithSettings,
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = env.TRUST_PROXY_HOPS;
  const hops = parseTrustProxyHops(raw);
  app.set("trust proxy", hops);

  const unset = raw === undefined || raw.trim() === "";
  if (env.NODE_ENV === "production" && unset) {
    console.warn(
      "[api] TRUST_PROXY_HOPS is not set; defaulting to 0 and ignoring X-Forwarded-For. " +
        "Set TRUST_PROXY_HOPS=1 after deploying behind one proxy (Render/Railway/Fly/Heroku).",
    );
  } else if (!unset && Number(raw) !== hops) {
    console.warn(`[api] Invalid TRUST_PROXY_HOPS=${JSON.stringify(raw)}; using ${hops}.`);
  }

  return hops;
}

/**
 * The single source of truth for the client IP. Express applies the configured
 * trust-proxy hop count to req.ip before this is called.
 */
export function requestSourceIp(req: Request): string | null {
  if (req.ip) return req.ip;
  return req.socket?.remoteAddress ?? null;
}
