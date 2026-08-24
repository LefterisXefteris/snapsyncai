export const PRODUCT_EDITOR_FACTS_TITLE = "Product facts";
export const PRODUCT_EDITOR_LISTING_COPY_TITLE = "Listing copy";
export const PRODUCT_EDITOR_SELLING_TITLE = "Selling";
export const PRODUCT_EDITOR_DETAILS_TITLE = "Details";

export const PRODUCT_EDITOR_WORK = [
  { title: PRODUCT_EDITOR_FACTS_TITLE },
  { title: PRODUCT_EDITOR_LISTING_COPY_TITLE },
  { title: PRODUCT_EDITOR_SELLING_TITLE },
  { title: PRODUCT_EDITOR_DETAILS_TITLE },
] as const;

export const UNPAID_PREVIEW_TITLE = "This product is in preview mode.";
export const UNPAID_PREVIEW_DETAIL =
  "Subscribe to unlock listing copy, pricing, and selling fields.";

export function productEditorShowsVariants(variantCount: number): boolean {
  return variantCount > 0;
}
