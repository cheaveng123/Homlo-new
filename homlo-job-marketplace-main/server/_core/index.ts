import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerSupabaseAuthRoutes } from "./supabase-auth";
import { registerEventLogRoutes } from "./eventLogRoutes";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { validateProductionEnv } from "./envValidation";
import { createCorsMiddleware } from "./cors";
import { configureTrustProxy } from "./requestIp";

validateProductionEnv();

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

/** Build the Express app with all middleware. Exported for testing. */
export function createApp() {
  const app = express();

  configureTrustProxy(app);
  app.use(createCorsMiddleware());

  // Two body parsers for /api/trpc:
  //  - 16mb only on the exact upload procedure paths (single call):
  //      /api/trpc/homlo.profile.uploadPhoto
  //      /api/trpc/homlo.employer.uploadImage
  //  - 1mb for everything else
  // Express matches routes in order, so the upload-specific parsers run
  // before the general 1mb parser.
  app.use("/api/trpc/homlo.profile.uploadPhoto", express.json({ limit: TRPC_UPLOAD_LIMIT }));
  app.use("/api/trpc/homlo.profile.uploadPhoto", express.urlencoded({ limit: TRPC_UPLOAD_LIMIT, extended: true }));
  app.use("/api/trpc/homlo.employer.uploadImage", express.json({ limit: TRPC_UPLOAD_LIMIT }));
  app.use("/api/trpc/homlo.employer.uploadImage", express.urlencoded({ limit: TRPC_UPLOAD_LIMIT, extended: true }));

  app.use(express.json({ limit: DEFAULT_LIMIT }));
  app.use(express.urlencoded({ limit: DEFAULT_LIMIT, extended: true }));

  // Auth responses must never be cached by browsers or intermediate proxies.
  app.use("/api/supabase-auth/*", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

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

export async function startServer() {
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
