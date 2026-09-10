import type { Express, Request, Response } from "express";

import { getHomloDirectService } from "../homlo-direct-service";
import { homloEventInputSchema } from "../event-logging";

const MAX_SNAPSHOT_BYTES = 20_000;
const USER_CACHE_TTL_MS = 5 * 60_000;
const USER_CACHE_MAX_ENTRIES = 5_000;

const userCache = new Map<string, { userId: string; expiresAt: number }>();

function requestSourceIp(req: Request): string | null {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  if (req.ip) return req.ip;
  return req.socket?.remoteAddress ?? null;
}

/**
 * Resolves an access token to a user id for event attribution. Cheap because it
 * is cached: browsing events are high-frequency and per-event Supabase round
 * trips would defeat the purpose of the (mostly) fire-and-forget endpoint.
 * Failures fall back to anonymous attribution; the event is still recorded.
 */
function resolveUserForLogging(accessToken: string): Promise<{ id: string } | null> {
  const cached = userCache.get(accessToken);
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve({ id: cached.userId });
  return getHomloDirectService()
    .resolveSession(accessToken)
    .then((user) => {
      userCache.set(accessToken, { userId: user.id, expiresAt: Date.now() + USER_CACHE_TTL_MS });
      if (userCache.size > USER_CACHE_MAX_ENTRIES) {
        for (const [key, entry] of userCache) {
          if (entry.expiresAt <= Date.now()) userCache.delete(key);
        }
      }
      return { id: user.id };
    })
    .catch(() => null);
}

export function registerEventLogRoutes(app: Express) {
  app.post("/api/events/log", async (req: Request, res: Response) => {
    const input = homloEventInputSchema.safeParse(req.body);
    if (!input.success) {
      return res.status(400).json({ ok: false, code: "INVALID_PAYLOAD", error: "Invalid event payload" });
    }

    if (input.data.rankingScoreSnapshot && JSON.stringify(input.data.rankingScoreSnapshot).length > MAX_SNAPSHOT_BYTES) {
      return res.status(400).json({ ok: false, code: "INVALID_PAYLOAD", error: "Event payload too large" });
    }

    const ip = requestSourceIp(req);
    let userId: string | null = null;
    const accessToken = getHomloDirectService().getAccessToken(req);
    if (accessToken) {
      const user = await resolveUserForLogging(accessToken);
      userId = user?.id ?? null;
    }

    const result = await getHomloDirectService().logEvent(input.data, { ip, userId });

    if (result.ok) {
      return res.json({ ok: true, id: result.id });
    }
    switch (result.code) {
      case "rate_limited":
        return res.status(429).json({ ok: false, code: "RATE_LIMITED", error: "Too many events" });
      case "invalid_job":
        return res.status(400).json({ ok: false, code: "INVALID_JOB", error: "Unknown job" });
      case "invalid_payload":
        return res.status(400).json({ ok: false, code: "INVALID_PAYLOAD", error: "Invalid event payload" });
      case "database":
        return res.status(500).json({ ok: false, code: "SERVER_ERROR", error: "Could not record event" });
    }
  });
}