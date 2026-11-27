import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const gateway = readFileSync(
  resolve(process.cwd(), "supabase/functions/homlo-service-gateway/index.ts"),
  "utf8",
).replace(/\r\n/g, "\n");

describe("homlo-service-gateway error handling", () => {
  it("only passes database messages through when SQLSTATE is P0001", () => {
    expect(gateway).toContain('b?.code === "P0001"');
    expect(gateway).toContain("class SafeError extends Error {}");
  });

  it("no longer rethrows raw database error messages", () => {
    expect(gateway).not.toContain("throw new Error(typeof error.message");
    expect(gateway.split("throw dbError(").length - 1).toBe(2);
  });

  it("returns a generic message for unexpected errors", () => {
    expect(gateway).toContain('return fail("Request failed", 400);');
    expect(gateway).not.toContain('const message = error instanceof Error ? error.message');
    expect(gateway).toContain("if (error instanceof SafeError) return fail(error.message, 400);");
  });

  it("still logs the real error server-side", () => {
    expect(gateway).toContain('console.error("[homlo-service-gateway] action failed", error);');
  });
});
