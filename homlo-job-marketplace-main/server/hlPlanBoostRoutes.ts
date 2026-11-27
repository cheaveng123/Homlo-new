import type { Express, Request, Response } from "express";
import { getHomloDirectService } from "./homlo-direct-service";
import {
  applicationPrecheckHandler,
  boostCatalogHandler,
  boostPaymentWebhookHandler,
  getMyPlanHandler,
  publishJobHandler,
  purchaseBoostHandler,
} from "./hlPlanBoostHandlers";
import { getPlanBoostDb } from "./plan-boost-db";
import { registerBoostRoutes } from "./boost/boostRoutes";

async function resolveUserId(req: Request): Promise<string | null> {
  const service = getHomloDirectService();
  const token = service.getAccessToken(req);
  if (!token) return null;
  try {
    const user = await service.resolveSession(token);
    return user.id;
  } catch {
    return null;
  }
}

function send(res: Response, response: { status: number; body: Record<string, unknown> }) {
  res.status(response.status).json(response.body);
}

export function registerPlanBoostRoutes(app: Express) {
  app.get("/api/me/plan", async (req: Request, res: Response) => {
    const userId = await resolveUserId(req);
    send(res, await getMyPlanHandler(getPlanBoostDb(), userId));
  });

  app.get("/api/boosts/catalog", async (req: Request, res: Response) => {
    const userId = await resolveUserId(req);
    send(res, await boostCatalogHandler(getPlanBoostDb(), userId));
  });

  app.post("/api/jobs/:jobId/publish", async (req: Request, res: Response) => {
    const userId = await resolveUserId(req);
    send(res, await publishJobHandler(getPlanBoostDb(), userId, req.params.jobId));
  });

  app.post("/api/boosts", async (req: Request, res: Response) => {
    const userId = await resolveUserId(req);
    const jobId = typeof req.body?.jobId === "string" ? req.body.jobId : "";
    const packageId =
      typeof req.body?.packageId === "string"
        ? req.body.packageId
        : typeof req.body?.package === "string"
          ? req.body.package
          : "";
    send(res, await purchaseBoostHandler(getPlanBoostDb(), userId, jobId, packageId));
  });

  app.post("/api/applications/precheck", async (req: Request, res: Response) => {
    const userId = await resolveUserId(req);
    const jobId = typeof req.body?.jobId === "string" ? req.body.jobId : "";
    send(res, await applicationPrecheckHandler(getPlanBoostDb(), jobId, new Date(), userId));
  });

  app.post("/api/internal/boosts/:boostId/payment-succeeded", async (req: Request, res: Response) => {
    const secret = process.env.PLAN_BOOST_WEBHOOK_SECRET;
    if (!secret) {
      res.status(503).json({ error: "WEBHOOK_DISABLED", message: "PLAN_BOOST_WEBHOOK_SECRET is not configured" });
      return;
    }
    if (req.headers["x-webhook-secret"] !== secret) {
      res.status(401).json({ error: "UNAUTHORIZED", message: "Invalid webhook secret" });
      return;
    }
    const paymentId = typeof req.body?.paymentId === "string" ? req.body.paymentId : "";
    send(
      res,
      await boostPaymentWebhookHandler(getPlanBoostDb(), { boostId: req.params.boostId, paymentId }),
    );
  });

  registerBoostRoutes(app, resolveUserId);
}
