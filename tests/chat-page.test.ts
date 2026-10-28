import assert from "node:assert/strict";
import test from "node:test";

import {
  chatBody,
  importRunning,
  openProductId,
  rememberBulkSeoTicks,
  rememberPageProposal,
} from "../client/src/lib/chat-page.ts";

test("a product page is that product", () => {
  assert.equal(openProductId("/product/8"), 8);
});

test("another destination is not a product", () => {
  assert.equal(openProductId("/"), null);
  assert.equal(openProductId("/bulk-seo"), null);
  assert.equal(openProductId("/product/8/edit"), null);
});

test("a proposal on the open product page is sent with the message", () => {
  rememberPageProposal({
    productId: 8,
    title: "Blue linen shirt",
    description: "A breezy linen shirt for warm days.",
    tags: ["linen", "shirt"],
    seoTitle: "Blue linen shirt",
    seoDescription: "A breezy linen shirt.",
    aeoFaqs: [{ q: "Is it linen?", a: "Yes." }],
  });

  assert.deepEqual(chatBody("Accept it.", "/product/8"), {
    message: "Accept it.",
    openProductId: 8,
    pageProposal: {
      title: "Blue linen shirt",
      description: "A breezy linen shirt for warm days.",
      tags: ["linen", "shirt"],
      seoTitle: "Blue linen shirt",
      seoDescription: "A breezy linen shirt.",
      aeoFaqs: [{ q: "Is it linen?", a: "Yes." }],
    },
  });
  assert.deepEqual(chatBody("Accept it.", "/bulk-seo"), { message: "Accept it." });
  rememberPageProposal(null);
});

test("eligible Bulk SEO ticks go with the message only on Bulk SEO", () => {
  rememberBulkSeoTicks([7, 9]);
  assert.deepEqual(chatBody("Start Bulk SEO.", "/bulk-seo"), {
    message: "Start Bulk SEO.",
    bulkSeoIds: [7, 9],
  });
  assert.deepEqual(chatBody("Start Bulk SEO.", "/"), { message: "Start Bulk SEO." });
  assert.deepEqual(chatBody("Start Bulk SEO.", "/products"), { message: "Start Bulk SEO." });
  rememberBulkSeoTicks([]);
});

test("the card keeps reading the thread while Import is in progress", () => {
  assert.equal(importRunning([]), false);
  assert.equal(importRunning([{ role: "seller", text: "Import the shop." }]), false);
  assert.equal(importRunning([{ role: "chat", text: "Import is in progress." }]), true);
  assert.equal(
    importRunning([
      { role: "chat", text: "Import is in progress." },
      { role: "chat", text: "An Import is already in progress." },
    ]),
    true,
  );
  assert.equal(
    importRunning([
      { role: "chat", text: "Import is in progress." },
      { role: "chat", text: "An Import is already in progress." },
      { role: "chat", text: "Created 1 · skipped 0 · failed 0" },
    ]),
    false,
  );
});
