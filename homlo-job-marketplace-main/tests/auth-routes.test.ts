import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import http from "http";
import { type AddressInfo } from "node:net";

import { createApp } from "../server/_core/index";
import {
  getHomloDirectService,
  SUPABASE_ACCESS_COOKIE,
  SUPABASE_REFRESH_COOKIE,
} from "../server/homlo-direct-service";

const app = createApp();
let server: http.Server;

beforeAll(async () => {
  server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, () => resolve());
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

afterEach(() => {
  vi.restoreAllMocks();
});

function getPort(): number {
  return (server.address() as AddressInfo).port;
}

function request(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; body: string; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? undefined : JSON.stringify(body);
    const req = http.request(
      {
        hostname: "localhost",
        port: getPort(),
        path,
        method,
        headers: {
          ...(data ? { "Content-Type": "application/json" } : {}),
          ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        let chunks = "";
        res.on("data", (chunk) => {
          chunks += chunk;
        });
        res.on("end", () => {
          resolve({ status: res.statusCode!, body: chunks, headers: res.headers });
        });
      },
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

describe("Supabase auth HTTP routes (real server, no credentials needed)", () => {
  it("rejects a sign-in request whose password is shorter than 8 characters", async () => {
    const result = await request("POST", "/api/supabase-auth/sign-in", {
      email: "user@example.com",
      password: "short",
    });
    expect(result.status).toBe(400);
    expect(JSON.parse(result.body)).toEqual({ error: "Enter a valid email and password" });
  });

  it("returns 401 from /me when no session token is present", async () => {
    const result = await request("GET", "/api/supabase-auth/me");
    expect(result.status).toBe(401);
    expect(JSON.parse(result.body)).toEqual({ error: "Not authenticated", user: null });
  });

  it("logs out safely without a session and clears both session cookies", async () => {
    const result = await request("POST", "/api/supabase-auth/logout");
    expect(result.status).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ success: true });

    const setCookie = result.headers["set-cookie"] ?? [];
    const joined = setCookie.join("\n");
    expect(joined).toContain(`${SUPABASE_ACCESS_COOKIE}=`);
    expect(joined).toContain(`${SUPABASE_REFRESH_COOKIE}=`);
    expect(joined).toMatch(/Expires=Thu, 01 Jan 1970/i);
  });

  it("returns a generic 401 when sign-in fails without exposing Supabase details", async () => {
    const service = getHomloDirectService();
    const error = new Error("Invalid login credentials for user@example.com");
    vi.spyOn(service, "signIn").mockRejectedValue(error);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await request("POST", "/api/supabase-auth/sign-in", {
      email: "user@example.com",
      password: "password123",
    });

    expect(result.status).toBe(401);
    expect(JSON.parse(result.body)).toEqual({ error: "Invalid email or password" });
    expect(result.body).not.toContain("user@example.com");
    expect(log).toHaveBeenCalledWith("[supabase-auth] sign-in failed", error);
  });

  it("returns the same generic sign-up error whether or not the email already exists", async () => {
    const service = getHomloDirectService();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const signUp = vi.spyOn(service, "signUp");

    signUp.mockRejectedValueOnce(new Error("User already registered: existing@example.com"));
    const existing = await request("POST", "/api/supabase-auth/sign-up", {
      email: "existing@example.com",
      password: "password123",
    });

    signUp.mockRejectedValueOnce(new Error("database unavailable"));
    const otherFailure = await request("POST", "/api/supabase-auth/sign-up", {
      email: "new@example.com",
      password: "password123",
    });

    expect(existing.status).toBe(400);
    expect(existing.body).toBe(otherFailure.body);
    expect(JSON.parse(existing.body)).toEqual({ error: "Unable to create account" });
    expect(existing.body).not.toContain("already registered");
    expect(log).toHaveBeenCalledWith("[supabase-auth] sign-up failed", expect.any(Error));
  });

  it("returns 429 from sign-up when Supabase reports an email rate limit", async () => {
    const service = getHomloDirectService();
    const error = new Error("email rate limit exceeded");
    vi.spyOn(service, "signUp").mockRejectedValueOnce(error);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await request("POST", "/api/supabase-auth/sign-up", {
      email: "new@example.com",
      password: "password123",
    });

    expect(result.status).toBe(429);
    expect(JSON.parse(result.body)).toEqual({ error: "Please try again later" });
    expect(result.body).not.toContain("rate limit");
    expect(log).toHaveBeenCalledWith("[supabase-auth] sign-up failed", error);
  });
});
