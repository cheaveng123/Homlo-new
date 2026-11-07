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

function rawPost(
  path: string,
  body: unknown,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const data = typeof body === "string" ? body : JSON.stringify(body);
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
          resolve({ status: res.statusCode!, body: chunks });
        });
      },
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function rawGet(path: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "localhost",
        port: getPort(),
        path,
        method: "GET",
      },
      (res) => {
        let chunks = "";
        res.on("data", (c) => {
          chunks += c;
        });
        res.on("end", () => {
          resolve({ status: res.statusCode!, body: chunks });
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}

describe("Request size limits (real server, path-based tRPC)", () => {
  it("401 without auth on protected procedure", async () => {
    const result = await rawGet("/api/trpc/homlo.profile.get");
    expect(result.status).toBe(200); // tRPC always returns 200
    const parsed = JSON.parse(result.body);
    expect(parsed.error.json.code).toBe("UNAUTHORIZED");
    expect(parsed.error.json.stack).toBeUndefined();
  });

  it("~3MB uploadPhoto under 16mb is accepted (not 413)", async () => {
    const photo = "x".repeat(3 * 1024 * 1024);
    const result = await rawPost("/api/trpc/homlo.profile.uploadPhoto", {
      photo,
    });
    expect(result.status).not.toBe(413);
  });

  it("~3MB uploadImage under 16mb is accepted (not 413)", async () => {
    const image = "x".repeat(3 * 1024 * 1024);
    const result = await rawPost("/api/trpc/homlo.employer.uploadImage", {
      jobId: "00000000-0000-0000-0000-000000000000",
      image,
    });
    expect(result.status).not.toBe(413);
  });

  it("5MB body to normal procedure returns 413", async () => {
    const bigBody = { data: "x".repeat(5 * 1024 * 1024) };
    const result = await rawPost("/api/trpc/homlo.publicJobs", bigBody);
    expect(result.status).toBe(413);
    const parsed = JSON.parse(result.body);
    expect(parsed.error).toBe("Request too large");
    expect(parsed.stack).toBeUndefined();
  });

  it("17MB uploadPhoto over 16mb returns 413", async () => {
    const bigPhoto = { photo: "x".repeat(17 * 1024 * 1024) };
    const result = await rawPost("/api/trpc/homlo.profile.uploadPhoto", bigPhoto);
    expect(result.status).toBe(413);
    const parsed = JSON.parse(result.body);
    expect(parsed.error).toBe("Request too large");
    expect(parsed.stack).toBeUndefined();
  });

  it("batch path with mixed upload + non-upload gets 1mb limit", async () => {
    const bigBody = { data: "x".repeat(2 * 1024 * 1024) };
    const result = await rawPost(
      "/api/trpc/homlo.profile.uploadPhoto,homlo.profile.get",
      bigBody,
    );
    expect(result.status).toBe(413);
  });
});
