import type { Express, Request } from "express";
import { createServer, type Server } from "node:http";
import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createAuthRateLimiters,
  normalizeAuthEmail,
  RATE_LIMIT_ERROR_MESSAGE,
} from "../server/_core/authRateLimit";
import {
  configureTrustProxy,
  parseTrustProxyHops,
  requestSourceIp,
} from "../server/_core/requestIp";

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) => new Promise<void>((resolve) => server.close(() => resolve())),
    ),
  );
});

async function startApp(register: (app: Express) => void): Promise<string> {
  const app = express();
  app.set("trust proxy", 0);
  app.use(express.json());
  register(app);

  const server = createServer(app);
  servers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server did not bind to a port");
  return `http://127.0.0.1:${address.port}`;
}

function post(
  baseUrl: string,
  path: string,
  body: unknown,
): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("normalizeAuthEmail", () => {
  it("trims and lowercases email addresses", () => {
    expect(normalizeAuthEmail("  User@Example.COM ")).toBe("user@example.com");
  });

  it("rejects missing or non-string values", () => {
    expect(normalizeAuthEmail(undefined)).toBeNull();
    expect(normalizeAuthEmail(null)).toBeNull();
    expect(normalizeAuthEmail(123)).toBeNull();
    expect(normalizeAuthEmail("   ")).toBeNull();
  });
});

describe("trust proxy configuration", () => {
  it("defaults to 0 hops and ignores invalid values", () => {
    expect(parseTrustProxyHops(undefined)).toBe(0);
    expect(parseTrustProxyHops("")).toBe(0);
    expect(parseTrustProxyHops("abc")).toBe(0);
    expect(parseTrustProxyHops("-1")).toBe(0);
    expect(parseTrustProxyHops("1.5")).toBe(0);
    expect(parseTrustProxyHops("1")).toBe(1);
    expect(parseTrustProxyHops("2")).toBe(2);
  });

  it("sets Express trust proxy to the configured hop count", () => {
    const app = { set: vi.fn() };
    configureTrustProxy(app, { NODE_ENV: "production", TRUST_PROXY_HOPS: "1" });
    expect(app.set).toHaveBeenCalledWith("trust proxy", 1);
  });

  it("warns in production when TRUST_PROXY_HOPS is unset", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const app = { set: vi.fn() };
    configureTrustProxy(app, { NODE_ENV: "production" });
    expect(app.set).toHaveBeenCalledWith("trust proxy", 0);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("TRUST_PROXY_HOPS is not set"));
    warn.mockRestore();
  });

  it("does not warn in development when TRUST_PROXY_HOPS is unset", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    configureTrustProxy({ set: vi.fn() }, { NODE_ENV: "development" });
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("uses req.ip and never reads X-Forwarded-For directly", () => {
    const req = {
      ip: "127.0.0.1",
      headers: { "x-forwarded-for": "203.0.113.9" },
      socket: { remoteAddress: "10.0.0.5" },
    } as unknown as Request;
    expect(requestSourceIp(req)).toBe("127.0.0.1");
  });

  it("falls back to the socket address when req.ip is unavailable", () => {
    const req = {
      ip: undefined,
      headers: {},
      socket: { remoteAddress: "10.0.0.5" },
    } as unknown as Request;
    expect(requestSourceIp(req)).toBe("10.0.0.5");
  });
});

describe("auth IP rate limiting", () => {
  it("returns 429 with a generic body and Retry-After after the sign-in limit", async () => {
    const limiters = createAuthRateLimiters({ signInLimit: 2, emailFailureLimit: 100 });
    const baseUrl = await startApp((app) => {
      app.post("/sign-in", limiters.signIn, (_req, res) => res.json({ ok: true }));
    });

    expect((await post(baseUrl, "/sign-in", {})).status).toBe(200);
    expect((await post(baseUrl, "/sign-in", {})).status).toBe(200);

    const blocked = await post(baseUrl, "/sign-in", {});
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ error: RATE_LIMIT_ERROR_MESSAGE });
    const retryAfter = Number(blocked.headers.get("retry-after"));
    expect(Number.isInteger(retryAfter)).toBe(true);
    expect(retryAfter).toBeGreaterThanOrEqual(1);
  });

  it("applies a separate sign-up limit", async () => {
    const limiters = createAuthRateLimiters({ signUpLimit: 1 });
    const baseUrl = await startApp((app) => {
      app.post("/sign-up", limiters.signUp, (_req, res) => res.json({ ok: true }));
    });

    expect((await post(baseUrl, "/sign-up", {})).status).toBe(200);
    const blocked = await post(baseUrl, "/sign-up", {});
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ error: RATE_LIMIT_ERROR_MESSAGE });
    expect(blocked.headers.get("retry-after")).not.toBeNull();
  });

  it("applies a more lenient refresh limit", async () => {
    const limiters = createAuthRateLimiters({ refreshLimit: 2 });
    const baseUrl = await startApp((app) => {
      app.post("/refresh", limiters.refresh, (_req, res) => res.json({ ok: true }));
    });

    expect((await post(baseUrl, "/refresh", {})).status).toBe(200);
    expect((await post(baseUrl, "/refresh", {})).status).toBe(200);
    expect((await post(baseUrl, "/refresh", {})).status).toBe(429);
  });
});

describe("per-email sign-in failure limiting", () => {
  it("blocks after repeated failures for the same normalized email only", async () => {
    const limiters = createAuthRateLimiters({
      emailFailureLimit: 2,
      emailWindowMs: 60_000,
      signInLimit: 100,
    });
    const baseUrl = await startApp((app) => {
      app.post("/sign-in", limiters.signInEmailFailures, (req, res) => {
        if (req.body?.password === "correct") return res.json({ ok: true });
        return res.status(401).json({ error: "Invalid credentials" });
      });
    });

    expect((await post(baseUrl, "/sign-in", { email: "User@Example.com", password: "wrong" })).status).toBe(401);
    expect((await post(baseUrl, "/sign-in", { email: " user@example.COM ", password: "wrong" })).status).toBe(401);

    const blocked = await post(baseUrl, "/sign-in", {
      email: "USER@example.com",
      password: "correct",
    });
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ error: RATE_LIMIT_ERROR_MESSAGE });
    expect(blocked.headers.get("retry-after")).not.toBeNull();

    const otherEmail = await post(baseUrl, "/sign-in", {
      email: "someone-else@example.com",
      password: "correct",
    });
    expect(otherEmail.status).toBe(200);
  });

  it("lets a normal single sign-in through", async () => {
    const limiters = createAuthRateLimiters({ emailFailureLimit: 5 });
    const baseUrl = await startApp((app) => {
      app.post("/sign-in", limiters.signInEmailFailures, (req, res) => {
        if (req.body?.password === "correct") return res.json({ ok: true });
        return res.status(401).json({ error: "Invalid credentials" });
      });
    });

    const response = await post(baseUrl, "/sign-in", {
      email: "user@example.com",
      password: "correct",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("does not reveal whether an email exists in the 429 body", async () => {
    const limiters = createAuthRateLimiters({
      emailFailureLimit: 1,
      emailWindowMs: 60_000,
      signInLimit: 100,
    });
    const baseUrl = await startApp((app) => {
      app.post("/sign-in", limiters.signInEmailFailures, (_req, res) =>
        res.status(401).json({ error: "Invalid credentials" }),
      );
    });

    await post(baseUrl, "/sign-in", { email: "known@example.com", password: "wrong" });
    const blocked = await post(baseUrl, "/sign-in", {
      email: "known@example.com",
      password: "wrong",
    });

    const body = await blocked.json();
    expect(blocked.status).toBe(429);
    expect(body).toEqual({ error: RATE_LIMIT_ERROR_MESSAGE });
    expect(JSON.stringify(body)).not.toContain("known@example.com");
  });
});
