import type { Express, Request } from "express";
import type { Server } from "http";
import multer from "multer";
import express from "express";
import { storage } from "./storage";
import { openai } from "./replit_integrations/image/client";
import { batchProcess } from "./replit_integrations/batch";
import { z } from "zod";
import crypto from "crypto";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";
import { db } from "./db";
import { images } from "@shared/schema";
import { sql, and, eq } from "drizzle-orm";
import { clerkMiddleware, requireAuth as clerkRequireAuth, getAuth, clerkClient } from "@clerk/express";
import memoizee from "memoizee";
import { uploadImageToStorage } from "./supabaseClient";
import { canonicalizeAutoGroup, mergeAutoGroupsByFamily } from "./auto-group-utils";
import {
  embedImagesCohere,
  clusterByCosine,
  getAutoGroupTimeoutMs,
} from "./embedding-utils";
import { resolveUploadProcessingMode } from "./uploadLanggraph";
import {
  buildShopifyOAuthAuthorizeUrl,
  getShopifyOAuthConfig,
  createShopifyOAuthState,
  isValidShopifyDomain,
  normalizeShopifyDomain,
  verifyShopifyHmac,
  verifyShopifyOAuthState,
} from "./shopifyOAuth";
import { registerInventoryRoutes } from "./inventoryRoutes";
import { disableInventoryForUser, registerPublishedShopifyProduct } from "./inventoryService";
import {
  createShopifyProductGraphql,
  encryptShopifyToken,
  getShopifyShopIdentity,
} from "./shopifyAdmin";


const MIN_IMAGE_COUNT = 1;
const DEV_BYPASS_AUTH = process.env.DEV_BYPASS_AUTH === "true";
const DEV_USER_ID = "dev_local_user";
const DEV_FREE_EMAIL = "lefterisgilmaz@gmail.com";

/** Returns true if this user gets free unlimited AI on localhost (non-production only). */
async function isDevFreeUser(req: Request): Promise<boolean> {
  if (process.env.NODE_ENV === "production") return false;
  if (DEV_BYPASS_AUTH) return false; // dev bypass already handles everything
  try {
    const auth = getAuth(req);
    if (!auth.userId) return false;
    const clerkUser = await clerkClient.users.getUser(auth.userId);
    const email = clerkUser.emailAddresses?.find(e => e.id === clerkUser.primaryEmailAddressId)?.emailAddress
      ?? clerkUser.emailAddresses?.[0]?.emailAddress;
    return email === DEV_FREE_EMAIL;
  } catch {
    return false;
  }
}

function requireAuth() {
  if (DEV_BYPASS_AUTH) return (_req: any, _res: any, next: any) => next();
  return clerkRequireAuth();
}

function getUserId(req: Request): string {
  if (DEV_BYPASS_AUTH) return DEV_USER_ID;
  const auth = getAuth(req);
  if (!auth.userId) throw new Error("Authenticated route missing userId — this should never happen");
  return auth.userId;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

// LRU-capped buffer store: keeps at most MAX_BUFFER_ENTRIES recent image buffers in memory.
// On overflow the oldest entry (first inserted) is evicted.
const MAX_BUFFER_ENTRIES = 500;
const imageBuffers = new Map<number, Buffer>();
function setImageBuffer(id: number, buf: Buffer) {
  if (imageBuffers.size >= MAX_BUFFER_ENTRIES && !imageBuffers.has(id)) {
    const oldest = imageBuffers.keys().next().value;
    if (oldest !== undefined) imageBuffers.delete(oldest);
  }
  imageBuffers.set(id, buf);
}

// Load an image buffer: memory cache → base64 DB column → Supabase Storage URL
async function loadImageBuffer(image: { id: number; imageData?: string | null; storageUrl?: string | null }): Promise<Buffer | null> {
  const cached = imageBuffers.get(image.id);
  if (cached) return cached;
  if (image.imageData) return Buffer.from(image.imageData, 'base64');
  if ((image as any).storageUrl) {
    try {
      const resp = await fetch((image as any).storageUrl as string);
      if (resp.ok) {
        const buf = Buffer.from(await resp.arrayBuffer());
        setImageBuffer(image.id, buf);
        return buf;
      }
    } catch (e) {
      console.error(`loadImageBuffer: failed to fetch storageUrl for image ${image.id}:`, e);
    }
  }
  return null;
}

const CONCURRENCY_LIMIT = 10;

async function runWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  const queue = items.map((item, i) => ({ item, i }));

  async function worker() {
    while (true) {
      const entry = queue.shift();
      if (!entry) break;
      results[entry.i] = await fn(entry.item, entry.i);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

type AutoGroupMode = "default" | "variant-family";
type AutoGroupInputImage = {
  index: number;
  base64: string;
  mimeType: string;
  filename: string;
  descriptor?: string;
};
type AutoGroupOutput = {
  label: string;
  imageIndices: number[];
  confidence: string;
  familyKey?: string;
  descriptor?: string;
};

export interface RunAutoGroupingResult {
  groups: AutoGroupOutput[];
  fallbackUsed: boolean;
  fallbackReason?: string;
}

export async function runAutoGrouping(
  inputImages: AutoGroupInputImage[],
  productContext?: string,
  mode: AutoGroupMode = "default",
): Promise<RunAutoGroupingResult> {
  // productContext is retained as a parameter for call-site stability even
  // though the embedding path does not consume it. Removing it would ripple
  // through both endpoint handlers for no benefit — revisit only if a future
  // phase wires product context into Cohere's multimodal embed call.
  void productContext;

  // Thresholds from 08-RESEARCH.md pitfalls 1 & 2. variant-family is looser
  // because the user has explicitly said "these are variants"; default is
  // more conservative to avoid over-merging distinct products.
  const threshold = mode === "variant-family" ? 0.78 : 0.88;
  const MAX_ATTEMPTS = 2; // initial + 1 retry per 08-CONTEXT.md
  const BACKOFF_MS = 750;
  const TIMEOUT_MS = getAutoGroupTimeoutMs();

  async function attemptEmbeddingPath(): Promise<AutoGroupOutput[]> {
    const embedInputs = inputImages.map((img) => ({
      base64: img.base64,
      mimeType: img.mimeType,
    }));

    // Promise.race does not cancel the losing promise. Track the setTimeout
    // handle and clear it on the success path so we don't pin the event loop
    // open for the full TIMEOUT_MS on every successful call.
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(
        () => reject(new Error(`Cohere embed timeout after ${TIMEOUT_MS}ms`)),
        TIMEOUT_MS,
      );
    });

    let vectors: number[][];
    try {
      vectors = await Promise.race([
        embedImagesCohere(embedInputs),
        timeoutPromise,
      ]);
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }

    // TEMP DIAGNOSTIC (debug session: embedding-clustering-over-merge)
    // Logs the full pairwise cosine matrix + per-vector norm so we can see the
    // actual distribution Cohere returns on real user data. Remove once the
    // over-merge bug in Phase 8 is resolved and the root cause is confirmed.
    if (process.env.DEBUG_AUTOGROUP === "1") {
      const norms = vectors.map((v) => Math.sqrt(v.reduce((s, x) => s + x * x, 0)));
      console.log(
        `[auto-group DIAG] mode=${mode} threshold=${threshold} n=${vectors.length} dim=${vectors[0]?.length}`,
      );
      console.log(
        `[auto-group DIAG] filenames: ${inputImages.map((img, i) => `[${i}]${img.filename}(norm=${norms[i].toFixed(3)})`).join(" ")}`,
      );
      const header = "         " + vectors.map((_, j) => `[${String(j).padStart(2, " ")}]    `).join("");
      console.log(`[auto-group DIAG] ${header}`);
      for (let i = 0; i < vectors.length; i++) {
        const row: string[] = [];
        for (let j = 0; j < vectors.length; j++) {
          let dot = 0;
          for (let k = 0; k < vectors[i].length; k++) dot += vectors[i][k] * vectors[j][k];
          const sim = dot / (norms[i] * norms[j]);
          row.push(sim.toFixed(4));
        }
        console.log(`[auto-group DIAG] [${String(i).padStart(2, " ")}]  ${row.join("  ")}`);
      }
    }

    const clusters = clusterByCosine(vectors, threshold);

    if (process.env.DEBUG_AUTOGROUP === "1") {
      console.log(
        `[auto-group DIAG] clusterByCosine(threshold=${threshold}) produced ${clusters.length} cluster(s): ${clusters.map((c) => `[${c.join(",")}]`).join(" ")}`,
      );
    }

    return clusters.map((indicesInInputOrder) => {
      const clusterImages = indicesInInputOrder.map((i) => inputImages[i]);
      const descriptorBlob = clusterImages
        .map((img) => [img.descriptor, img.filename].filter(Boolean).join(" "))
        .slice(0, 4)
        .join(" || ");

      const head = clusterImages[0];
      return canonicalizeAutoGroup({
        label:
          head.filename.replace(/\.[^/.]+$/, "") ||
          `Product ${head.index + 1}`,
        familyKey: undefined,
        imageIndices: clusterImages.map((img) => img.index),
        confidence: clusterImages.length > 1 ? "high" : "low",
        descriptor: descriptorBlob,
      });
    });
  }

  // Primary path: Cohere with 1 retry.
  //
  // IMPORTANT: on the embedding success path we return clusters AS-IS. Do NOT
  // call mergeAutoGroupsByFamily here — per 08-CONTEXT.md the apparel filename
  // merger is the FALLBACK path, not a second pass on top of embeddings. Running
  // it on embedding clusters would let filename heuristics re-cluster images that
  // the semantic model already grouped, which defeats the point of replacing the
  // VLM.
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const groups = await attemptEmbeddingPath();
      return { groups, fallbackUsed: false };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(
        `[auto-group] Cohere attempt ${attempt}/${MAX_ATTEMPTS} failed: ${lastError.message}`,
      );
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, BACKOFF_MS * attempt));
      }
    }
  }

  // Fallback: filename-only bucketing via the existing apparel-token merger.
  // NOT the VLM path — per 08-CONTEXT.md the dead VLM code is left untouched
  // elsewhere but is never reached from this function.
  console.error(
    `[auto-group] Cohere failed after ${MAX_ATTEMPTS} attempts — falling back to filename grouping. Last error: ${lastError?.message}`,
  );

  const fallbackSeedGroups: AutoGroupOutput[] = inputImages.map((img) =>
    canonicalizeAutoGroup({
      label: img.filename.replace(/\.[^/.]+$/, "") || `Product ${img.index + 1}`,
      familyKey: undefined,
      imageIndices: [img.index],
      confidence: "low",
      descriptor: img.descriptor,
    }),
  );
  const mergedFallback = mergeAutoGroupsByFamily(fallbackSeedGroups);

  return {
    groups: mergedFallback,
    fallbackUsed: true,
    fallbackReason: lastError?.message ?? "Cohere unavailable",
  };
}

const SUBSCRIPTION_WEEKLY_PRICE_PENCE = 400;    // £4.00/week
const SUBSCRIPTION_ANNUAL_PRICE_PENCE = 17300;  // £173.00/year (2 months free vs 52×£4=£208)
const WEEKLY_PRODUCT_LIMIT = 30;

let cachedWeeklyPriceId: string | null = null;
let cachedAnnualPriceId: string | null = null;

async function getOrCreateWeeklySubscriptionPriceId(): Promise<string> {
  if (cachedWeeklyPriceId) return cachedWeeklyPriceId;
  const stripe = await getUncachableStripeClient();
  const products = await stripe.products.list({ active: true, limit: 100 });
  const existingProduct = products.data.find(p => p.metadata?.type === 'weekly_subscription');

  if (existingProduct) {
    const prices = await stripe.prices.list({ product: existingProduct.id, active: true, limit: 10 });
    const match = prices.data.find(
      p => p.unit_amount === SUBSCRIPTION_WEEKLY_PRICE_PENCE
        && p.type === 'recurring'
        && (p.recurring as any)?.interval === 'week'
    );
    if (match) { cachedWeeklyPriceId = match.id; return match.id; }
  }

  let productId: string;
  if (existingProduct) {
    productId = existingProduct.id;
  } else {
    const product = await stripe.products.create({
      name: 'SnapSync AI',
      description: 'Up to 30 AI-powered product listings per week',
      metadata: { type: 'weekly_subscription' },
    });
    productId = product.id;
  }

  const price = await stripe.prices.create({
    product: productId,
    unit_amount: SUBSCRIPTION_WEEKLY_PRICE_PENCE,
    currency: 'gbp',
    recurring: { interval: 'week' },
  });
  cachedWeeklyPriceId = price.id;
  return cachedWeeklyPriceId;
}

async function getOrCreateAnnualSubscriptionPriceId(): Promise<string> {
  if (cachedAnnualPriceId) return cachedAnnualPriceId;
  const stripe = await getUncachableStripeClient();
  const products = await stripe.products.list({ active: true, limit: 100 });
  // Annual price lives on the same product as the weekly price
  const existingProduct = products.data.find(p => p.metadata?.type === 'weekly_subscription');

  if (existingProduct) {
    const prices = await stripe.prices.list({ product: existingProduct.id, active: true, limit: 20 });
    const match = prices.data.find(
      p => p.unit_amount === SUBSCRIPTION_ANNUAL_PRICE_PENCE
        && p.type === 'recurring'
        && (p.recurring as any)?.interval === 'year'
    );
    if (match) { cachedAnnualPriceId = match.id; return match.id; }
  }

  let productId: string;
  if (existingProduct) {
    productId = existingProduct.id;
  } else {
    const product = await stripe.products.create({
      name: 'SnapSync AI',
      description: 'Up to 30 AI-powered product listings per week',
      metadata: { type: 'weekly_subscription' },
    });
    productId = product.id;
  }

  const price = await stripe.prices.create({
    product: productId,
    unit_amount: SUBSCRIPTION_ANNUAL_PRICE_PENCE,
    currency: 'gbp',
    recurring: { interval: 'year' },
  });
  cachedAnnualPriceId = price.id;
  return cachedAnnualPriceId;
}

// Returns the UTC Monday that starts the current ISO week
function getWeekStartUTC(): Date {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setUTCHours(0, 0, 0, 0);
  const day = weekStart.getUTCDay(); // 0=Sun, 1=Mon
  const diff = day === 0 ? -6 : 1 - day;
  weekStart.setUTCDate(weekStart.getUTCDate() + diff);
  return weekStart;
}

// Returns next Monday at UTC midnight (for "resets at" display)
function nextMondayUTC(): Date {
  const start = getWeekStartUTC();
  start.setUTCDate(start.getUTCDate() + 7);
  return start;
}

async function getWeeklyProductCount(userId: string): Promise<number> {
  const weekStart = getWeekStartUTC();
  const [result] = await db
    .select({
      count: sql<number>`count(distinct coalesce(${images.productGroupId}, cast(${images.id} as text)))`
    })
    .from(images)
    .where(
      and(
        eq(images.sessionId, userId),
        eq(images.paymentStatus, 'paid'),
        sql`${images.createdAt} >= ${weekStart}`
      )
    );
  return Number(result?.count ?? 0);
}

const updateSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  price: z.string().nullable().optional(),
  category: z.string().optional(),
  productType: z.string().optional(),
  tags: z.array(z.string()).optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  altText: z.string().optional(),
  aeoFaqs: z.array(z.object({ question: z.string(), answer: z.string() })).optional(),
  aeoSnippet: z.string().optional(),
  variants: z.any().optional(),
  compareAtPrice: z.string().nullable().optional(),
  costPerItem: z.string().nullable().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  trackQuantity: z.string().optional(),
  inventoryQuantity: z.number().optional(),
  mediaGallery: z.array(z.string()).optional(),
  collections: z.array(z.string()).optional(),
  paymentStatus: z.string().optional(),
  instagramCaption: z.string().optional(),
  instagramStatus: z.string().optional(),
  instagramPostId: z.string().optional(),
  productGroupId: z.string().nullable().optional(),
});

interface ProductAnalysis {
  title: string;
  description: string;
  price: string;
  category: string;
  mainCategory: string;
  productType: string;
  tags: string[];
  seoTitle: string;
  seoDescription: string;
  altText: string;
  aeoFaqs: { question: string; answer: string }[];
  aeoSnippet: string;
  variants: { name: string; values: string[] }[];
  imageColors?: string[]; // per-image detected color (index matches files[] order)
}

const toneInstructions: Record<string, string> = {
  professional: "Write in a polished, professional tone suitable for a premium brand. Use clear, authoritative language.",
  casual: "Write in a friendly, conversational tone. Use approachable language that feels warm and relatable.",
  luxury: "Write in an aspirational, refined tone. Emphasize exclusivity, craftsmanship, and premium quality. Use elegant vocabulary.",
  playful: "Write in a fun, energetic tone. Use creative language, wordplay, and an upbeat vibe.",
  technical: "Write in a detailed, specification-focused tone. Emphasize features, materials, dimensions, and performance data.",
};

interface QuickPreview {
  title: string;
  category: string;
  mainCategory: string;
  productType: string;
  tags: string[];
}

function imageHashNormalizer(args: any[]) {
  const buffer: Buffer = args[0];
  const stringsToHash = args.slice(1).map((arg: any) => String(arg)).join('|');
  const hash = crypto.createHash('sha256');
  hash.update(buffer);
  hash.update(stringsToHash);
  return hash.digest('hex');
}

const quickPreviewImage = memoizee(
  async function _quickPreviewImage(buffer: Buffer, mimeType: string, originalName: string, productContext?: string, brandTone?: string): Promise<QuickPreview> {
  try {
    const base64Image = buffer.toString('base64');
    const contextHint = productContext
      ? `\n\nThe seller describes these products as: "${productContext}". Use this context to more accurately identify and classify the product.`
      : "";
    const toneHint = brandTone && toneInstructions[brandTone]
      ? `\nBrand voice: ${toneInstructions[brandTone]}`
      : "";
    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      messages: [
        {
          role: "system",
          content: `Product image classifier for Shopify/Etsy/Amazon. Identify the EXACT product including brand, model, material, color.${contextHint}${toneHint}

Respond with JSON:
{
  "title": "Specific title (max 80 chars) with brand, type, key attribute",
  "category": "Shopify taxonomy path with ' > ' separators, 2-4 levels deep",
  "mainCategory": "One broad, top-level product grouping (e.g. 'Shoes', 'Outerwear', 'Accessories', 'Electronics', 'Home Decor', 'Jewelry')",
  "productType": "Short Shopify product_type label",
  "tags": ["5 specific tags: brand, type, material, color, use case"]
}`
        },
        {
          role: "user",
          content: [
            { type: "text", text: `Classify this product image (${originalName}). JSON only.` },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } },
          ],
        },
      ],
      max_completion_tokens: 300,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content || "";
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    }
    if (parsed) {
      return {
        title: parsed.title || originalName.replace(/\.[^/.]+$/, ""),
        category: parsed.category || "Other",
        mainCategory: parsed.mainCategory || "Uncategorized",
        productType: parsed.productType || "",
        tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [],
      };
    }
    throw new Error("No JSON in quick preview: " + content.substring(0, 200));
  } catch (error) {
    console.error("Quick preview error:", error);
    return {
      title: originalName.replace(/\.[^/.]+$/, ""),
      category: "Other",
      mainCategory: "Uncategorized",
      productType: "",
      tags: [],
    };
  }
}, {
  promise: true,
  normalizer: imageHashNormalizer,
  maxAge: 24 * 60 * 60 * 1000, // Cache for 24 hours
  max: 1000 // Keep up to 1000 items in memory
});

const fullAnalyzeImage = memoizee(
  async function _fullAnalyzeImage(buffer: Buffer, mimeType: string, originalName: string, tone: string = "professional", productContext?: string, attempt: number = 1): Promise<ProductAnalysis> {
  const MAX_RETRIES = 2;
  const toneGuide = toneInstructions[tone] || toneInstructions.professional;
  const contextGuide = productContext
    ? `\nSeller context: "${productContext}".`
    : "";

  try {
    const base64Image = buffer.toString('base64');
    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      messages: [
        {
          role: "system",
          content: `E-commerce product listing expert for Shopify/Etsy/Amazon. ${toneGuide}${contextGuide}

Identify the EXACT product: brand, model, material, color, size. Use specific tags (never generic). Respond with JSON:
{
  "title": "Specific title (max 80 chars) with brand, type, key attribute",
  "description": "3-4 sentence HTML description with <p>, <ul>, <li>. Include brand, materials, dimensions, target buyer.",
  "price": "Retail price string e.g. '29.99'",
  "category": "Shopify taxonomy path with ' > ' separators, 2-4 levels deep",
  "mainCategory": "One broad, top-level product grouping (e.g. 'Shoes', 'Outerwear', 'Accessories', 'Electronics', 'Home Decor', 'Jewelry')",
  "productType": "Short Shopify product_type label",
  "tags": ["8 specific tags: brand, type, material, color, use case, audience, style, occupation"],
  "seoTitle": "SEO title (50-60 chars) with brand and product name",
  "seoDescription": "Meta description (140-160 chars) with brand, product, benefit, CTA",
  "altText": "Alt text (max 125 chars) describing what's visible in the image",
  "aeoFaqs": [{"question":"...","answer":"1-2 sentence factual answer"}] (3-5 FAQ pairs for AI answer engines),
  "aeoSnippet": "2-3 sentence conversational summary as if answering 'Tell me about [product]'",
  "variants": VARIANT_RULES
}

VARIANT_RULES: Always detect the exact color(s) visible in the image. For apparel/clothing/footwear always include both a Color option and a Size option. Sizes default to ["S","M","L","XL"] unless the product clearly uses a different sizing system (e.g. shoe sizes, numeric waist sizes). Non-apparel items: only include variants that make sense (e.g. storage capacity for electronics, material for furniture). Example for a purple t-shirt: [{"name":"Color","values":["Purple"]},{"name":"Size","values":["S","M","L","XL"]}]. If no variants apply, use [].`
        },
        {
          role: "user",
          content: [
            { type: "text", text: `Analyze this product image (${originalName}). JSON only.` },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } },
          ],
        },
      ],
      max_completion_tokens: 2000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content || "";
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    }
    if (parsed && parsed.title && parsed.description && parsed.description.length > 20) {
      return {
        title: parsed.title || originalName,
        description: parsed.description,
        price: String(parsed.price || "0.00"),
        category: parsed.category || "Other",
        mainCategory: parsed.mainCategory || "Uncategorized",
        productType: parsed.productType || "",
        tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [],
        seoTitle: parsed.seoTitle || parsed.title || originalName,
        seoDescription: parsed.seoDescription || "",
        altText: parsed.altText || "",
        aeoFaqs: Array.isArray(parsed.aeoFaqs) ? parsed.aeoFaqs : [],
        aeoSnippet: parsed.aeoSnippet || "",
        variants: Array.isArray(parsed.variants) ? parsed.variants : [],
      };
    }
    throw new Error("Incomplete AI response — missing title or description: " + content.substring(0, 200));
  } catch (error) {
    console.error(`OpenAI full analysis error (attempt ${attempt}/${MAX_RETRIES}):`, error);
    if (attempt < MAX_RETRIES) {
      console.log(`Retrying full analysis for ${originalName} (attempt ${attempt + 1})...`);
      return fullAnalyzeImage(buffer, mimeType, originalName, tone, productContext, attempt + 1);
    }
    return {
      title: originalName.replace(/\.[^/.]+$/, ""),
      description: "Failed to analyze image.",
      price: "0.00",
      category: "Other",
      mainCategory: "Uncategorized",
      productType: "",
      tags: [],
      seoTitle: "",
      seoDescription: "",
      altText: "",
      aeoFaqs: [],
      aeoSnippet: "",
      variants: [],
    };
  }
}, {
  promise: true,
  normalizer: imageHashNormalizer,
  maxAge: 24 * 60 * 60 * 1000,
  max: 1000
});

// Analyzes multiple images of the SAME product in one AI call — returns a single listing
async function fullAnalyzeMultipleImages(
  files: { buffer: Buffer; mimeType: string; originalName: string }[],
  tone: string = "professional",
  productContext?: string
): Promise<ProductAnalysis> {
  const MAX_RETRIES = 2;
  const toneGuide = toneInstructions[tone] || toneInstructions.professional;
  const contextGuide = productContext ? `\nSeller context: "${productContext}".` : "";

  async function attempt(n: number): Promise<ProductAnalysis> {
    try {
      const imageContent = files.map(f => ({
        type: "image_url" as const,
        image_url: { url: `data:${f.mimeType};base64,${f.buffer.toString('base64')}` }
      }));

      const response = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: [
          {
            role: "system",
            content: `E-commerce product listing expert for Shopify/Etsy/Amazon. ${toneGuide}${contextGuide}

You are given ${files.length} images of the SAME product. The images may be different angles of one color, OR different color versions of the same product (e.g. purple, black, brown). Analyze ALL images and generate ONE unified product listing. Respond with JSON:
{
  "title": "Specific title (max 80 chars) — omit specific color, use brand+type (e.g. 'Cotton Crew-Neck T-Shirt')",
  "description": "3-4 sentence HTML description with <p>, <ul>, <li>. Include brand, materials, dimensions, target buyer.",
  "price": "Retail price string e.g. '29.99'",
  "category": "Shopify taxonomy path with ' > ' separators, 2-4 levels deep",
  "mainCategory": "One broad, top-level product grouping (e.g. 'Shoes', 'Outerwear', 'Accessories', 'Electronics', 'Home Decor', 'Jewelry')",
  "productType": "Short Shopify product_type label",
  "tags": ["8 specific tags: brand, type, material, colors, use case, audience, style, occasion"],
  "seoTitle": "SEO title (50-60 chars) with brand and product name",
  "seoDescription": "Meta description (140-160 chars) with brand, product, benefit, CTA",
  "altText": "Alt text (max 125 chars) describing the product across all images",
  "aeoFaqs": [{"question":"...","answer":"1-2 sentence factual answer"}] (3-5 FAQ pairs for AI answer engines),
  "aeoSnippet": "2-3 sentence conversational summary as if answering 'Tell me about [product]'",
  "imageColors": ["color of image 0", "color of image 1", ...] — detect the EXACT dominant color for EACH image in order (e.g. ["Purple","Black","Brown"]),
  "variants": VARIANT_RULES
}

VARIANT_RULES: For apparel/clothing/footwear always include Color AND Size variants. Color values = deduplicated list of all colors from imageColors (e.g. ["Purple","Black","Brown"]). Size defaults to ["S","M","L","XL"] unless product uses a different system (shoe sizes, numeric waist, etc.). Non-apparel: only include variants that make sense. Example: [{"name":"Color","values":["Purple","Black","Brown"]},{"name":"Size","values":["S","M","L","XL"]}]. If no variants apply, use [].`
          },
          {
            role: "user",
            content: [
              { type: "text", text: `Analyze these ${files.length} images of the same product (${files.map(f => f.originalName).join(', ')}). JSON only.` },
              ...imageContent,
            ],
          },
        ],
        max_completion_tokens: 2000,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0].message.content || "";
      let parsed: any;
      try {
        parsed = JSON.parse(content);
      } catch {
        const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '');
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
      }
      if (parsed && parsed.title && parsed.description && parsed.description.length > 20) {
        return {
          title: parsed.title,
          description: parsed.description,
          price: String(parsed.price || "0.00"),
          category: parsed.category || "Other",
          mainCategory: parsed.mainCategory || "Uncategorized",
          productType: parsed.productType || "",
          tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [],
          seoTitle: parsed.seoTitle || parsed.title,
          seoDescription: parsed.seoDescription || "",
          altText: parsed.altText || "",
          aeoFaqs: Array.isArray(parsed.aeoFaqs) ? parsed.aeoFaqs : [],
          aeoSnippet: parsed.aeoSnippet || "",
          variants: Array.isArray(parsed.variants) ? parsed.variants : [],
          imageColors: Array.isArray(parsed.imageColors) ? parsed.imageColors.map(String) : [],
        };
      }
      throw new Error("Incomplete AI response: " + content.substring(0, 200));
    } catch (error) {
      console.error(`Multi-image full analysis error (attempt ${n}/${MAX_RETRIES}):`, error);
      if (n < MAX_RETRIES) return attempt(n + 1);
      return {
        title: files[0].originalName.replace(/\.[^/.]+$/, ""),
        description: "Failed to analyze images.",
        price: "0.00",
        category: "Other",
        mainCategory: "Uncategorized",
        productType: "",
        tags: [],
        seoTitle: "",
        seoDescription: "",
        altText: "",
        aeoFaqs: [],
        aeoSnippet: "",
        variants: [],
      };
    }
  }

  return attempt(1);
}

async function quickPreviewMultipleImages(
  files: { buffer: Buffer; mimeType: string; originalName: string }[],
  productContext?: string,
  brandTone?: string
): Promise<QuickPreview> {
  const contextHint = productContext
    ? `\n\nThe seller describes these products as: "${productContext}". Use this to more accurately classify the product.`
    : "";
  const toneHint = brandTone && toneInstructions[brandTone]
    ? `\nBrand voice: ${toneInstructions[brandTone]}`
    : "";

  try {
    const imageContent = files.map(f => ({
      type: "image_url" as const,
      image_url: { url: `data:${f.mimeType};base64,${f.buffer.toString('base64')}` }
    }));

    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      messages: [
        {
          role: "system",
          content: `Product image classifier for Shopify/Etsy/Amazon. You are given ${files.length} images of the SAME product. Identify the EXACT product including brand, model, material, color from all images combined.${contextHint}${toneHint}

Respond with JSON:
{
  "title": "Specific title (max 80 chars) with brand, type, key attribute",
  "category": "Shopify taxonomy path with ' > ' separators, 2-4 levels deep",
  "mainCategory": "One broad, top-level product grouping (e.g. 'Shoes', 'Outerwear', 'Accessories', 'Electronics', 'Home Decor', 'Jewelry')",
  "productType": "Short Shopify product_type label",
  "tags": ["5 specific tags: brand, type, material, color, use case"]
}`
        },
        {
          role: "user",
          content: [
            { type: "text", text: `Classify this product from ${files.length} images. JSON only.` },
            ...imageContent,
          ],
        },
      ],
      max_completion_tokens: 300,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content || "";
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    }
    if (parsed) {
      return {
        title: parsed.title || files[0].originalName.replace(/\.[^/.]+$/, ""),
        category: parsed.category || "Other",
        mainCategory: parsed.mainCategory || "Uncategorized",
        productType: parsed.productType || "",
        tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [],
      };
    }
    throw new Error("No JSON in multi-image quick preview");
  } catch (error) {
    console.error("Multi-image quick preview error:", error);
    return {
      title: files[0].originalName.replace(/\.[^/.]+$/, ""),
      category: "Other",
      mainCategory: "Uncategorized",
      productType: "",
      tags: [],
    };
  }
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isDatabaseConnectionLimitError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("EMAXCONN") || message.includes("max client connections reached");
}

async function pushProductToShopify(
  image: any,
  connection: any,
  viewImages?: { image: any; buffer?: Buffer }[],
): Promise<{
  shopifyProductId?: string;
  variants?: Array<{ id: string; sku: string | null; inventoryItem: { id: string; tracked: boolean } }>;
  error?: string;
}> {
  try {
    const product = await createShopifyProductGraphql({ connection, image, viewImages });
    return {
      shopifyProductId: product.id,
      variants: product.variants.nodes,
    };
  } catch (error: any) {
    console.error("Shopify push error:", error);
    return { error: error.message || "Failed to push to Shopify" };
  }
}

async function pushProductToEtsy(
  image: any,
  connection: { apiKeystring: string; accessToken: string; shopId: string },
  imageBuffer?: Buffer
): Promise<{ etsyListingId?: string; error?: string }> {
  const { apiKeystring, accessToken, shopId } = connection;

  try {
    const listingData = new URLSearchParams();
    listingData.append("quantity", "1");
    listingData.append("title", (image.title || image.originalName || "Untitled Product").substring(0, 140));
    listingData.append("description", image.description || image.title || "Product listing");
    listingData.append("price", String(parseFloat(image.price || "0") || 9.99));
    listingData.append("who_made", "i_did");
    listingData.append("when_made", "2020_2025");
    listingData.append("taxonomy_id", "1");
    listingData.append("type", "physical");

    if (image.tags && Array.isArray(image.tags)) {
      image.tags.slice(0, 13).forEach((tag: string) => {
        listingData.append("tags[]", tag.substring(0, 20));
      });
    }

    const createResponse = await fetch(
      `https://api.etsy.com/v3/application/shops/${shopId}/listings`,
      {
        method: "POST",
        headers: {
          'x-api-key': apiKeystring,
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: listingData.toString(),
      }
    );

    if (!createResponse.ok) {
      const errorBody = await createResponse.text();
      console.error("Etsy listing create error:", createResponse.status, errorBody);
      return { error: `Etsy API error: ${createResponse.status} - ${errorBody.substring(0, 200)}` };
    }

    const listingResult = await createResponse.json();
    const listingId = String(listingResult.listing_id);

    if (imageBuffer) {
      try {
        const boundary = `----FormBoundary${Date.now()}`;
        const filename = image.originalName || 'product.jpg';
        const mimeType = image.mimeType || 'image/jpeg';

        const header = `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`;
        const footer = `\r\n--${boundary}--\r\n`;

        const headerBuf = Buffer.from(header, 'utf-8');
        const footerBuf = Buffer.from(footer, 'utf-8');
        const body = Buffer.concat([headerBuf, imageBuffer, footerBuf]);

        const imgResponse = await fetch(
          `https://api.etsy.com/v3/application/shops/${shopId}/listings/${listingId}/images`,
          {
            method: "POST",
            headers: {
              'x-api-key': apiKeystring,
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': `multipart/form-data; boundary=${boundary}`,
            },
            body: body,
          }
        );

        if (!imgResponse.ok) {
          console.error("Etsy image upload failed:", imgResponse.status, await imgResponse.text().catch(() => ''));
        }
      } catch (imgErr) {
        console.error("Etsy image upload error:", imgErr);
      }
    }

    return { etsyListingId: listingId };
  } catch (error: any) {
    console.error("Etsy push error:", error);
    return { error: error.message || "Failed to push to Etsy" };
  }
}

async function getAmazonAccessToken(connection: { lwaClientId: string; lwaClientSecret: string; lwaRefreshToken: string }): Promise<string> {
  const response = await fetch('https://api.amazon.com/auth/o2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: connection.lwaRefreshToken,
      client_id: connection.lwaClientId,
      client_secret: connection.lwaClientSecret,
    }).toString(),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => '');
    throw new Error(`Failed to get Amazon access token: ${response.status} ${err}`);
  }

  const data = await response.json();
  return data.access_token;
}

function getAmazonEndpoint(marketplaceId: string): string {
  const endpoints: Record<string, string> = {
    'ATVPDKIKX0DER': 'https://sellingpartnerapi-na.amazon.com',
    'A2EUQ1WTGCTBG2': 'https://sellingpartnerapi-na.amazon.com',
    'A1AM78C64UM0Y8': 'https://sellingpartnerapi-na.amazon.com',
    'A1PA6795UKMFR9': 'https://sellingpartnerapi-eu.amazon.com',
    'A1F83G8C2ARO7P': 'https://sellingpartnerapi-eu.amazon.com',
    'A13V1IB3VIYZZH': 'https://sellingpartnerapi-eu.amazon.com',
    'A1VC38T7YXB528': 'https://sellingpartnerapi-fe.amazon.com',
    'A39IBJ37TRP1C6': 'https://sellingpartnerapi-fe.amazon.com',
  };
  return endpoints[marketplaceId] || 'https://sellingpartnerapi-na.amazon.com';
}

async function pushProductToAmazon(
  image: any,
  connection: { lwaClientId: string; lwaClientSecret: string; lwaRefreshToken: string; sellerId: string; marketplaceId: string },
): Promise<{ amazonListingId?: string; error?: string }> {
  try {
    const accessToken = await getAmazonAccessToken(connection);
    const endpoint = getAmazonEndpoint(connection.marketplaceId);
    const sku = `PB-${image.id}-${Date.now()}`;

    const listingBody = {
      productType: "PRODUCT",
      requirements: "LISTING",
      attributes: {
        item_name: [{ value: (image.title || image.originalName || "Untitled Product").substring(0, 250), marketplace_id: connection.marketplaceId }],
        bullet_point: image.description
          ? [{ value: image.description.substring(0, 1000), marketplace_id: connection.marketplaceId }]
          : [],
        list_price: image.price
          ? [{ value: parseFloat(image.price) || 9.99, currency: "USD", marketplace_id: connection.marketplaceId }]
          : [{ value: 9.99, currency: "USD", marketplace_id: connection.marketplaceId }],
        condition_type: [{ value: "new_new", marketplace_id: connection.marketplaceId }],
        merchant_suggested_asin: [],
      },
    };

    const listingResponse = await fetch(
      `${endpoint}/listings/2021-08-01/items/${connection.sellerId}/${encodeURIComponent(sku)}`,
      {
        method: "PUT",
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'x-amz-access-token': accessToken,
        },
        body: JSON.stringify(listingBody),
      }
    );

    if (!listingResponse.ok) {
      const errorBody = await listingResponse.text();
      console.error("Amazon listing create error:", listingResponse.status, errorBody);
      return { error: `Amazon API error: ${listingResponse.status} - ${errorBody.substring(0, 200)}` };
    }

    return { amazonListingId: sku };
  } catch (error: any) {
    console.error("Amazon push error:", error);
    return { error: error.message || "Failed to push to Amazon" };
  }
}

function getAppUrl(req: express.Request): string {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host || req.hostname;
  return `${protocol}://${host}`;
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  if (!DEV_BYPASS_AUTH) {
    app.use(clerkMiddleware());
  } else {
    console.log("⚠️  DEV_BYPASS_AUTH enabled — Clerk auth is disabled, using dev user");
  }

  registerInventoryRoutes(app, { requireAuth, getUserId });

  app.get("/api/auth/clerk-config", (_req, res) => {
    const publishableKey = process.env.CLERK_PUBLISHABLE_KEY;
    if (!publishableKey) {
      return res.status(500).json({ message: "Clerk not configured" });
    }
    res.json({ publishableKey });
  });

  app.get("/api/payments/config", async (_req, res) => {
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({
        publishableKey,
        subscriptionWeeklyPricePence: SUBSCRIPTION_WEEKLY_PRICE_PENCE,
        subscriptionAnnualPricePence: SUBSCRIPTION_ANNUAL_PRICE_PENCE,
        weeklyProductLimit: WEEKLY_PRODUCT_LIMIT,
      });
    } catch (error) {
      console.error("Stripe config error:", error);
      res.status(500).json({ message: "Payment system not available" });
    }
  });

  // ── Subscription ─────────────────────────────────────────────────────────

  app.get("/api/subscription/status", requireAuth(), async (req, res) => {
    try {
      const userId = getUserId(req);

      // Dev-free user: fake active subscription on localhost
      if (await isDevFreeUser(req)) {
        return res.json({ subscribed: true, status: "active", currentPeriodEnd: null, stripeSubscriptionId: null });
      }

      let sub = await storage.getSubscription(userId);

      // Auto-recover: if no subscription found by userId, try to find one in Stripe
      // by the user's email and re-link it. This handles the case where the user
      // subscribed under a different Clerk account (e.g. Google vs email sign-in).
      // Also migrates images & connections from the old userId so data isn't orphaned.
      if (!sub) {
        try {
          const clerkUser = await clerkClient.users.getUser(userId);
          const email = clerkUser.emailAddresses?.find(e => e.id === clerkUser.primaryEmailAddressId)?.emailAddress
            ?? clerkUser.emailAddresses?.[0]?.emailAddress;

          if (email) {
            const stripe = await getUncachableStripeClient();
            const customers = await stripe.customers.list({ email, limit: 5 });
            for (const customer of customers.data) {
              const subs = await stripe.subscriptions.list({ customer: customer.id, status: 'all', limit: 3 });
              const activeSub = subs.data.find(s => s.status === 'active' || s.status === 'trialing');
              if (activeSub) {
                // Check if subscription was previously linked to a different userId
                // and migrate their images + connections to the current userId
                const oldSubRecord = await storage.getSubscriptionByStripeId(activeSub.id);
                if (oldSubRecord && oldSubRecord.userId !== userId) {
                  console.log(`Migrating data from old userId ${oldSubRecord.userId} to new userId ${userId}`);
                  await storage.migrateSession(oldSubRecord.userId, userId);
                }

                const periodEnd = (activeSub as any).current_period_end
                  ? new Date((activeSub as any).current_period_end * 1000) : null;
                sub = await storage.upsertSubscription({
                  userId,
                  stripeCustomerId: customer.id,
                  stripeSubscriptionId: activeSub.id,
                  status: activeSub.status,
                  currentPeriodEnd: periodEnd,
                });
                console.log(`Auto-recovered subscription ${activeSub.id} for user ${userId} via email ${email}`);
                break;
              }
            }
          }
        } catch (recoverErr: any) {
          // Non-fatal — log and fall through to subscribed: false
          console.warn('Auto-recover subscription failed (non-fatal):', recoverErr.message);
        }
      }

      if (sub) {
        // 'canceling' = user cancelled but still has access until period end
        const isActive = sub.status === 'active' || sub.status === 'trialing' || sub.status === 'canceling';
        const periodEnd = sub.currentPeriodEnd ? sub.currentPeriodEnd.toISOString() : null;
        return res.json({ subscribed: isActive, status: sub.status, currentPeriodEnd: periodEnd, stripeSubscriptionId: sub.stripeSubscriptionId });
      }
      return res.json({ subscribed: false });
    } catch (error: any) {
      console.error("Subscription status error:", error);
      res.status(500).json({ message: "Failed to check subscription status" });
    }
  });

  app.post("/api/subscription/recover", requireAuth(), async (req, res) => {
    try {
      const userId = getUserId(req);
      const { checkoutSessionId } = req.body;

      const existingSub = await storage.getSubscription(userId);
      if (existingSub && (existingSub.status === 'active' || existingSub.status === 'trialing' || existingSub.status === 'canceling')) {
        return res.json({ recovered: true, alreadyActive: true });
      }

      if (!checkoutSessionId) {
        return res.status(400).json({ message: "Missing checkout session ID" });
      }

      const stripe = await getUncachableStripeClient();
      const session = await stripe.checkout.sessions.retrieve(checkoutSessionId);

      if (session.metadata?.userId !== userId) {
        return res.status(403).json({ message: "Session does not belong to this user" });
      }

      if (session.payment_status !== 'paid' || !session.subscription) {
        return res.status(400).json({ message: "No paid subscription found for this session" });
      }

      const subId = typeof session.subscription === 'string' ? session.subscription : (session.subscription as any).id;
      const customerId = typeof session.customer === 'string' ? session.customer : (session.customer as any)?.id || '';

      const fullSub: any = await stripe.subscriptions.retrieve(subId);
      let periodEnd: Date | null = null;
      if (fullSub.current_period_end) {
        periodEnd = new Date(fullSub.current_period_end * 1000);
      }

      // Migrate images & connections from old userId if subscription was under a different account
      const oldSubRecord = await storage.getSubscriptionByStripeId(subId);
      if (oldSubRecord && oldSubRecord.userId !== userId) {
        console.log(`recover: migrating data from old userId ${oldSubRecord.userId} to ${userId}`);
        await storage.migrateSession(oldSubRecord.userId, userId);
      }

      await storage.upsertSubscription({
        userId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subId,
        status: fullSub.status,
        currentPeriodEnd: periodEnd,
      });

      console.log(`Recovered subscription ${subId} for user ${userId}`);
      res.json({ recovered: true, subscribed: fullSub.status === 'active' || fullSub.status === 'trialing' });
    } catch (error: any) {
      console.error("Subscription recovery error:", error);
      res.status(500).json({ message: "Failed to recover subscription" });
    }
  });

  // Recover subscription by looking up the user's email in Stripe.
  // Useful when a user re-signs up with a different Clerk account but used the same email.
  app.post("/api/subscription/recover-by-email", requireAuth(), async (req, res) => {
    try {
      const userId = getUserId(req);

      // Already has an active subscription under this userId — nothing to do
      const existingSub = await storage.getSubscription(userId);
      if (existingSub && (existingSub.status === 'active' || existingSub.status === 'trialing' || existingSub.status === 'canceling')) {
        return res.json({ recovered: true, subscribed: true, message: "Subscription already active" });
      }

      // Get user's primary email from Clerk
      const clerkUser = await clerkClient.users.getUser(userId);
      const primaryEmail = clerkUser.emailAddresses?.find(e => e.id === clerkUser.primaryEmailAddressId)?.emailAddress
        ?? clerkUser.emailAddresses?.[0]?.emailAddress;

      if (!primaryEmail) {
        return res.status(400).json({ message: "No email address found on your account" });
      }

      const stripe = await getUncachableStripeClient();

      // Find Stripe customers matching this email
      const customers = await stripe.customers.list({ email: primaryEmail, limit: 10 });
      if (customers.data.length === 0) {
        return res.json({ recovered: false, message: "No Stripe customer found for your email" });
      }

      // Look for an active/trialing subscription across all matching customers
      for (const customer of customers.data) {
        const subs = await stripe.subscriptions.list({ customer: customer.id, status: 'all', limit: 5 });
        const activeSub = subs.data.find(s => s.status === 'active' || s.status === 'trialing');
        if (activeSub) {
          // Migrate images & connections from old userId if subscription was under a different account
          const oldSubRecord = await storage.getSubscriptionByStripeId(activeSub.id);
          if (oldSubRecord && oldSubRecord.userId !== userId) {
            console.log(`recover-by-email: migrating data from old userId ${oldSubRecord.userId} to ${userId}`);
            await storage.migrateSession(oldSubRecord.userId, userId);
          }

          const periodEnd = (activeSub as any).current_period_end
            ? new Date((activeSub as any).current_period_end * 1000)
            : null;
          await storage.upsertSubscription({
            userId,
            stripeCustomerId: customer.id,
            stripeSubscriptionId: activeSub.id,
            status: activeSub.status,
            currentPeriodEnd: periodEnd,
          });
          console.log(`recover-by-email: linked sub ${activeSub.id} to user ${userId} via email ${primaryEmail}`);
          return res.json({ recovered: true, subscribed: true });
        }
      }

      return res.json({ recovered: false, message: "No active subscription found for your email" });
    } catch (error: any) {
      console.error("recover-by-email error:", error);
      res.status(500).json({ message: "Failed to recover subscription" });
    }
  });

  app.post("/api/subscription/create-checkout", requireAuth(), async (req, res) => {
    try {
      const userId = getUserId(req);
      const existingSub = await storage.getSubscription(userId);
      if (existingSub && (existingSub.status === 'active' || existingSub.status === 'trialing' || existingSub.status === 'canceling')) {
        return res.status(400).json({ message: "You already have an active subscription" });
      }

      const stripe = await getUncachableStripeClient();

      // Look up Stripe by email before creating a new checkout. Prevents the
      // double-charge case where a user signs in with a different Clerk auth
      // method (Google vs email) and ends up with a second Stripe customer +
      // subscription on the same card.
      let existingCustomerId: string | undefined;
      let primaryEmail: string | undefined;
      try {
        const clerkUser = await clerkClient.users.getUser(userId);
        primaryEmail = clerkUser.emailAddresses?.find(e => e.id === clerkUser.primaryEmailAddressId)?.emailAddress
          ?? clerkUser.emailAddresses?.[0]?.emailAddress;

        if (primaryEmail) {
          const customers = await stripe.customers.list({ email: primaryEmail, limit: 5 });
          for (const customer of customers.data) {
            const subs = await stripe.subscriptions.list({ customer: customer.id, status: 'all', limit: 3 });
            const activeSub = subs.data.find(s => s.status === 'active' || s.status === 'trialing');
            if (activeSub) {
              const periodEnd = (activeSub as any).current_period_end
                ? new Date((activeSub as any).current_period_end * 1000) : null;
              const oldSubRecord = await storage.getSubscriptionByStripeId(activeSub.id);
              if (oldSubRecord && oldSubRecord.userId !== userId) {
                console.log(`create-checkout: migrating data from old userId ${oldSubRecord.userId} to ${userId}`);
                await storage.migrateSession(oldSubRecord.userId, userId);
              }
              await storage.upsertSubscription({
                userId,
                stripeCustomerId: customer.id,
                stripeSubscriptionId: activeSub.id,
                status: activeSub.status,
                currentPeriodEnd: periodEnd,
              });
              console.log(`create-checkout: recovered existing sub ${activeSub.id} for user ${userId} via email ${primaryEmail}`);
              return res.status(409).json({
                message: "You already have an active subscription on this email — your account has been refreshed.",
                recovered: true,
              });
            }
            if (!existingCustomerId) existingCustomerId = customer.id;
          }
        }
      } catch (lookupErr: any) {
        // Non-fatal: log and proceed with a fresh checkout. Better to let the
        // user pay than to block them on a Stripe lookup hiccup.
        console.warn("create-checkout: email-based Stripe lookup failed (non-fatal):", lookupErr?.message);
      }

      const { billingInterval } = req.body; // 'weekly' | 'annual', default 'weekly'
      const priceId = billingInterval === 'annual'
        ? await getOrCreateAnnualSubscriptionPriceId()
        : await getOrCreateWeeklySubscriptionPriceId();
      const appUrl = getAppUrl(req);

      // Bucket per minute so rapid double-clicks/network retries return the
      // same checkout session instead of creating a duplicate.
      const idempotencyKey = `checkout-${userId}-${billingInterval ?? 'weekly'}-${Math.floor(Date.now() / 60000)}`;

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price: priceId,
          quantity: 1,
        }],
        mode: 'subscription',
        success_url: `${appUrl}/?subscription=success&checkout_session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/?subscription=cancelled`,
        metadata: {
          userId,
        },
        ...(existingCustomerId
          ? { customer: existingCustomerId }
          : primaryEmail ? { customer_email: primaryEmail } : {}),
      }, {
        idempotencyKey,
      });

      res.json({ checkoutUrl: session.url, sessionId: session.id });
    } catch (error: any) {
      console.error("Subscription checkout error details:", error);
      res.status(500).json({
        message: "Failed to create subscription checkout",
        detail: error?.message || String(error)
      });
    }
  });

  app.post("/api/subscription/verify", requireAuth(), async (req, res) => {
    try {
      const { checkoutSessionId } = req.body;
      if (!checkoutSessionId) {
        return res.status(400).json({ message: "Missing checkout session ID" });
      }

      const userId = getUserId(req);
      const existingSub = await storage.getSubscription(userId);
      if (existingSub && (existingSub.status === 'active' || existingSub.status === 'trialing' || existingSub.status === 'canceling')) {
        return res.json({ verified: true, alreadyActive: true });
      }

      const stripe = await getUncachableStripeClient();
      const session = await stripe.checkout.sessions.retrieve(checkoutSessionId, {
        expand: ['subscription'],
      });

      if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
        return res.status(402).json({ message: "Payment not completed", status: session.payment_status });
      }

      const subscription = session.subscription as any;
      if (!subscription) {
        return res.status(400).json({ message: "No subscription found in checkout session" });
      }

      const subId = typeof subscription === 'string' ? subscription : subscription.id;
      const customerId = typeof session.customer === 'string' ? session.customer : (session.customer as any)?.id || '';
      let subStatus = 'active';
      let periodEnd: Date | null = null;

      if (typeof subscription === 'object' && subscription.status) {
        subStatus = subscription.status;
      }
      if (typeof subscription === 'object' && subscription.current_period_end) {
        try {
          const ts = Number(subscription.current_period_end);
          if (!isNaN(ts) && ts > 0) {
            periodEnd = new Date(ts * 1000);
          }
        } catch (e) { }
      }

      if (typeof subscription === 'string') {
        try {
          const stripe = await getUncachableStripeClient();
          const fullSub: any = await stripe.subscriptions.retrieve(subscription);
          subStatus = fullSub.status;
          if (fullSub.current_period_end) {
            periodEnd = new Date(fullSub.current_period_end * 1000);
          }
        } catch (e) {
          console.error("Failed to retrieve subscription details:", e);
        }
      }

      await storage.upsertSubscription({
        userId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subId,
        status: subStatus,
        currentPeriodEnd: periodEnd,
      });

      res.json({ verified: true, subscribed: true });
    } catch (error: any) {
      console.error("Subscription verification error:", error);
      res.status(500).json({ message: "Failed to verify subscription" });
    }
  });

  app.post("/api/subscription/cancel", requireAuth(), async (req, res) => {
    try {
      const userId = getUserId(req);
      const sub = await storage.getSubscription(userId);
      if (!sub) {
        return res.status(400).json({ message: "No active subscription found" });
      }

      const stripe = await getUncachableStripeClient();
      await stripe.subscriptions.update(sub.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });

      await storage.updateSubscriptionStatus(sub.stripeSubscriptionId, 'canceling');
      res.json({ cancelled: true, message: "Subscription will end at the current billing period" });
    } catch (error: any) {
      console.error("Subscription cancel error:", error);
      res.status(500).json({ message: "Failed to cancel subscription", detail: error?.message || String(error) });
    }
  });

  app.post("/api/subscription/migrate-to-weekly", requireAuth(), async (req, res) => {
    try {
      const { migrationSecret } = req.body;
      if (!process.env.MIGRATION_SECRET || migrationSecret !== process.env.MIGRATION_SECRET) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const stripe = await getUncachableStripeClient();
      const newWeeklyPriceId = await getOrCreateWeeklySubscriptionPriceId();
      const allSubs = await storage.getAllActiveSubscriptions();
      let migrated = 0, skipped = 0, errors = 0;

      for (const sub of allSubs) {
        if (!sub.stripeSubscriptionId) { skipped++; continue; }
        try {
          const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
          const subItem = stripeSub.items.data[0];
          if (!subItem) { skipped++; continue; }
          // Skip if already on weekly interval
          if ((subItem.price.recurring as any)?.interval === 'week') { skipped++; continue; }
          await stripe.subscriptions.update(sub.stripeSubscriptionId, {
            items: [{ id: subItem.id, price: newWeeklyPriceId }],
            proration_behavior: 'none',
          });
          migrated++;
        } catch (err) {
          console.error(`Migration failed for sub ${sub.stripeSubscriptionId}:`, err);
          errors++;
        }
      }

      res.json({ migrated, skipped, errors, total: allSubs.length });
    } catch (error: any) {
      console.error("Migration error:", error);
      res.status(500).json({ message: "Migration failed", detail: error?.message });
    }
  });

  app.post("/api/subscription/archive-old-prices", requireAuth(), async (req, res) => {
    try {
      const { migrationSecret } = req.body;
      if (!process.env.MIGRATION_SECRET || migrationSecret !== process.env.MIGRATION_SECRET) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const stripe = await getUncachableStripeClient();
      const archivedIds: string[] = [];
      let skippedCount = 0;

      // 1. Archive old subscription prices that are not weekly
      const allProducts = await stripe.products.list({ limit: 100 });
      const subProducts = allProducts.data.filter(
        p => p.metadata?.type === 'monthly_subscription' || p.metadata?.type === 'weekly_subscription'
      );
      for (const subProduct of subProducts) {
        const subPrices = await stripe.prices.list({ product: subProduct.id, limit: 100 });
        for (const price of subPrices.data) {
          if (!price.active) { skippedCount++; continue; }
          // Keep weekly prices active; archive monthly, annual (old), and any other intervals
          if ((price.recurring as any)?.interval === 'week') { skippedCount++; continue; }
          await stripe.prices.update(price.id, { active: false });
          archivedIds.push(price.id);
        }
      }

      // 2. Archive all credit pack prices
      const creditProducts = allProducts.data.filter(p => p.metadata?.type === 'credit_pack');
      for (const creditProduct of creditProducts) {
        const creditPrices = await stripe.prices.list({ product: creditProduct.id, active: true, limit: 100 });
        for (const price of creditPrices.data) {
          await stripe.prices.update(price.id, { active: false });
          archivedIds.push(price.id);
        }
      }

      res.json({ archived: archivedIds, archivedCount: archivedIds.length, skipped: skippedCount });
    } catch (error: any) {
      console.error("Archive error:", error);
      res.status(500).json({ message: "Archive failed", detail: error?.message });
    }
  });

  app.post("/api/subscription/unlock-images", requireAuth(), async (req, res) => {
    try {
      const userId = getUserId(req);

      const { imageIds } = req.body;
      if (!imageIds || !Array.isArray(imageIds) || imageIds.length === 0) {
        return res.status(400).json({ message: "No image IDs provided" });
      }

      const allImages = await storage.getImagesByIds(imageIds);
      const userImages = allImages.filter(img => img.sessionId === userId);
      const unpaidImages = userImages.filter(img => img.paymentStatus !== 'paid');

      if (unpaidImages.length === 0) {
        return res.json({ processed: 0, message: "All selected images are already unlocked." });
      }

      // Check subscription OR credits (dev-free user bypasses payment)
      const devFree = await isDevFreeUser(req);
      const sub = await storage.getSubscription(userId);
      const isSubscribed = devFree || (sub && (sub.status === 'active' || sub.status === 'trialing' || sub.status === 'canceling'));

      if (!isSubscribed) {
        return res.status(403).json({
          message: "Subscription required",
          detail: "Subscribe to SnapSync AI to unlock AI product analysis.",
        });
      }

      // Enforce weekly product cap for subscribers
      const weeklyCount = await getWeeklyProductCount(userId);
      const remaining = WEEKLY_PRODUCT_LIMIT - weeklyCount;

      if (remaining <= 0) {
        return res.status(403).json({
          message: "Weekly limit reached",
          detail: `You've used all ${WEEKLY_PRODUCT_LIMIT} products this week. Your limit resets every Monday at midnight UTC.`,
          weeklyLimit: WEEKLY_PRODUCT_LIMIT,
          used: weeklyCount,
          resetsAt: nextMondayUTC().toISOString(),
        });
      }

      // Partial cap: if more unpaid products than remaining weekly allowance, only unlock up to remaining
      const seenGroups = new Set<string>();
      const cappedImages: typeof unpaidImages = [];
      for (const img of unpaidImages) {
        const key = img.productGroupId || `single_${img.id}`;
        if (!seenGroups.has(key)) {
          if (seenGroups.size >= remaining) break;
          seenGroups.add(key);
        }
        cappedImages.push(img);
      }
      unpaidImages.splice(0, unpaidImages.length, ...cappedImages);

      const results = await runWithConcurrency(unpaidImages, CONCURRENCY_LIMIT, async (image) => {
        try {
          console.log(`[unlock-images] Processing image ${image.id}: mimeType=${image.mimeType}, hasImageData=${!!image.imageData}, hasStorageUrl=${!!(image as any).storageUrl}`);
          const buffer = await loadImageBuffer(image);
          console.log(`[unlock-images] loadImageBuffer for image ${image.id}: ${buffer ? `got buffer (${buffer.length} bytes)` : 'null'}`);
          if (!buffer) {
            await storage.updateImage(image.id, {
              paymentStatus: "paid",
              description: image.description || `Premium ${image.title || image.originalName || 'product'} listing`,
              price: image.price || "19.99",
              seoTitle: image.seoTitle || image.title || image.originalName || "Product",
              seoDescription: image.seoDescription || image.description || image.title || "Product listing",
              altText: image.altText || image.title || image.originalName || "Product image",
            });
            return { id: image.id, title: image.title, note: "Unlocked with basic data (image buffer expired). Re-upload for full AI analysis." };
          }

          const imageTone = image.brandTone || 'professional';
          console.log(`[unlock-images] Calling fullAnalyzeImage for image ${image.id}, tone=${imageTone}`);
          let analysis: ProductAnalysis | null = null;
          try {
            analysis = await fullAnalyzeImage(buffer, image.mimeType, image.originalName, imageTone, image.productContext || undefined);
          } catch (analysisErr) {
            console.error(`[unlock-images] fullAnalyzeImage THREW for image ${image.id}:`, analysisErr);
          }
          console.log(`[unlock-images] fullAnalyzeImage result for image ${image.id}: ${analysis ? `description="${analysis.description?.substring(0, 50)}"` : 'null (threw)'}`);

          if (analysis && analysis.description !== "Failed to analyze image.") {
            await storage.updateImage(image.id, {
              title: analysis.title,
              description: analysis.description,
              price: analysis.price,
              category: analysis.category,
              productType: analysis.productType,
              tags: analysis.tags,
              seoTitle: analysis.seoTitle,
              seoDescription: analysis.seoDescription,
              altText: analysis.altText,
              aeoFaqs: analysis.aeoFaqs,
              aeoSnippet: analysis.aeoSnippet,
              variants: analysis.variants,
              aiData: analysis,
              paymentStatus: "paid",
            });
            return { id: image.id, title: analysis.title };
          } else {
            await storage.updateImage(image.id, { paymentStatus: "paid" });
            return { id: image.id, title: image.title, error: "AI analysis failed — your preview data is preserved. Please try unlocking again or edit manually." };
          }
        } catch (err) {
          console.error(`[unlock-images] CAUGHT ERROR for image ${image.id}:`, err);
          await storage.updateImage(image.id, { paymentStatus: "paid" });
          return { id: image.id, error: "Full analysis failed but product unlocked. You can edit details manually." };
        }
      });

      res.json({ processed: results.length, results });
    } catch (error: any) {
      console.error("Verify and unlock error:", error);
      res.status(500).json({ message: "Failed to process payment and unlock analysis" });
    }
  });

  // Upload a file buffer to Supabase Storage and return storageUrl (or null on failure)
  async function uploadFileToStorage(file: Express.Multer.File, imageId: number): Promise<string | null> {
    try {
      return await uploadImageToStorage(file.buffer, file.mimetype, imageId, file.originalname);
    } catch (err) {
      console.error('uploadFileToStorage error:', err);
      return null;
    }
  }

  app.post("/api/images/upload", requireAuth(), upload.array("images", 200), async (req, res) => {
    try {
      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const files = req.files as Express.Multer.File[];
      if (files.length < MIN_IMAGE_COUNT) {
        return res.status(400).json({ message: `Minimum ${MIN_IMAGE_COUNT} images required. You uploaded ${files.length}.` });
      }
      if (files.length > 200) {
        return res.status(400).json({ message: "Maximum 200 images per upload." });
      }

      const sessionId = getUserId(req);
      const productContext = (req.body?.productContext as string) || "";
      const brandTone = (req.body?.brandTone as string) || "professional";
      const groupAsOne = req.body?.groupAsOne === "true" || req.body?.groupAsOne === true;

      const devFree = await isDevFreeUser(req);
      const sub = await storage.getSubscription(sessionId);
      const hasActiveSubscription = devFree || (sub && (sub.status === 'active' || sub.status === 'trialing' || sub.status === 'canceling'));
      const uploadMode = resolveUploadProcessingMode({
        fileCount: files.length,
        groupAsOne,
        hasActiveSubscription: Boolean(hasActiveSubscription),
      });

      // When groupAsOne=true and multiple files: analyze all images together as one product
      if (uploadMode === "groupedPaid" || uploadMode === "groupedPreview") {
        const groupId = crypto.randomUUID();
        const fileInputs = files.map(f => ({ buffer: f.buffer, mimeType: f.mimetype, originalName: f.originalname }));

        let analysis: ProductAnalysis | QuickPreview | null = null;
        let analysisSucceeded = false;

        if (uploadMode === "groupedPaid") {
          const fullAnalysis = await fullAnalyzeMultipleImages(fileInputs, brandTone, productContext || undefined);
          analysis = fullAnalysis;
          analysisSucceeded = fullAnalysis.description !== "Failed to analyze images.";
        } else {
          analysis = await quickPreviewMultipleImages(fileInputs, productContext || undefined, brandTone);
          analysisSucceeded = true;
        }

        const results = await Promise.all(files.map(async (file, idx) => {
          const isPrimary = idx === 0;

          try {
            let image;
            if (uploadMode === "groupedPaid" && analysisSucceeded) {
              const a = analysis as ProductAnalysis;
              const detectedColor = a.imageColors?.[idx] || null;
              image = await storage.createImage({
                originalName: file.originalname,
                mimeType: file.mimetype,
                size: file.size,
                imageData: null,
                title: isPrimary ? a.title : `${a.title} (view ${idx + 1})`,
                description: isPrimary ? a.description : undefined,
                price: isPrimary ? a.price : undefined,
                category: a.category,
                mainCategory: (a as any).mainCategory,
                productType: a.productType,
                tags: isPrimary ? a.tags : [],
                seoTitle: isPrimary ? a.seoTitle : undefined,
                seoDescription: isPrimary ? a.seoDescription : undefined,
                altText: detectedColor ? `${detectedColor} ${a.altText || a.title}` : a.altText,
                aeoFaqs: isPrimary ? a.aeoFaqs : undefined,
                aeoSnippet: isPrimary ? a.aeoSnippet : undefined,
                variants: isPrimary ? a.variants : undefined,
                aiData: isPrimary ? a : (detectedColor ? { detectedColor } : undefined),
                shopifyStatus: "pending",
                paymentStatus: "paid",
                productContext: productContext || null,
                brandTone,
                productGroupId: groupId,
                sessionId,
              });
            } else {
              const a = analysis as QuickPreview;
              image = await storage.createImage({
                originalName: file.originalname,
                mimeType: file.mimetype,
                size: file.size,
                imageData: null,
                title: isPrimary ? a.title : `${a.title} (view ${idx + 1})`,
                category: a.category,
                mainCategory: (a as any).mainCategory,
                productType: a.productType,
                tags: isPrimary ? a.tags : [],
                shopifyStatus: "pending",
                paymentStatus: uploadMode === "groupedPaid" ? "paid" : "unpaid",
                productContext: productContext || null,
                brandTone,
                productGroupId: groupId,
                sessionId,
              });
            }
            setImageBuffer(image.id, file.buffer);
            const storageUrl = await uploadFileToStorage(file, image.id);
            if (storageUrl) await storage.updateImage(image.id, { storageUrl } as any);
            return storageUrl ? { ...image, storageUrl } : image;
          } catch (err) {
            console.error(`Failed to store grouped image ${file.originalname}:`, err);
            const fallback = await storage.createImage({
              originalName: file.originalname,
              mimeType: file.mimetype,
              size: file.size,
              imageData: null,
              title: file.originalname.replace(/\.[^/.]+$/, ""),
              category: "Other",
              tags: [],
              shopifyStatus: "pending",
              paymentStatus: hasActiveSubscription ? "paid" : "unpaid",
              productContext: productContext || null,
              brandTone,
              productGroupId: groupId,
              sessionId,
            });
            setImageBuffer(fallback.id, file.buffer);
            const storageUrl = await uploadFileToStorage(file, fallback.id);
            if (storageUrl) await storage.updateImage(fallback.id, { storageUrl } as any);
            return storageUrl ? { ...fallback, storageUrl } : fallback;
          }
        }));

        return res.status(200).json(results);
      }

      // Default: process each image independently
      const results = await runWithConcurrency(files, CONCURRENCY_LIMIT, async (file) => {
        try {
          if (uploadMode === "singlePaid") {
            const analysis = await fullAnalyzeImage(file.buffer, file.mimetype, file.originalname, brandTone, productContext || undefined);
            const analysisSucceeded = analysis.description !== "Failed to analyze image.";

            const image = await storage.createImage({
              originalName: file.originalname,
              mimeType: file.mimetype,
              size: file.size,
              imageData: null,
              title: analysisSucceeded ? analysis.title : file.originalname.replace(/\.[^/.]+$/, ""),
              description: analysisSucceeded ? analysis.description : undefined,
              price: analysisSucceeded ? analysis.price : undefined,
              category: analysisSucceeded ? analysis.category : "Other",
              productType: analysisSucceeded ? analysis.productType : undefined,
              tags: analysisSucceeded ? analysis.tags : [],
              seoTitle: analysisSucceeded ? analysis.seoTitle : undefined,
              seoDescription: analysisSucceeded ? analysis.seoDescription : undefined,
              altText: analysisSucceeded ? analysis.altText : undefined,
              aeoFaqs: analysisSucceeded ? analysis.aeoFaqs : undefined,
              aeoSnippet: analysisSucceeded ? analysis.aeoSnippet : undefined,
              variants: analysisSucceeded ? analysis.variants : undefined,
              aiData: analysisSucceeded ? analysis : undefined,
              shopifyStatus: "pending",
              paymentStatus: "paid",
              productContext: productContext || null,
              brandTone,
              sessionId,
            });

            setImageBuffer(image.id, file.buffer);
            const storageUrl = await uploadFileToStorage(file, image.id);
            if (storageUrl) await storage.updateImage(image.id, { storageUrl } as any);
            return storageUrl ? { ...image, storageUrl } : image;
          }

          const preview = await quickPreviewImage(file.buffer, file.mimetype, file.originalname, productContext || undefined, brandTone);

          const image = await storage.createImage({
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            imageData: null,
            title: preview.title,
            category: preview.category,
            productType: preview.productType,
            tags: preview.tags,
            shopifyStatus: "pending",
            paymentStatus: "unpaid",
            productContext: productContext || null,
            brandTone,
            sessionId,
          });

          setImageBuffer(image.id, file.buffer);
          const storageUrl = await uploadFileToStorage(file, image.id);
          if (storageUrl) await storage.updateImage(image.id, { storageUrl } as any);
          return storageUrl ? { ...image, storageUrl } : image;
        } catch (err) {
          console.error(`Failed to process ${file.originalname}:`, err);
          const fallbackImage = await storage.createImage({
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            imageData: null,
            title: file.originalname.replace(/\.[^/.]+$/, ""),
            category: "Other",
            tags: [],
            shopifyStatus: "pending",
            paymentStatus: uploadMode === "singlePaid" ? "paid" : "unpaid",
            productContext: productContext || null,
            brandTone,
            sessionId,
          });
          setImageBuffer(fallbackImage.id, file.buffer);
          const storageUrl = await uploadFileToStorage(file, fallbackImage.id);
          if (storageUrl) await storage.updateImage(fallbackImage.id, { storageUrl } as any);
          return storageUrl ? { ...fallbackImage, storageUrl } : fallbackImage;
        }
      });

      res.status(200).json(results);
    } catch (error: any) {
      console.error("Upload error:", error);
      res.status(500).json({ message: error?.message || "Internal server error during upload processing" });
    }
  });

  app.get("/api/images", requireAuth(), async (req, res) => {
    try {
      const sessionId = getUserId(req);
      const allImages = await storage.listImages(sessionId);
      res.json(allImages);
    } catch (error) {
      console.error("GET /api/images error for user", (error as any)?.message || error);
      res.status(500).json({ message: "Failed to fetch images" });
    }
  });

  app.get("/api/images/:id/group", requireAuth(), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const sessionId = getUserId(req);
      const group = await storage.getImageGroup(id, sessionId);
      res.json(group);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch product group" });
    }
  });

  // Unlink an image from its product group — sends it back to the library as a standalone image
  app.post("/api/images/:id/unlink-from-group", requireAuth(), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const sessionId = getUserId(req);
      const image = await storage.getImage(id);
      if (!image || image.sessionId !== sessionId) return res.status(404).json({ message: "Image not found" });
      await storage.updateImage(id, { productGroupId: null } as any);
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to unlink image" });
    }
  });

  // Batch-assign multiple images to a product group in one request
  app.post("/api/images/assign-group-batch", requireAuth(), async (req, res) => {
    try {
      const sessionId = getUserId(req);
      const { imageIds, productGroupId, primaryImageId } = req.body as { imageIds: number[]; productGroupId: string; primaryImageId?: number };
      if (!productGroupId || !Array.isArray(imageIds) || imageIds.length === 0) {
        return res.status(400).json({ message: "imageIds array and productGroupId required" });
      }
      let updated = 0;
      for (const id of imageIds) {
        const img = await storage.getImage(id);
        if (img && img.sessionId === sessionId) {
          await storage.updateImage(id, { productGroupId } as any);
          updated++;
        } else {
          console.warn(`assign-group-batch: skipped image ${id} — not found or sessionId mismatch (expected ${sessionId}, got ${img?.sessionId})`);
        }
      }
      // Also assign the primary image to the group if it wasn't already in one
      if (primaryImageId) {
        const primary = await storage.getImage(primaryImageId);
        if (primary && primary.sessionId === sessionId && !primary.productGroupId) {
          await storage.updateImage(primaryImageId, { productGroupId } as any);
          updated++;
        }
      }
      res.json({ ok: true, updated });
    } catch (error: any) {
      console.error("assign-group-batch error:", error);
      res.status(500).json({ message: "Failed to assign images to group", details: error?.message });
    }
  });

  // Assign an existing image to a product group (share/move to current product)
  app.post("/api/images/:id/assign-group", requireAuth(), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const sessionId = getUserId(req);
      const { productGroupId, primaryImageId } = req.body as { productGroupId: string; primaryImageId?: number };
      if (!productGroupId) return res.status(400).json({ message: "productGroupId required" });
      const image = await storage.getImage(id);
      if (!image || image.sessionId !== sessionId) return res.status(404).json({ message: "Image not found" });
      await storage.updateImage(id, { productGroupId } as any);
      // Also assign the primary image to the group if it wasn't already in one
      if (primaryImageId && primaryImageId !== id) {
        const primary = await storage.getImage(primaryImageId);
        if (primary && primary.sessionId === sessionId && !primary.productGroupId) {
          await storage.updateImage(primaryImageId, { productGroupId } as any);
        }
      }
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to assign image to group" });
    }
  });

  app.get("/api/images/:id/file", requireAuth(), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const userId = getUserId(req);
      const shouldProxy = req.query.proxy === "1";

      // Always fetch image record to check ownership and storageUrl
      const image = await storage.getImage(id);
      if (!image || image.sessionId !== userId) {
        return res.status(404).json({ message: "Image not found" });
      }

      // Fast path for normal image tags: redirect to Supabase Storage URL.
      // Some client flows need same-origin bytes (e.g. blob fetches), so allow
      // an explicit proxy mode that streams through this route instead.
      if ((image as any).storageUrl && !shouldProxy) {
        return res.redirect(302, (image as any).storageUrl);
      }

      const buffer = await loadImageBuffer(image);
      if (!buffer) {
        return res.status(404).json({ message: "Image data not found" });
      }

      res.set({
        'Content-Type': image.mimeType,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'public, max-age=604800, immutable',
      });
      res.send(buffer);
    } catch (error) {
      res.status(500).json({ message: "Failed to serve image" });
    }
  });

  app.put("/api/images/:id", requireAuth(), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const image = await storage.getImage(id);
      if (!image || image.sessionId !== getUserId(req)) {
        return res.status(404).json({ message: "Image not found" });
      }
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid update data", field: parsed.error.errors[0]?.path.join('.') });
      }

      // Convert empty strings to null for numeric fields to prevent Postgres syntax errors
      const updatePayload = { ...parsed.data };
      if (updatePayload.price === "") updatePayload.price = null;
      if (updatePayload.compareAtPrice === "") updatePayload.compareAtPrice = null;
      if (updatePayload.costPerItem === "") updatePayload.costPerItem = null;

      const updated = await storage.updateImage(id, updatePayload);
      if (!updated) {
        return res.status(404).json({ message: "Image not found" });
      }
      res.json(updated);
    } catch (error: any) {
      console.error("Update image error:", error);
      res.status(500).json({ message: "Failed to update image", details: error.message || String(error) });
    }
  });

  app.delete("/api/images/:id", requireAuth(), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const image = await storage.getImage(id);
      if (!image || image.sessionId !== getUserId(req)) {
        return res.status(404).json({ message: "Image not found" });
      }
      imageBuffers.delete(id);
      await storage.deleteImage(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete image" });
    }
  });

  app.delete("/api/images/group/:groupId", requireAuth(), async (req, res) => {
    try {
      const groupId = String(req.params.groupId);
      const sessionId = getUserId(req);
      const count = await storage.deleteImagesByGroupId(groupId, sessionId);
      if (count === 0) {
        return res.status(404).json({ message: "No images found for this product group" });
      }
      res.status(200).json({ deleted: count });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete product group" });
    }
  });

  app.get("/api/shopify/oauth/start", requireAuth(), async (req, res) => {
    try {
      const { apiKey, apiSecret, scopes, appBaseUrl } = getShopifyOAuthConfig();
      if (!apiKey || !apiSecret) {
        return res.status(500).json({ message: "Shopify OAuth is not configured. Set SHOPIFY_API_KEY and SHOPIFY_API_SECRET." });
      }

      const rawShop = Array.isArray(req.query.shop) ? req.query.shop[0] : req.query.shop;
      const shop = typeof rawShop === "string" ? normalizeShopifyDomain(rawShop) : "";
      if (!shop || !isValidShopifyDomain(shop)) {
        return res.status(400).json({ message: "Invalid Shopify shop domain. Use your-store.myshopify.com." });
      }

      const redirectUri = `${appBaseUrl}/api/shopify/oauth/callback`;
      const state = createShopifyOAuthState(getUserId(req), apiSecret);
      const authUrl = buildShopifyOAuthAuthorizeUrl({
        shop,
        apiKey,
        scopes,
        redirectUri,
        state,
      });

      res.redirect(authUrl);
    } catch (error) {
      console.error("Shopify OAuth start error:", error);
      res.status(500).json({ message: "Failed to start Shopify authorization" });
    }
  });

  app.get("/api/shopify/oauth/callback", async (req, res) => {
    const fail = (reason: string) => {
      const redirect = new URL("/", getShopifyOAuthConfig().appBaseUrl);
      redirect.searchParams.set("shopify", "error");
      redirect.searchParams.set("reason", reason);
      return res.redirect(redirect.toString());
    };

    try {
      const { apiKey, apiSecret, scopes, appBaseUrl } = getShopifyOAuthConfig();
      if (!apiKey || !apiSecret) {
        return fail("not_configured");
      }

      const code = typeof req.query.code === "string" ? req.query.code : "";
      const rawShop = Array.isArray(req.query.shop) ? req.query.shop[0] : req.query.shop;
      const shop = typeof rawShop === "string" ? normalizeShopifyDomain(rawShop) : "";
      const state = typeof req.query.state === "string" ? req.query.state : "";

      if (!code) return fail("missing_code");
      if (!shop || !isValidShopifyDomain(shop)) return fail("invalid_shop");
      if (!verifyShopifyHmac(req.query as Record<string, unknown>, apiSecret)) return fail("invalid_hmac");

      const stateResult = verifyShopifyOAuthState(state, apiSecret);
      if (!stateResult.ok) return fail(`invalid_state_${stateResult.reason}`);

      const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: apiKey,
          client_secret: apiSecret,
          code,
        }),
      });

      if (!tokenResponse.ok) {
        const body = await tokenResponse.text();
        console.error("Shopify OAuth token exchange failed:", tokenResponse.status, body);
        return fail("token_exchange_failed");
      }

      const tokenData = await tokenResponse.json() as { access_token?: string; scope?: string };
      const accessToken = tokenData.access_token;
      if (!accessToken) return fail("token_exchange_failed");

      const grantedScopes = new Set((tokenData.scope || "").split(",").map(scope => scope.trim()).filter(Boolean));
      const requiredScopes = scopes.split(",").map(scope => scope.trim()).filter(Boolean);
      const missingScopes = requiredScopes.filter(scope => !grantedScopes.has(scope));
      if (missingScopes.length > 0) {
        return fail("missing_inventory_scopes");
      }

      const shopIdentity = await getShopifyShopIdentity({
        shopDomain: shop,
        accessToken,
      });
      const shopName = shopIdentity.name || shop.replace(".myshopify.com", "");

      await storage.upsertShopifyConnection({
        sessionId: stateResult.userId,
        shopDomain: shop,
        accessToken: encryptShopifyToken(accessToken),
        shopName,
        grantedScopes: Array.from(grantedScopes),
      });

      const redirect = new URL("/", appBaseUrl);
      redirect.searchParams.set("shopify", "connected");
      res.redirect(redirect.toString());
    } catch (error) {
      console.error("Shopify OAuth callback error:", error);
      return fail("unexpected_error");
    }
  });

  app.post("/api/shopify/connect", requireAuth(), async (req, res) => {
    try {
      const { shopDomain, accessToken } = req.body;
      if (!shopDomain || !accessToken) {
        return res.status(400).json({ message: "Store URL and access token are required" });
      }

      const domain = shopDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
      const fullDomain = domain.includes('.myshopify.com') ? domain : `${domain}.myshopify.com`;

      const shopIdentity = await getShopifyShopIdentity({
        shopDomain: fullDomain,
        accessToken,
      });
      const shopName = shopIdentity.name || fullDomain.replace('.myshopify.com', '');

      await storage.upsertShopifyConnection({
        sessionId: getUserId(req),
        shopDomain: fullDomain,
        accessToken: encryptShopifyToken(accessToken),
        shopName,
        grantedScopes: shopIdentity.grantedScopes,
      });

      res.json({ connected: true, shopName, shopDomain: fullDomain });
    } catch (error) {
      console.error("Shopify connect error:", error);
      res.status(500).json({ message: "Failed to connect to Shopify" });
    }
  });

  app.post("/api/shopify/disconnect", requireAuth(), async (req, res) => {
    try {
      const userId = getUserId(req);
      await disableInventoryForUser(userId);
      await storage.deleteShopifyConnection(userId);
      res.json({ disconnected: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to disconnect" });
    }
  });

  app.get("/api/shopify/status", requireAuth(), async (req, res) => {
    try {
      const connection = await storage.getShopifyConnection(getUserId(req));
      if (connection) {
        return res.json({
          connected: true,
          shopName: connection.shopName || connection.shopDomain,
          shopDomain: connection.shopDomain,
          grantedScopes: connection.grantedScopes || [],
          inventoryReady: [
            "read_products",
            "write_products",
            "read_inventory",
            "write_inventory",
            "read_locations",
          ].every(scope => connection.grantedScopes?.includes(scope)),
        });
      }
      return res.json({ connected: false });
    } catch {
      return res.json({ connected: false });
    }
  });

  app.post("/api/images/push-to-shopify", requireAuth(), async (req, res) => {
    try {
      const { ids } = req.body;
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "No image IDs provided" });
      }

      const connection = await storage.getShopifyConnection(getUserId(req));
      if (!connection) {
        return res.status(400).json({ message: "Shopify not connected. Please connect your store first." });
      }
      const selectedImages = await storage.getImagesByIds(ids);
      const imagesToPush = selectedImages.filter(img => img.sessionId === getUserId(req));
      if (imagesToPush.length === 0) {
        return res.status(400).json({ message: "No images found for given IDs" });
      }

      const unpaidImages = imagesToPush.filter(img => img.paymentStatus !== 'paid');
      if (unpaidImages.length > 0) {
        return res.status(402).json({
          message: `${unpaidImages.length} product(s) have not been unlocked yet. Pay for full AI analysis before pushing to Shopify.`,
          unpaidCount: unpaidImages.length,
        });
      }

      // Load all user images (without imageData blob) to find companion views
      const allUserImages = await storage.listImages(getUserId(req));

      type ListedImage = typeof allUserImages[0];
      // Pre-build groupId → sorted members map in one pass — O(n) not O(n²)
      const groupMap = new Map<string, ListedImage[]>();
      for (const img of allUserImages) {
        if (img.productGroupId) {
          const arr = groupMap.get(img.productGroupId) ?? [];
          arr.push(img);
          groupMap.set(img.productGroupId, arr);
        }
      }
      const sortGroupByMediaGallery = (arr: ListedImage[]) => {
        const source = arr.find((item: any) => Array.isArray(item.mediaGallery) && item.mediaGallery.length > 0);
        const orderedIds = Array.isArray((source as any)?.mediaGallery)
          ? (source as any).mediaGallery.map((id: unknown) => Number(id)).filter((id: number) => Number.isFinite(id))
          : [];
        const rank = new Map<number, number>(orderedIds.map((id: number, index: number) => [id, index]));

        arr.sort((a: ListedImage, b: ListedImage) => {
          const aRank = rank.get(a.id);
          const bRank = rank.get(b.id);
          if (aRank !== undefined || bRank !== undefined) {
            return (aRank ?? Number.MAX_SAFE_INTEGER) - (bRank ?? Number.MAX_SAFE_INTEGER) || a.id - b.id;
          }
          if (a.description && !b.description) return -1;
          if (!a.description && b.description) return 1;
          return a.id - b.id;
        });
      };

      // Sort each group by saved media order, with the previous primary-first fallback.
      groupMap.forEach((arr) => {
        sortGroupByMediaGallery(arr);
      });

      const processedGroups = new Set<string>();
      type ProductEntry = { primary: ListedImage; views: ListedImage[] };
      const productsToPush: ProductEntry[] = [];

      for (const img of imagesToPush) {
        if (img.productGroupId) {
          if (processedGroups.has(img.productGroupId)) continue;
          processedGroups.add(img.productGroupId);
          const group: ListedImage[] = groupMap.get(img.productGroupId) ?? [img as unknown as ListedImage];
          productsToPush.push({ primary: group[0], views: group.slice(1) });
        } else {
          productsToPush.push({ primary: img as unknown as ListedImage, views: [] });
        }
      }

      // Build a lookup of full image rows (with imageData + aiData) from the selected IDs
      const fullImageMap = new Map<number, typeof selectedImages[0]>();
      for (const img of selectedImages) fullImageMap.set(img.id, img);

      let successCount = 0;
      let failCount = 0;
      const results: { id: number; shopifyProductId?: string; error?: string }[] = [];

      for (const { primary, views } of productsToPush) {
        // Fetch full row (with imageData & aiData) for primary and views if not already loaded
        const allNeededIds = [primary.id, ...views.map(v => v.id)];
        const missingIds = allNeededIds.filter(id => !fullImageMap.has(id));
        if (missingIds.length > 0) {
          const missingImages = await storage.getImagesByIds(missingIds);
          for (const img of missingImages) fullImageMap.set(img.id, img);
        }

        const fullPrimary = (fullImageMap.get(primary.id) || primary) as any;
        const viewData = await Promise.all(views.map(async v => {
          const fullView = (fullImageMap.get(v.id) || v) as any;
          return {
            image: fullView,
          };
        }));
        const result = await pushProductToShopify(fullPrimary, connection, viewData);
        if (result.shopifyProductId) {
          await registerPublishedShopifyProduct({
            userId: getUserId(req),
            image: fullPrimary,
            productId: result.shopifyProductId,
            variants: result.variants || [],
          });
          // Batch-update all images in the group in one query
          if (primary.productGroupId) {
            await storage.updateImagesByGroupId(primary.productGroupId, {
              shopifyProductId: result.shopifyProductId,
              shopifyStatus: "synced",
            });
          } else {
            await storage.updateImage(primary.id, { shopifyProductId: result.shopifyProductId, shopifyStatus: "synced" });
          }
          successCount++;
          results.push({ id: primary.id, shopifyProductId: result.shopifyProductId });
        } else {
          await storage.updateImage(primary.id, { shopifyStatus: "failed" });
          failCount++;
          results.push({ id: primary.id, error: result.error });
        }
        // No artificial delay — 429s from Shopify are handled inside pushProductToShopify
      }

      res.json({ success: successCount, failed: failCount, results });
    } catch (error: any) {
      console.error("Shopify push error:", error);
      if (isDatabaseConnectionLimitError(error)) {
        return res.status(503).json({
          message: "The database is still clearing old connections. Please wait 1-2 minutes and try pushing to Shopify again.",
          code: "DATABASE_CONNECTION_LIMIT",
        });
      }
      res.status(500).json({ message: error?.message || "Failed to push products to Shopify" });
    }
  });

  app.post("/api/etsy/connect", requireAuth(), async (req, res) => {
    try {
      const { apiKeystring, accessToken, shopId } = req.body;
      if (!apiKeystring || !accessToken || !shopId) {
        return res.status(400).json({ message: "API key, access token, and shop ID are required" });
      }

      const shopResponse = await fetch(`https://api.etsy.com/v3/application/shops/${shopId}`, {
        headers: {
          'x-api-key': apiKeystring,
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!shopResponse.ok) {
        const errorText = await shopResponse.text().catch(() => '');
        console.error("Etsy connect validation failed:", shopResponse.status, errorText);
        return res.status(400).json({ message: "Could not connect to Etsy. Please check your API key, access token, and shop ID." });
      }

      const shopData = await shopResponse.json();
      const shopName = shopData.shop_name || `Shop ${shopId}`;

      await storage.upsertEtsyConnection({
        sessionId: getUserId(req),
        apiKeystring,
        accessToken,
        shopId: String(shopId),
        shopName,
      });

      res.json({ connected: true, shopName, shopId: String(shopId) });
    } catch (error) {
      console.error("Etsy connect error:", error);
      res.status(500).json({ message: "Failed to connect to Etsy" });
    }
  });

  app.post("/api/etsy/disconnect", requireAuth(), async (req, res) => {
    try {
      await storage.deleteEtsyConnection(getUserId(req));
      res.json({ disconnected: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to disconnect" });
    }
  });

  app.get("/api/etsy/status", requireAuth(), async (req, res) => {
    try {
      const connection = await storage.getEtsyConnection(getUserId(req));
      if (connection) {
        return res.json({
          connected: true,
          shopName: connection.shopName || `Shop ${connection.shopId}`,
          shopId: connection.shopId,
        });
      }
      return res.json({ connected: false });
    } catch {
      return res.json({ connected: false });
    }
  });

  app.post("/api/amazon/connect", requireAuth(), async (req, res) => {
    try {
      const { lwaClientId, lwaClientSecret, lwaRefreshToken, sellerId, marketplaceId } = req.body;
      if (!lwaClientId || !lwaClientSecret || !lwaRefreshToken || !sellerId || !marketplaceId) {
        return res.status(400).json({ message: "All Amazon SP-API credentials are required: LWA Client ID, Client Secret, Refresh Token, Seller ID, and Marketplace ID" });
      }

      try {
        await getAmazonAccessToken({ lwaClientId, lwaClientSecret, lwaRefreshToken });
      } catch (tokenErr: any) {
        console.error("Amazon credential validation failed:", tokenErr.message);
        return res.status(400).json({ message: "Could not validate Amazon credentials. Please check your LWA Client ID, Client Secret, and Refresh Token." });
      }

      await storage.upsertAmazonConnection({
        sessionId: getUserId(req),
        sellerId,
        marketplaceId,
        lwaClientId,
        lwaClientSecret,
        lwaRefreshToken,
        sellerName: `Seller ${sellerId.substring(0, 6)}`,
      });

      res.json({ connected: true, sellerId, marketplaceId, sellerName: `Seller ${sellerId.substring(0, 6)}` });
    } catch (error) {
      console.error("Amazon connect error:", error);
      res.status(500).json({ message: "Failed to connect to Amazon" });
    }
  });

  app.post("/api/amazon/disconnect", requireAuth(), async (req, res) => {
    try {
      await storage.deleteAmazonConnection(getUserId(req));
      res.json({ disconnected: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to disconnect" });
    }
  });

  app.get("/api/amazon/status", requireAuth(), async (req, res) => {
    try {
      const connection = await storage.getAmazonConnection(getUserId(req));
      if (connection) {
        return res.json({
          connected: true,
          sellerName: connection.sellerName || `Seller ${connection.sellerId.substring(0, 6)}`,
          sellerId: connection.sellerId,
          marketplaceId: connection.marketplaceId,
        });
      }
      return res.json({ connected: false });
    } catch {
      return res.json({ connected: false });
    }
  });

  app.post("/api/images/push-to-etsy", requireAuth(), async (req, res) => {
    try {
      const { ids } = req.body;
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "No image IDs provided" });
      }

      const connection = await storage.getEtsyConnection(getUserId(req));
      if (!connection) {
        return res.status(400).json({ message: "Etsy not connected. Please connect your store first." });
      }

      const allImages = await storage.getImagesByIds(ids);
      const imagesToPush = allImages.filter(img => img.sessionId === getUserId(req));
      if (imagesToPush.length === 0) {
        return res.status(400).json({ message: "No images found for given IDs" });
      }

      const unpaidImages = imagesToPush.filter(img => img.paymentStatus !== 'paid');
      if (unpaidImages.length > 0) {
        return res.status(402).json({
          message: `${unpaidImages.length} product(s) have not been unlocked yet.`,
          unpaidCount: unpaidImages.length,
        });
      }

      let successCount = 0;
      let failCount = 0;
      const results: { id: number; etsyListingId?: string; error?: string }[] = [];

      for (const image of imagesToPush) {
        const buffer = await loadImageBuffer(image);
        const result = await pushProductToEtsy(image, connection, buffer || undefined);
        if (result.etsyListingId) {
          await storage.updateImage(image.id, {
            etsyListingId: result.etsyListingId,
            etsyStatus: "synced",
          });
          successCount++;
          results.push({ id: image.id, etsyListingId: result.etsyListingId });
        } else {
          await storage.updateImage(image.id, { etsyStatus: "failed" });
          failCount++;
          results.push({ id: image.id, error: result.error });
        }
      }

      res.json({ success: successCount, failed: failCount, results });
    } catch (error) {
      console.error("Etsy push error:", error);
      res.status(500).json({ message: "Failed to push products to Etsy" });
    }
  });

  // Instagram routes

  app.get("/api/instagram/oauth/config", requireAuth(), async (_req, res) => {
    const appId = process.env.FACEBOOK_APP_ID;
    if (!appId) {
      return res.json({ configured: false });
    }
    return res.json({ configured: true });
  });

  app.get("/api/instagram/oauth/start", requireAuth(), async (req, res) => {
    try {
      const appId = process.env.FACEBOOK_APP_ID;
      const appSecret = process.env.FACEBOOK_APP_SECRET;
      if (!appId || !appSecret) {
        return res.status(400).json({ message: "Instagram OAuth is not configured. Please add your Facebook App credentials." });
      }

      const userId = getUserId(req);
      const nonce = crypto.randomBytes(16).toString("hex");
      const payload = JSON.stringify({ userId, nonce, ts: Date.now() });
      const sig = crypto.createHmac("sha256", appSecret).update(payload).digest("hex");
      const state = Buffer.from(JSON.stringify({ payload, sig })).toString("base64url");

      const proto = req.headers["x-forwarded-proto"] || req.protocol;
      const redirectUri = `${proto}://${req.get("host")}/api/instagram/oauth/callback`;

      const configId = process.env.FACEBOOK_CONFIG_ID;
      if (!configId) {
        return res.status(400).json({ message: "Instagram OAuth is not fully configured. Please add your Facebook Login Configuration ID." });
      }

      const authUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&config_id=${configId}&response_type=code&state=${state}`;

      res.json({ authUrl });
    } catch (error) {
      console.error("Instagram OAuth start error:", error);
      res.status(500).json({ message: "Failed to start Instagram connection" });
    }
  });

  app.get("/api/instagram/oauth/callback", async (req, res) => {
    try {
      const { code, state, error: fbError, error_description } = req.query;

      if (fbError) {
        console.error("Facebook OAuth error:", fbError, error_description);
        return res.send(`<html><body><script>window.opener?.postMessage({type:'instagram-oauth-error',message:'${String(error_description || fbError)}'},'*');window.close();</script><p>Connection failed. You can close this window.</p></body></html>`);
      }

      if (!code || !state) {
        return res.status(400).send(`<html><body><script>window.opener?.postMessage({type:'instagram-oauth-error',message:'Missing authorization code'},'*');window.close();</script><p>Missing authorization code. You can close this window.</p></body></html>`);
      }

      const appId = process.env.FACEBOOK_APP_ID;
      const appSecret = process.env.FACEBOOK_APP_SECRET;
      if (!appId || !appSecret) {
        return res.status(500).send("Instagram OAuth not configured");
      }

      let userId: string;
      try {
        const decoded = JSON.parse(Buffer.from(String(state), "base64url").toString());
        const expectedSig = crypto.createHmac("sha256", appSecret).update(decoded.payload).digest("hex");
        if (expectedSig !== decoded.sig) {
          throw new Error("Invalid signature");
        }
        const payloadData = JSON.parse(decoded.payload);
        const MAX_STATE_AGE_MS = 10 * 60 * 1000;
        if (Date.now() - payloadData.ts > MAX_STATE_AGE_MS) {
          throw new Error("State expired");
        }
        userId = payloadData.userId;
      } catch (stateErr: any) {
        console.error("Instagram OAuth state validation failed:", stateErr?.message);
        return res.send(`<html><body><script>window.opener?.postMessage({type:'instagram-oauth-error',message:'Session expired or invalid. Please try again.'},'*');window.close();</script><p>Session expired. You can close this window.</p></body></html>`);
      }

      const proto = req.headers["x-forwarded-proto"] || req.protocol;
      const redirectUri = `${proto}://${req.get("host")}/api/instagram/oauth/callback`;

      const tokenRes = await fetch(
        `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`
      );
      if (!tokenRes.ok) {
        const errText = await tokenRes.text().catch(() => "");
        console.error("Facebook token exchange failed:", tokenRes.status, errText);
        return res.send(`<html><body><script>window.opener?.postMessage({type:'instagram-oauth-error',message:'Failed to exchange authorization code'},'*');window.close();</script><p>Connection failed. You can close this window.</p></body></html>`);
      }
      const tokenData = await tokenRes.json();
      const shortLivedToken = tokenData.access_token;

      const longTokenRes = await fetch(
        `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortLivedToken}`
      );
      let accessToken = shortLivedToken;
      if (longTokenRes.ok) {
        const longTokenData = await longTokenRes.json();
        accessToken = longTokenData.access_token || shortLivedToken;
      }

      let igUserId: string | null = null;
      let finalToken = accessToken;
      let username = "";

      const igAccountsRes = await fetch(`https://graph.facebook.com/v21.0/me/instagram_accounts?fields=id,username&access_token=${accessToken}`);
      if (igAccountsRes.ok) {
        const igAccountsData = await igAccountsRes.json();
        console.log("Instagram accounts response:", JSON.stringify(igAccountsData));
        if (igAccountsData.data?.length > 0) {
          igUserId = igAccountsData.data[0].id;
          username = igAccountsData.data[0].username || `user_${igUserId}`;
        }
      } else {
        console.log("Instagram accounts endpoint failed, trying Pages approach...");
      }

      if (!igUserId) {
        const pagesRes = await fetch(`https://graph.facebook.com/v21.0/me/accounts?fields=id,name,instagram_business_account&access_token=${accessToken}`);
        if (pagesRes.ok) {
          const pagesData = await pagesRes.json();
          console.log("Facebook Pages response:", JSON.stringify(pagesData));
          for (const page of pagesData.data || []) {
            if (page.instagram_business_account?.id) {
              igUserId = page.instagram_business_account.id;
              const pageTokenRes = await fetch(`https://graph.facebook.com/v21.0/${page.id}?fields=access_token&access_token=${accessToken}`);
              if (pageTokenRes.ok) {
                const pageTokenData = await pageTokenRes.json();
                finalToken = pageTokenData.access_token || accessToken;
              }
              break;
            }
          }
        }

        if (igUserId && !username) {
          const igProfileRes = await fetch(`https://graph.instagram.com/v21.0/${igUserId}?fields=id,username&access_token=${finalToken}`);
          if (igProfileRes.ok) {
            const igProfile = await igProfileRes.json();
            username = igProfile.username || `user_${igUserId}`;
          } else {
            username = `user_${igUserId}`;
          }
        }
      }

      if (!igUserId) {
        const meRes = await fetch(`https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${accessToken}`);
        const meData = meRes.ok ? await meRes.json() : {};
        console.log("Facebook me response:", JSON.stringify(meData));
        return res.send(`<html><body><script>window.opener?.postMessage({type:'instagram-oauth-error',message:'Could not find your Instagram account. Make sure your Instagram Business or Creator account is linked to a Facebook Page and that you selected it during login.'},'*');window.close();</script><p>No Instagram account found. You can close this window.</p></body></html>`);
      }

      await storage.upsertInstagramConnection({
        sessionId: userId,
        accessToken: finalToken,
        igUserId: String(igUserId),
        username,
      });

      res.send(`<html><body><script>window.opener?.postMessage({type:'instagram-oauth-success',username:'${username}'},'*');window.close();</script><p>Connected as @${username}! You can close this window.</p></body></html>`);
    } catch (error) {
      console.error("Instagram OAuth callback error:", error);
      res.send(`<html><body><script>window.opener?.postMessage({type:'instagram-oauth-error',message:'An unexpected error occurred'},'*');window.close();</script><p>Connection failed. You can close this window.</p></body></html>`);
    }
  });

  app.post("/api/instagram/connect", requireAuth(), async (req, res) => {
    try {
      const { accessToken } = req.body;
      if (!accessToken) {
        return res.status(400).json({ message: "Access token is required" });
      }

      const igResponse = await fetch(`https://graph.instagram.com/v21.0/me?fields=id,username&access_token=${accessToken}`);
      if (!igResponse.ok) {
        const errorText = await igResponse.text().catch(() => '');
        console.error("Instagram connect validation failed:", igResponse.status, errorText);
        return res.status(400).json({ message: "Could not connect to Instagram. Please check your access token." });
      }

      const igData = await igResponse.json();
      const igUserId = igData.id;
      const username = igData.username || `user_${igUserId}`;

      if (!igUserId) {
        return res.status(400).json({ message: "Could not retrieve your Instagram account. Make sure the token has instagram_business_basic permission and the account is a Business or Creator account." });
      }

      await storage.upsertInstagramConnection({
        sessionId: getUserId(req),
        accessToken,
        igUserId: String(igUserId),
        username,
      });

      res.json({ connected: true, username, igUserId: String(igUserId) });
    } catch (error) {
      console.error("Instagram connect error:", error);
      res.status(500).json({ message: "Failed to connect to Instagram" });
    }
  });

  app.post("/api/instagram/disconnect", requireAuth(), async (req, res) => {
    try {
      await storage.deleteInstagramConnection(getUserId(req));
      res.json({ disconnected: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to disconnect" });
    }
  });

  app.get("/api/instagram/status", requireAuth(), async (req, res) => {
    try {
      const connection = await storage.getInstagramConnection(getUserId(req));
      if (connection) {
        return res.json({
          connected: true,
          username: connection.username || `user_${connection.igUserId}`,
          igUserId: connection.igUserId,
        });
      }
      return res.json({ connected: false });
    } catch {
      return res.json({ connected: false });
    }
  });

  app.post("/api/instagram/import-media", requireAuth(), async (req, res) => {
    try {
      const connection = await storage.getInstagramConnection(getUserId(req));
      if (!connection) {
        return res.status(400).json({ message: "Instagram not connected. Please connect your account first." });
      }

      const { mediaIds, productContext, brandTone } = req.body;
      const limit = req.body.limit || 20;

      let mediaItems: any[] = [];

      if (mediaIds && Array.isArray(mediaIds) && mediaIds.length > 0) {
        const mediaPromises = mediaIds.map(async (mediaId: string) => {
          const mediaRes = await fetch(
            `https://graph.instagram.com/v21.0/${mediaId}?fields=id,caption,media_type,media_url,thumbnail_url,timestamp&access_token=${connection.accessToken}`
          );
          if (mediaRes.ok) return mediaRes.json();
          return null;
        });
        const results = await Promise.all(mediaPromises);
        mediaItems = results.filter(Boolean);
      } else {
        const feedRes = await fetch(
          `https://graph.instagram.com/v21.0/${connection.igUserId}/media?fields=id,caption,media_type,media_url,thumbnail_url,timestamp&limit=${limit}&access_token=${connection.accessToken}`
        );
        if (!feedRes.ok) {
          const errText = await feedRes.text().catch(() => '');
          console.error("Instagram media fetch failed:", feedRes.status, errText);
          return res.status(400).json({ message: "Failed to fetch Instagram media. Your access token may have expired." });
        }
        const feedData = await feedRes.json();
        mediaItems = feedData.data || [];
      }

      const imageMedia = mediaItems.filter((m: any) => m.media_type === 'IMAGE' || m.media_type === 'CAROUSEL_ALBUM');

      if (imageMedia.length === 0) {
        return res.json({ imported: 0, message: "No image posts found." });
      }

      const userId = getUserId(req);
      const sub = await storage.getSubscription(userId);
      const isSubscribed = sub && sub.status === 'active' && (!sub.currentPeriodEnd || new Date(sub.currentPeriodEnd) > new Date());

      const importedImages: any[] = [];

      for (const media of imageMedia) {
        const imageUrl = media.media_url || media.thumbnail_url;
        if (!imageUrl) continue;

        try {
          const imgRes = await fetch(imageUrl);
          if (!imgRes.ok) continue;
          const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
          const mimeType = imgRes.headers.get('content-type') || 'image/jpeg';
          const originalName = `instagram_${media.id}.jpg`;

          if (isSubscribed) {
            const analysis = await fullAnalyzeImage(imgBuffer, mimeType, originalName, brandTone || 'professional', productContext);
            const newImage = await storage.createImage({
              originalName,
              mimeType,
              size: imgBuffer.length,
              imageData: imgBuffer.toString('base64'),
              title: analysis.title,
              description: analysis.description,
              price: analysis.price,
              category: analysis.category,
              productType: analysis.productType,
              tags: analysis.tags,
              seoTitle: analysis.seoTitle,
              seoDescription: analysis.seoDescription,
              altText: analysis.altText,
              aeoFaqs: analysis.aeoFaqs,
              aeoSnippet: analysis.aeoSnippet,
              variants: analysis.variants,
              paymentStatus: 'paid',
              productContext: productContext || media.caption || null,
              brandTone: brandTone || 'professional',
              aiData: analysis,
              sessionId: userId,
            });
            setImageBuffer(newImage.id, imgBuffer);
            importedImages.push(newImage);
          } else {
            const preview = await quickPreviewImage(imgBuffer, mimeType, originalName, productContext || media.caption, brandTone);
            const newImage = await storage.createImage({
              originalName,
              mimeType,
              size: imgBuffer.length,
              imageData: imgBuffer.toString('base64'),
              title: preview.title,
              category: preview.category,
              productType: preview.productType,
              tags: preview.tags,
              paymentStatus: 'unpaid',
              productContext: productContext || media.caption || null,
              brandTone: brandTone || 'professional',
              sessionId: userId,
            });
            setImageBuffer(newImage.id, imgBuffer);
            importedImages.push(newImage);
          }
        } catch (imgErr) {
          console.error(`Failed to import Instagram media ${media.id}:`, imgErr);
        }
      }

      res.json({ imported: importedImages.length, images: importedImages });
    } catch (error) {
      console.error("Instagram import error:", error);
      res.status(500).json({ message: "Failed to import from Instagram" });
    }
  });

  app.post("/api/instagram/generate-caption", requireAuth(), async (req, res) => {
    try {
      const { imageId } = req.body;
      if (!imageId) {
        return res.status(400).json({ message: "Image ID is required" });
      }

      const image = await storage.getImage(imageId);
      if (!image || image.sessionId !== getUserId(req)) {
        return res.status(404).json({ message: "Image not found" });
      }

      const tone = image.brandTone || 'professional';
      const toneGuide = toneInstructions[tone] || toneInstructions.professional;

      const response = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: [
          {
            role: "system",
            content: `You are a social media marketing expert. Generate an engaging Instagram post caption for a product. ${toneGuide}

Include:
- Engaging hook in the first line
- Product highlights and benefits
- Call to action (e.g., "Shop now", "Link in bio")
- 15-20 relevant hashtags

Respond with JSON:
{
  "caption": "Full Instagram caption with line breaks using \\n",
  "hashtags": ["hashtag1", "hashtag2", ...]
}`
          },
          {
            role: "user",
            content: `Generate an Instagram caption for:
Title: ${image.title || image.originalName}
Description: ${image.description || 'N/A'}
Price: ${image.price || 'N/A'}
Category: ${image.category || 'N/A'}
Tags: ${(image.tags || []).join(', ')}`
          },
        ],
        max_completion_tokens: 1000,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0].message.content || "";
      let parsed: any;
      try {
        parsed = JSON.parse(content);
      } catch {
        const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '');
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
      }

      if (parsed) {
        const fullCaption = parsed.caption + '\n\n' + (parsed.hashtags || []).map((h: string) => h.startsWith('#') ? h : `#${h}`).join(' ');
        await storage.updateImage(imageId, { instagramCaption: fullCaption });
        res.json({ caption: fullCaption, hashtags: parsed.hashtags || [] });
      } else {
        res.status(500).json({ message: "Failed to generate caption" });
      }
    } catch (error) {
      console.error("Caption generation error:", error);
      res.status(500).json({ message: "Failed to generate Instagram caption" });
    }
  });

  app.post("/api/instagram/post-product", requireAuth(), async (req, res) => {
    try {
      const { imageId, caption } = req.body;
      if (!imageId) {
        return res.status(400).json({ message: "Image ID is required" });
      }

      const connection = await storage.getInstagramConnection(getUserId(req));
      if (!connection) {
        return res.status(400).json({ message: "Instagram not connected. Please connect your account first." });
      }

      const image = await storage.getImage(imageId);
      if (!image || image.sessionId !== getUserId(req)) {
        return res.status(404).json({ message: "Image not found" });
      }

      if (image.paymentStatus !== 'paid') {
        return res.status(402).json({ message: "Product needs full AI analysis before posting to Instagram." });
      }

      const buffer = await loadImageBuffer(image);
      if (!buffer) {
        return res.status(400).json({ message: "Image data not available for posting." });
      }

      const postCaption = caption || image.instagramCaption || `${image.title}\n\n${(image.description || '').replace(/<[^>]*>/g, '')}`;

      const appUrl = getAppUrl(req);
      const imageUrl = `${appUrl}/api/images/${image.id}/file`;

      const containerRes = await fetch(
        `https://graph.instagram.com/v21.0/${connection.igUserId}/media`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_url: imageUrl,
            caption: postCaption,
            access_token: connection.accessToken,
          }),
        }
      );

      if (!containerRes.ok) {
        const errText = await containerRes.text().catch(() => '');
        console.error("Instagram container create failed:", containerRes.status, errText);
        return res.status(400).json({ message: "Failed to create Instagram media container. Make sure the image is publicly accessible." });
      }

      const containerData = await containerRes.json();
      const containerId = containerData.id;

      let status = 'IN_PROGRESS';
      let attempts = 0;
      while (status === 'IN_PROGRESS' && attempts < 30) {
        await delay(2000);
        const statusRes = await fetch(
          `https://graph.instagram.com/v21.0/${containerId}?fields=status_code&access_token=${connection.accessToken}`
        );
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          status = statusData.status_code;
        }
        attempts++;
      }

      if (status !== 'FINISHED') {
        return res.status(400).json({ message: `Instagram media processing failed with status: ${status}` });
      }

      const publishRes = await fetch(
        `https://graph.instagram.com/v21.0/${connection.igUserId}/media_publish`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            creation_id: containerId,
            access_token: connection.accessToken,
          }),
        }
      );

      if (!publishRes.ok) {
        const errText = await publishRes.text().catch(() => '');
        console.error("Instagram publish failed:", publishRes.status, errText);
        return res.status(400).json({ message: "Failed to publish Instagram post." });
      }

      const publishData = await publishRes.json();
      const postId = publishData.id;

      await storage.updateImage(imageId, {
        instagramPostId: postId,
        instagramStatus: 'posted',
        instagramCaption: postCaption,
      });

      res.json({ posted: true, postId, caption: postCaption });
    } catch (error) {
      console.error("Instagram post error:", error);
      res.status(500).json({ message: "Failed to post to Instagram" });
    }
  });

  app.get("/api/instagram/media", requireAuth(), async (req, res) => {
    try {
      const connection = await storage.getInstagramConnection(getUserId(req));
      if (!connection) {
        return res.status(400).json({ message: "Instagram not connected." });
      }

      const limit = Number(req.query.limit) || 20;
      const feedRes = await fetch(
        `https://graph.instagram.com/v21.0/${connection.igUserId}/media?fields=id,caption,media_type,media_url,thumbnail_url,timestamp&limit=${limit}&access_token=${connection.accessToken}`
      );

      if (!feedRes.ok) {
        return res.status(400).json({ message: "Failed to fetch Instagram media." });
      }

      const feedData = await feedRes.json();
      const media = (feedData.data || []).filter((m: any) => m.media_type === 'IMAGE' || m.media_type === 'CAROUSEL_ALBUM');
      res.json({ media });
    } catch (error) {
      console.error("Instagram media fetch error:", error);
      res.status(500).json({ message: "Failed to fetch Instagram media" });
    }
  });

  app.post("/api/images/push-to-amazon", requireAuth(), async (req, res) => {
    try {
      const { ids } = req.body;
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "No image IDs provided" });
      }

      const connection = await storage.getAmazonConnection(getUserId(req));
      if (!connection) {
        return res.status(400).json({ message: "Amazon not connected. Please connect your seller account first." });
      }

      const allImages = await storage.getImagesByIds(ids);
      const imagesToPush = allImages.filter(img => img.sessionId === getUserId(req));
      if (imagesToPush.length === 0) {
        return res.status(400).json({ message: "No images found for given IDs" });
      }

      const unpaidImages = imagesToPush.filter(img => img.paymentStatus !== 'paid');
      if (unpaidImages.length > 0) {
        return res.status(402).json({
          message: `${unpaidImages.length} product(s) have not been unlocked yet.`,
          unpaidCount: unpaidImages.length,
        });
      }

      let successCount = 0;
      let failCount = 0;
      const results: { id: number; amazonListingId?: string; error?: string }[] = [];

      for (const image of imagesToPush) {
        const result = await pushProductToAmazon(image, connection);
        if (result.amazonListingId) {
          await storage.updateImage(image.id, {
            amazonListingId: result.amazonListingId,
            amazonStatus: "synced",
          });
          successCount++;
          results.push({ id: image.id, amazonListingId: result.amazonListingId });
        } else {
          await storage.updateImage(image.id, { amazonStatus: "failed" });
          failCount++;
          results.push({ id: image.id, error: result.error });
        }
      }

      res.json({ success: successCount, failed: failCount, results });
    } catch (error) {
      console.error("Amazon push error:", error);
      res.status(500).json({ message: "Failed to push products to Amazon" });
    }
  });

  app.post("/api/images/:id/generate-photoshoot", requireAuth(), async (req, res) => {
    try {
      const id = parseInt(String(req.params.id));
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid image ID" });
      }

      const image = await storage.getImage(id);
      if (!image) {
        return res.status(404).json({ message: "Image not found" });
      }

      const { style } = req.body;
      const validStyles = ["Studio Lighting", "Minimalist Marble", "Natural Outdoor", "E-commerce White", "Neon Cyberpunk"];
      const selectedStyle = validStyles.includes(style as string) ? style : "Studio Lighting";

      // Reconstruct the physical description from AI data to maintain specific details
      const detailString = image.aiData ?
        `Physical details: ${JSON.stringify(image.aiData)}.` :
        `Description: ${image.description || image.title}`;

      const prompt = `A professional high-end e-commerce product photoshoot of: "${image.title}". 
${detailString}
Environmental Style: ${selectedStyle}. 
The image must be a photorealistic, 4k ultra-detailed commercial product photograph. Do not include any text, logos, or watermarks. Center the product perfectly.`;

      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: prompt.substring(0, 4000), // DALL-E 3 limit
        n: 1,
        size: "1024x1024",
        quality: "standard",
        response_format: "url",
      });

      const generatedUrl = response.data?.[0]?.url;
      if (!generatedUrl) {
        throw new Error("OpenAI did not return an image URL");
      }

      const currentBackgrounds = image.generatedBackgrounds || [];
      const newBackgrounds = [...currentBackgrounds, generatedUrl];

      const updatedImage = await storage.updateImage(id, {
        generatedBackgrounds: newBackgrounds
      });

      res.json(updatedImage);
    } catch (error: any) {
      console.error("DALL-E Generation Error:", error);
      res.status(500).json({
        message: "Failed to generate photoshoot image.",
        error: error.message
      });
    }
  });


  /* ── AI Background Editor ──────────────────────────────────────────────────
     POST /api/images/:id/edit-background  { style: string }
     Uses gpt-image-1 images.edit to replace the product background.
     Edited images are kept in-memory (bgEditBuffers) and served via GET below. */

  const bgEditBuffers = new Map<string, { buffer: Buffer; mimeType: string }>();

  const BG_STYLES: Record<string, string> = {
    studio:    "a clean, professional white studio photography background with soft even lighting",
    gradient:  "a soft purple-to-violet gradient background, smooth and elegant",
    lifestyle: "a bright, natural lifestyle scene with wooden surfaces and plants",
    minimal:   "a light warm grey minimalist background with subtle shadows",
    dark:      "a dramatic dark charcoal background with moody ambient lighting",
  };

  app.post("/api/images/:id/edit-background", requireAuth(), async (req, res) => {
    try {
      const id = parseInt(String(req.params.id));
      if (isNaN(id)) return res.status(400).json({ message: "Invalid image ID" });

      const image = await storage.getImage(id);
      if (!image) return res.status(404).json({ message: "Image not found" });

      const { style = "studio" } = req.body;
      const bgDescription = BG_STYLES[style] ?? BG_STYLES.studio;

      // Fetch the raw image buffer
      const imageBuffer = await loadImageBuffer(image);
      if (!imageBuffer) {
        return res.status(404).json({ message: "Image file not available. Please re-upload." });
      }

      // gpt-image-1 requires PNG for edits; convert buffer to an uploadable File
      const { toFile } = await import("openai");
      const imageFile = await toFile(imageBuffer, `product-${id}.png`, { type: "image/png" });

      const prompt = `Replace ONLY the background of this product image with ${bgDescription}. The product itself must remain completely unchanged — same position, same lighting on the product, same scale. Do not alter the product in any way. High quality e-commerce style.`;

      const response = await openai.images.edit({
        model: "gpt-image-1",
        image: imageFile,
        prompt: prompt.substring(0, 4000),
        size: "1024x1024",
      });

      const base64 = response.data?.[0]?.b64_json;
      if (!base64) throw new Error("gpt-image-1 did not return image data");

      const editedBuffer = Buffer.from(base64, "base64");
      const cacheKey = `${id}-${style}-${Date.now()}`;
      bgEditBuffers.set(cacheKey, { buffer: editedBuffer, mimeType: "image/png" });

      res.json({ key: cacheKey, url: `/api/images/${id}/bg/${cacheKey}` });
    } catch (error: any) {
      console.error("Background edit error:", error);
      res.status(500).json({ message: "Failed to edit background", error: error.message });
    }
  });

  // Serve edited background images
  app.get("/api/images/:id/bg/:key", (req, res) => {
    const { key } = req.params;
    const entry = bgEditBuffers.get(key);
    if (!entry) return res.status(404).json({ message: "Edited image not found or expired" });
    res.setHeader("Content-Type", entry.mimeType);
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(entry.buffer);
  });

  app.post("/api/images/:id/apply-image", requireAuth(), async (req, res) => {
    try {
      const id = parseInt(String(req.params.id));
      if (isNaN(id)) return res.status(400).json({ message: "Invalid image ID" });

      const image = await storage.getImage(id);
      if (!image) return res.status(404).json({ message: "Image not found" });

      const { bgKey, imageUrl } = req.body;
      
      let newImageBuffer: Buffer;
      let newMimeType: string;

      if (bgKey) {
        const entry = bgEditBuffers.get(bgKey);
        if (!entry) return res.status(400).json({ message: "Edited background not found or expired" });
        newImageBuffer = entry.buffer;
        newMimeType = entry.mimeType;
      } else if (imageUrl) {
        const fetchRes = await fetch(imageUrl);
        if (!fetchRes.ok) return res.status(400).json({ message: "Failed to fetch image from URL" });
        const arrayBuffer = await fetchRes.arrayBuffer();
        newImageBuffer = Buffer.from(arrayBuffer);
        newMimeType = fetchRes.headers.get("content-type") || "image/png";
      } else {
        return res.status(400).json({ message: "Must provide either bgKey or imageUrl" });
      }

      const base64 = newImageBuffer.toString("base64");
      
      const updatedImage = await storage.updateImage(id, {
        imageData: base64,
        mimeType: newMimeType,
        size: newImageBuffer.length,
      });

      // Update the in-memory buffer so /api/images/:id/file serves the new image immediately
      setImageBuffer(id, newImageBuffer);

      res.json(updatedImage);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to apply image", error: error.message });
    }
  });

  app.post("/api/images/:id/rewrite-description", requireAuth(), async (req, res) => {
    try {
      const id = parseInt(String(req.params.id));
      if (isNaN(id)) return res.status(400).json({ message: "Invalid image ID" });

      const image = await storage.getImage(id);
      if (!image) return res.status(404).json({ message: "Image not found" });

      const { tone } = req.body;
      if (!tone) return res.status(400).json({ message: "Tone is required" });

      const tonePrompt = toneInstructions[tone] || `Write in a ${tone} tone.`;

      const prompt = `
        Rewrite the following product description to be engaging, high-converting, and optimized for an e-commerce store. 
        ${tonePrompt}

        Original Description:
        "${image.description || 'A product being sold online.'}"

        Product Title: "${image.title || 'Unknown Product'}"
        Product Tags: ${image.tags?.join(', ') || 'None'}

        Output ONLY the rewritten description text. Do not include any intro, outro, or emojis unless appropriate for the requested tone.
        Format heavily with paragraphs to make it readable.
      `;

      const response = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview", // Use a fast text model
        messages: [{ role: "user", content: prompt }],
        max_tokens: 500,
        temperature: 0.7,
      });

      const rewrittenDescription = response.choices[0].message.content?.trim() || "";

      res.json({ description: rewrittenDescription });
    } catch (error: any) {
      console.error("Rewrite description error:", error);
      res.status(500).json({ message: "Failed to rewrite description", error: error.message });
    }
  });

  // POST /api/images/:id/generate-content — SSE stream: title, description, seoKeywords, aeoFaqs
  app.post("/api/images/:id/generate-content", requireAuth(), async (req, res) => {
    try {
      const id = parseInt(String(req.params.id));
      if (isNaN(id)) return res.status(400).json({ message: "Invalid image ID" });

      const image = await storage.getImage(id);
      if (!image || image.sessionId !== getUserId(req)) {
        return res.status(404).json({ message: "Image not found" });
      }

      const buf = await loadImageBuffer(image);
      if (!buf) {
        return res.status(400).json({ message: "Image not available for AI analysis" });
      }

      const { category, styleTone, audience } = req.body as {
        category?: string;
        styleTone?: string;
        audience?: string;
      };

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const systemPrompt = `You are an expert e-commerce copywriter. Generate product listing content for a product shown in the image.
Output ONLY valid JSON with this exact structure (no markdown, no code fences):
{
  "title": "Product title — specific, benefit-led, max 80 chars",
  "description": "3-4 paragraph product description, engaging and conversion-optimised",
  "seoKeywords": ["keyword1", "keyword2", ...],
  "aeoFaqs": [{"q": "Question?", "a": "Answer."}, ...]
}
Rules:
- seoKeywords: 8-12 specific keywords/phrases for Shopify/Etsy/Amazon search — brand, material, use case, style
- aeoFaqs: 4-6 FAQ pairs that answer common buyer questions about this type of product (price not included)
- Use the category, style/tone, and target audience provided by the user`;

      const userContent: any[] = [
        {
          type: "text",
          text: `Category: ${category || image.category || "General"}\nStyle/tone: ${styleTone || "professional"}\nTarget audience: ${audience || "general buyers"}\nProduct title context: ${image.title || (image as any).originalName || ""}`,
        },
        {
          type: "image_url",
          image_url: { url: `data:${(image as any).mimeType};base64,${buf.toString("base64")}` },
        },
      ];

      const stream = await openai.chat.completions.create({
        model: "gpt-5.2",
        stream: true,
        max_completion_tokens: 1500,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error: any) {
      console.error("generate-content error:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Generation failed" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ message: "Failed to generate content", error: error.message });
      }
    }
  });

  // POST /api/images/:id/regenerate-field — SSE stream for a single field
  app.post("/api/images/:id/regenerate-field", requireAuth(), async (req, res) => {
    try {
      const id = parseInt(String(req.params.id));
      if (isNaN(id)) return res.status(400).json({ message: "Invalid image ID" });

      const image = await storage.getImage(id);
      if (!image || image.sessionId !== getUserId(req)) {
        return res.status(404).json({ message: "Image not found" });
      }

      const buf = await loadImageBuffer(image);
      if (!buf) {
        return res.status(400).json({ message: "Image not available for AI analysis" });
      }

      const { field, category, styleTone, audience } = req.body as {
        field: "title" | "description" | "seoKeywords" | "aeoFaqs";
        category?: string;
        styleTone?: string;
        audience?: string;
      };

      const fieldPrompts: Record<string, string> = {
        title: "Generate a single product title. Output only the title text, no JSON, no quotes.",
        description: "Rewrite the product description — 3-4 engaging paragraphs. Output only the description text.",
        seoKeywords: 'Generate SEO keywords as a JSON array of strings: ["keyword1", "keyword2", ...]. Output only the JSON array.',
        aeoFaqs: 'Generate FAQ pairs as a JSON array: [{"q": "...", "a": "..."}]. Output only the JSON array.',
      };

      const systemPrompt = fieldPrompts[field];
      if (!systemPrompt) {
        return res.status(400).json({ message: `Unknown field: ${field}` });
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const userContent: any[] = [
        {
          type: "text",
          text: `Category: ${category || image.category || "General"}\nStyle/tone: ${styleTone || "professional"}\nTarget audience: ${audience || "general buyers"}\nProduct title context: ${image.title || (image as any).originalName || ""}`,
        },
        {
          type: "image_url",
          image_url: { url: `data:${(image as any).mimeType};base64,${buf.toString("base64")}` },
        },
      ];

      const stream = await openai.chat.completions.create({
        model: "gpt-5.2",
        stream: true,
        max_completion_tokens: 1000,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error: any) {
      console.error("regenerate-field error:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Generation failed" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ message: "Failed to regenerate field", error: error.message });
      }
    }
  });

  // POST /api/images/auto-group — SSE: AI-powered image grouping via GPT-5.2 vision
  app.post("/api/images/auto-group", requireAuth(), async (req, res) => {
    try {
      const { images: inputImages, productContext, mode = "default" } = req.body as {
        images: AutoGroupInputImage[];
        productContext?: string;
        mode?: AutoGroupMode;
      };

      // Validate input
      if (!Array.isArray(inputImages) || inputImages.length < 2) {
        return res.status(400).json({ message: "At least 2 images are required" });
      }
      if (inputImages.length > 200) {
        return res.status(400).json({ message: "Maximum 200 images allowed" });
      }

      // Set SSE headers
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      const { groups: finalGroups, fallbackUsed, fallbackReason } =
        await runAutoGrouping(inputImages, productContext, mode);

      // If the embedding path failed, tell the client BEFORE any group events
      // so the UI can render the filename-only-fallback banner from Plan 08-03.
      if (fallbackUsed) {
        res.write(
          `data: ${JSON.stringify({ type: "fallback", reason: fallbackReason ?? "unknown" })}\n\n`,
        );
      }

      // Stream each final group as an SSE event
      for (const group of finalGroups) {
        res.write(`data: ${JSON.stringify({ type: "group", group })}\n\n`);
      }

      // Send done event (fallbackUsed also echoed here for clients that only
      // listen for the terminal event).
      res.write(
        `data: ${JSON.stringify({ type: "done", totalGroups: finalGroups.length, fallbackUsed })}\n\n`,
      );
      res.end();
    } catch (error: any) {
      console.error("auto-group error:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ type: "error", message: error.message || "Auto-grouping failed" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ message: "Failed to auto-group images", error: error.message });
      }
    }
  });

  app.post("/api/images/auto-group-existing", requireAuth(), async (req, res) => {
    try {
      const sessionId = getUserId(req);
      const { imageIds, productContext, mode = "variant-family" } = req.body as {
        imageIds: number[];
        productContext?: string;
        mode?: AutoGroupMode;
      };

      if (!Array.isArray(imageIds) || imageIds.length < 2) {
        return res.status(400).json({ message: "At least 2 image IDs are required" });
      }
      if (imageIds.length > 200) {
        return res.status(400).json({ message: "Maximum 200 images allowed" });
      }

      const existingImages = await storage.getImagesByIds(imageIds);
      const imagesById = new Map(existingImages.map((image) => [image.id, image]));
      const orderedImages = imageIds
        .map((imageId) => imagesById.get(imageId))
        .filter((image): image is NonNullable<typeof image> => !!image);

      if (orderedImages.length !== imageIds.length) {
        return res.status(404).json({ message: "Some selected images could not be found" });
      }

      const unauthorizedImage = orderedImages.find((image) => image.sessionId !== sessionId);
      if (unauthorizedImage) {
        return res.status(403).json({ message: "Some selected images do not belong to this workspace" });
      }

      const inputImages = await runWithConcurrency(orderedImages, 6, async (image, index) => {
        const buffer = await loadImageBuffer(image);
        if (!buffer) {
          throw new Error(`Image data not found for ${image.originalName || `image ${image.id}`}`);
        }

        return {
          index,
          base64: buffer.toString("base64"),
          mimeType: image.mimeType,
          filename: image.originalName,
          descriptor: [
            image.title ? `title: ${image.title}` : null,
            image.category ? `category: ${image.category}` : null,
            image.mainCategory ? `main category: ${image.mainCategory}` : null,
            image.originalName ? `filename: ${image.originalName}` : null,
          ].filter(Boolean).join(" | "),
        };
      });

      const { groups, fallbackUsed, fallbackReason } =
        await runAutoGrouping(inputImages, productContext, mode);
      res.json({ groups, fallbackUsed, fallbackReason });
    } catch (error: any) {
      console.error("auto-group-existing error:", error);
      res.status(500).json({ message: "Failed to auto-group existing images", error: error.message });
    }
  });

      return httpServer;

}
