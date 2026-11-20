import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient } from "@tanstack/react-query";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "../hooks/use-auth";

const mocks = vi.hoisted(() => ({
  clearQueryClient: vi.fn(),
  logout: vi.fn(async () => undefined),
  getSupabaseMe: vi.fn(async () => null),
  refreshSupabaseSession: vi.fn(async () => ({ user: null, session: null })),
  getRefreshToken: vi.fn(async () => null),
  setAuthSession: vi.fn(async () => undefined),
  clearAuthSession: vi.fn(async () => undefined),
  setUserInfo: vi.fn(async () => undefined),
  clearUserInfo: vi.fn(async () => undefined),
  identifyPurchasesUser: vi.fn(async () => undefined),
  clearPurchasesUser: vi.fn(async () => undefined),
}));

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("@/lib/trpc", () => ({ clearQueryClient: mocks.clearQueryClient }));
vi.mock("@/lib/purchases", () => ({
  identifyPurchasesUser: mocks.identifyPurchasesUser,
  clearPurchasesUser: mocks.clearPurchasesUser,
}));
vi.mock("@/lib/_core/auth", () => ({
  getRefreshToken: mocks.getRefreshToken,
  setAuthSession: mocks.setAuthSession,
  clearAuthSession: mocks.clearAuthSession,
  setUserInfo: mocks.setUserInfo,
  clearUserInfo: mocks.clearUserInfo,
}));
vi.mock("@/lib/_core/api", () => ({
  logout: mocks.logout,
  getSupabaseMe: mocks.getSupabaseMe,
  refreshSupabaseSession: mocks.refreshSupabaseSession,
}));

type HookApi = ReturnType<typeof useAuth>;

function captureAuthHook(): HookApi {
  let captured: HookApi | undefined;
  function Probe() {
    captured = useAuth({ autoFetch: false });
    return null;
  }
  renderToStaticMarkup(React.createElement(Probe));
  if (!captured) throw new Error("useAuth was not captured");
  return captured;
}

function sessionUser(id: string) {
  return {
    id,
    status: "active" as const,
    profileComplete: true,
    role: "worker" as const,
    fullName: `User ${id}`,
    email: `${id}@example.com`,
  };
}

describe("cache isolation across sign-out / sign-in", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("removes account A's cached data on sign-out and does not leak it to account B", async () => {
    const queryClient = new QueryClient();
    mocks.clearQueryClient.mockImplementation(() => queryClient.clear());

    const auth = captureAuthHook();
    const accountScopedKey = ["homlo", "employer", "jobs"];

    await auth.completeSignIn({ user: sessionUser("account-a"), session: null });
    queryClient.setQueryData(accountScopedKey, [{ id: "job-owned-by-a" }]);
    expect(queryClient.getQueryData(accountScopedKey)).toEqual([{ id: "job-owned-by-a" }]);

    await auth.logout();
    expect(queryClient.getQueryData(accountScopedKey)).toBeUndefined();

    await auth.completeSignIn({ user: sessionUser("account-b"), session: null });
    expect(queryClient.getQueryData(accountScopedKey)).toBeUndefined();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(mocks.clearQueryClient).toHaveBeenCalledTimes(3);
  });

  it("wires the live QueryClient so clearQueryClient can actually clear it", async () => {
    const layoutSource = await readFile(
      path.join(process.cwd(), "app", "_layout.tsx"),
      "utf8",
    );
    expect(layoutSource).toContain(
      'import { trpc, createTRPCClient, setQueryClientInstance } from "@/lib/trpc";',
    );
    expect(layoutSource).toContain("setQueryClientInstance(queryClient);");
  });
});
