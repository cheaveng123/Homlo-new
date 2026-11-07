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

async function startServer() {
  const app = express();
  const server = createServer(app);

  configureTrustProxy(app);

  app.use(requestId);
  app.use(requestLogger);

  // Strict CORS: only ALLOWED_ORIGINS (plus localhost outside production) may
  // call the API from a browser with credentials. Native clients send no Origin
  // and are unaffected by CORS.
  app.use(createCorsMiddleware());

  // Default body limit: 1mb for all routes. The trpc endpoint is allowed
  // up to 16mb because profile photo (profile.uploadPhoto) and job image
  // (employer.uploadImage) uploads send base64 data URLs. All other trpc
  // procedures are protected by zod input schemas with strict string length
  // limits, so a 16mb cap on trpc does not create an abuse vector.
  // Oversized requests return 413 with a generic message from body-parser.
  app.use("/api/trpc", express.json({ limit: "16mb" }));
  app.use("/api/trpc", express.urlencoded({ limit: "16mb", extended: true }));

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true }));

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

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`[api] server listening on port ${port}`);
  });
}

startServer().catch(console.error);
