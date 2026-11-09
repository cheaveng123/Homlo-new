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

function rawRequest(
  method: string,
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const data = typeof body === "string" ? body : body ? JSON.stringify(body) : undefined;
    const req = http.request(
      {
        hostname: "localhost",
        port: getPort(),
        path,
        method,
        headers: {
          ...(data ? { "Content-Type": "application/json" } : {}),
          ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
          ...headers,
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
    if (data) req.write(data);
    req.end();
  });
}

function rawPost(path: string, body: unknown) {
  return rawRequest("POST", path, body);
}

function rawGet(path: string) {
  return rawRequest("GET", path);
}

describe("Request size limits (real server, path-based tRPC)", () => {
  it("401 without auth on protected procedure (HTTP 401)", async () => {
    const result = await rawGet("/api/trpc/homlo.profile.get");
    expect(result.status).toBe(401);
    const parsed = JSON.parse(result.body);
    expect(parsed.error.json.code).toBe(-32001);
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

  it("accepts a realistic few-MB base64 JPEG profile photo (reaches auth, not 413)", async () => {
    const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const bytes = Buffer.concat([jpegHeader, Buffer.alloc(4 * 1024 * 1024, 0)]);
    const photo = `data:image/jpeg;base64,${bytes.toString("base64")}`;
    const result = await rawPost("/api/trpc/homlo.profile.uploadPhoto", { photo });
    expect(result.status).not.toBe(413);
    expect(result.status).toBe(401);
  });

  it("accepts a realistic few-MB base64 JPEG job image (reaches auth, not 413)", async () => {
    const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const bytes = Buffer.concat([jpegHeader, Buffer.alloc(4 * 1024 * 1024, 0)]);
    const image = `data:image/jpeg;base64,${bytes.toString("base64")}`;
    const result = await rawPost("/api/trpc/homlo.employer.uploadImage", {
      jobId: "00000000-0000-0000-0000-000000000000",
      image,
    });
    expect(result.status).not.toBe(413);
    expect(result.status).toBe(401);
  });

  it("rejects a base64 JPEG data URL whose bytes exceed 16mb with 413", async () => {
    const bytes = Buffer.alloc(13 * 1024 * 1024, 0);
    const photo = `data:image/jpeg;base64,${bytes.toString("base64")}`;
    const result = await rawPost("/api/trpc/homlo.profile.uploadPhoto", { photo });
    expect(result.status).toBe(413);
    const parsed = JSON.parse(result.body);
    expect(parsed.error).toBe("Request too large");
    expect(parsed.stack).toBeUndefined();
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

  it("5MB chunked request (no Content-Length) to normal procedure returns 413", async () => {
    const bigData = "x".repeat(5 * 1024 * 1024);
    const result = await new Promise<{ status: number; body: string }>(
      (resolve, reject) => {
        const req = http.request(
          {
            hostname: "localhost",
            port: getPort(),
            path: "/api/trpc/homlo.publicJobs",
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              // No Content-Length - chunked transfer encoding
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
        // Send data in chunks without Content-Length
        const chunkSize = 1024;
        let sent = 0;
        const sendNext = () => {
          if (sent >= bigData.length) {
            req.end();
            return;
          }
          const end = Math.min(sent + chunkSize, bigData.length);
          req.write(bigData.slice(sent, end));
          sent = end;
          setImmediate(sendNext);
        };
        sendNext();
      },
    );
    expect(result.status).toBe(413);
    const parsed = JSON.parse(result.body);
    expect(parsed.error).toBe("Request too large");
    expect(parsed.stack).toBeUndefined();
  });
});
