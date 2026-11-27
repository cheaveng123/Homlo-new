import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import { createCorsMiddleware, parseAllowedOrigins } from "../server/_core/cors";

type StubResponse = Response & {
  statusCode: number;
  payload: unknown;
  headers: Record<string, string>;
  ended: boolean;
};

function makeResponse(): StubResponse {
  const res: Record<string, unknown> = {
    statusCode: 200,
    payload: null,
    headers: {} as Record<string, string>,
    ended: false,
  };
  res.setHeader = (name: string, value: string) => {
    (res.headers as Record<string, string>)[name.toLowerCase()] = value;
    return res;
  };
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (value: unknown) => {
    res.payload = value;
    return res;
  };
  res.end = () => {
    res.ended = true;
    return res;
  };
  return res as unknown as StubResponse;
}

function makeRequest(
  method: string,
  headers: Record<string, string> = {},
): Request {
  return { method, url: "/api/health", originalUrl: "/api/health", headers } as unknown as Request;
}

function run(
  middleware: ReturnType<typeof createCorsMiddleware>,
  req: Request,
  res: StubResponse,
): NextFunction {
  const next = vi.fn();
  middleware(req, res, next);
  return next;
}

describe("parseAllowedOrigins", () => {
  it("trims whitespace, normalizes trailing slashes and drops invalid entries", () => {
    expect(
      parseAllowedOrigins(" https://app.homlo.com/ , http://localhost:8081, not-a-url, "),
    ).toEqual(["https://app.homlo.com", "http://localhost:8081"]);
  });

  it("deduplicates origins", () => {
    expect(parseAllowedOrigins("https://a.test, https://a.test/")).toEqual(["https://a.test"]);
  });
});

describe("CORS middleware", () => {
  it("allows an allowlisted origin and enables credentials", () => {
    const middleware = createCorsMiddleware({
      nodeEnv: "production",
      allowedOrigins: "https://app.homlo.com",
    });
    const req = makeRequest("GET", { origin: "https://app.homlo.com" });
    const res = makeResponse();
    const next = run(middleware, req, res);

    expect(res.headers["access-control-allow-origin"]).toBe("https://app.homlo.com");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
    expect(next).toHaveBeenCalledOnce();
  });

  it("does not reflect an origin that is not allowlisted", () => {
    const middleware = createCorsMiddleware({
      nodeEnv: "production",
      allowedOrigins: "https://app.homlo.com",
    });
    const req = makeRequest("GET", { origin: "https://evil.example" });
    const res = makeResponse();
    const next = run(middleware, req, res);

    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    expect(res.headers["access-control-allow-credentials"]).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
  });

  it("allows localhost in development", () => {
    const middleware = createCorsMiddleware({ nodeEnv: "development", allowedOrigins: "" });
    const req = makeRequest("GET", { origin: "http://localhost:8081" });
    const res = makeResponse();
    run(middleware, req, res);

    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:8081");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("does not allow localhost in production, even if it is in the env list", () => {
    const middleware = createCorsMiddleware({
      nodeEnv: "production",
      allowedOrigins: "http://localhost:8081",
    });
    const req = makeRequest("GET", { origin: "http://localhost:8081" });
    const res = makeResponse();
    run(middleware, req, res);

    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    expect(res.headers["access-control-allow-credentials"]).toBeUndefined();
  });

  it("rejects a preflight request from a disallowed origin", () => {
    const middleware = createCorsMiddleware({
      nodeEnv: "production",
      allowedOrigins: "https://app.homlo.com",
    });
    const req = makeRequest("OPTIONS", { origin: "https://evil.example" });
    const res = makeResponse();
    const next = run(middleware, req, res);

    expect(res.statusCode).toBe(403);
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    expect(next).not.toHaveBeenCalled();
  });

  it("answers an allowed preflight with 204 and the expected headers", () => {
    const middleware = createCorsMiddleware({
      nodeEnv: "production",
      allowedOrigins: "https://app.homlo.com",
    });
    const req = makeRequest("OPTIONS", { origin: "https://app.homlo.com" });
    const res = makeResponse();
    run(middleware, req, res);

    expect(res.statusCode).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe("https://app.homlo.com");
    expect(res.headers["access-control-allow-methods"]).toContain("PATCH");
    expect(res.headers["access-control-allow-headers"]).toContain("X-Homlo-Client");
  });

  it("lets native clients without an Origin header through without CORS headers", () => {
    const middleware = createCorsMiddleware({
      nodeEnv: "production",
      allowedOrigins: "https://app.homlo.com",
    });
    const req = makeRequest("POST", { "x-homlo-client": "native" });
    const res = makeResponse();
    const next = run(middleware, req, res);

    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    expect(res.headers["access-control-allow-credentials"]).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
  });

  it("always varies on Origin so caches cannot mix allowlisted and blocked responses", () => {
    const middleware = createCorsMiddleware({ nodeEnv: "production", allowedOrigins: "" });
    const res = makeResponse();
    run(middleware, makeRequest("GET", { origin: "https://evil.example" }), res);

    expect(res.headers.vary).toBe("Origin");
  });
});
