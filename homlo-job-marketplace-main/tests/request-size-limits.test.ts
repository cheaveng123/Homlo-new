import { describe, expect, it, beforeAll, afterAll } from "vitest";
import express from "express";
import http from "http";
import { type AddressInfo } from "node:net";

function createApp() {
  const app = express();

  // Same limit logic as server/_core/index.ts:
  // 16mb for /api/trpc (photo uploads via base64 data URLs), 1mb globally.
  app.use("/api/trpc", express.json({ limit: "16mb" }));
  app.use("/api/trpc", express.urlencoded({ limit: "16mb", extended: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true }));

  app.post("/api/regular", (_req, res) => {
    res.json({ ok: true });
  });

  app.post("/api/trpc/upload", (_req, res) => {
    res.json({ ok: true });
  });

  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err.type === "entity.too.large") {
      return res.status(413).json({ error: "Request too large" });
    }
    res.status(500).json({ error: "Internal error" });
  });

  return app;
}

describe("Request size limits", () => {
  let server: http.Server;
  let port: number;

  beforeAll(async () => {
    const app = createApp();
    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        port = (server.address() as AddressInfo).port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  function post(path: string, body: unknown): Promise<{ status: number; body: unknown }> {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(body);
      const req = http.request(
        {
          hostname: "localhost",
          port,
          path,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(data),
          },
        },
        (res) => {
          let chunks = "";
          res.on("data", (c) => {
            chunks += c;
          });
          res.on("end", () => {
            resolve({
              status: res.statusCode!,
              body: chunks ? JSON.parse(chunks) : {},
            });
          });
        }
      );
      req.on("error", reject);
      req.write(data);
      req.end();
    });
  }

  it("normal request to regular route passes", async () => {
    const result = await post("/api/regular", { hello: "world" });
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ ok: true });
  });

  it("5MB body to normal route returns 413 (1mb limit)", async () => {
    const bigBody = { data: "x".repeat(5 * 1024 * 1024) }; // 5MB > 1MB limit
    const result = await post("/api/regular", bigBody);
    expect(result.status).toBe(413);
  });

  it("normal request to trpc route passes", async () => {
    const result = await post("/api/trpc/upload", { hello: "world" });
    expect(result.status).toBe(200);
  });

  it("valid photo upload to trpc route under 16mb passes", async () => {
    const photoData = "x".repeat(5 * 1024 * 1024); // 5MB base64-like payload
    const result = await post("/api/trpc/upload", { photo: photoData });
    expect(result.status).toBe(200);
  });

  it("oversized request to trpc route over 16mb returns 413", async () => {
    const bigBody = { data: "x".repeat(17 * 1024 * 1024) }; // 17MB > 16MB limit
    const result = await post("/api/trpc/upload", bigBody);
    expect(result.status).toBe(413);
  });
});
