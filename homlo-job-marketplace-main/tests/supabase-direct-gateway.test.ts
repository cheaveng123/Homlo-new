import { describe, expect, it } from "vitest";
import { getHomloDirectService } from "../server/homlo-direct-service";

const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/+$/, "");

describe("Supabase direct service gateway", () => {
  it("is deployed and rejects requests without an authenticated user token", async () => {
    expect(supabaseUrl).toMatch(/^https:\/\/.+\.supabase\.co$/);

    const response = await fetch(`${supabaseUrl}/functions/v1/homlo-service-gateway`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "session" }),
    });

    expect([401, 403]).toContain(response.status);
  }, 15_000);

  it("rejects malformed bearer tokens in the application server before invoking a gateway command", async () => {
    await expect(getHomloDirectService().resolveSession("malformed.supabase.token")).rejects.toThrow(
      "Invalid Supabase authentication token",
    );
  }, 15_000);
});
