import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createApp } from "../server/_core/index";
import http from "http";
import { type AddressInfo } from "node:net";

const app = createApp();
let server: http.Server;

beforeAll(async () => {
  server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, () => resolve());
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function getPort(): number {
  return (server.address() as AddressInfo).port;
}

function rawPost(path: string, body: unknown): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      {
        hostname: "localhost",
        port: getPort(),
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
      },
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function trpcPost(method: string, params: unknown): Promise<{ status: number; body: unknown }> {
  return rawPost("/api/trpc", {
    id: "1",
    jsonrpc: "2.0",
    method,
    params,
  });
}

describe("Request size limits (real server setup)", () => {
  it("non-upload trpc procedure under 1mb is accepted (not 413)", async () => {
    const result = await trpcPost("profile.get", {});
    // 404/401 from tRPC is fine — the key is body was NOT rejected as too large
    expect(result.status).not.toBe(413);
  });

  it("non-upload trpc procedure over 1mb returns 413", async () => {
    const bigBody = { data: "x".repeat(2 * 1024 * 1024) }; // 2MB > 1MB
    const result = await trpcPost("homlo.publicJobs", { padding: bigBody });
    expect(result.status).toBe(413);
  });

  it("uploadPhoto trpc procedure under 16mb is accepted (not 413)", async () => {
    const photoData = "x".repeat(5 * 1024 * 1024); // 5MB base64-like payload
    const result = await trpcPost("profile.uploadPhoto", { photo: photoData });
    expect(result.status).not.toBe(413);
  });

  it("uploadImage trpc procedure under 16mb is accepted (not 413)", async () => {
    const imageData = "x".repeat(5 * 1024 * 1024); // 5MB base64-like payload
    const result = await trpcPost("employer.uploadImage", {
      jobId: "00000000-0000-0000-0000-000000000000",
      image: imageData,
    });
    expect(result.status).not.toBe(413);
  });

  it("uploadPhoto trpc procedure over 16mb returns 413", async () => {
    const bigBody = { data: "x".repeat(17 * 1024 * 1024) }; // 17MB > 16MB
    const result = await trpcPost("profile.uploadPhoto", { photo: bigBody.data });
    expect(result.status).toBe(413);
  });

  it("non-trpc route over 1mb returns 413", async () => {
    const bigBody = { data: "x".repeat(2 * 1024 * 1024) };
    const result = await rawPost("/api/health", bigBody);
    expect(result.status).toBe(413);
  });
});
