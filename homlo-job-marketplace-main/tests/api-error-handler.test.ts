import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import { HttpError, errorHandler, getRequestId, notFoundHandler, requestId, requestLogger } from "../server/_core/errors";

type StubResponse = Response & {
  statusCode: number;
  payload: { status: number; body: unknown } | null;
  headers: Record<string, string>;
  listeners: Record<string, (() => void)[]>;
  headersSent: boolean;
  setHeader: (name: string, value: string) => void;
  status: (code: number) => StubResponse;
  json: (body: unknown) => StubResponse;
  on: (event: string, handler: () => void) => StubResponse;
};

function makeResponse(headersSent = false): StubResponse {
  const res: Record<string, unknown> = {
    statusCode: 200,
    payload: null as { status: number; body: unknown } | null,
    headers: {} as Record<string, string>,
    headersSent,
    listeners: {} as Record<string, (() => void)[]>,
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
    res.payload = { status: res.statusCode as number, body: value };
    return res;
  };
  res.on = (event: string, handler: () => void) => {
    const listeners = res.listeners as Record<string, (() => void)[]>;
    listeners[event] = [...(listeners[event] ?? []), handler];
    return res;
  };
  return res as unknown as StubResponse;
}

function makeRequest(headers: Record<string, string | string[]> = {}): Request {
  return { method: "GET", url: "/x", originalUrl: "/x", headers } as unknown as Request;
}

function body(res: StubResponse): { code: string; message: string; requestId: string } {
  const payload = res.payload?.body as { error: { code: string; message: string; requestId: string } };
  return payload.error;
}

describe("requestId", () => {
  it("reuses a valid inbound id and echoes it on the response", () => {
    const req = makeRequest({ "x-request-id": "abc-123" });
    const res = makeResponse();
    requestId(req, res, () => undefined);
    expect(getRequestId(req)).toBe("abc-123");
    expect(res.headers["x-request-id"]).toBe("abc-123");
  });

  it("generates an id when none is supplied", () => {
    const req = makeRequest();
    const res = makeResponse();
    requestId(req, res, () => undefined);
    expect(res.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("ignores an absurdly long inbound id", () => {
    const req = makeRequest({ "x-request-id": "x".repeat(500) });
    const res = makeResponse();
    requestId(req, res, () => undefined);
    expect(getRequestId(req)).not.toBe("x".repeat(500));
  });
});

describe("requestLogger", () => {
  it("emits one line with method, path, status and duration on finish", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const req = makeRequest();
    const res = makeResponse();
    requestLogger(req, res, () => undefined);
    res.statusCode = 200;
    for (const handler of res.listeners.finish ?? []) handler();
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toBe("[api]");
    expect(log.mock.calls[0][1]).toMatchObject({ method: "GET", path: "/x", status: 200 });
    expect((log.mock.calls[0][1] as { durationMs: number }).durationMs).toBeGreaterThanOrEqual(0);
    log.mockRestore();
  });

  it("logs 5xx responses at error level", () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const req = makeRequest();
    const res = makeResponse();
    requestLogger(req, res, () => undefined);
    res.statusCode = 503;
    for (const handler of res.listeners.finish ?? []) handler();
    expect(error).toHaveBeenCalledTimes(1);
    expect(vi.mocked(console.log)).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});

describe("notFoundHandler", () => {
  it("answers an unmatched route with JSON and a request id, not HTML", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const req = makeRequest();
    const res = makeResponse();
    notFoundHandler(req, res, (() => undefined) as NextFunction);
    expect(res.payload?.status).toBe(404);
    expect(body(res)).toEqual({
      code: "NOT_FOUND",
      message: "Not found",
      requestId: getRequestId(req),
    });
    vi.restoreAllMocks();
  });

  it("hands off instead of writing when the response already started", () => {
    const res = makeResponse(true);
    const next = vi.fn();
    notFoundHandler(makeRequest(), res, next as unknown as NextFunction);
    expect(next).toHaveBeenCalled();
    expect(res.payload).toBeNull();
  });
});

describe("errorHandler", () => {
  it("returns 500 with a generic message and never leaks internals", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const req = makeRequest();
    const res = makeResponse();
    errorHandler(new Error("select * from secrets failed"), req, res, (() => undefined) as NextFunction);

    expect(res.payload?.status).toBe(500);
    expect(body(res)).toMatchObject({ code: "INTERNAL_ERROR", message: "Internal server error" });
    expect(JSON.stringify(res.payload)).not.toContain("secrets");
    expect(body(res).requestId).toBe(getRequestId(req));
    error.mockRestore();
  });

  it("preserves a 4xx status and its client-safe message", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const req = makeRequest();
    const res = makeResponse();
    errorHandler(new HttpError(404, "NOT_FOUND", "No such job"), req, res, (() => undefined) as NextFunction);

    expect(res.payload?.status).toBe(404);
    expect(body(res)).toMatchObject({ code: "NOT_FOUND", message: "No such job" });
    vi.restoreAllMocks();
  });

  it("honours a non-Error throw with an attached status", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const req = makeRequest();
    const res = makeResponse();
    const thrown = Object.assign(new Error("too many"), { status: 429 });
    errorHandler(thrown, req, res, (() => undefined) as NextFunction);
    expect(res.payload?.status).toBe(429);
    expect(body(res).message).toBe("too many");
    vi.restoreAllMocks();
  });

  it("delegates to next() instead of writing when headers were already sent", () => {
    const req = makeRequest();
    const res = makeResponse(true);
    const next = vi.fn();
    const err = new Error("late failure");
    errorHandler(err, req, res, next as unknown as NextFunction);
    expect(next).toHaveBeenCalledWith(err);
    expect(res.payload).toBeNull();
  });

  it("never throws for a null rejection value", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const req = makeRequest();
    const res = makeResponse();
    expect(() => errorHandler(null, req, res, (() => undefined) as NextFunction)).not.toThrow();
    expect(res.payload?.status).toBe(500);
    vi.restoreAllMocks();
  });
});
