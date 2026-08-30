export const PRODUCT_EDITOR_FACTS_TITLE = "Product facts";
export const PRODUCT_EDITOR_LISTING_COPY_TITLE = "Listing copy";
export const PRODUCT_EDITOR_REFRESH_LABEL = "Refresh from search demand";
export const PRODUCT_EDITOR_SELLING_TITLE = "Selling";
export const PRODUCT_EDITOR_DETAILS_TITLE = "Details";
export const PRODUCT_EDITOR_SHOPIFY_TITLE = "Shopify";
export const PRODUCT_EDITOR_AVAILABLE_ON_LABEL = "Available on";
export const PRODUCT_EDITOR_SHOPIFY_STATUS_LABEL = "Draft or Active";
export const PRODUCT_EDITOR_SHOPIFY_CONNECT =
  "Connect Shopify in Settings to push this product.";
export const PRODUCT_EDITOR_SHOPIFY_RECONNECT =
  "Reconnect Shopify in Settings to choose where this product is available.";

export const PRODUCT_EDITOR_WORK = [
  { title: PRODUCT_EDITOR_FACTS_TITLE },
  { title: PRODUCT_EDITOR_LISTING_COPY_TITLE },
  { title: PRODUCT_EDITOR_SELLING_TITLE },
  { title: PRODUCT_EDITOR_DETAILS_TITLE },
] as const;

export const UNPAID_PREVIEW_TITLE = "This product is in preview mode.";
export const UNPAID_PREVIEW_DETAIL =
  "Subscribe to unlock listing copy, pricing, and selling fields.";
export const PRODUCT_EDITOR_ALT_TEXT_LABEL = "Alt text";

export function productEditorShowsVariants(variantCount: number): boolean {
  return variantCount > 0;
}

export function listingCopyTagsAfterAdd(tags: string[], raw: string): string[] {
  const next = raw.trim();
  if (!next || tags.includes(next)) return tags;
  return [...tags, next];
}

export function listingCopyTagsAfterRemove(tags: string[], index: number): string[] {
  return tags.filter((_, i) => i !== index);
}

export function shopifyProductStatus(value: string | null | undefined): "DRAFT" | "ACTIVE" {
  return (value ?? "").toUpperCase() === "ACTIVE" ? "ACTIVE" : "DRAFT";
}

export function publicationIdsAfterToggle(
  ids: string[],
  publicationId: string,
  on: boolean,
): string[] {
  if (on) {
    return ids.includes(publicationId) ? ids : [...ids, publicationId];
  }
  return ids.filter((id) => id !== publicationId);
}

