import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  PRODUCT_EDITOR_WORK,
  UNPAID_PREVIEW_DETAIL,
  UNPAID_PREVIEW_TITLE,
  listingCopyTagsAfterAdd,
  listingCopyTagsAfterRemove,
  productEditorShowsVariants,
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

test("unpaid preview unlocks listing copy and selling, not variants", () => {
  assert.match(UNPAID_PREVIEW_TITLE, /preview/i);
  assert.match(UNPAID_PREVIEW_DETAIL, /listing copy/i);
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
