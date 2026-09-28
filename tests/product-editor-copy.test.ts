import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  GO_LIVE_NEEDS_LISTING_COPY,
  GO_LIVE_NEEDS_PRICE,
  GO_LIVE_NO_ONLINE_STORE,
  PRODUCT_EDITOR_SHOPIFY_CONNECT,
  PRODUCT_EDITOR_SHOPIFY_RECONNECT,
  PRODUCT_EDITOR_WORK,
  UNPAID_PREVIEW_DETAIL,
  UNPAID_PREVIEW_TITLE,
  listingCopyIsPresent,
  listingCopyTagsAfterAdd,
  listingCopyTagsAfterRemove,
  productEditorShowsVariants,
  productPageShopifyDecision,
  PRODUCT_EDITOR_AVAILABLE_ON_LABEL,
  publicationIdsAfterToggle,
  shopifyProductStatus,
} from "../client/src/lib/product-editor-copy.ts";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const editorPage = readFileSync(path.join(root, "client/src/pages/ProductDetails.tsx"), "utf8");
const listingCopyPanel = readFileSync(
  path.join(root, "client/src/components/ai-content-panel.tsx"),
  "utf8",
);

test("work column is product facts, then listing copy, then selling, then details", () => {
  assert.deepEqual(
    PRODUCT_EDITOR_WORK.map((section) => section.title),
    ["Product facts", "Listing copy", "Selling", "Details"],
  );
});

test("missing listing copy points at facts or typing, not unlock", () => {
  assert.match(UNPAID_PREVIEW_TITLE, /listing copy/i);
  assert.match(UNPAID_PREVIEW_DETAIL, /listing copy/i);
  assert.doesNotMatch(UNPAID_PREVIEW_TITLE, /unlock/i);
  assert.doesNotMatch(UNPAID_PREVIEW_DETAIL, /unlock/i);
  assert.doesNotMatch(UNPAID_PREVIEW_DETAIL, /variant/i);
});

test("variants only belong on the editor when the product already has them", () => {
  assert.equal(productEditorShowsVariants(0), false);
  assert.equal(productEditorShowsVariants(2), true);
});

test("a seller can add and remove listing copy tags", () => {
  assert.deepEqual(listingCopyTagsAfterAdd(["cotton"], "tee"), ["cotton", "tee"]);
  assert.deepEqual(listingCopyTagsAfterAdd(["cotton"], "  "), ["cotton"]);
  assert.deepEqual(listingCopyTagsAfterAdd(["cotton"], "cotton"), ["cotton"]);
  assert.deepEqual(listingCopyTagsAfterRemove(["cotton", "tee"], 0), ["tee"]);
});

test("the product editor page uses the copy module", () => {
  assert.match(editorPage, /from ["']@\/lib\/product-editor-copy["']/);
  assert.match(editorPage, /PRODUCT_EDITOR_WORK/);
  assert.match(editorPage, /UNPAID_PREVIEW_DETAIL/);
  assert.match(editorPage, /productEditorShowsVariants/);
});

test("the product editor lets the seller edit tags and photo alt text", () => {
  assert.match(editorPage, /listingCopyTagsAfterAdd/);
  assert.match(editorPage, /listingCopyTagsAfterRemove/);
  assert.match(editorPage, /PRODUCT_EDITOR_ALT_TEXT_LABEL/);
});

test("generate listing copy fills page title and meta description", () => {
  assert.match(editorPage, /parsed\.seoTitle/);
  assert.match(editorPage, /parsed\.seoDescription/);
  assert.match(listingCopyPanel, /seoTitle/);
  assert.match(listingCopyPanel, /seoDescription/);
});

test("the product editor has no Discard, Add options, AI Content Generator, or Status card", () => {
  assert.doesNotMatch(editorPage, />\s*Discard\s*</);
  assert.doesNotMatch(editorPage, /Add options/);
  assert.doesNotMatch(editorPage, /AI Content Generator/);
  assert.doesNotMatch(listingCopyPanel, /AI Content Generator/);
  assert.doesNotMatch(editorPage, /CardTitle[^>]*>Status</);
});

test("Shopify publications are Available on, never called channels", () => {
  assert.equal(PRODUCT_EDITOR_AVAILABLE_ON_LABEL, "Available on");
  assert.match(editorPage, /PRODUCT_EDITOR_AVAILABLE_ON_LABEL/);
  assert.match(editorPage, /PRODUCT_EDITOR_SHOPIFY_TITLE/);
  assert.doesNotMatch(editorPage, /available channels/i);
});

test("Draft is the default Shopify product status and publications start unticked", () => {
  assert.equal(shopifyProductStatus(undefined), "DRAFT");
  assert.equal(shopifyProductStatus("ACTIVE"), "ACTIVE");
  assert.deepEqual(publicationIdsAfterToggle([], "gid://shopify/Publication/1", true), [
    "gid://shopify/Publication/1",
  ]);
  assert.deepEqual(
    publicationIdsAfterToggle(["gid://shopify/Publication/1"], "gid://shopify/Publication/1", false),
    [],
  );
});

const ONLINE_STORE = "gid://shopify/Publication/1";
const POINT_OF_SALE = "gid://shopify/Publication/2";

const shopPublications = [
  { id: ONLINE_STORE, name: "Online Store" },
  { id: POINT_OF_SALE, name: "Point of Sale" },
];

function pageDecision(
  overrides: Partial<Parameters<typeof productPageShopifyDecision>[0]> = {},
) {
  return productPageShopifyDecision({
    lastSentStatus: null,
    lastSentPublicationIds: [],
    shopPublications,
    pickedStatus: "DRAFT",
    pickedPublicationIds: [],
    listingCopyPresent: true,
    price: "24.00",
    shopConnected: true,
    publicationsReady: true,
    ...overrides,
  });
}

test("Go live is the header action until the product is Active on the Online Store", () => {
  const decision = pageDecision();
  assert.equal(decision.header, "go-live");
  assert.equal(decision.headerLabel, "Go live");
  assert.equal(decision.headerReason, null);
});

test("Sync updates is the header once Active on the Online Store was sent", () => {
  const decision = pageDecision({
    lastSentStatus: "ACTIVE",
    lastSentPublicationIds: [ONLINE_STORE, POINT_OF_SALE],
    pickedStatus: "DRAFT",
    pickedPublicationIds: [],
  });
  assert.equal(decision.header, "sync-updates");
  assert.equal(decision.headerLabel, "Sync updates");
  assert.equal(decision.pushLabel, "Push");
});

test("missing listing copy keeps Go live visible and names that gap", () => {
  const decision = pageDecision({ listingCopyPresent: false, price: "24.00" });
  assert.equal(decision.header, "go-live");
  assert.equal(decision.headerLabel, "Go live");
  assert.equal(decision.headerReason, GO_LIVE_NEEDS_LISTING_COPY);
});

test("a missing or zero price keeps Go live visible and names that gap", () => {
  assert.equal(pageDecision({ price: null }).headerReason, GO_LIVE_NEEDS_PRICE);
  assert.equal(pageDecision({ price: "" }).headerReason, GO_LIVE_NEEDS_PRICE);
  assert.equal(pageDecision({ price: "0" }).headerReason, GO_LIVE_NEEDS_PRICE);
  assert.equal(pageDecision({ price: "0.00" }).header, "go-live");
  assert.equal(pageDecision({ price: "0.00" }).headerReason, GO_LIVE_NEEDS_PRICE);
});

test("Go live adds Online Store and keeps the other ticks", () => {
  const decision = pageDecision({
    pickedStatus: "DRAFT",
    pickedPublicationIds: [POINT_OF_SALE],
  });
  assert.equal(decision.goLiveStatus, "ACTIVE");
  assert.deepEqual(decision.goLivePublicationIds, [POINT_OF_SALE, ONLINE_STORE]);
});

test("Go live includes Online Store even when that tick is off", () => {
  const decision = pageDecision({
    pickedPublicationIds: [POINT_OF_SALE],
  });
  assert.equal(decision.goLivePublicationIds.includes(ONLINE_STORE), true);
});

test("the quieter Push can send the picked Draft without a price", () => {
  const decision = pageDecision({
    pickedStatus: "DRAFT",
    pickedPublicationIds: [POINT_OF_SALE],
    price: null,
  });
  assert.equal(decision.pushStatus, "DRAFT");
  assert.deepEqual(decision.pushPublicationIds, [POINT_OF_SALE]);
  assert.equal(decision.pushReason, null);
  assert.equal(decision.headerReason, GO_LIVE_NEEDS_PRICE);
});

test("a storefront pick without a price is refused with a reason", () => {
  const decision = pageDecision({
    pickedStatus: "ACTIVE",
    pickedPublicationIds: [ONLINE_STORE, POINT_OF_SALE],
    price: "0",
  });
  assert.equal(decision.pushReason, GO_LIVE_NEEDS_PRICE);
  assert.equal(decision.pushStatus, "ACTIVE");
  assert.deepEqual(decision.pushPublicationIds, [ONLINE_STORE, POINT_OF_SALE]);
});

test("an Active pick that leaves out Online Store needs only listing copy", () => {
  const decision = pageDecision({
    pickedStatus: "ACTIVE",
    pickedPublicationIds: [POINT_OF_SALE],
    price: null,
  });
  assert.equal(decision.pushReason, null);
  assert.equal(decision.pushStatus, "ACTIVE");
});

test("stale listing copy and unconfirmed facts do not refuse the write", () => {
  const decision = pageDecision({
    listingCopyPresent: true,
    listingCopyStale: true,
    factsConfirmed: false,
    price: "18.00",
  });
  assert.equal(decision.headerReason, null);
  assert.equal(decision.pushReason, null);
});

test("a typed title counts as listing copy", () => {
  assert.equal(listingCopyIsPresent({ title: "  Merino crew  " }), true);
  assert.equal(listingCopyIsPresent({ title: "  ", description: "", tags: [] }), false);
});

test("a disconnected shop keeps Go live visible and names Settings", () => {
  const decision = pageDecision({ shopConnected: false, listingCopyPresent: false, price: null });
  assert.equal(decision.header, "go-live");
  assert.equal(decision.headerReason, PRODUCT_EDITOR_SHOPIFY_CONNECT);
  assert.equal(decision.pushReason, PRODUCT_EDITOR_SHOPIFY_CONNECT);
});

test("publications that need a reconnect keep the header action visible", () => {
  const decision = pageDecision({ publicationsReady: false });
  assert.equal(decision.headerLabel, "Go live");
  assert.equal(decision.headerReason, PRODUCT_EDITOR_SHOPIFY_RECONNECT);
});

test("a publication list that is still loading does not name a reconnect", () => {
  const decision = pageDecision({
    publicationsPending: true,
    publicationsReady: false,
    shopPublications: [],
  });
  assert.equal(decision.header, "go-live");
  assert.equal(decision.headerReason, null);
  assert.equal(decision.headerCanSend, false);
});

test("a shop with no Online Store publication names that gap", () => {
  const decision = pageDecision({
    shopPublications: [{ id: POINT_OF_SALE, name: "Point of Sale" }],
    price: "24.00",
  });
  assert.equal(decision.header, "go-live");
  assert.equal(decision.headerReason, GO_LIVE_NO_ONLINE_STORE);
  assert.equal(decision.pushReason, null);
});

test("clearing the price on a live product makes Sync name the missing price", () => {
  const decision = pageDecision({
    lastSentStatus: "ACTIVE",
    lastSentPublicationIds: [ONLINE_STORE],
    pickedStatus: "ACTIVE",
    pickedPublicationIds: [ONLINE_STORE],
    price: "",
  });
  assert.equal(decision.header, "sync-updates");
  assert.equal(decision.headerLabel, "Sync updates");
  assert.equal(decision.headerReason, GO_LIVE_NEEDS_PRICE);
});

test("switching a live product to Draft needs only listing copy", () => {
  const decision = pageDecision({
    lastSentStatus: "ACTIVE",
    lastSentPublicationIds: [ONLINE_STORE],
    pickedStatus: "DRAFT",
    pickedPublicationIds: [],
    price: null,
    listingCopyPresent: true,
  });
  assert.equal(decision.header, "sync-updates");
  assert.equal(decision.headerReason, null);
  assert.equal(decision.pushStatus, "DRAFT");
  assert.equal(decision.pushReason, null);
});

test("the Shopify Channel row is Draft/Active and Available on, not Shopify admin leftovers", () => {
  assert.match(editorPage, /PRODUCT_EDITOR_SHOPIFY_STATUS_LABEL/);
  assert.match(editorPage, /PRODUCT_EDITOR_SHOPIFY_RECONNECT/);
  assert.match(editorPage, /card-shopify-publications/);
  assert.match(editorPage, /publicationsReady !== true/);
  assert.doesNotMatch(editorPage, /\bWix\b/);
  assert.doesNotMatch(editorPage, /\bVinted\b/);
  assert.doesNotMatch(editorPage, /\bVendor\b/);
  assert.doesNotMatch(editorPage, /theme template/i);
  assert.doesNotMatch(editorPage, /collections/i);
  assert.doesNotMatch(editorPage, /shipping/i);
});
