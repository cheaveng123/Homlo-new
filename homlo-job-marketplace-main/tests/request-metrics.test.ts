import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import http from "node:http";
import { gunzipSync } from "node:zlib";
import type { AddressInfo } from "node:net";
import { createApp } from "../server/_core/index";

/**
 * Observability guardrail: every API request gets a request id and one
 * structured log line (route, status, duration, DB query count) with no
 * query string or user data. Only routes that never touch the database are
 * exercised here.
 */
const app = createApp();
let server: http.Server;

beforeAll(async () => {
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, () => resolve()));
});
afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function get(path: string, headers: Record<string, string> = {}) {
  return new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }>((resolve, reject) => {
    const req = http.request({ hostname: "localhost", port: (server.address() as AddressInfo).port, path, headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode!, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on("error", reject);
    req.end();
  });
}

describe("request metrics", () => {
  it("echoes a valid x-request-id and logs one structured line without the query string", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const res = await get("/api/trpc/homlo.doesNotExist?input=secret%40example.com", { "x-request-id": "test-request-0001" });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(res.headers["x-request-id"]).toBe("test-request-0001");
    const lines = log.mock.calls.map((c) => String(c[0])).filter((l) => l.includes('"msg":"request"'));
    log.mockRestore();
    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0]);
    expect(entry).toMatchObject({ requestId: "test-request-0001", method: "GET", route: "/api/trpc/homlo.doesNotExist", queries: 0 });
    expect(typeof entry.durationMs).toBe("number");
    expect(lines[0]).not.toContain("secret");
  });

  it("replaces a malformed request id and keeps health checks out of the log", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const res = await get("/api/health", { "x-request-id": "bad id <script>" });
    await new Promise((resolve) => setTimeout(resolve, 10));
    const lines = log.mock.calls.map((c) => String(c[0])).filter((l) => l.includes('"msg":"request"'));
    log.mockRestore();
    expect(res.status).toBe(200);
    expect(res.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(lines).toHaveLength(0);
  });

  it("gzips responses over 1 KB when the client accepts it", async () => {
    // An unknown tRPC procedure in a large batch returns a >1 KB JSON error
    // body without touching the database.
    const names = Array.from({ length: 40 }, (_, i) => `homlo.missingProcedure${i}`).join(",");
    const res = await get(`/api/trpc/${names}?batch=1&input=%7B%7D`, { "Accept-Encoding": "gzip" });
    expect(res.headers["content-encoding"]).toBe("gzip");
    const json = JSON.parse(gunzipSync(res.body).toString("utf8"));
    expect(Array.isArray(json)).toBe(true);
  });
});
