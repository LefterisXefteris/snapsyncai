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

export const UNPAID_PREVIEW_TITLE = "This product has no listing copy yet.";
export const UNPAID_PREVIEW_DETAIL =
  "Confirm product facts, then generate listing copy — or type it yourself and push.";
export const NEED_PLAN =
  "Subscribe to a Plan to generate listing copy, refresh from search demand, run Bulk SEO, or build a website.";
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

export const GO_LIVE_LABEL = "Go live";
export const SYNC_UPDATES_LABEL = "Sync updates";
export const QUIETER_PUSH_LABEL = "Push";
export const GO_LIVE_NEEDS_LISTING_COPY = "This product needs listing copy.";
export const GO_LIVE_NEEDS_PRICE = "This product needs a price greater than zero.";
export const GO_LIVE_NO_ONLINE_STORE = "This shop has no Online Store.";

const ONLINE_STORE_LABEL = "Online Store";

export type ShopPublicationChoice = {
  id: string;
  name: string;
};

export type ProductPageShopifyInput = {
  lastSentStatus: string | null;
  lastSentPublicationIds: readonly string[];
  shopPublications: readonly ShopPublicationChoice[];
  pickedStatus: string | null;
  pickedPublicationIds: readonly string[];
  listingCopyPresent: boolean;
  /** Ignored. Stale listing copy is not a Go live or Sync refusal. */
  listingCopyStale?: boolean;
  /** Ignored. Typed listing copy can go live without confirmed facts. */
  factsConfirmed?: boolean;
  price: string | null;
  shopConnected: boolean;
  publicationsReady: boolean;
  /** Shop is connected and the publication list has not come back yet. */
  publicationsPending?: boolean;
};

export type ProductPageShopifyDecision = {
  header: "go-live" | "sync-updates";
  headerLabel: string;
  headerReason: string | null;
  headerCanSend: boolean;
  goLiveStatus: "ACTIVE";
  goLivePublicationIds: string[];
  pushLabel: string;
  pushStatus: "DRAFT" | "ACTIVE";
  pushPublicationIds: string[];
  pushReason: string | null;
  pushCanSend: boolean;
};

export function listingCopyIsPresent(copy: {
  title?: string | null;
  description?: string | null;
  tags?: readonly string[] | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  aeoSnippet?: string | null;
  aeoFaqs?: readonly unknown[] | null;
}): boolean {
  const text = (value?: string | null) => Boolean(value && value.trim());
  if (
    text(copy.title) ||
    text(copy.description) ||
    text(copy.seoTitle) ||
    text(copy.seoDescription) ||
    text(copy.aeoSnippet)
  ) {
    return true;
  }
  if ((copy.tags ?? []).some((tag) => tag.trim())) return true;
  return (copy.aeoFaqs ?? []).length > 0;
}

function priceGreaterThanZero(price: string | null | undefined): boolean {
  if (price == null) return false;
  const trimmed = price.trim();
  if (!trimmed) return false;
  const value = Number(trimmed);
  return Number.isFinite(value) && value > 0;
}

function onlineStorePublicationId(
  publications: readonly ShopPublicationChoice[],
): string | null {
  return publications.find((publication) => publication.name === ONLINE_STORE_LABEL)?.id ?? null;
}

function publicationIdsForGoLive(
  picked: readonly string[],
  onlineStoreId: string | null,
): string[] {
  if (onlineStoreId == null || picked.includes(onlineStoreId)) return [...picked];
  return [...picked, onlineStoreId];
}

function writeReason(
  input: ProductPageShopifyInput,
  status: "DRAFT" | "ACTIVE",
  publicationIds: readonly string[],
  onlineStoreId: string | null,
  requiresOnlineStore: boolean,
): string | null {
  if (!input.shopConnected) return PRODUCT_EDITOR_SHOPIFY_CONNECT;
  if (!input.publicationsPending && !input.publicationsReady) return PRODUCT_EDITOR_SHOPIFY_RECONNECT;
  if (!input.publicationsPending && requiresOnlineStore && onlineStoreId == null) {
    return GO_LIVE_NO_ONLINE_STORE;
  }
  if (!input.listingCopyPresent) return GO_LIVE_NEEDS_LISTING_COPY;
  const storefront =
    status === "ACTIVE" &&
    (input.publicationsPending ||
      (onlineStoreId != null && publicationIds.includes(onlineStoreId)));
  if (storefront && !priceGreaterThanZero(input.price)) return GO_LIVE_NEEDS_PRICE;
  return null;
}

export function productPageShopifyDecision(
  input: ProductPageShopifyInput,
): ProductPageShopifyDecision {
  const onlineStoreId = onlineStorePublicationId(input.shopPublications);
  const sentOnOnlineStore =
    shopifyProductStatus(input.lastSentStatus) === "ACTIVE" &&
    onlineStoreId != null &&
    input.lastSentPublicationIds.includes(onlineStoreId);
  const goLivePublicationIds = publicationIdsForGoLive(
    input.pickedPublicationIds,
    onlineStoreId,
  );
  const pushStatus = shopifyProductStatus(input.pickedStatus);
  const pushPublicationIds = [...input.pickedPublicationIds];
  const header = sentOnOnlineStore ? "sync-updates" : "go-live";
  const pending = input.publicationsPending === true;
  const headerReason = writeReason(
    input,
    header === "go-live" ? "ACTIVE" : pushStatus,
    header === "go-live" ? goLivePublicationIds : pushPublicationIds,
    onlineStoreId,
    header === "go-live",
  );
  const pushReason = writeReason(input, pushStatus, pushPublicationIds, onlineStoreId, false);

  return {
    header,
    headerLabel: header === "go-live" ? GO_LIVE_LABEL : SYNC_UPDATES_LABEL,
    headerReason,
    headerCanSend: headerReason == null && !pending,
    goLiveStatus: "ACTIVE",
    goLivePublicationIds,
    pushLabel: QUIETER_PUSH_LABEL,
    pushStatus,
    pushPublicationIds,
    pushReason,
    pushCanSend: pushReason == null && !pending,
  };
}

