import crypto from "node:crypto";
import * as Sentry from "@sentry/node";
import { Resend } from "resend";
import { send as sendQueueMessage } from "@vercel/queue";
import { clerkClient } from "@clerk/express";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  ilike,
  inArray,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { db, pool } from "./db";
import {
  inventoryBundleComponents,
  inventoryChannelLinks,
  inventoryImportJobs,
  inventoryItems,
  inventoryLedgerEntries,
  inventoryNotifications,
  inventoryOutboxJobs,
  inventorySettings,
  inventoryWebhookEvents,
  shopifyConnections,
  subscriptions,
  type InventoryItem,
  type ShopifyConnection,
} from "@shared/schema";
import {
  calculateAdjustedQuantity,
  calculateSellableQuantity,
  effectiveLowStockThreshold,
  effectiveSafetyBuffer,
  isLowStock,
  parseShopifyBulkInventoryJsonl,
  shouldSendLowStockEmail,
  type ImportedInventoryRecord,
  validateBundleRecipe,
  webhookAdjustmentDelta,
} from "./inventory-core";
import {
  encryptShopifyToken,
  getShopifyBulkOperation,
  getShopifyInventoryQuantity,
  getShopifyLocations,
  registerInventoryWebhooks,
  replaceShopifyBundleComponents,
  setShopifyInventoryQuantity,
  setShopifyVariantInventoryPolicies,
  startShopifyCatalogBulkImport,
  unregisterInventoryWebhooks,
} from "./shopifyAdmin";

const INVENTORY_TOPIC = "inventory-autopilot";
const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing", "canceling"]);

function inventoryLog(
  level: "info" | "warn" | "error",
  event: string,
  fields: Record<string, unknown> = {},
) {
  const message = JSON.stringify({ service: "inventory_autopilot", event, ...fields });
  if (level === "error") console.error(message);
  else if (level === "warn") console.warn(message);
  else console.info(message);
}

export type InventoryQueueMessage = { jobId: number };

function featureEnabled() {
  return process.env.INVENTORY_AUTOPILOT_ENABLED === "true";
}

function proAccessError() {
  const error = new Error("Inventory Autopilot requires an active SnapSync AI Pro subscription");
  (error as Error & { status?: number }).status = 402;
  return error;
}

async function updateSubscriptionGrace(userId: string) {
  const [[subscription], [settings]] = await Promise.all([
    db.select().from(subscriptions).where(eq(subscriptions.userId, userId)),
    db.select().from(inventorySettings).where(eq(inventorySettings.userId, userId)),
  ]);
  const active = !!subscription && ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status);
  if (active) {
    if (settings?.graceEndsAt || settings?.status === "grace") {
      await db.update(inventorySettings).set({
        graceEndsAt: null,
        status: settings.enabled ? "active" : settings.status,
        updatedAt: new Date(),
      }).where(eq(inventorySettings.userId, userId));
    }
    return { active: true, grace: false, expired: false };
  }
  if (!settings?.enabled) return { active: false, grace: false, expired: true };

  const now = new Date();
  const expiryAnchor = subscription?.currentPeriodEnd
    && subscription.currentPeriodEnd.getTime() < now.getTime()
    ? subscription.currentPeriodEnd
    : now;
  const graceEndsAt = settings.graceEndsAt
    ?? new Date(expiryAnchor.getTime() + 7 * 24 * 60 * 60 * 1000);
  if (graceEndsAt.getTime() > now.getTime()) {
    if (!settings.graceEndsAt || settings.status !== "grace") {
      await db.update(inventorySettings).set({
        graceEndsAt,
        status: "grace",
        updatedAt: now,
      }).where(eq(inventorySettings.userId, userId));
    }
    return { active: false, grace: true, expired: false };
  }

  await db.update(inventorySettings).set({
    enabled: false,
    status: "expired",
    updatedAt: now,
  }).where(eq(inventorySettings.userId, userId));
  const connection = await getConnectionForUser(userId).catch(() => undefined);
  if (connection) {
    await unregisterInventoryWebhooks(
      connection,
      `${appBaseUrl()}/api/shopify/webhooks`,
    ).catch((error) => {
      console.warn("Could not unregister expired inventory webhooks:", error instanceof Error ? error.message : error);
    });
  }
  return { active: false, grace: false, expired: true };
}

export async function assertInventoryAccess(userId: string, options: { write?: boolean } = {}) {
  if (!featureEnabled()) {
    const error = new Error("Inventory Autopilot is not enabled for this deployment");
    (error as Error & { status?: number }).status = 404;
    throw error;
  }
  if (process.env.DEV_BYPASS_AUTH === "true") return;
  const entitlement = await updateSubscriptionGrace(userId);
  if (entitlement.active || (entitlement.grace && !options.write)) return;
  throw proAccessError();
}

async function getConnectionForUser(userId: string) {
  const [connection] = await db.select().from(shopifyConnections)
    .where(eq(shopifyConnections.sessionId, userId));
  if (!connection) {
    const error = new Error("Connect Shopify before setting up Inventory Autopilot");
    (error as Error & { status?: number }).status = 400;
    throw error;
  }
  return connection;
}

async function getConnectionForShop(shopDomain: string) {
  const [connection] = await db.select().from(shopifyConnections)
    .where(eq(shopifyConnections.shopDomain, shopDomain));
  return connection;
}

export async function listInventoryLocations(userId: string) {
  await assertInventoryAccess(userId);
  return getShopifyLocations(await getConnectionForUser(userId));
}

function appBaseUrl() {
  return (process.env.APP_BASE_URL || "https://snapsyncai.co.uk").replace(/\/$/, "");
}

export async function startInventorySetup(input: {
  userId: string;
  locationId: string;
  defaultSafetyBuffer: number;
  defaultLowStockThreshold: number;
}) {
  await assertInventoryAccess(input.userId, { write: true });
  const connection = await getConnectionForUser(input.userId);
  const locations = await getShopifyLocations(connection);
  const location = locations.find((candidate) => candidate.id === input.locationId);
  if (!location) {
    const error = new Error("The selected Shopify location is not active");
    (error as Error & { status?: number }).status = 400;
    throw error;
  }

  const encryptedToken = encryptShopifyToken(connection.accessToken);
  if (encryptedToken !== connection.accessToken) {
    await db.update(shopifyConnections)
      .set({ accessToken: encryptedToken })
      .where(eq(shopifyConnections.id, connection.id));
    connection.accessToken = encryptedToken;
  }

  await registerInventoryWebhooks(
    connection,
    `${appBaseUrl()}/api/shopify/webhooks`,
  );
  await db.update(shopifyConnections)
    .set({ webhooksRegisteredAt: new Date() })
    .where(eq(shopifyConnections.id, connection.id));
  await db.update(inventoryNotifications).set({ resolvedAt: new Date() })
    .where(and(
      eq(inventoryNotifications.userId, input.userId),
      inArray(inventoryNotifications.type, ["connection", "sync_failure"]),
      isNull(inventoryNotifications.resolvedAt),
    ));

  await db.insert(inventorySettings).values({
    userId: input.userId,
    shopDomain: connection.shopDomain,
    locationId: location.id,
    locationName: location.name,
    status: "importing",
    enabled: false,
    defaultSafetyBuffer: input.defaultSafetyBuffer,
    defaultLowStockThreshold: input.defaultLowStockThreshold,
    updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: inventorySettings.userId,
    set: {
      shopDomain: connection.shopDomain,
      locationId: location.id,
      locationName: location.name,
      status: "importing",
      enabled: false,
      defaultSafetyBuffer: input.defaultSafetyBuffer,
      defaultLowStockThreshold: input.defaultLowStockThreshold,
      updatedAt: new Date(),
    },
  });

  const [job] = await db.insert(inventoryImportJobs).values({
    userId: input.userId,
    status: "starting",
  }).returning();

  try {
    const operation = await startShopifyCatalogBulkImport(connection);
    const [updated] = await db.update(inventoryImportJobs).set({
      externalOperationId: operation.id,
      status: operation.status === "COMPLETED" ? "processing" : "running",
    }).where(eq(inventoryImportJobs.id, job.id)).returning();

    if (operation.status === "COMPLETED") {
      await enqueueInventoryJob(input.userId, "finish_import", { importJobId: job.id });
    }
    return updated;
  } catch (error) {
    await db.update(inventoryImportJobs).set({
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
      completedAt: new Date(),
    }).where(eq(inventoryImportJobs.id, job.id));
    throw error;
  }
}

function normalizeGid(resource: "InventoryItem" | "Location" | "Product", value: unknown) {
  const text = String(value || "");
  return text.startsWith("gid://") ? text : `gid://shopify/${resource}/${text}`;
}

async function finishCatalogImport(importJobId: number) {
  const [job] = await db.select().from(inventoryImportJobs)
    .where(eq(inventoryImportJobs.id, importJobId));
  if (!job || !job.externalOperationId) throw new Error("Inventory import job was not found");
  if (job.status === "preview_ready" || job.status === "enabled") return;

  const connection = await getConnectionForUser(job.userId);
  const [settings] = await db.select().from(inventorySettings)
    .where(eq(inventorySettings.userId, job.userId));
  if (!settings) throw new Error("Inventory settings were not found");

  const operation = await getShopifyBulkOperation(connection, job.externalOperationId);
  if (operation.status !== "COMPLETED") {
    if (["FAILED", "CANCELED", "EXPIRED"].includes(operation.status)) {
      throw new Error(`Shopify catalog import ${operation.status.toLowerCase()}: ${operation.errorCode || "unknown error"}`);
    }
    const error = new Error("Shopify catalog import is not finished yet");
    (error as Error & { retryAfterSeconds?: number }).retryAfterSeconds = 20;
    throw error;
  }

  const downloadUrl = operation.url || operation.partialDataUrl;
  if (!downloadUrl) throw new Error("Shopify catalog import completed without a result file");
  const response = await fetch(downloadUrl);
  if (!response.ok) throw new Error(`Could not download Shopify catalog import (${response.status})`);
  const records = parseShopifyBulkInventoryJsonl(await response.text(), settings.locationId);
  const isLiveRefresh = job.provider === "shopify_refresh" && settings.enabled;

  const existingLinks = await db.select().from(inventoryChannelLinks)
    .where(and(
      eq(inventoryChannelLinks.userId, job.userId),
      eq(inventoryChannelLinks.channel, "shopify"),
      eq(inventoryChannelLinks.externalLocationId, settings.locationId),
    ));
  const existingByExternal = new Map(existingLinks.map((link) => [link.externalInventoryItemId, link]));

  const newRecords: ImportedInventoryRecord[] = [];
  const existingRecords: Array<ImportedInventoryRecord & { itemId: number; linkId: number }> = [];
  for (const record of records) {
    const existing = existingByExternal.get(record.inventoryItemId);
    if (!existing) {
      newRecords.push(record);
      continue;
    }
    existingRecords.push({ ...record, itemId: existing.inventoryItemId, linkId: existing.id });
  }

  for (let offset = 0; offset < existingRecords.length; offset += 250) {
    const chunk = existingRecords.slice(offset, offset + 250);
    const payload = JSON.stringify(chunk.map((record) => ({
      item_id: record.itemId,
      link_id: record.linkId,
      product_id: record.productId,
      variant_id: record.variantId,
      title: record.title,
      variant_title: record.variantTitle,
      sku: record.sku,
      tracked: record.tracked,
      status: record.status,
      quantity: record.quantity,
    })));
    await db.transaction(async (tx) => {
      await tx.execute(sql`
        WITH imported AS (
          SELECT * FROM jsonb_to_recordset(${payload}::jsonb) AS data(
            item_id integer,
            link_id integer,
            product_id text,
            variant_id text,
            title text,
            variant_title text,
            sku text,
            tracked boolean,
            status text,
            quantity integer
          )
        )
        UPDATE inventory_items AS item
        SET title = imported.title,
            variant_title = imported.variant_title,
            sku = imported.sku,
            tracking_enabled = imported.tracked,
            state = ${isLiveRefresh ? "active" : "draft"},
            updated_at = NOW()
        FROM imported
        WHERE item.id = imported.item_id
      `);
      await tx.execute(sql`
        WITH imported AS (
          SELECT * FROM jsonb_to_recordset(${payload}::jsonb) AS data(
            item_id integer,
            link_id integer,
            product_id text,
            variant_id text,
            title text,
            variant_title text,
            sku text,
            tracked boolean,
            status text,
            quantity integer
          )
        )
        UPDATE inventory_channel_links AS link
        SET external_product_id = imported.product_id,
            external_variant_id = imported.variant_id,
            observed_quantity = CASE
              WHEN ${isLiveRefresh} THEN link.observed_quantity
              ELSE imported.quantity
            END,
            pushed_quantity = CASE
              WHEN ${isLiveRefresh} THEN link.pushed_quantity
              ELSE imported.quantity
            END,
            pending_quantity = NULL,
            external_status = imported.status,
            sync_state = ${isLiveRefresh ? "pending" : "draft"},
            last_observed_at = CASE
              WHEN ${isLiveRefresh} THEN link.last_observed_at
              ELSE NOW()
            END,
            updated_at = NOW()
        FROM imported
        WHERE link.id = imported.link_id
      `);
    });
  }

  // Keep the initial 10k+ catalog path bounded: each chunk is three set-based
  // inserts rather than three round trips per variant.
  for (let offset = 0; offset < newRecords.length; offset += 250) {
    const chunk = newRecords.slice(offset, offset + 250);
    await db.transaction(async (tx) => {
      const insertedItems = await tx.insert(inventoryItems).values(chunk.map((record) => ({
        userId: job.userId,
        title: record.title,
        variantTitle: record.variantTitle,
        sku: record.sku,
        ledgerQuantity: record.quantity,
        trackingEnabled: record.tracked,
        state: isLiveRefresh ? "active" : "draft",
      }))).returning({ id: inventoryItems.id });
      await tx.insert(inventoryLedgerEntries).values(chunk.map((record, index) => ({
        userId: job.userId,
        inventoryItemId: insertedItems[index].id,
        delta: record.quantity,
        quantityAfter: record.quantity,
        reason: "Initial Shopify catalog import",
        source: "shopify_import",
        idempotencyKey: `import:${record.inventoryItemId}`,
        externalReference: job.externalOperationId,
      })));
      await tx.insert(inventoryChannelLinks).values(chunk.map((record, index) => ({
        userId: job.userId,
        inventoryItemId: insertedItems[index].id,
        externalProductId: record.productId,
        externalVariantId: record.variantId,
        externalInventoryItemId: record.inventoryItemId,
        externalLocationId: settings.locationId,
        observedQuantity: record.quantity,
        pushedQuantity: record.quantity,
        externalStatus: record.status,
        syncState: isLiveRefresh ? "pending" : "draft",
        lastObservedAt: new Date(),
      })));
    });
  }

  const bufferImpact = records.reduce(
    (total, record) => total + Math.min(record.quantity, settings.defaultSafetyBuffer),
    0,
  );
  const preview = {
    totalVariants: records.length,
    trackedVariants: records.filter((record) => record.tracked).length,
    missingSku: records.filter((record) => !record.sku).length,
    unitsReservedByBuffer: bufferImpact,
  };

  await db.update(inventoryImportJobs).set({
    status: isLiveRefresh ? "enabled" : "preview_ready",
    totalItems: records.length,
    importedItems: records.length,
    preview,
    completedAt: new Date(),
  }).where(eq(inventoryImportJobs.id, job.id));
  await db.update(inventorySettings).set({
    status: isLiveRefresh ? "active" : "preview",
    updatedAt: new Date(),
  }).where(eq(inventorySettings.userId, job.userId));
  if (isLiveRefresh) {
    await enqueueInventoryJob(job.userId, "protect_variants", { userId: job.userId, cursor: 0 });
  }
}

async function startWebhookCatalogRefresh(userId: string) {
  const [running] = await db.select({ id: inventoryImportJobs.id }).from(inventoryImportJobs)
    .where(and(
      eq(inventoryImportJobs.userId, userId),
      eq(inventoryImportJobs.provider, "shopify_refresh"),
      inArray(inventoryImportJobs.status, ["starting", "running", "processing"]),
    ))
    .limit(1);
  if (running) return running;

  const [job] = await db.insert(inventoryImportJobs).values({
    userId,
    provider: "shopify_refresh",
    status: "starting",
  }).returning();
  try {
    const operation = await startShopifyCatalogBulkImport(await getConnectionForUser(userId));
    const [updated] = await db.update(inventoryImportJobs).set({
      externalOperationId: operation.id,
      status: operation.status === "COMPLETED" ? "processing" : "running",
    }).where(eq(inventoryImportJobs.id, job.id)).returning();
    if (operation.status === "COMPLETED") {
      await enqueueInventoryJob(userId, "finish_import", { importJobId: job.id });
    }
    return updated;
  } catch (error) {
    await db.update(inventoryImportJobs).set({
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
      completedAt: new Date(),
    }).where(eq(inventoryImportJobs.id, job.id));
    throw error;
  }
}

export async function enableInventoryImport(userId: string, importJobId: number) {
  await assertInventoryAccess(userId, { write: true });
  const [job] = await db.select().from(inventoryImportJobs)
    .where(and(eq(inventoryImportJobs.id, importJobId), eq(inventoryImportJobs.userId, userId)));
  if (!job || job.status !== "preview_ready") {
    const error = new Error("The catalog preview is not ready to enable");
    (error as Error & { status?: number }).status = 409;
    throw error;
  }

  await db.transaction(async (tx) => {
    await tx.update(inventorySettings).set({
      status: "active",
      enabled: true,
      updatedAt: new Date(),
    }).where(eq(inventorySettings.userId, userId));
    await tx.update(inventoryItems).set({
      state: "active",
      updatedAt: new Date(),
    }).where(eq(inventoryItems.userId, userId));
    await tx.update(inventoryChannelLinks).set({
      syncState: "pending",
      updatedAt: new Date(),
    }).where(eq(inventoryChannelLinks.userId, userId));
    await tx.update(inventoryImportJobs).set({ status: "enabled" })
      .where(eq(inventoryImportJobs.id, importJobId));
  });

  await enqueueInventoryJob(userId, "protect_variants", { userId, cursor: 0 });
  return { enabled: true };
}

export async function getInventoryImport(userId: string, importJobId: number) {
  const [job] = await db.select().from(inventoryImportJobs)
    .where(and(eq(inventoryImportJobs.id, importJobId), eq(inventoryImportJobs.userId, userId)));
  return job;
}

export async function getInventoryOverview(userId: string) {
  const [settings] = await db.select().from(inventorySettings)
    .where(eq(inventorySettings.userId, userId));
  const [totals] = await db.select({
    totalItems: sql<number>`count(*)::int`,
    totalUnits: sql<number>`coalesce(sum(${inventoryItems.ledgerQuantity}), 0)::int`,
    lowStockItems: sql<number>`count(*) filter (
      where ${inventoryItems.ledgerQuantity} <= coalesce(
        ${inventoryItems.lowStockThreshold},
        ${settings?.defaultLowStockThreshold ?? 5}
      )
    )::int`,
    soldOutItems: sql<number>`count(*) filter (
      where greatest(
        0,
        ${inventoryItems.ledgerQuantity} - coalesce(
          ${inventoryItems.safetyBuffer},
          ${settings?.defaultSafetyBuffer ?? 2}
        )
      ) = 0
    )::int`,
    syncFailures: sql<number>`count(*) filter (where ${inventoryItems.state} = 'conflict')::int`,
  }).from(inventoryItems).where(eq(inventoryItems.userId, userId));
  const [unread] = await db.select({
    count: sql<number>`count(*)::int`,
  }).from(inventoryNotifications).where(and(
    eq(inventoryNotifications.userId, userId),
    isNull(inventoryNotifications.readAt),
    isNull(inventoryNotifications.resolvedAt),
  ));
  const [latestImport] = await db.select().from(inventoryImportJobs)
    .where(eq(inventoryImportJobs.userId, userId))
    .orderBy(desc(inventoryImportJobs.createdAt))
    .limit(1);
  return {
    settings: settings || null,
    latestImport: latestImport || null,
    ...totals,
    unreadAlerts: unread?.count || 0,
  };
}

export async function listInventoryItems(input: {
  userId: string;
  cursor?: number;
  limit?: number;
  search?: string;
  state?: string;
}) {
  const [settings] = await db.select({
    defaultSafetyBuffer: inventorySettings.defaultSafetyBuffer,
  }).from(inventorySettings).where(eq(inventorySettings.userId, input.userId));
  const limit = Math.min(Math.max(input.limit || 50, 1), 100);
  const conditions = [eq(inventoryItems.userId, input.userId)];
  if (input.cursor) conditions.push(gt(inventoryItems.id, input.cursor));
  if (input.state && input.state !== "all") conditions.push(eq(inventoryItems.state, input.state));
  if (input.search) {
    const search = `%${input.search}%`;
    conditions.push(or(
      ilike(inventoryItems.title, search),
      ilike(inventoryItems.variantTitle, search),
      ilike(inventoryItems.sku, search),
    )!);
  }
  const rows = await db.select({
    item: inventoryItems,
    link: inventoryChannelLinks,
  }).from(inventoryItems)
    .leftJoin(inventoryChannelLinks, eq(inventoryChannelLinks.inventoryItemId, inventoryItems.id))
    .where(and(...conditions))
    .orderBy(asc(inventoryItems.id))
    .limit(limit + 1);
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  return {
    items: page.map(({ item, link }) => ({
      ...item,
      safetyBuffer: item.safetyBuffer,
      lowStockThreshold: item.lowStockThreshold,
      sellableQuantity: calculateSellableQuantity(
        item.ledgerQuantity,
        item.safetyBuffer ?? settings?.defaultSafetyBuffer ?? 2,
      ),
      channelLink: link,
    })),
    nextCursor: hasMore ? page[page.length - 1]?.item.id ?? null : null,
  };
}

async function applyLedgerAdjustment(input: {
  userId: string;
  itemId: number;
  mode: "set" | "delta";
  quantity: number;
  reason: string;
  source: string;
  idempotencyKey: string;
  externalReference?: string;
}) {
  return db.transaction(async (tx) => {
    const locked = await tx.execute(sql`
      SELECT * FROM inventory_items
      WHERE id = ${input.itemId} AND user_id = ${input.userId}
      FOR UPDATE
    `);
    const row = locked.rows[0] as Record<string, any> | undefined;
    if (!row) {
      const error = new Error("Inventory item was not found");
      (error as Error & { status?: number }).status = 404;
      throw error;
    }

    const [existing] = await tx.select({ id: inventoryLedgerEntries.id })
      .from(inventoryLedgerEntries)
      .where(eq(inventoryLedgerEntries.idempotencyKey, input.idempotencyKey))
      .limit(1);
    if (existing) {
      const [item] = await tx.select().from(inventoryItems)
        .where(eq(inventoryItems.id, input.itemId));
      return item;
    }

    const current = Number(row.ledger_quantity);
    const next = calculateAdjustedQuantity(current, input.mode, input.quantity);
    const [item] = await tx.update(inventoryItems).set({
      ledgerQuantity: next,
      version: Number(row.version) + 1,
      updatedAt: new Date(),
    }).where(eq(inventoryItems.id, input.itemId)).returning();
    await tx.insert(inventoryLedgerEntries).values({
      userId: input.userId,
      inventoryItemId: input.itemId,
      delta: next - current,
      quantityAfter: next,
      reason: input.reason,
      source: input.source,
      idempotencyKey: input.idempotencyKey,
      externalReference: input.externalReference,
    });
    return item;
  });
}

export async function adjustInventoryItem(input: {
  userId: string;
  itemId: number;
  mode: "set" | "delta";
  quantity: number;
  reason: string;
}) {
  await assertInventoryAccess(input.userId, { write: true });
  const item = await applyLedgerAdjustment({
    ...input,
    source: "snapsync",
    idempotencyKey: `manual:${input.userId}:${crypto.randomUUID()}`,
  });
  await enqueueInventoryJob(input.userId, "sync_item", { itemId: item.id });
  await evaluateStockAlert(item);
  return item;
}

export async function updateInventoryPolicy(input: {
  userId: string;
  itemId: number;
  safetyBuffer: number | null;
  lowStockThreshold: number | null;
  trackingEnabled: boolean;
}) {
  await assertInventoryAccess(input.userId, { write: true });
  const [item] = await db.update(inventoryItems).set({
    safetyBuffer: input.safetyBuffer,
    lowStockThreshold: input.lowStockThreshold,
    trackingEnabled: input.trackingEnabled,
    updatedAt: new Date(),
  }).where(and(
    eq(inventoryItems.id, input.itemId),
    eq(inventoryItems.userId, input.userId),
  )).returning();
  if (!item) {
    const error = new Error("Inventory item was not found");
    (error as Error & { status?: number }).status = 404;
    throw error;
  }
  await enqueueInventoryJob(input.userId, "sync_item", { itemId: item.id });
  await evaluateStockAlert(item);
  return item;
}

export async function getInventoryLedger(userId: string, itemId: number) {
  const [item] = await db.select({ id: inventoryItems.id }).from(inventoryItems)
    .where(and(eq(inventoryItems.id, itemId), eq(inventoryItems.userId, userId)));
  if (!item) return null;
  return db.select().from(inventoryLedgerEntries)
    .where(eq(inventoryLedgerEntries.inventoryItemId, itemId))
    .orderBy(desc(inventoryLedgerEntries.createdAt))
    .limit(100);
}

export async function upsertInventoryBundle(input: {
  userId: string;
  bundleItemId: number;
  components: Array<{ itemId: number; units: number }>;
}) {
  await assertInventoryAccess(input.userId, { write: true });
  const ids = [input.bundleItemId, ...input.components.map((component) => component.itemId)];
  const rows = await db.select({
    item: inventoryItems,
    link: inventoryChannelLinks,
  }).from(inventoryItems)
    .innerJoin(inventoryChannelLinks, eq(inventoryChannelLinks.inventoryItemId, inventoryItems.id))
    .where(and(
      eq(inventoryItems.userId, input.userId),
      inArray(inventoryItems.id, ids),
    ));
  const byId = new Map(rows.map((row) => [row.item.id, row]));
  validateBundleRecipe({
    bundleItemId: input.bundleItemId,
    components: input.components.map((component) => ({
      ...component,
      kind: byId.get(component.itemId)?.item.kind,
    })),
  });
  if (byId.size !== ids.length) {
    const error = new Error("One or more bundle items were not found");
    (error as Error & { status?: number }).status = 404;
    throw error;
  }
  const parent = byId.get(input.bundleItemId)!;
  const connection = await getConnectionForUser(input.userId);

  await replaceShopifyBundleComponents({
    connection,
    parentVariantId: parent.link.externalVariantId,
    components: input.components.map((component) => ({
      variantId: byId.get(component.itemId)!.link.externalVariantId,
      units: component.units,
    })),
  });

  await db.transaction(async (tx) => {
    await tx.delete(inventoryBundleComponents)
      .where(eq(inventoryBundleComponents.bundleItemId, input.bundleItemId));
    await tx.insert(inventoryBundleComponents).values(
      input.components.map((component) => ({
        userId: input.userId,
        bundleItemId: input.bundleItemId,
        componentItemId: component.itemId,
        units: component.units,
      })),
    );
    await tx.update(inventoryItems).set({
      kind: "bundle",
      updatedAt: new Date(),
    }).where(eq(inventoryItems.id, input.bundleItemId));
  });
  return getInventoryBundle(input.userId, input.bundleItemId);
}

export async function getInventoryBundle(userId: string, bundleItemId: number) {
  const [settings] = await db.select({
    defaultSafetyBuffer: inventorySettings.defaultSafetyBuffer,
  }).from(inventorySettings).where(eq(inventorySettings.userId, userId));
  const components = await db.select({
    id: inventoryBundleComponents.id,
    itemId: inventoryBundleComponents.componentItemId,
    units: inventoryBundleComponents.units,
    title: inventoryItems.title,
    sku: inventoryItems.sku,
    quantity: inventoryItems.ledgerQuantity,
    safetyBuffer: inventoryItems.safetyBuffer,
  }).from(inventoryBundleComponents)
    .innerJoin(inventoryItems, eq(inventoryItems.id, inventoryBundleComponents.componentItemId))
    .where(and(
      eq(inventoryBundleComponents.userId, userId),
      eq(inventoryBundleComponents.bundleItemId, bundleItemId),
    ));
  const computedAvailability = components.length > 0
    ? Math.min(...components.map((component) => Math.floor(
      calculateSellableQuantity(
        component.quantity,
        component.safetyBuffer ?? settings?.defaultSafetyBuffer ?? 2,
      ) / component.units,
    )))
    : 0;
  return { bundleItemId, components, computedAvailability };
}

export async function listInventoryBundles(userId: string) {
  const bundles = await db.select().from(inventoryItems)
    .where(and(eq(inventoryItems.userId, userId), eq(inventoryItems.kind, "bundle")))
    .orderBy(asc(inventoryItems.title));
  return Promise.all(bundles.map(async (bundle) => ({
    ...bundle,
    components: (await getInventoryBundle(userId, bundle.id)).components,
  })));
}

export async function deleteInventoryBundle(userId: string, bundleItemId: number) {
  await assertInventoryAccess(userId, { write: true });
  const rows = await db.select({
    item: inventoryItems,
    link: inventoryChannelLinks,
  }).from(inventoryItems)
    .innerJoin(inventoryChannelLinks, eq(inventoryChannelLinks.inventoryItemId, inventoryItems.id))
    .where(and(eq(inventoryItems.id, bundleItemId), eq(inventoryItems.userId, userId)));
  if (!rows[0]) return false;
  await replaceShopifyBundleComponents({
    connection: await getConnectionForUser(userId),
    parentVariantId: rows[0].link.externalVariantId,
    components: [],
  });
  await db.transaction(async (tx) => {
    await tx.delete(inventoryBundleComponents)
      .where(eq(inventoryBundleComponents.bundleItemId, bundleItemId));
    await tx.update(inventoryItems).set({ kind: "standalone", updatedAt: new Date() })
      .where(eq(inventoryItems.id, bundleItemId));
  });
  return true;
}

async function createInventoryNotification(input: {
  userId: string;
  inventoryItemId?: number;
  type: string;
  severity: string;
  title: string;
  body: string;
  dedupeKey: string;
  email?: boolean;
}) {
  const [existing] = await db.select().from(inventoryNotifications)
    .where(and(
      eq(inventoryNotifications.userId, input.userId),
      eq(inventoryNotifications.dedupeKey, input.dedupeKey),
      isNull(inventoryNotifications.resolvedAt),
    ))
    .orderBy(desc(inventoryNotifications.createdAt))
    .limit(1);
  const [created] = existing ? [] : await db.insert(inventoryNotifications).values({
    userId: input.userId,
    inventoryItemId: input.inventoryItemId,
    type: input.type,
    severity: input.severity,
    title: input.title,
    body: input.body,
    dedupeKey: input.dedupeKey,
  }).onConflictDoNothing().returning();
  const notification = existing || created || (await db.select().from(inventoryNotifications)
    .where(and(
      eq(inventoryNotifications.userId, input.userId),
      eq(inventoryNotifications.dedupeKey, input.dedupeKey),
      isNull(inventoryNotifications.resolvedAt),
    ))
    .limit(1))[0];
  if (!notification) throw new Error("Could not persist inventory notification");

  if (input.email) {
    const [lastEmail] = await db.select({ emailedAt: inventoryNotifications.emailedAt })
      .from(inventoryNotifications)
      .where(and(
        eq(inventoryNotifications.userId, input.userId),
        eq(inventoryNotifications.dedupeKey, input.dedupeKey),
        sql`${inventoryNotifications.emailedAt} IS NOT NULL`,
      ))
      .orderBy(desc(inventoryNotifications.emailedAt))
      .limit(1);
    if (shouldSendLowStockEmail(lastEmail?.emailedAt ?? null)) {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [reserved] = await db.update(inventoryNotifications).set({ emailedAt: new Date() })
        .where(and(
          eq(inventoryNotifications.id, notification.id),
          or(
            isNull(inventoryNotifications.emailedAt),
            lte(inventoryNotifications.emailedAt, cutoff),
          ),
        )).returning({ id: inventoryNotifications.id });
      if (reserved) {
        await enqueueInventoryJob(input.userId, "send_alert_email", { notificationId: notification.id });
      }
    }
  }
  return notification;
}

async function evaluateStockAlert(item: InventoryItem) {
  const [settings] = await db.select().from(inventorySettings)
    .where(eq(inventorySettings.userId, item.userId));
  if (!settings) return;
  const threshold = effectiveLowStockThreshold(item, settings.defaultLowStockThreshold);
  const dedupeKey = `low-stock:${item.id}`;
  if (isLowStock(item.ledgerQuantity, threshold)) {
    await createInventoryNotification({
      userId: item.userId,
      inventoryItemId: item.id,
      type: "low_stock",
      severity: item.ledgerQuantity === 0 ? "critical" : "warning",
      title: item.ledgerQuantity === 0 ? `${item.title} is out of stock` : `${item.title} is running low`,
      body: `${item.sku || "This item"} has ${item.ledgerQuantity} units remaining.`,
      dedupeKey,
      email: true,
    });
  } else {
    await db.update(inventoryNotifications).set({ resolvedAt: new Date() })
      .where(and(
        eq(inventoryNotifications.userId, item.userId),
        eq(inventoryNotifications.dedupeKey, dedupeKey),
        isNull(inventoryNotifications.resolvedAt),
      ));
  }
}

async function sendAlertEmail(notificationId: number) {
  const [notification] = await db.select().from(inventoryNotifications)
    .where(eq(inventoryNotifications.id, notificationId));
  if (!notification || notification.resolvedAt) return;
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.INVENTORY_ALERT_FROM_EMAIL;
  if (!apiKey || !from) throw new Error("Resend inventory alert delivery is not configured");
  const user = await clerkClient.users.getUser(notification.userId);
  const email = user.emailAddresses.find((entry) => entry.id === user.primaryEmailAddressId)?.emailAddress
    || user.emailAddresses[0]?.emailAddress;
  if (!email) throw new Error("The seller does not have an email address");
  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from,
    to: email,
    subject: notification.title,
    text: `${notification.body}\n\nOpen Inventory Autopilot: ${appBaseUrl()}/inventory`,
  });
  if (result.error) throw new Error(result.error.message);
}

export async function listInventoryNotifications(userId: string) {
  return db.select().from(inventoryNotifications)
    .where(eq(inventoryNotifications.userId, userId))
    .orderBy(desc(inventoryNotifications.createdAt))
    .limit(100);
}

export async function markInventoryNotificationRead(userId: string, notificationId: number) {
  const [notification] = await db.update(inventoryNotifications).set({ readAt: new Date() })
    .where(and(
      eq(inventoryNotifications.id, notificationId),
      eq(inventoryNotifications.userId, userId),
    )).returning();
  return notification;
}

async function syncInventoryItemUnlocked(itemId: number) {
  const rows = await db.select({
    item: inventoryItems,
    link: inventoryChannelLinks,
    settings: inventorySettings,
    connection: shopifyConnections,
  }).from(inventoryItems)
    .innerJoin(inventoryChannelLinks, eq(inventoryChannelLinks.inventoryItemId, inventoryItems.id))
    .innerJoin(inventorySettings, eq(inventorySettings.userId, inventoryItems.userId))
    .innerJoin(shopifyConnections, eq(shopifyConnections.sessionId, inventoryItems.userId))
    .where(eq(inventoryItems.id, itemId));
  const row = rows[0];
  if (!row || !row.settings.enabled || !row.item.trackingEnabled || row.item.kind === "bundle") return;

  let currentItem = row.item;
  let target = calculateSellableQuantity(
    currentItem.ledgerQuantity,
    effectiveSafetyBuffer(currentItem, row.settings.defaultSafetyBuffer),
  );
  let itemVersion = currentItem.version;
  if (row.link.observedQuantity === target && row.link.pendingQuantity === null) {
    await db.update(inventoryChannelLinks).set({
      pushedQuantity: target,
      syncState: "synced",
      lastError: null,
      updatedAt: new Date(),
    }).where(eq(inventoryChannelLinks.id, row.link.id));
    return;
  }

  await db.update(inventoryChannelLinks).set({
    pendingQuantity: target,
    syncState: "syncing",
    updatedAt: new Date(),
  }).where(eq(inventoryChannelLinks.id, row.link.id));

  let compareQuantity = row.link.observedQuantity;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await setShopifyInventoryQuantity({
        connection: row.connection,
        inventoryItemId: row.link.externalInventoryItemId,
        locationId: row.link.externalLocationId,
        quantity: target,
        compareQuantity,
        idempotencyKey: `inventory-${row.item.id}-${itemVersion}-${target}-${compareQuantity}`,
      });
      await db.transaction(async (tx) => {
        await tx.update(inventoryChannelLinks).set({
          observedQuantity: target,
          pushedQuantity: target,
          pendingQuantity: null,
          syncState: "synced",
          lastError: null,
          lastObservedAt: new Date(),
          lastPushedAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(inventoryChannelLinks.id, row.link.id));
        await tx.update(inventoryItems).set({
          state: target === 0 ? "sold_out" : "active",
          lastSyncedAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(inventoryItems.id, row.item.id));
        await tx.update(inventoryNotifications).set({ resolvedAt: new Date() })
          .where(and(
            eq(inventoryNotifications.userId, row.item.userId),
            eq(inventoryNotifications.dedupeKey, `sync-failure:${row.item.id}`),
            isNull(inventoryNotifications.resolvedAt),
          ));
      });
      await evaluateStockAlert({ ...currentItem, state: target === 0 ? "sold_out" : "active" });
      inventoryLog("info", "shopify_quantity_synced", { itemId: row.item.id, target });
      return;
    } catch (error) {
      if (!(error as Error & { compareMismatch?: boolean }).compareMismatch || attempt === 2) {
        const message = error instanceof Error ? error.message : String(error);
        await db.transaction(async (tx) => {
          await tx.update(inventoryChannelLinks).set({
            pendingQuantity: null,
            syncState: "conflict",
            lastError: message,
            updatedAt: new Date(),
          }).where(eq(inventoryChannelLinks.id, row.link.id));
          await tx.update(inventoryItems).set({ state: "conflict", updatedAt: new Date() })
            .where(eq(inventoryItems.id, row.item.id));
        });
        await createInventoryNotification({
          userId: row.item.userId,
          inventoryItemId: row.item.id,
          type: "sync_failure",
          severity: "critical",
          title: `Inventory sync failed for ${row.item.title}`,
          body: message,
          dedupeKey: `sync-failure:${row.item.id}`,
          email: true,
        });
        inventoryLog("error", "shopify_sync_conflict", {
          itemId: row.item.id,
          attempts: attempt + 1,
          error: message,
        });
        Sentry.captureException(error, {
          tags: { subsystem: "inventory", operation: "shopify_sync" },
          extra: { itemId: row.item.id, attempts: attempt + 1 },
        });
        throw error;
      }
      const latestQuantity = await getShopifyInventoryQuantity(
        row.connection,
        row.link.externalInventoryItemId,
        row.link.externalLocationId,
      );
      const externalDelta = latestQuantity - compareQuantity;
      if (externalDelta !== 0) {
        inventoryLog("warn", "reconciliation_drift", {
          itemId: row.item.id,
          expectedQuantity: compareQuantity,
          observedQuantity: latestQuantity,
          delta: externalDelta,
        });
        const adjusted = await applyLedgerAdjustment({
          userId: row.item.userId,
          itemId: row.item.id,
          mode: "delta",
          quantity: externalDelta,
          reason: "Shopify reconciliation adjustment",
          source: "shopify_reconciliation",
          idempotencyKey: `reconcile:${row.item.id}:${itemVersion}:${compareQuantity}:${latestQuantity}`,
        });
        target = calculateSellableQuantity(
          adjusted.ledgerQuantity,
          effectiveSafetyBuffer(adjusted, row.settings.defaultSafetyBuffer),
        );
        currentItem = adjusted;
        itemVersion = adjusted.version;
        await evaluateStockAlert(adjusted);
        await db.update(inventoryChannelLinks).set({
          pendingQuantity: target,
          updatedAt: new Date(),
        }).where(eq(inventoryChannelLinks.id, row.link.id));
      }
      compareQuantity = latestQuantity;
      await db.update(inventoryChannelLinks).set({
        observedQuantity: compareQuantity,
        lastObservedAt: new Date(),
      }).where(eq(inventoryChannelLinks.id, row.link.id));
    }
  }
}

async function syncInventoryItem(itemId: number) {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [itemId]);
    await syncInventoryItemUnlocked(itemId);
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [itemId]).catch(() => undefined);
    client.release();
  }
}

async function processInventoryWebhook(eventId: number) {
  const [event] = await db.select().from(inventoryWebhookEvents)
    .where(eq(inventoryWebhookEvents.id, eventId));
  if (!event || event.status === "processed") return;
  const connection = await getConnectionForShop(event.shopDomain);
  if (!connection) {
    await db.update(inventoryWebhookEvents).set({
      status: "processed",
      processedAt: new Date(),
      attempts: event.attempts + 1,
    }).where(eq(inventoryWebhookEvents.id, event.id));
    return;
  }
  const userId = connection.sessionId;
  const payload = event.payload as Record<string, any>;

  if (event.topic === "inventory_levels/update") {
    const inventoryItemId = normalizeGid("InventoryItem", payload.inventory_item_id);
    const locationId = normalizeGid("Location", payload.location_id);
    const observed = Math.max(0, Number(payload.available || 0));
    const rows = await db.select({
      link: inventoryChannelLinks,
      item: inventoryItems,
      settings: inventorySettings,
    }).from(inventoryChannelLinks)
      .innerJoin(inventoryItems, eq(inventoryItems.id, inventoryChannelLinks.inventoryItemId))
      .innerJoin(inventorySettings, eq(inventorySettings.userId, inventoryChannelLinks.userId))
      .where(and(
        eq(inventoryChannelLinks.externalInventoryItemId, inventoryItemId),
        eq(inventoryChannelLinks.externalLocationId, locationId),
    ));
    const row = rows[0];
    const eventTime = payload.updated_at ? new Date(String(payload.updated_at)) : null;
    const isOutOfOrder = !!eventTime
      && !Number.isNaN(eventTime.getTime())
      && !!row?.link.lastObservedAt
      && eventTime.getTime() <= row.link.lastObservedAt.getTime();
    if (row?.settings.enabled && !isOutOfOrder) {
      const expected = row.link.pendingQuantity
        ?? row.link.pushedQuantity
        ?? calculateSellableQuantity(
          row.item.ledgerQuantity,
          effectiveSafetyBuffer(row.item, row.settings.defaultSafetyBuffer),
        );
      const delta = webhookAdjustmentDelta(observed, expected);
      if (delta !== 0 && row.item.kind !== "bundle") {
        const item = await applyLedgerAdjustment({
          userId,
          itemId: row.item.id,
          mode: "delta",
          quantity: delta,
          reason: "Shopify inventory adjustment",
          source: "shopify",
          idempotencyKey: `webhook:${event.externalEventId}:${row.item.id}`,
          externalReference: event.externalEventId,
        });
        await evaluateStockAlert(item);
      }
      await db.update(inventoryChannelLinks).set({
        observedQuantity: observed,
        pushedQuantity: observed === expected ? observed : row.link.pushedQuantity,
        pendingQuantity: observed === expected ? null : row.link.pendingQuantity,
        syncState: observed === expected ? "synced" : "pending",
        lastObservedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(inventoryChannelLinks.id, row.link.id));
      if (delta !== 0 && row.item.kind !== "bundle") {
        await enqueueInventoryJob(userId, "sync_item", { itemId: row.item.id });
      }
    }
  } else if (event.topic === "bulk_operations/finish") {
    const operationId = String(payload.admin_graphql_api_id || payload.id || "");
    const [job] = await db.select().from(inventoryImportJobs)
      .where(eq(inventoryImportJobs.externalOperationId, operationId));
    if (job) await enqueueInventoryJob(job.userId, "finish_import", { importJobId: job.id });
  } else if (event.topic === "app/uninstalled") {
    await db.update(inventorySettings).set({
      enabled: false,
      status: "disconnected",
      updatedAt: new Date(),
    }).where(eq(inventorySettings.userId, userId));
    await db.delete(shopifyConnections).where(eq(shopifyConnections.id, connection.id));
  } else if (event.topic === "locations/delete") {
    const deletedLocation = normalizeGid("Location", payload.id);
    const [settings] = await db.select().from(inventorySettings)
      .where(eq(inventorySettings.userId, userId));
    if (settings?.locationId === deletedLocation) {
      await db.update(inventorySettings).set({
        enabled: false,
        status: "location_missing",
        updatedAt: new Date(),
      }).where(eq(inventorySettings.userId, userId));
      await createInventoryNotification({
        userId,
        type: "connection",
        severity: "critical",
        title: "Inventory location was removed",
        body: "Choose a new Shopify fulfilment location before inventory syncing can continue.",
        dedupeKey: "location-missing",
        email: true,
      });
    }
  } else if (event.topic === "products/delete") {
    const productId = String(payload.admin_graphql_api_id || normalizeGid("Product", payload.id));
    const links = await db.select({ itemId: inventoryChannelLinks.inventoryItemId })
      .from(inventoryChannelLinks)
      .where(and(
        eq(inventoryChannelLinks.userId, userId),
        eq(inventoryChannelLinks.externalProductId, productId),
      ));
    if (links.length > 0) {
      const itemIds = links.map((link) => link.itemId);
      await db.update(inventoryItems).set({
        state: "archived",
        trackingEnabled: false,
        updatedAt: new Date(),
      }).where(inArray(inventoryItems.id, itemIds));
      await db.update(inventoryChannelLinks).set({
        syncState: "disconnected",
        externalStatus: "DELETED",
        pendingQuantity: null,
        updatedAt: new Date(),
      }).where(and(
        eq(inventoryChannelLinks.userId, userId),
        eq(inventoryChannelLinks.externalProductId, productId),
      ));
    }
  } else if (event.topic === "products/create" || event.topic === "products/update") {
    const [settings] = await db.select().from(inventorySettings)
      .where(eq(inventorySettings.userId, userId));
    if (settings?.enabled) await startWebhookCatalogRefresh(userId);
  } else {
    await enqueueInventoryJob(userId, "reconcile_user", { userId });
  }

  await db.update(inventoryWebhookEvents).set({
    status: "processed",
    processedAt: new Date(),
    attempts: event.attempts + 1,
    lastError: null,
  }).where(eq(inventoryWebhookEvents.id, event.id));
}

export async function ingestShopifyWebhook(input: {
  externalEventId: string;
  topic: string;
  shopDomain: string;
  payload: Record<string, unknown>;
}) {
  if (!featureEnabled()) return { duplicate: false, disabled: true };
  const connection = await getConnectionForShop(input.shopDomain);
  const [event] = await db.insert(inventoryWebhookEvents).values({
    externalEventId: input.externalEventId,
    userId: connection?.sessionId,
    topic: input.topic,
    shopDomain: input.shopDomain,
    payload: input.payload,
  }).onConflictDoNothing({
    target: inventoryWebhookEvents.externalEventId,
  }).returning();
  if (!event) {
    inventoryLog("info", "duplicate_webhook", {
      webhookId: input.externalEventId,
      topic: input.topic,
      shopDomain: input.shopDomain,
    });
    return { duplicate: true };
  }
  await enqueueInventoryJob(connection?.sessionId, "process_webhook", { eventId: event.id });
  return { duplicate: false };
}

async function syncAll(userId: string, cursor: number) {
  const items = await db.select({ id: inventoryItems.id }).from(inventoryItems)
    .where(and(eq(inventoryItems.userId, userId), gt(inventoryItems.id, cursor)))
    .orderBy(asc(inventoryItems.id))
    .limit(100);
  for (const item of items) {
    await enqueueInventoryJob(userId, "sync_item", { itemId: item.id });
  }
  if (items.length === 100) {
    await enqueueInventoryJob(userId, "sync_all", { userId, cursor: items[items.length - 1].id });
  }
}

async function protectVariantPolicies(userId: string, cursor: number) {
  const links = await db.select({
    id: inventoryChannelLinks.id,
    productId: inventoryChannelLinks.externalProductId,
    variantId: inventoryChannelLinks.externalVariantId,
  }).from(inventoryChannelLinks)
    .where(and(
      eq(inventoryChannelLinks.userId, userId),
      gt(inventoryChannelLinks.id, cursor),
    ))
    .orderBy(asc(inventoryChannelLinks.id))
    .limit(100);
  const byProduct = new Map<string, string[]>();
  for (const link of links) {
    byProduct.set(link.productId, [...(byProduct.get(link.productId) || []), link.variantId]);
  }
  const connection = await getConnectionForUser(userId);
  for (const [productId, variantIds] of byProduct) {
    await setShopifyVariantInventoryPolicies({ connection, productId, variantIds });
  }
  if (links.length === 100) {
    await enqueueInventoryJob(userId, "protect_variants", {
      userId,
      cursor: links[links.length - 1].id,
    });
  } else {
    await enqueueInventoryJob(userId, "sync_all", { userId, cursor: 0 });
  }
}

export async function reconcileInventoryUser(userId: string) {
  const [settings] = await db.select().from(inventorySettings)
    .where(eq(inventorySettings.userId, userId));
  if (!settings?.enabled) return { queued: 0 };
  const links = await db.select({ itemId: inventoryChannelLinks.inventoryItemId })
    .from(inventoryChannelLinks)
    .where(eq(inventoryChannelLinks.userId, userId));
  for (const link of links) {
    await enqueueInventoryJob(userId, "sync_item", { itemId: link.itemId });
  }
  await db.update(inventorySettings).set({
    lastReconciledAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(inventorySettings.userId, userId));
  return { queued: links.length };
}

export async function disableInventoryForUser(userId: string) {
  if (!featureEnabled()) return;
  const connection = await getConnectionForUser(userId).catch(() => undefined);
  if (connection) {
    await unregisterInventoryWebhooks(
      connection,
      `${appBaseUrl()}/api/shopify/webhooks`,
    ).catch((error) => {
      console.warn("Could not unregister inventory webhooks during disconnect:", error instanceof Error ? error.message : error);
    });
  }
  await db.update(inventorySettings).set({
    enabled: false,
    status: "disconnected",
    updatedAt: new Date(),
  }).where(eq(inventorySettings.userId, userId));
}

export async function enqueueInventoryJob(
  userId: string | undefined,
  type: string,
  payload: Record<string, unknown>,
) {
  const [job] = await db.insert(inventoryOutboxJobs).values({
    userId,
    type,
    payload,
  }).returning();
  try {
    if (process.env.VERCEL === "1" || process.env.VERCEL === "true") {
      await sendQueueMessage(INVENTORY_TOPIC, { jobId: job.id }, {
        idempotencyKey: `inventory-job-${job.id}`,
        retentionSeconds: 7 * 24 * 60 * 60,
      });
    } else {
      setImmediate(() => {
        processInventoryQueueMessage({ jobId: job.id }).catch((error) => {
          console.error("Local inventory job failed:", error instanceof Error ? error.message : error);
        });
      });
    }
  } catch (error) {
    console.warn("Inventory job persisted but queue publish failed:", error instanceof Error ? error.message : error);
  }
  return job;
}

export async function processInventoryQueueMessage(message: InventoryQueueMessage) {
  const [job] = await db.update(inventoryOutboxJobs).set({
    status: "processing",
    processingStartedAt: new Date(),
    attempts: sql`${inventoryOutboxJobs.attempts} + 1`,
  }).where(and(
    eq(inventoryOutboxJobs.id, message.jobId),
    inArray(inventoryOutboxJobs.status, ["pending", "failed"]),
  )).returning();
  if (!job) return;

  try {
    const payload = job.payload as Record<string, any>;
    if (job.type === "finish_import") await finishCatalogImport(Number(payload.importJobId));
    else if (job.type === "sync_item") await syncInventoryItem(Number(payload.itemId));
    else if (job.type === "sync_all") await syncAll(String(payload.userId), Number(payload.cursor || 0));
    else if (job.type === "protect_variants") {
      await protectVariantPolicies(String(payload.userId), Number(payload.cursor || 0));
    }
    else if (job.type === "process_webhook") await processInventoryWebhook(Number(payload.eventId));
    else if (job.type === "send_alert_email") await sendAlertEmail(Number(payload.notificationId));
    else if (job.type === "reconcile_user") await reconcileInventoryUser(String(payload.userId));
    else throw new Error(`Unknown inventory job type: ${job.type}`);

    await db.update(inventoryOutboxJobs).set({
      status: "processed",
      processedAt: new Date(),
      lastError: null,
    }).where(eq(inventoryOutboxJobs.id, job.id));
  } catch (error) {
    const retryAfter = (error as Error & { retryAfterSeconds?: number }).retryAfterSeconds
      ?? Math.min(300, 2 ** Math.min(job.attempts, 8));
    await db.update(inventoryOutboxJobs).set({
      status: "failed",
      availableAt: new Date(Date.now() + retryAfter * 1000),
      lastError: error instanceof Error ? error.message : String(error),
    }).where(eq(inventoryOutboxJobs.id, job.id));
    inventoryLog("error", "outbox_job_failed", {
      jobId: job.id,
      type: job.type,
      attempts: job.attempts,
      retryAfterSeconds: retryAfter,
      error: error instanceof Error ? error.message : String(error),
    });
    Sentry.captureException(error, {
      tags: { subsystem: "inventory", operation: job.type },
      extra: { jobId: job.id, attempts: job.attempts },
    });
    throw error;
  }
}

export async function recoverInventoryJobs() {
  if (!featureEnabled()) return { recoveredJobs: 0, reconciliations: 0, disabled: true };
  await db.update(inventoryOutboxJobs).set({
    status: "failed",
    availableAt: new Date(),
    lastError: "Recovered after worker visibility timeout",
  }).where(and(
    eq(inventoryOutboxJobs.status, "processing"),
    lte(inventoryOutboxJobs.processingStartedAt, new Date(Date.now() - 10 * 60 * 1000)),
    isNull(inventoryOutboxJobs.processedAt),
  ));
  const staleJobs = await db.select().from(inventoryOutboxJobs)
    .where(and(
      inArray(inventoryOutboxJobs.status, ["pending", "failed"]),
      lte(inventoryOutboxJobs.availableAt, new Date()),
    ))
    .orderBy(asc(inventoryOutboxJobs.createdAt))
    .limit(100);
  if (staleJobs.length > 0) {
    const oldestAgeSeconds = Math.max(
      0,
      Math.round((Date.now() - (staleJobs[0].createdAt?.getTime() ?? Date.now())) / 1000),
    );
    inventoryLog("warn", "outbox_recovery", {
      jobCount: staleJobs.length,
      oldestAgeSeconds,
    });
  }
  for (const job of staleJobs) {
    try {
      await sendQueueMessage(INVENTORY_TOPIC, { jobId: job.id }, {
        idempotencyKey: `inventory-recovery-${job.id}-${job.attempts}`,
        retentionSeconds: 7 * 24 * 60 * 60,
      });
    } catch {
      await processInventoryQueueMessage({ jobId: job.id }).catch(() => undefined);
    }
  }

  const enabledSettings = await db.select({ userId: inventorySettings.userId })
    .from(inventorySettings).where(eq(inventorySettings.enabled, true));
  const entitledSettings: Array<{ userId: string }> = [];
  for (const setting of enabledSettings) {
    const entitlement = await updateSubscriptionGrace(setting.userId);
    if (!entitlement.expired) {
      entitledSettings.push(setting);
      await enqueueInventoryJob(setting.userId, "reconcile_user", { userId: setting.userId });
    }
  }
  return { recoveredJobs: staleJobs.length, reconciliations: entitledSettings.length };
}

export async function registerPublishedShopifyProduct(input: {
  userId: string;
  image: any;
  productId: string;
  variants: Array<{ id: string; sku: string | null; inventoryItem: { id: string; tracked: boolean } }>;
}) {
  if (!featureEnabled()) return;
  const [settings] = await db.select().from(inventorySettings)
    .where(and(eq(inventorySettings.userId, input.userId), eq(inventorySettings.enabled, true)));
  if (!settings) return;

  for (const [index, variant] of input.variants.entries()) {
    const [item] = await db.insert(inventoryItems).values({
      userId: input.userId,
      title: input.image.title || input.image.originalName || "Untitled product",
      variantTitle: input.variants.length > 1 ? `Variant ${index + 1}` : null,
      sku: variant.sku,
      ledgerQuantity: Math.max(0, Number(input.image.inventoryQuantity || 0)),
      trackingEnabled: variant.inventoryItem.tracked,
      state: "active",
    }).returning();
    await db.insert(inventoryChannelLinks).values({
      userId: input.userId,
      inventoryItemId: item.id,
      externalProductId: input.productId,
      externalVariantId: variant.id,
      externalInventoryItemId: variant.inventoryItem.id,
      externalLocationId: settings.locationId,
      observedQuantity: 0,
      pushedQuantity: 0,
      syncState: "pending",
      externalStatus: "DRAFT",
      lastObservedAt: new Date(),
    });
    await enqueueInventoryJob(input.userId, "sync_item", { itemId: item.id });
  }
}
