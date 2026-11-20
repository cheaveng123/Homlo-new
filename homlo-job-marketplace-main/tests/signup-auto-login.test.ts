import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import http from "http";
import { type AddressInfo } from "node:net";

// Trust & safety steps around sign-up talk to Postgres; stub them here.
vi.mock("../server/plan-boost-db", () => ({ getPlanBoostDb: () => ({ query: async () => ({ rows: [] }) }) }));
vi.mock("../server/trust/accounts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../server/trust/accounts")>()),
  isBlockedFromSignup: async () => false,
  ipMatchesBannedAccount: async () => false,
  recordDevice: async () => undefined,
  sendEmailVerification: async () => undefined,
}));
vi.mock("../server/trust/consent", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../server/trust/consent")>()),
  recordConsent: async () => ({ id: "consent-id", createdAt: new Date(0).toISOString() }),
}));

import { createApp } from "../server/_core/index";
import {
  getHomloDirectService,
  SUPABASE_ACCESS_COOKIE,
  SUPABASE_REFRESH_COOKIE,
} from "../server/homlo-direct-service";
import { SupabaseAdapter } from "../backend/infrastructure/database/SupabaseAdapter";

const app = createApp();
let server: http.Server;

beforeAll(async () => {
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, () => resolve()));
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

afterEach(() => {
  vi.restoreAllMocks();
});

function signUpRequest(body: unknown): Promise<{ status: number; body: string; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      {
        hostname: "localhost",
        port: (server.address() as AddressInfo).port,
        path: "/api/supabase-auth/sign-up",
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) },
      },
      (res) => {
        let chunks = "";
        res.on("data", (chunk) => (chunks += chunk));
        res.on("end", () => resolve({ status: res.statusCode!, body: chunks, headers: res.headers }));
      },
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

const session = { accessToken: "access-token-abcdefghijklmnop", refreshToken: "refresh-token-abcdefghijklmnop", expiresIn: 3600 };
const homloUser = { id: "11111111-1111-1111-1111-111111111111", status: "active", profileComplete: false, role: null, fullName: "New Member", email: "new@example.com" };

describe("sign-up logs the new member in straight away", () => {
  it("creates a confirmed account and signs it in through the adapter", async () => {
    const service = getHomloDirectService();
    const create = vi
      .spyOn(SupabaseAdapter.prototype, "createConfirmedUserAndSignIn")
      .mockResolvedValue({ user: null, session } as never);
    const legacySignUp = vi.spyOn(SupabaseAdapter.prototype, "signUpWithEmailPassword");
    vi.spyOn(service, "resolveSession").mockResolvedValue(homloUser as never);

    const result = await service.signUp("new@example.com", "password123", "New Member");

    expect(create).toHaveBeenCalledWith("new@example.com", "password123", "New Member");
    expect(legacySignUp).not.toHaveBeenCalled();
    expect(result).toEqual({ user: homloUser, session });
  });

  it("falls back to 'log in normally' only when the account was made but no session came back", async () => {
    const service = getHomloDirectService();
    vi.spyOn(SupabaseAdapter.prototype, "createConfirmedUserAndSignIn").mockResolvedValue({ user: null, session: null });

    await expect(service.signUp("new@example.com", "password123")).resolves.toEqual({ confirmationRequired: true });
  });

  it("returns 201 with session cookies set on account creation", async () => {
    vi.spyOn(getHomloDirectService(), "signUp").mockResolvedValue({ user: homloUser, session } as never);

    const result = await signUpRequest({ email: "new@example.com", password: "password123", acceptTerms: true });

    expect(result.status).toBe(201);
    const cookies = (result.headers["set-cookie"] ?? []).join("\n");
    expect(cookies).toContain(`${SUPABASE_ACCESS_COOKIE}=${session.accessToken}`);
    expect(cookies).toContain(`${SUPABASE_REFRESH_COOKIE}=${session.refreshToken}`);
    expect(JSON.parse(result.body).user).toEqual(homloUser);
  });

  it("no longer tells people to check their email", async () => {
    vi.spyOn(getHomloDirectService(), "signUp").mockResolvedValue({ confirmationRequired: true });

    const result = await signUpRequest({ email: "new@example.com", password: "password123", acceptTerms: true });

    expect(result.status).toBe(202);
    expect(result.body).not.toMatch(/check your email/i);
    expect(JSON.parse(result.body).message).toBe("Your Homlo account is ready. Log in with your new email and password.");
  });
});
