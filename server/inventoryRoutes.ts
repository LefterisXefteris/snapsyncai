import type { Express, Request, RequestHandler, Response } from "express";
import { z } from "zod";
import {
  adjustInventoryItem,
  assertInventoryAccess,
  deleteInventoryBundle,
  enableInventoryImport,
  getInventoryImport,
  getInventoryLedger,
  getInventoryOverview,
  ingestShopifyWebhook,
  listInventoryBundles,
  listInventoryItems,
  listInventoryLocations,
  listInventoryNotifications,
  markInventoryNotificationRead,
  reconcileInventoryUser,
  recoverInventoryJobs,
  startInventorySetup,
  updateInventoryPolicy,
  upsertInventoryBundle,
} from "./inventoryService";
import { verifyShopifyWebhookHmac } from "./shopifyAdmin";

type InventoryRouteDeps = {
  requireAuth: () => RequestHandler;
  getUserId: (req: Request) => string;
};

const nonNegativeInt = z.number().int().min(0).max(1_000_000_000);

function routeError(res: Response, error: unknown) {
  const status = (error as Error & { status?: number }).status || (error instanceof z.ZodError ? 400 : 500);
  const message = error instanceof z.ZodError
    ? error.issues.map((issue) => issue.message).join("; ")
    : error instanceof Error ? error.message : "Inventory request failed";
  if (status >= 500) console.error("Inventory route error:", error);
  return res.status(status).json({ message });
}

export function registerInventoryRoutes(app: Express, deps: InventoryRouteDeps) {
  app.post("/api/shopify/webhooks", async (req, res) => {
    try {
      const rawBody = Buffer.isBuffer(req.rawBody)
        ? req.rawBody
        : Buffer.from(JSON.stringify(req.body ?? {}));
      const signatureHeader = req.headers["x-shopify-hmac-sha256"];
      const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
      if (!verifyShopifyWebhookHmac(rawBody, signature)) {
        console.warn(JSON.stringify({
          service: "inventory_autopilot",
          event: "webhook_rejected",
          shopDomain: req.headers["x-shopify-shop-domain"] || "unknown",
        }));
        return res.status(401).json({ message: "Invalid Shopify webhook signature" });
      }

      const idHeader = req.headers["x-shopify-webhook-id"];
      const topicHeader = req.headers["x-shopify-topic"];
      const shopHeader = req.headers["x-shopify-shop-domain"];
      const externalEventId = Array.isArray(idHeader) ? idHeader[0] : idHeader;
      const topic = Array.isArray(topicHeader) ? topicHeader[0] : topicHeader;
      const shopDomain = Array.isArray(shopHeader) ? shopHeader[0] : shopHeader;
      if (!externalEventId || !topic || !shopDomain) {
        return res.status(400).json({ message: "Missing Shopify webhook headers" });
      }

      await ingestShopifyWebhook({
        externalEventId,
        topic,
        shopDomain,
        payload: req.body as Record<string, unknown>,
      });
      return res.status(200).json({ received: true });
    } catch (error) {
      return routeError(res, error);
    }
  });

  app.get("/api/inventory/locations", deps.requireAuth(), async (req, res) => {
    try {
      return res.json(await listInventoryLocations(deps.getUserId(req)));
    } catch (error) {
      return routeError(res, error);
    }
  });

  app.post("/api/inventory/setup", deps.requireAuth(), async (req, res) => {
    try {
      const body = z.object({
        locationId: z.string().min(1),
        defaultSafetyBuffer: nonNegativeInt.default(2),
        defaultLowStockThreshold: nonNegativeInt.default(5),
      }).parse(req.body);
      const job = await startInventorySetup({ userId: deps.getUserId(req), ...body });
      return res.status(202).json(job);
    } catch (error) {
      return routeError(res, error);
    }
  });

  app.post("/api/inventory/setup/:importId/enable", deps.requireAuth(), async (req, res) => {
    try {
      const importId = z.coerce.number().int().positive().parse(req.params.importId);
      return res.json(await enableInventoryImport(deps.getUserId(req), importId));
    } catch (error) {
      return routeError(res, error);
    }
  });

  app.get("/api/inventory/imports/:importId", deps.requireAuth(), async (req, res) => {
    try {
      const userId = deps.getUserId(req);
      await assertInventoryAccess(userId);
      const importId = z.coerce.number().int().positive().parse(req.params.importId);
      const job = await getInventoryImport(userId, importId);
      return job ? res.json(job) : res.status(404).json({ message: "Inventory import was not found" });
    } catch (error) {
      return routeError(res, error);
    }
  });

  app.get("/api/inventory/overview", deps.requireAuth(), async (req, res) => {
    try {
      const userId = deps.getUserId(req);
      await assertInventoryAccess(userId);
      return res.json(await getInventoryOverview(userId));
    } catch (error) {
      return routeError(res, error);
    }
  });

  app.get("/api/inventory/items", deps.requireAuth(), async (req, res) => {
    try {
      const userId = deps.getUserId(req);
      await assertInventoryAccess(userId);
      return res.json(await listInventoryItems({
        userId,
        cursor: req.query.cursor ? Number(req.query.cursor) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        search: typeof req.query.search === "string" ? req.query.search : undefined,
        state: typeof req.query.state === "string" ? req.query.state : undefined,
      }));
    } catch (error) {
      return routeError(res, error);
    }
  });

  app.post("/api/inventory/items/:id/adjustments", deps.requireAuth(), async (req, res) => {
    try {
      const body = z.object({
        mode: z.enum(["set", "delta"]),
        quantity: z.number().int().min(-1_000_000_000).max(1_000_000_000),
        reason: z.string().trim().min(3).max(250),
      }).parse(req.body);
      return res.json(await adjustInventoryItem({
        userId: deps.getUserId(req),
        itemId: z.coerce.number().int().positive().parse(req.params.id),
        ...body,
      }));
    } catch (error) {
      return routeError(res, error);
    }
  });

  app.patch("/api/inventory/items/:id/policy", deps.requireAuth(), async (req, res) => {
    try {
      const body = z.object({
        safetyBuffer: nonNegativeInt.nullable(),
        lowStockThreshold: nonNegativeInt.nullable(),
        trackingEnabled: z.boolean(),
      }).parse(req.body);
      return res.json(await updateInventoryPolicy({
        userId: deps.getUserId(req),
        itemId: z.coerce.number().int().positive().parse(req.params.id),
        ...body,
      }));
    } catch (error) {
      return routeError(res, error);
    }
  });

  app.get("/api/inventory/items/:id/ledger", deps.requireAuth(), async (req, res) => {
    try {
      const userId = deps.getUserId(req);
      await assertInventoryAccess(userId);
      const ledger = await getInventoryLedger(
        userId,
        z.coerce.number().int().positive().parse(req.params.id),
      );
      return ledger ? res.json(ledger) : res.status(404).json({ message: "Inventory item was not found" });
    } catch (error) {
      return routeError(res, error);
    }
  });

  app.get("/api/inventory/bundles", deps.requireAuth(), async (req, res) => {
    try {
      const userId = deps.getUserId(req);
      await assertInventoryAccess(userId);
      return res.json(await listInventoryBundles(userId));
    } catch (error) {
      return routeError(res, error);
    }
  });

  const bundleHandler = async (req: Request, res: Response) => {
    try {
      const body = z.object({
        bundleItemId: z.number().int().positive().optional(),
        components: z.array(z.object({
          itemId: z.number().int().positive(),
          units: z.number().int().positive().max(1_000),
        })).min(1).max(30),
      }).parse(req.body);
      const routeBundleItemId = req.params.bundleItemId
        ? z.coerce.number().int().positive().parse(req.params.bundleItemId)
        : undefined;
      const bundleItemId = routeBundleItemId ?? body.bundleItemId;
      if (!bundleItemId) return res.status(400).json({ message: "A bundle item is required" });
      return res.json(await upsertInventoryBundle({
        userId: deps.getUserId(req),
        bundleItemId,
        components: body.components,
      }));
    } catch (error) {
      return routeError(res, error);
    }
  };
  app.post("/api/inventory/bundles", deps.requireAuth(), bundleHandler);
  app.put("/api/inventory/bundles/:bundleItemId", deps.requireAuth(), bundleHandler);

  app.delete("/api/inventory/bundles/:bundleItemId", deps.requireAuth(), async (req, res) => {
    try {
      const removed = await deleteInventoryBundle(
        deps.getUserId(req),
        z.coerce.number().int().positive().parse(req.params.bundleItemId),
      );
      return removed ? res.status(204).send() : res.status(404).json({ message: "Bundle was not found" });
    } catch (error) {
      return routeError(res, error);
    }
  });

  app.get("/api/inventory/notifications", deps.requireAuth(), async (req, res) => {
    try {
      const userId = deps.getUserId(req);
      await assertInventoryAccess(userId);
      return res.json(await listInventoryNotifications(userId));
    } catch (error) {
      return routeError(res, error);
    }
  });

  app.post("/api/inventory/notifications/:id/read", deps.requireAuth(), async (req, res) => {
    try {
      const notification = await markInventoryNotificationRead(
        deps.getUserId(req),
        z.coerce.number().int().positive().parse(req.params.id),
      );
      return notification
        ? res.json(notification)
        : res.status(404).json({ message: "Notification was not found" });
    } catch (error) {
      return routeError(res, error);
    }
  });

  app.post("/api/inventory/reconcile", deps.requireAuth(), async (req, res) => {
    try {
      const userId = deps.getUserId(req);
      await assertInventoryAccess(userId);
      return res.status(202).json(await reconcileInventoryUser(userId));
    } catch (error) {
      return routeError(res, error);
    }
  });

  app.get("/api/inventory/cron", async (req, res) => {
    const authorization = req.headers.authorization;
    if (!process.env.CRON_SECRET || authorization !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      return res.json(await recoverInventoryJobs());
    } catch (error) {
      return routeError(res, error);
    }
  });
}
