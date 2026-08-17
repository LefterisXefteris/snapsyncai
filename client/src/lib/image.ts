/**
 * Product photo as the SPA reads it from FastAPI (camelCase JSON).
 * Not a Drizzle row — `shared/` is gone with Express.
 */
export type Image = {
  id: number;
  originalName: string;
  mimeType: string;
  size: number;
  imageData?: string | null;
  storageUrl?: string | null;
  title?: string | null;
  description?: string | null;
  price?: string | null;
  category?: string | null;
  mainCategory?: string | null;
  productType?: string | null;
  tags?: string[] | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  altText?: string | null;
  aeoFaqs?: unknown;
  aeoSnippet?: string | null;
  variants?: unknown;
  compareAtPrice?: string | null;
  costPerItem?: string | null;
  sku?: string | null;
  barcode?: string | null;
  trackQuantity?: string | boolean | null;
  inventoryQuantity?: number | null;
  mediaGallery?: string[] | null;
  collections?: string[] | null;
  shopifyProductId?: string | null;
  shopifyStatus?: string | null;
  paymentStatus?: string | null;
  productContext?: string | null;
  brandTone?: string | null;
  aiData?: unknown;
  productFacts?: unknown;
  productGroupId?: string | null;
  sessionId?: string | null;
  createdAt?: string | null;
};
