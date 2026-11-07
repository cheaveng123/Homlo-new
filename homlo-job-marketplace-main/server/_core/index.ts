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

const UPLOAD_PROCEDURES = new Set(["profile.uploadPhoto", "employer.uploadImage"]);
const TRPC_UPLOAD_LIMIT = 16 * 1024 * 1024; // 16mb — base64 photo uploads
const DEFAULT_LIMIT = 1 * 1024 * 1024; // 1mb — everything else

interface TrpcRequest extends express.Request {
  trpcBodySize?: number;
}

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

/** Build the Express app with all middleware. Exported for testing. */
export function createApp() {
  const app = express();

  configureTrustProxy(app);

  // Strict CORS: only ALLOWED_ORIGINS (plus localhost outside production) may
  // call the API from a browser with credentials. Native clients send no Origin
  // and are unaffected by CORS.
  app.use(createCorsMiddleware());

  // Body limits. Non-trpc routes are capped at 1mb. The trpc endpoint allows
  // up to 16mb raw because profile photo (profile.uploadPhoto) and job image
  // (employer.uploadImage) uploads send base64 data URLs. A post-parse
  // middleware enforces 1mb for every non-upload trpc procedure so an attacker
  // cannot use the 16mb trpc allowance to send oversized payloads to saveJob,
  // messaging, or any other procedure — those are additionally protected by
  // zod input schemas with strict string length limits.
  app.use("/api/trpc", express.json({
    limit: TRPC_UPLOAD_LIMIT,
    verify: (req: TrpcRequest, _res, buf) => {
      req.trpcBodySize = buf.length;
    },
  }));
  app.use("/api/trpc", express.urlencoded({
    limit: TRPC_UPLOAD_LIMIT,
    extended: true,
    verify: (req: TrpcRequest, _res, buf) => {
      req.trpcBodySize = buf.length;
    },
  }));

  // Per-procedure limit enforcement: only uploadPhoto/uploadImage may exceed 1mb.
  app.use("/api/trpc", (req: TrpcRequest, res, next) => {
    const body = req.body as { method?: string } | undefined;
    const isUpload = body?.method ? UPLOAD_PROCEDURES.has(body.method) : false;
    const size = req.trpcBodySize ?? 0;
    if (!isUpload && size > DEFAULT_LIMIT) {
      return res.status(413).json({ error: "Request too large" });
    }
    next();
  });

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
    }),
  );

  // 413 handler for body-parser entity.too.large errors
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

if (import.meta.main) {
  startServer().catch(console.error);
}
