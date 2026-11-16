import { describe, expect, it } from "vitest";

import {
  devServerAuthorityFromBundleUrl,
  isMetroAuthority,
  parseDevServerAuthority,
  toApiAuthority,
} from "../lib/api-base-url";

describe("parseDevServerAuthority", () => {
  it("reduces a plain hostUri to host:port", () => {
    expect(parseDevServerAuthority("192.168.1.42:8081")).toBe("192.168.1.42:8081");
    expect(parseDevServerAuthority("localhost")).toBe("localhost");
  });

  it("strips scheme, path, and query from a bundle URL", () => {
    expect(
      parseDevServerAuthority("http://localhost:8081/index.bundle?platform=ios&dev=true"),
    ).toBe("localhost:8081");
    expect(parseDevServerAuthority("exp://10.0.0.2:19000/--/")).toBe("10.0.0.2:19000");
  });

  it("keeps IPv6 authorities intact", () => {
    expect(parseDevServerAuthority("http://[::1]:8081/x.bundle")).toBe("[::1]:8081");
  });

  it("returns null for empty input", () => {
    expect(parseDevServerAuthority(undefined)).toBeNull();
    expect(parseDevServerAuthority("")).toBeNull();
    expect(parseDevServerAuthority("file:///var/containers/x.bundle")).toBeNull();
  });
});

describe("devServerAuthorityFromBundleUrl", () => {
  it("derives the authority from an http(s) bundle URL", () => {
    expect(devServerAuthorityFromBundleUrl("http://localhost:8081/.expo/x.bundle")).toBe(
      "localhost:8081",
    );
    expect(devServerAuthorityFromBundleUrl("https://dev.example.com:8082/index.bundle")).toBe(
      "dev.example.com:8082",
    );
  });

  it("ignores non-http bundle URLs (production/release bundles)", () => {
    expect(devServerAuthorityFromBundleUrl("file:///var/containers/Bundle/Application/x.bundle")).toBeNull();
    expect(devServerAuthorityFromBundleUrl("assets://index.android.bundle")).toBeNull();
    expect(devServerAuthorityFromBundleUrl(undefined)).toBeNull();
  });
});

describe("toApiAuthority", () => {
  it("replaces any dev-server port with the API port", () => {
    expect(toApiAuthority("localhost:8081")).toBe("localhost:3000");
    expect(toApiAuthority("192.168.1.42:19000")).toBe("192.168.1.42:3000");
  });

  it("adds the API port when the host has none", () => {
    expect(toApiAuthority("localhost")).toBe("localhost:3000");
  });

  it("handles IPv6 without mangling the address", () => {
    expect(toApiAuthority("[::1]:8081")).toBe("[::1]:3000");
  });
});

describe("isMetroAuthority", () => {
  it("detects Metro/Expo dev-server ports", () => {
    expect(isMetroAuthority("localhost:8081")).toBe(true);
    expect(isMetroAuthority("localhost:8082")).toBe(true);
    expect(isMetroAuthority("192.168.1.42:19000")).toBe(true);
    expect(isMetroAuthority("192.168.1.42:19001")).toBe(true);
  });

  it("does not flag the API port or unknown hosts", () => {
    expect(isMetroAuthority("localhost:3000")).toBe(false);
    expect(isMetroAuthority("api.example.com")).toBe(false);
    expect(isMetroAuthority(null)).toBe(false);
  });
});
