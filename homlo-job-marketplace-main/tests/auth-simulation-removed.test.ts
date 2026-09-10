import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectFile = (...segments: string[]) => path.join(process.cwd(), ...segments);

describe("temporary authentication simulation removal", () => {
  it("does not expose preview-session creation from the auth hook or Login route", async () => {
    const [authHook, loginRoute, applyRoute] = await Promise.all([
      readFile(projectFile("hooks", "use-auth.ts"), "utf8"),
      readFile(projectFile("app", "login.tsx"), "utf8"),
      readFile(projectFile("app", "job", "[id]", "apply.tsx"), "utf8"),
    ]);

    for (const source of [authHook, loginRoute, applyRoute]) {
      expect(source).not.toContain("signInForBuild");
      expect(source).not.toContain("preview_");
      expect(source).not.toContain("isBuildPreview");
    }
    expect(loginRoute).not.toContain("Continue with Apple");
    expect(loginRoute).not.toContain("Continue with Google");
  });
});
