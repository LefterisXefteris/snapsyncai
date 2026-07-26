import {
  pgTable,
  text,
  serial,
  integer,
  jsonb,
  timestamp,
  numeric,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import { z } from "zod";

export const images = pgTable("images", {
  id: serial("id").primaryKey(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  imageData: text("image_data"),
  storageUrl: text("storage_url"),
  title: text("title"),
  description: text("description"),
  price: numeric("price"),
  category: text("category"),
  mainCategory: text("main_category").default("Uncategorized"),
  generatedBackgrounds: text("generated_backgrounds").array(),
  productType: text("product_type"),
  tags: text("tags").array(),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  altText: text("alt_text"),
  aeoFaqs: jsonb("aeo_faqs"),
  aeoSnippet: text("aeo_snippet"),
  variants: jsonb("variants"),
  compareAtPrice: numeric("compare_at_price"),
  costPerItem: numeric("cost_per_item"),
  sku: text("sku"),
  barcode: text("barcode"),
  trackQuantity: text("track_quantity").default("true"),
  inventoryQuantity: integer("inventory_quantity").default(0),
  mediaGallery: text("media_gallery").array(),
  collections: text("collections").array(),
  shopifyProductId: text("shopify_product_id"),
  shopifyStatus: text("shopify_status").default("pending"),
  etsyListingId: text("etsy_listing_id"),
  etsyStatus: text("etsy_status").default("pending"),
  amazonListingId: text("amazon_listing_id"),
  amazonStatus: text("amazon_status").default("pending"),
  instagramPostId: text("instagram_post_id"),
  instagramStatus: text("instagram_status").default("pending"),
  instagramCaption: text("instagram_caption"),
  paymentStatus: text("payment_status").default("unpaid"),
  productContext: text("product_context"),
  brandTone: text("brand_tone").default("professional"),
  aiData: jsonb("ai_data"),
  productGroupId: text("product_group_id"),
  sessionId: text("session_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertImageSchema = createInsertSchema(images).omit({
  id: true,
  createdAt: true
});

export type Image = typeof images.$inferSelect;
export type InsertImage = z.infer<typeof insertImageSchema>;

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const shopifyConnections = pgTable("shopify_connections", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  shopDomain: text("shop_domain").notNull(),
  accessToken: text("access_token").notNull(),
  shopName: text("shop_name"),
  grantedScopes: text("granted_scopes").array(),
  webhooksRegisteredAt: timestamp("webhooks_registered_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertShopifyConnectionSchema = createInsertSchema(shopifyConnections).omit({
  id: true,
  createdAt: true,
});

export type ShopifyConnection = typeof shopifyConnections.$inferSelect;
export type InsertShopifyConnection = z.infer<typeof insertShopifyConnectionSchema>;

export const etsyConnections = pgTable("etsy_connections", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  apiKeystring: text("api_keystring").notNull(),
  accessToken: text("access_token").notNull(),
  shopId: text("shop_id").notNull(),
  shopName: text("shop_name"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEtsyConnectionSchema = createInsertSchema(etsyConnections).omit({
  id: true,
  createdAt: true,
});

export type EtsyConnection = typeof etsyConnections.$inferSelect;
export type InsertEtsyConnection = z.infer<typeof insertEtsyConnectionSchema>;

export const amazonConnections = pgTable("amazon_connections", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  sellerId: text("seller_id").notNull(),
  marketplaceId: text("marketplace_id").notNull(),
  lwaClientId: text("lwa_client_id").notNull(),
  lwaClientSecret: text("lwa_client_secret").notNull(),
  lwaRefreshToken: text("lwa_refresh_token").notNull(),
  sellerName: text("seller_name"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAmazonConnectionSchema = createInsertSchema(amazonConnections).omit({
  id: true,
  createdAt: true,
});

export type AmazonConnection = typeof amazonConnections.$inferSelect;
export type InsertAmazonConnection = z.infer<typeof insertAmazonConnectionSchema>;

export const instagramConnections = pgTable("instagram_connections", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  accessToken: text("access_token").notNull(),
  igUserId: text("ig_user_id").notNull(),
  username: text("username"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertInstagramConnectionSchema = createInsertSchema(instagramConnections).omit({
  id: true,
  createdAt: true,
});

export type InstagramConnection = typeof instagramConnections.$inferSelect;
export type InsertInstagramConnection = z.infer<typeof insertInstagramConnectionSchema>;

export const paidSessions = pgTable("paid_sessions", {
  id: serial("id").primaryKey(),
  checkoutSessionId: text("checkout_session_id").notNull().unique(),
  sessionId: text("session_id").notNull(),
  imageCount: integer("image_count").notNull(),
  tone: text("tone").notNull().default("professional"),
  amountPaid: integer("amount_paid").notNull(),
  used: integer("used").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPaidSessionSchema = createInsertSchema(paidSessions).omit({
  id: true,
  createdAt: true,
});

export type PaidSession = typeof paidSessions.$inferSelect;
export type InsertPaidSession = z.infer<typeof insertPaidSessionSchema>;

export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  stripeCustomerId: text("stripe_customer_id").notNull(),
  stripeSubscriptionId: text("stripe_subscription_id").notNull(),
  status: text("status").notNull().default("active"),
  currentPeriodEnd: timestamp("current_period_end"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
  id: true,
  createdAt: true,
});

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;

export const userCredits = pgTable("user_credits", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  balance: integer("balance").notNull().default(0),
  lifetimeCredits: integer("lifetime_credits").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UserCredits = typeof userCredits.$inferSelect;

// ── Inventory Autopilot ─────────────────────────────────────────────────────

export const inventorySettings = pgTable("inventory_settings", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  shopDomain: text("shop_domain").notNull(),
  locationId: text("location_id").notNull(),
  locationName: text("location_name").notNull(),
  status: text("status").notNull().default("setup"),
  enabled: boolean("enabled").notNull().default(false),
  defaultSafetyBuffer: integer("default_safety_buffer").notNull().default(2),
  defaultLowStockThreshold: integer("default_low_stock_threshold").notNull().default(5),
  graceEndsAt: timestamp("grace_ends_at"),
  lastReconciledAt: timestamp("last_reconciled_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  enabledIdx: index("idx_inventory_settings_enabled").on(table.enabled),
}));

export const inventoryItems = pgTable("inventory_items", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  variantTitle: text("variant_title"),
  sku: text("sku"),
  kind: text("kind").notNull().default("standalone"),
  ledgerQuantity: integer("ledger_quantity").notNull().default(0),
  safetyBuffer: integer("safety_buffer"),
  lowStockThreshold: integer("low_stock_threshold"),
  trackingEnabled: boolean("tracking_enabled").notNull().default(true),
  state: text("state").notNull().default("draft"),
  version: integer("version").notNull().default(0),
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userIdx: index("idx_inventory_items_user").on(table.userId),
  userStateIdx: index("idx_inventory_items_user_state").on(table.userId, table.state),
  userSkuIdx: index("idx_inventory_items_user_sku").on(table.userId, table.sku),
}));

export const inventoryChannelLinks = pgTable("inventory_channel_links", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  inventoryItemId: integer("inventory_item_id").notNull()
    .references(() => inventoryItems.id, { onDelete: "cascade" }),
  channel: text("channel").notNull().default("shopify"),
  externalProductId: text("external_product_id").notNull(),
  externalVariantId: text("external_variant_id").notNull(),
  externalInventoryItemId: text("external_inventory_item_id").notNull(),
  externalLocationId: text("external_location_id").notNull(),
  observedQuantity: integer("observed_quantity").notNull().default(0),
  pushedQuantity: integer("pushed_quantity"),
  pendingQuantity: integer("pending_quantity"),
  externalStatus: text("external_status"),
  syncState: text("sync_state").notNull().default("draft"),
  lastError: text("last_error"),
  lastObservedAt: timestamp("last_observed_at"),
  lastPushedAt: timestamp("last_pushed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  itemChannelUnique: uniqueIndex("uq_inventory_channel_item").on(table.inventoryItemId, table.channel),
  externalUnique: uniqueIndex("uq_inventory_channel_external").on(
    table.channel,
    table.externalInventoryItemId,
    table.externalLocationId,
  ),
  userIdx: index("idx_inventory_channel_user").on(table.userId),
}));

export const inventoryLedgerEntries = pgTable("inventory_ledger_entries", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  inventoryItemId: integer("inventory_item_id").notNull()
    .references(() => inventoryItems.id, { onDelete: "cascade" }),
  delta: integer("delta").notNull(),
  quantityAfter: integer("quantity_after").notNull(),
  reason: text("reason").notNull(),
  source: text("source").notNull(),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  externalReference: text("external_reference"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  itemCreatedIdx: index("idx_inventory_ledger_item_created").on(table.inventoryItemId, table.createdAt),
  userCreatedIdx: index("idx_inventory_ledger_user_created").on(table.userId, table.createdAt),
}));

export const inventoryBundleComponents = pgTable("inventory_bundle_components", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  bundleItemId: integer("bundle_item_id").notNull()
    .references(() => inventoryItems.id, { onDelete: "cascade" }),
  componentItemId: integer("component_item_id").notNull()
    .references(() => inventoryItems.id, { onDelete: "cascade" }),
  units: integer("units").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  recipeUnique: uniqueIndex("uq_inventory_bundle_component").on(table.bundleItemId, table.componentItemId),
  componentIdx: index("idx_inventory_bundle_component_item").on(table.componentItemId),
}));

export const inventoryImportJobs = pgTable("inventory_import_jobs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  provider: text("provider").notNull().default("shopify"),
  externalOperationId: text("external_operation_id"),
  status: text("status").notNull().default("queued"),
  totalItems: integer("total_items").notNull().default(0),
  importedItems: integer("imported_items").notNull().default(0),
  preview: jsonb("preview"),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
}, (table) => ({
  userCreatedIdx: index("idx_inventory_import_user_created").on(table.userId, table.createdAt),
  operationIdx: uniqueIndex("uq_inventory_import_operation").on(table.externalOperationId),
}));

export const inventoryWebhookEvents = pgTable("inventory_webhook_events", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull().default("shopify"),
  externalEventId: text("external_event_id").notNull().unique(),
  userId: text("user_id"),
  topic: text("topic").notNull(),
  shopDomain: text("shop_domain").notNull(),
  payload: jsonb("payload").notNull(),
  status: text("status").notNull().default("received"),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  receivedAt: timestamp("received_at").defaultNow(),
  processedAt: timestamp("processed_at"),
}, (table) => ({
  statusIdx: index("idx_inventory_webhook_status").on(table.status, table.receivedAt),
  shopIdx: index("idx_inventory_webhook_shop").on(table.shopDomain),
}));

export const inventoryOutboxJobs = pgTable("inventory_outbox_jobs", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  type: text("type").notNull(),
  payload: jsonb("payload").notNull(),
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  availableAt: timestamp("available_at").defaultNow(),
  processingStartedAt: timestamp("processing_started_at"),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").defaultNow(),
  processedAt: timestamp("processed_at"),
}, (table) => ({
  pendingIdx: index("idx_inventory_outbox_pending").on(table.status, table.availableAt),
}));

export const inventoryNotifications = pgTable("inventory_notifications", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  inventoryItemId: integer("inventory_item_id")
    .references(() => inventoryItems.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  severity: text("severity").notNull().default("warning"),
  title: text("title").notNull(),
  body: text("body").notNull(),
  dedupeKey: text("dedupe_key").notNull(),
  readAt: timestamp("read_at"),
  resolvedAt: timestamp("resolved_at"),
  emailedAt: timestamp("emailed_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  userCreatedIdx: index("idx_inventory_notification_user_created").on(table.userId, table.createdAt),
  activeDedupeIdx: uniqueIndex("idx_inventory_notification_dedupe")
    .on(table.userId, table.dedupeKey)
    .where(sql`${table.resolvedAt} IS NULL`),
}));

export type InventorySettings = typeof inventorySettings.$inferSelect;
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type InventoryChannelLink = typeof inventoryChannelLinks.$inferSelect;
export type InventoryLedgerEntry = typeof inventoryLedgerEntries.$inferSelect;
export type InventoryBundleComponent = typeof inventoryBundleComponents.$inferSelect;
export type InventoryImportJob = typeof inventoryImportJobs.$inferSelect;
export type InventoryWebhookEvent = typeof inventoryWebhookEvents.$inferSelect;
export type InventoryOutboxJob = typeof inventoryOutboxJobs.$inferSelect;
export type InventoryNotification = typeof inventoryNotifications.$inferSelect;
