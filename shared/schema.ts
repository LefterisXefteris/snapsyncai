import { pgTable, text, serial, integer, jsonb, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const images = pgTable("images", {
  id: serial("id").primaryKey(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  imageData: text("image_data"),
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
  sessionId: text("session_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertImageSchema = createInsertSchema(images).omit({
  id: true,
  createdAt: true
});

export type Image = typeof images.$inferSelect;
export type InsertImage = z.infer<typeof insertImageSchema>;

export const shopifyConnections = pgTable("shopify_connections", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  shopDomain: text("shop_domain").notNull(),
  accessToken: text("access_token").notNull(),
  shopName: text("shop_name"),
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
