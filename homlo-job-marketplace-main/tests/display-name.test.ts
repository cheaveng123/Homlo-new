import { describe, expect, it } from "vitest";

import { defaultDisplayName } from "../lib/display-name";

describe("defaultDisplayName", () => {
  it("uses the name given at sign-up", () => {
    expect(defaultDisplayName("  Sokha Chan ", "x@example.com")).toBe("Sokha Chan");
  });

  it("builds a tidy name from the email when no name was given", () => {
    expect(defaultDisplayName(null, "sokha.chan@example.com")).toBe("Sokha Chan");
    expect(defaultDisplayName("", "dara_ly+jobs@example.com")).toBe("Dara Ly");
    expect(defaultDisplayName(undefined, "meng2019@example.com")).toBe("Meng2019");
  });

  it("always returns at least two characters, which the profile requires", () => {
    expect(defaultDisplayName("A", "1234@example.com")).toBe("Homlo member");
    expect(defaultDisplayName(null, null)).toBe("Homlo member");
    expect(defaultDisplayName(null, "x@example.com")).toBe("Homlo member");
  });
});
