import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerSupabaseAuthRoutes } from "./supabase-auth";
import { registerStorageProxy } from "./storageProxy";
import { registerEventLogRoutes } from "./eventLogRoutes";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { validateProductionEnv } from "./envValidation";
import { createCorsMiddleware } from "./cors";
import { configureTrustProxy } from "./requestIp";

validateProductionEnv();

/** Exact tRPC procedure paths that are allowed the 16mb upload limit.
 * These are the only two procedures that accept base64 photo/image data URLs.
 * All other procedures are capped at 1mb by zod input schemas anyway. */
const UPLOAD_PROCEDURES = new Set([
  "homlo.profile.uploadPhoto",
  "homlo.employer.uploadImage",
]);
const TRPC_UPLOAD_LIMIT = 16 * 1024 * 1024; // 16mb
const DEFAULT_LIMIT = 1 * 1024 * 1024; // 1mb

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

/** Extract procedure names from a tRPC URL path.
 *
 * Path examples (req.path may or may not include the /api/trpc mount prefix):
 *   "/api/trpc/homlo.profile.uploadPhoto"  → ["homlo.profile.uploadPhoto"]
 *   "/homlo.profile.uploadPhoto"           → ["homlo.profile.uploadPhoto"]
 *   "/api/trpc/homlo.profile.uploadPhoto,homlo.profile.get"
 *                                          → ["homlo.profile.uploadPhoto", "homlo.profile.get"]
 *   "/api/trpc"                            → []
 */
function getProcedureNamesFromPath(path: string): string[] {
  // Take the last path segment (after the final /), strip query string
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 0) return [];
  const lastPart = parts[parts.length - 1].split("?")[0];
  if (!lastPart) return [];
  return lastPart.split(",").map((s) => s.trim()).filter(Boolean);
}

/** Returns true only when every procedure named in the URL path is an upload
 * procedure. Mixed batches (upload + non-upload) return false → 1mb limit.
 */
function isUploadOnlyPath(path: string): boolean {
  const names = getProcedureNamesFromPath(path);
  return names.length > 0 && names.every((name) => UPLOAD_PROCEDURES.has(name));
}

/** Build the Express app with all middleware. Exported for testing. */
export function createApp() {
  const app = express();

  configureTrustProxy(app);
  app.use(createCorsMiddleware());

  // Pre-parse size check for trpc paths: reject oversized non-upload requests
  // before the body is read, using the Content-Length header. Upload-only
  // paths are allowed up to 16mb by the express.json limit below. Mixed batches
  // (upload + non-upload comma-separated in one path) get the 1mb limit.
  app.use("/api/trpc", (req, res, next) => {
    if (!isUploadOnlyPath(req.path)) {
      const size = Number(req.headers["content-length"]) || 0;
      if (size > DEFAULT_LIMIT) {
        return res.status(413).json({ error: "Request too large" });
      }
    }
    next();
  });

  app.use("/api/trpc", express.json({ limit: TRPC_UPLOAD_LIMIT }));
  app.use("/api/trpc", express.urlencoded({ limit: TRPC_UPLOAD_LIMIT, extended: true }));

  app.use(express.json({ limit: DEFAULT_LIMIT }));
  app.use(express.urlencoded({ limit: DEFAULT_LIMIT, extended: true }));

  registerStorageProxy(app);
  registerSupabaseAuthRoutes(app);
  registerEventLogRoutes(app);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      // Never include stack traces or file paths in error responses, in any
      // environment. Stack traces are logged server-side by the error handler.
      errorFormatter: ({ error, shape }) => ({
        message: error.message,
        code: error.code,
        httpStatus: error.httpStatus,
      }),
    }),
  );

  // Express error handler for body-parser entity.too.large and other errors.
  // Never includes stack traces in the response body.
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err.type === "entity.too.large") {
      return res.status(413).json({ error: "Request too large" });
    }
    res.status(500).json({ error: "Internal error" });
  });

  return app;
}

export const app = createApp();

async function startServer() {
  const server = createServer(app);
  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }
  server.listen(port, () => {
    console.log(`[api] server listening on port ${port}`);
  });
}

// Only start when this file is run directly, not when imported by tests.
if (process.argv[1] === new URL(import.meta.url).pathname) {
  startServer().catch(console.error);
}
