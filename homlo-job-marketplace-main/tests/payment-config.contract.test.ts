import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const gateway = readFileSync(
  resolve(process.cwd(), "supabase/functions/homlo-service-gateway/index.ts"),
  "utf8",
).replace(/\r\n/g, "\n");

describe("gateway payment configuration", () => {
  it("sets currency and provider server-side", () => {
    expect(gateway).toContain('const PAYMENT_CURRENCY = "USD";');
    expect(gateway).toContain(
      'const PAYMENT_PROVIDER = Deno.env.get("PAYMENT_PROVIDER")?.trim() || "aba_payway";',
    );
    expect(gateway.match(/const currency = PAYMENT_CURRENCY;/g) ?? []).toHaveLength(2);
    expect(gateway.match(/const provider = PAYMENT_PROVIDER;/g) ?? []).toHaveLength(2);
  });

  it("does not accept transaction currency or provider from the client payload", () => {
    expect(gateway).not.toMatch(/payload\.currency\b/);
    expect(gateway).not.toMatch(/payload\.provider(?!EventId|TransactionId)\b/);
    expect(gateway).not.toMatch(/body\.currency\b/);
    expect(gateway).not.toMatch(/body\.provider(?!EventId|TransactionId)\b/);
  });
});
