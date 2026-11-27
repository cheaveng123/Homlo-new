import "dotenv/config";
import express from "express";
import compression from "compression";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerSupabaseAuthRoutes } from "./supabase-auth";
import { registerEventLogRoutes } from "./eventLogRoutes";
import { registerRevenueCatRoutes } from "../revenuecatWebhook";
import { registerTrustRoutes, startTrustBackgroundJobs } from "../trust/routes";
import { registerFeedRoutes, invalidateFeedCache } from "../feed-routes";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { validateProductionEnv } from "./envValidation";
import { createCorsMiddleware } from "./cors";
import { configureTrustProxy } from "./requestIp";
import { createApiRateLimiters } from "./apiRateLimit";
import { getHomloDirectService } from "../homlo-direct-service";
import { shouldInvalidatePublicCaches } from "./write-invalidation";
import { randomUUID } from "node:crypto";
import { getCacheBus } from "./cache-bus";
import {
  currentRequestMetrics,
  runWithExistingMetrics,
  runWithRequestMetrics,
  type RequestMetrics,
} from "../../backend/infrastructure/database/query-metrics";

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

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{8,128}$/;

/**
 * PERF observability: one structured log line per API request with request
 * id, route, status, duration, DB query count and DB time. No query strings,
 * bodies, headers or user data are logged (the route is the path only; tRPC
 * paths are procedure names). Set REQUEST_LOG=off to silence it.
 */
export function requestMetricsMiddleware(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const incoming = req.headers["x-request-id"];
  const requestId = typeof incoming === "string" && REQUEST_ID_PATTERN.test(incoming) ? incoming : randomUUID();
  res.setHeader("x-request-id", requestId);
  const route = req.path;
  const startedAt = Date.now();
  const { metrics } = runWithRequestMetrics(() => {
    res.locals.requestMetrics = currentRequestMetrics();
    next();
  });
  res.on("finish", () => {
    if (process.env.REQUEST_LOG === "off" || route.startsWith("/api/health")) return;
    console.log(
      JSON.stringify({
        msg: "request",
        requestId,
        method: req.method,
        route,
        status: res.statusCode,
        durationMs: Date.now() - startedAt,
        queries: metrics.queries,
        dbMs: metrics.dbMs,
      }),
    );
  });
}

/** Build the Express app with all middleware. Exported for testing. */
export function createApp() {
  const app = express();

  configureTrustProxy(app);
  app.use(requestMetricsMiddleware);
  // PERF: gzip API responses (the public job list is up to 200 rows with full
  // descriptions; JSON text typically shrinks 4–6×). Only when the client
  // sends Accept-Encoding, only above 1 KB. React Native's fetch, browsers
  // and CDNs all decode it transparently; the JSON itself is unchanged.
  app.use(compression({ threshold: 1024 }));
  app.use(createCorsMiddleware());

  const { trpcGeneral, trpcPublic, upload, feed } = createApiRateLimiters();

  // Reject excess uploads before the large body parsers run, so oversized
  // bodies from a limited IP are not read into memory first.
  app.use("/api/trpc/homlo.profile.uploadPhoto", upload);
  app.use("/api/trpc/homlo.employer.uploadImage", upload);

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
  // Body parsers resume on stream events; re-enter the request's metrics
  // context so DB queries after this point are counted for this request.
  app.use((_req, res, next) => {
    const metrics = res.locals.requestMetrics as RequestMetrics | undefined;
    if (metrics) runWithExistingMetrics(metrics, next);
    else next();
  });

  // PERF: server-side read caches (session, public jobs, search) are cleared
  // whenever a write request finishes, so posts/edits/applies/boosts appear
  // on the very next read. Analytics and auth endpoints are skipped so they
  // don't wipe the caches constantly.
  // PERF: only writes that can change a listing clear the shared public
  // caches (see write-invalidation.ts); chat, notifications, uploads and
  // consent writes used to wipe them for everyone.
  app.use((req, res, next) => {
    if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();
    if (req.path.startsWith("/api/events") || req.path.startsWith("/events") || req.path.startsWith("/api/supabase-auth")) return next();
    const path = req.path;
    res.on("finish", () => {
      if (res.statusCode >= 400) return;
      const service = getHomloDirectService();
      if (shouldInvalidatePublicCaches(path)) {
        service.invalidateAfterWrite(service.getAccessToken(req));
        invalidateFeedCache();
        // Tell the other server instances to clear theirs too.
        void getCacheBus().then((bus) => bus.publish());
      } else {
        service.invalidateSessionAfterWrite(service.getAccessToken(req));
      }
    });
    next();
  });

  // Auth responses must never be cached by browsers or intermediate proxies.
  app.use("/api/supabase-auth/*", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  registerSupabaseAuthRoutes(app);
  registerEventLogRoutes(app);
  registerRevenueCatRoutes(app);
  registerTrustRoutes(app);

  // On Supabase Edge the whole server lives under the `api` function, so feed
  // calls arrive as /api/feed/*. Serve them through the same /feed/* routes.
  app.use((req, _res, next) => {
    if (req.url.startsWith("/api/feed/")) req.url = req.url.slice("/api".length);
    next();
  });

  // Rate limit feed endpoints (same shape as other API routes)
  app.use("/feed/*", feed);

  registerFeedRoutes(app);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  // Readiness: unlike /api/health (process is up), this checks the database.
  // 503 when the DB is unreachable or slower than 2s.
  app.get("/api/health/ready", async (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    let database: { ok: boolean; latencyMs: number };
    try {
      database = await getHomloDirectService().checkDatabase();
    } catch {
      database = { ok: false, latencyMs: 0 };
    }
    res.status(database.ok ? 200 : 503).json({ ok: database.ok, database, timestamp: Date.now() });
  });

  app.use("/api/trpc", trpcPublic);
  app.use("/api/trpc", trpcGeneral);

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
  // Refuses to boot in production without the encryption / hashing secrets.
  startTrustBackgroundJobs();
  const server = createServer(app);
  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }
  server.listen(port, () => {
    console.log(`[api] server listening on port ${port}`);
    void getHomloDirectService().warmUp();
    void getCacheBus().then((bus) =>
      bus.start(() => {
        getHomloDirectService().invalidateAfterWrite(null);
        invalidateFeedCache();
      }),
    );
  });
}
