import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

const REQUEST_ID_HEADER = "x-request-id";
const MAX_INBOUND_REQUEST_ID_LENGTH = 200;
const DEFAULT_ERROR_MESSAGE = "Internal server error";

/** An error that is safe to describe to the client verbatim. */
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}

function inboundRequestId(req: Request): string | null {
  const raw = req.headers[REQUEST_ID_HEADER];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_INBOUND_REQUEST_ID_LENGTH) return null;
  return trimmed;
}

export function getRequestId(req: Request): string {
  const existing = (req as Request & { requestId?: string }).requestId;
  if (existing) return existing;
  const resolved = inboundRequestId(req) ?? randomUUID();
  (req as Request & { requestId?: string }).requestId = resolved;
  return resolved;
}

/** Tags every request with an id that also appears in the response and the logs. */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = getRequestId(req);
  res.setHeader(REQUEST_ID_HEADER, id);
  next();
}

/** One structured line per response, so slow or failing routes are attributable. */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startedAt = process.hrtime.bigint();
  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const line = {
      requestId: getRequestId(req),
      method: req.method,
      path: req.originalUrl ?? req.url,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
    };
    if (res.statusCode >= 500) console.error("[api]", line);
    else console.log("[api]", line);
  });
  next();
}

function statusOf(err: unknown): number {
  if (err instanceof HttpError) return err.status;
  const candidate = err as { status?: unknown; statusCode?: unknown } | null;
  const raw = candidate?.status ?? candidate?.statusCode;
  return typeof raw === "number" && raw >= 400 && raw <= 599 ? raw : 500;
}

function codeOf(err: unknown, status: number): string {
  if (err instanceof HttpError) return err.code;
  return status >= 500 ? "INTERNAL_ERROR" : "REQUEST_FAILED";
}

function clientMessageOf(err: unknown, status: number): string {
  if (status >= 500) return DEFAULT_ERROR_MESSAGE;
  if (err instanceof Error && err.message) return err.message;
  return "Request failed";
}

/**
 * Terminates unmatched routes as JSON. Without this Express answers with its
 * own HTML 404 page, which breaks API clients and carries no request id.
 */
export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next();
    return;
  }
  const requestIdValue = getRequestId(req);
  console.warn("[api:warn]", {
    requestId: requestIdValue,
    method: req.method,
    path: req.originalUrl ?? req.url,
    status: 404,
    name: "NotFound",
    message: "No route matched",
  });
  res.status(404).json({
    error: { code: "NOT_FOUND", message: "Not found", requestId: requestIdValue },
  });
}

/**
 * Terminal Express error handler. Turns any escaped throw or async rejection
 * into a JSON body carrying the request id, and keeps internals in the log.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const requestIdValue = getRequestId(req);
  if (res.headersSent) {
    next(err);
    return;
  }
  const status = statusOf(err);
  const name = err instanceof Error ? err.name : typeof err;
  const message = err instanceof Error ? err.message : String(err);
  const context = { requestId: requestIdValue, method: req.method, path: req.originalUrl ?? req.url, status, name, message };
  if (status >= 500) console.error("[api:error]", context, err instanceof Error ? err.stack : undefined);
  else console.warn("[api:warn]", context);
  res.status(status).json({
    error: { code: codeOf(err, status), message: clientMessageOf(err, status), requestId: requestIdValue },
  });
}
