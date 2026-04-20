import { images, shopifyConnections, etsyConnections, amazonConnections, instagramConnections, paidSessions, subscriptions, type InsertImage, type Image, type InsertShopifyConnection, type ShopifyConnection, type InsertEtsyConnection, type EtsyConnection, type InsertAmazonConnection, type AmazonConnection, type InsertInstagramConnection, type InstagramConnection, type InsertPaidSession, type PaidSession, type InsertSubscription, type Subscription } from "@shared/schema";
import { db } from "./db";
import { eq, desc, inArray, sql, and } from "drizzle-orm";

// Columns returned for list/dashboard queries.
// Excludes imageData (base64 blob), aiData (large JSONB), aeoFaqs, generatedBackgrounds,
// mediaGallery, instagramCaption — these are only needed on the detail page, not the list.
const listColumns = {
  id: images.id,
  originalName: images.originalName,
  mimeType: images.mimeType,
  size: images.size,
  title: images.title,
  description: images.description,
  price: images.price,
  category: images.category,
  mainCategory: images.mainCategory,
  productType: images.productType,
  tags: images.tags,
  seoTitle: images.seoTitle,
  seoDescription: images.seoDescription,
  altText: images.altText,
  aeoSnippet: images.aeoSnippet,
  variants: images.variants,
  compareAtPrice: images.compareAtPrice,
  costPerItem: images.costPerItem,
  sku: images.sku,
  barcode: images.barcode,
  trackQuantity: images.trackQuantity,
  inventoryQuantity: images.inventoryQuantity,
  collections: images.collections,
  shopifyProductId: images.shopifyProductId,
  shopifyStatus: images.shopifyStatus,
  etsyListingId: images.etsyListingId,
  etsyStatus: images.etsyStatus,
  amazonListingId: images.amazonListingId,
  amazonStatus: images.amazonStatus,
  instagramPostId: images.instagramPostId,
  instagramStatus: images.instagramStatus,
  paymentStatus: images.paymentStatus,
  productGroupId: images.productGroupId,
  sessionId: images.sessionId,
  createdAt: images.createdAt,
} as const;

export interface IStorage {
  createImage(image: InsertImage): Promise<Image>;
  listImages(sessionId: string): Promise<Record<string, any>[]>;
  getAllImages(sessionId: string): Promise<Image[]>;
  getImage(id: number): Promise<Image | undefined>;
  getImagesByIds(ids: number[]): Promise<Image[]>;
  getImageGroup(imageId: number, sessionId: string): Promise<Record<string, any>[]>;
  updateImage(id: number, updates: Partial<InsertImage>): Promise<Image | undefined>;
  updateImagesByGroupId(groupId: string, updates: Partial<InsertImage>): Promise<void>;
  deleteImage(id: number): Promise<void>;
  deleteImagesByGroupId(groupId: string, sessionId: string): Promise<number>;
  getShopifyConnection(sessionId: string): Promise<ShopifyConnection | undefined>;
  upsertShopifyConnection(connection: InsertShopifyConnection): Promise<ShopifyConnection>;
  deleteShopifyConnection(sessionId: string): Promise<void>;
  getEtsyConnection(sessionId: string): Promise<EtsyConnection | undefined>;
  upsertEtsyConnection(connection: InsertEtsyConnection): Promise<EtsyConnection>;
  deleteEtsyConnection(sessionId: string): Promise<void>;
  getAmazonConnection(sessionId: string): Promise<AmazonConnection | undefined>;
  upsertAmazonConnection(connection: InsertAmazonConnection): Promise<AmazonConnection>;
  deleteAmazonConnection(sessionId: string): Promise<void>;
  getInstagramConnection(sessionId: string): Promise<InstagramConnection | undefined>;
  upsertInstagramConnection(connection: InsertInstagramConnection): Promise<InstagramConnection>;
  deleteInstagramConnection(sessionId: string): Promise<void>;
  migrateSession(oldSessionId: string, newSessionId: string): Promise<void>;
  createPaidSession(session: InsertPaidSession): Promise<PaidSession>;
  getPaidSession(checkoutSessionId: string): Promise<PaidSession | undefined>;
  markPaidSessionUsed(checkoutSessionId: string, usedCount: number): Promise<void>;
  getSubscription(userId: string): Promise<Subscription | undefined>;
  getSubscriptionByStripeId(stripeSubscriptionId: string): Promise<Subscription | undefined>;
  getAllActiveSubscriptions(): Promise<Subscription[]>;
  upsertSubscription(sub: InsertSubscription): Promise<Subscription>;
  updateSubscriptionStatus(stripeSubscriptionId: string, status: string, currentPeriodEnd?: Date): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async createImage(image: InsertImage): Promise<Image> {
    const [newImage] = await db.insert(images).values(image).returning();
    return newImage;
  }

  // List without imageData — use for API responses where the blob is not needed.
  // sessionId is required; passing a falsy value is a programming error.
  async listImages(sessionId: string): Promise<Record<string, any>[]> {
    if (!sessionId) throw new Error("listImages called without a sessionId — would return all users' data");
    return db.select(listColumns).from(images).where(eq(images.sessionId, sessionId)).orderBy(desc(images.createdAt));
  }

  async getAllImages(sessionId: string): Promise<Image[]> {
    if (!sessionId) throw new Error("getAllImages called without a sessionId — would return all users' data");
    return db.select().from(images).where(eq(images.sessionId, sessionId)).orderBy(desc(images.createdAt));
  }

  async getImage(id: number): Promise<Image | undefined> {
    const [image] = await db.select().from(images).where(eq(images.id, id));
    return image;
  }

  async getImagesByIds(ids: number[]): Promise<Image[]> {
    if (ids.length === 0) return [];
    return db.select().from(images).where(inArray(images.id, ids));
  }

  async getImageGroup(imageId: number, sessionId: string): Promise<Record<string, any>[]> {
    // Find the productGroupId for this image, scoped to the user's session
    const [img] = await db.select({ id: images.id, productGroupId: images.productGroupId, sessionId: images.sessionId })
      .from(images).where(and(eq(images.id, imageId), eq(images.sessionId, sessionId)));
    if (!img) return [];
    if (!img.productGroupId) {
      // Single image — return just itself using listColumns
      return db.select(listColumns).from(images)
        .where(and(eq(images.id, imageId), eq(images.sessionId, sessionId)));
    }
    return db.select(listColumns).from(images)
      .where(and(eq(images.productGroupId, img.productGroupId), eq(images.sessionId, sessionId)))
      .orderBy(images.id);
  }

  async updateImage(id: number, updates: Partial<InsertImage>): Promise<Image | undefined> {
    const [updated] = await db.update(images).set(updates).where(eq(images.id, id)).returning();
    return updated;
  }

  async updateImagesByGroupId(groupId: string, updates: Partial<InsertImage>): Promise<void> {
    await db.update(images).set(updates).where(eq(images.productGroupId, groupId));
  }

  async deleteImage(id: number): Promise<void> {
    await db.delete(images).where(eq(images.id, id));
  }

  async deleteImagesByGroupId(groupId: string, sessionId: string): Promise<number> {
    const deleted = await db.delete(images)
      .where(and(eq(images.productGroupId, groupId), eq(images.sessionId, sessionId)))
      .returning({ id: images.id });
    return deleted.length;
  }

  async getShopifyConnection(sessionId: string): Promise<ShopifyConnection | undefined> {
    const [conn] = await db.select().from(shopifyConnections).where(eq(shopifyConnections.sessionId, sessionId));
    return conn;
  }

  async upsertShopifyConnection(connection: InsertShopifyConnection): Promise<ShopifyConnection> {
    const existing = await this.getShopifyConnection(connection.sessionId);
    if (existing) {
      const [updated] = await db.update(shopifyConnections)
        .set(connection)
        .where(eq(shopifyConnections.sessionId, connection.sessionId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(shopifyConnections).values(connection).returning();
    return created;
  }

  async deleteShopifyConnection(sessionId: string): Promise<void> {
    await db.delete(shopifyConnections).where(eq(shopifyConnections.sessionId, sessionId));
  }

  async getEtsyConnection(sessionId: string): Promise<EtsyConnection | undefined> {
    const [conn] = await db.select().from(etsyConnections).where(eq(etsyConnections.sessionId, sessionId));
    return conn;
  }

  async upsertEtsyConnection(connection: InsertEtsyConnection): Promise<EtsyConnection> {
    const existing = await this.getEtsyConnection(connection.sessionId);
    if (existing) {
      const [updated] = await db.update(etsyConnections)
        .set(connection)
        .where(eq(etsyConnections.sessionId, connection.sessionId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(etsyConnections).values(connection).returning();
    return created;
  }

  async deleteEtsyConnection(sessionId: string): Promise<void> {
    await db.delete(etsyConnections).where(eq(etsyConnections.sessionId, sessionId));
  }

  async getAmazonConnection(sessionId: string): Promise<AmazonConnection | undefined> {
    const [conn] = await db.select().from(amazonConnections).where(eq(amazonConnections.sessionId, sessionId));
    return conn;
  }

  async upsertAmazonConnection(connection: InsertAmazonConnection): Promise<AmazonConnection> {
    const existing = await this.getAmazonConnection(connection.sessionId);
    if (existing) {
      const [updated] = await db.update(amazonConnections)
        .set(connection)
        .where(eq(amazonConnections.sessionId, connection.sessionId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(amazonConnections).values(connection).returning();
    return created;
  }

  async deleteAmazonConnection(sessionId: string): Promise<void> {
    await db.delete(amazonConnections).where(eq(amazonConnections.sessionId, sessionId));
  }

  async getInstagramConnection(sessionId: string): Promise<InstagramConnection | undefined> {
    const [conn] = await db.select().from(instagramConnections).where(eq(instagramConnections.sessionId, sessionId));
    return conn;
  }

  async upsertInstagramConnection(connection: InsertInstagramConnection): Promise<InstagramConnection> {
    const existing = await this.getInstagramConnection(connection.sessionId);
    if (existing) {
      const [updated] = await db.update(instagramConnections)
        .set(connection)
        .where(eq(instagramConnections.sessionId, connection.sessionId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(instagramConnections).values(connection).returning();
    return created;
  }

  async deleteInstagramConnection(sessionId: string): Promise<void> {
    await db.delete(instagramConnections).where(eq(instagramConnections.sessionId, sessionId));
  }

  async migrateSession(oldSessionId: string, newSessionId: string): Promise<void> {
    if (oldSessionId === newSessionId) return;
    console.log(`migrateSession: moving all data from ${oldSessionId} to ${newSessionId}`);
    await db.update(images).set({ sessionId: newSessionId }).where(eq(images.sessionId, oldSessionId));
    await db.update(shopifyConnections).set({ sessionId: newSessionId }).where(eq(shopifyConnections.sessionId, oldSessionId));
    await db.update(etsyConnections).set({ sessionId: newSessionId }).where(eq(etsyConnections.sessionId, oldSessionId));
    await db.update(amazonConnections).set({ sessionId: newSessionId }).where(eq(amazonConnections.sessionId, oldSessionId));
    await db.update(instagramConnections).set({ sessionId: newSessionId }).where(eq(instagramConnections.sessionId, oldSessionId));
    // Also migrate subscription record — update userId so the old record doesn't become orphaned
    await db.update(subscriptions).set({ userId: newSessionId }).where(eq(subscriptions.userId, oldSessionId));
  }

  async createPaidSession(session: InsertPaidSession): Promise<PaidSession> {
    const [created] = await db.insert(paidSessions).values(session).returning();
    return created;
  }

  async getPaidSession(checkoutSessionId: string): Promise<PaidSession | undefined> {
    const [session] = await db.select().from(paidSessions).where(eq(paidSessions.checkoutSessionId, checkoutSessionId));
    return session;
  }

  async markPaidSessionUsed(checkoutSessionId: string, usedCount: number): Promise<void> {
    await db.update(paidSessions)
      .set({ used: usedCount })
      .where(eq(paidSessions.checkoutSessionId, checkoutSessionId));
  }

  async getSubscription(userId: string): Promise<Subscription | undefined> {
    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId));
    return sub;
  }

  async getSubscriptionByStripeId(stripeSubscriptionId: string): Promise<Subscription | undefined> {
    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId));
    return sub;
  }

  async getAllActiveSubscriptions(): Promise<Subscription[]> {
    return await db
      .select()
      .from(subscriptions)
      .where(inArray(subscriptions.status, ['active', 'trialing']));
  }

  async upsertSubscription(sub: InsertSubscription): Promise<Subscription> {
    // First check if there's already a record for this userId
    const existingByUser = await this.getSubscription(sub.userId);
    if (existingByUser) {
      const [updated] = await db.update(subscriptions)
        .set(sub)
        .where(eq(subscriptions.userId, sub.userId))
        .returning();
      return updated;
    }
    // Also check if the same Stripe subscription is linked to a different userId
    // (happens when user switches Clerk auth method). Update in place to avoid duplicates.
    const existingByStripe = await this.getSubscriptionByStripeId(sub.stripeSubscriptionId);
    if (existingByStripe) {
      const [updated] = await db.update(subscriptions)
        .set(sub)
        .where(eq(subscriptions.stripeSubscriptionId, sub.stripeSubscriptionId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(subscriptions).values(sub).returning();
    return created;
  }

  async updateSubscriptionStatus(stripeSubscriptionId: string, status: string, currentPeriodEnd?: Date): Promise<void> {
    const updates: any = { status };
    if (currentPeriodEnd) updates.currentPeriodEnd = currentPeriodEnd;
    await db.update(subscriptions)
      .set(updates)
      .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId));
  }

}


export const storage = new DatabaseStorage();
