import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { authorizeFeedRequest, timingSafeEqual } from "../supabase/functions/_shared/feed-auth";

const feedSource = readFileSync(
  resolve(process.cwd(), "supabase/functions/homlo-public-job-feed/index.ts"),
  "utf8",
).replace(/\r\n/g, "\n");

describe("public job feed authentication", () => {
  it("returns 503 when the feed secret is not configured", () => {
    expect(authorizeFeedRequest("", "provided")).toEqual({
      ok: false,
      status: 503,
      error: "Public feed is not configured",
    });
  });

  it("returns 401 when the secret is missing or incorrect", () => {
    expect(authorizeFeedRequest("expected", null)).toEqual({
      ok: false,
      status: 401,
      error: "Unauthorized",
    });
    expect(authorizeFeedRequest("expected", "")).toEqual({
      ok: false,
      status: 401,
      error: "Unauthorized",
    });
    expect(authorizeFeedRequest("expected", "wrong")).toEqual({
      ok: false,
      status: 401,
      error: "Unauthorized",
    });
    expect(authorizeFeedRequest("expected", "expected-but-longer")).toEqual({
      ok: false,
      status: 401,
      error: "Unauthorized",
    });
  });

  it("accepts an exact secret match", () => {
    expect(authorizeFeedRequest("expected", "expected")).toEqual({ ok: true });
  });

  it("compares secrets without data-dependent early exits", () => {
    expect(timingSafeEqual("same", "same")).toBe(true);
    expect(timingSafeEqual("same", "diff")).toBe(false);
    expect(timingSafeEqual("short", "longer")).toBe(false);
    expect(timingSafeEqual("", "")).toBe(true);
  });

  it("wires the helper to the request header and environment secret", () => {
    expect(feedSource).toContain('import { authorizeFeedRequest } from "../_shared/feed-auth.ts";');
    expect(feedSource).toContain('Deno.env.get("HOMLO_FEED_SECRET")?.trim() ?? ""');
    expect(feedSource).toContain('request.headers.get("x-homlo-feed-secret")');
    expect(feedSource).toContain("status: auth.status");
    expect(feedSource).toContain("return new Response(JSON.stringify({ jobs })");
  });
});
