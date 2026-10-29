import assert from "node:assert/strict";
import test from "node:test";

import * as chatPage from "../client/src/lib/chat-page.ts";
import {
  applyGroupedDraftPhotos,
  chatBody,
  choosePhotos,
  holdUndos,
  importRunning,
  intakeSentences,
  landUndo,
  newListingDrafts,
  openProductId,
  registerPhotoIntake,
  rememberBulkSeoTicks,
  rememberNewListingDrafts,
  rememberNewListingSelection,
  rememberPageProposal,
  selectedDraftPhotoIds,
  undoControls,
  undoWrite,
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

test("selected draft photos go with a Group message only on New listing", () => {
  rememberNewListingSelection(["c1", "h1"]);
  assert.deepEqual(chatBody("Group them.", "/new"), {
    message: "Group them.",
    draftPhotoIds: ["c1", "h1"],
  });
  assert.deepEqual(chatBody("Group them.", "/"), { message: "Group them." });
  assert.deepEqual(chatBody("Group them.", "/products"), { message: "Group them." });
  assert.deepEqual(chatBody("Group them.", "/product/8"), {
    message: "Group them.",
    openProductId: 8,
  });
  rememberNewListingSelection(["c1"]);
  assert.deepEqual(chatBody("Group them.", "/new"), { message: "Group them." });
  rememberNewListingSelection([]);
  assert.deepEqual(chatBody("Group them.", "/new"), { message: "Group them." });
});

test("grouped photos become one draft and unselected photos stay", () => {
  rememberNewListingDrafts([
    { id: "coat", items: [{ id: "c1" }, { id: "c2" }] },
    { id: "hat", items: [{ id: "h1" }] },
  ]);
  rememberNewListingSelection(["c1", "h1"]);

  applyGroupedDraftPhotos(["c1", "h1"]);

  const drafts = newListingDrafts();
  const grouped = drafts.find((draft) => draft.items.length === 2);
  const left = drafts.find((draft) => draft.id === "coat");
  assert.equal(drafts.length, 2);
  assert.deepEqual(grouped?.items.map((item) => item.id), ["c1", "h1"]);
  assert.notEqual(grouped?.id, "coat");
  assert.notEqual(grouped?.id, "hat");
  assert.deepEqual(left?.items.map((item) => item.id), ["c2"]);
  assert.deepEqual(selectedDraftPhotoIds(), []);
});

test("a Group that names nothing leaves the canvas as it was", () => {
  rememberNewListingDrafts([
    { id: "coat", items: [{ id: "c1" }] },
    { id: "hat", items: [{ id: "h1" }] },
  ]);
  rememberNewListingSelection(["c1"]);

  applyGroupedDraftPhotos([]);
  applyGroupedDraftPhotos(["c1"]);

  assert.deepEqual(
    newListingDrafts().map((draft) => [draft.id, draft.items.map((item) => item.id)]),
    [
      ["coat", ["c1"]],
      ["hat", ["h1"]],
    ],
  );
  assert.deepEqual(selectedDraftPhotoIds(), ["c1"]);
});

function photo(name: string) {
  return { name, type: "image/jpeg" };
}

test("one photo becomes one unselected draft and the singular sentence", () => {
  rememberNewListingDrafts([]);
  rememberNewListingSelection([]);
  const linesBefore = intakeSentences().length;

  choosePhotos([photo("coat.jpg")]);

  const drafts = newListingDrafts();
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].items.length, 1);
  assert.deepEqual(selectedDraftPhotoIds(), []);
  assert.deepEqual(intakeSentences().slice(linesBefore), ["1 draft product is on New listing."]);
  assert.deepEqual(chatBody("hello", "/products"), { message: "hello" });
});

test("four photos become four unselected drafts after the ones already there", () => {
  rememberNewListingDrafts([{ id: "coat", items: [{ id: "c1" }] }]);
  rememberNewListingSelection(["c1"]);
  const linesBefore = intakeSentences().length;

  choosePhotos([photo("a.jpg"), photo("b.jpg"), photo("c.jpg"), photo("d.jpg")]);

  const drafts = newListingDrafts();
  assert.equal(drafts[0].id, "coat");
  assert.deepEqual(drafts[0].items.map((item) => item.id), ["c1"]);
  assert.equal(drafts.length, 5);
  for (const draft of drafts.slice(1)) {
    assert.equal(draft.items.length, 1);
    assert.equal(selectedDraftPhotoIds().includes(draft.items[0].id), false);
  }
  assert.deepEqual(selectedDraftPhotoIds(), ["c1"]);
  assert.deepEqual(intakeSentences().slice(linesBefore), ["4 draft products are on New listing."]);
});

test("a file that is not a photo is skipped", () => {
  rememberNewListingDrafts([{ id: "coat", items: [{ id: "c1" }] }]);
  rememberNewListingSelection([]);
  const linesBefore = intakeSentences().length;

  choosePhotos([photo("a.jpg"), { name: "notes.txt", type: "text/plain" }]);

  assert.equal(newListingDrafts().length, 2);
  assert.equal(newListingDrafts()[0].id, "coat");
  assert.deepEqual(intakeSentences().slice(linesBefore), ["1 draft product is on New listing."]);
});

test("a pick with no photos yields the failure sentence and no drafts", () => {
  rememberNewListingDrafts([{ id: "coat", items: [{ id: "c1" }] }]);
  const linesBefore = intakeSentences().length;

  choosePhotos([{ name: "notes.txt", type: "text/plain" }]);

  assert.equal(newListingDrafts().length, 1);
  assert.equal(newListingDrafts()[0].id, "coat");
  assert.deepEqual(intakeSentences().slice(linesBefore), ["None of those are photos."]);
});

test("a cancelled pick yields no sentence and no drafts", () => {
  rememberNewListingDrafts([{ id: "coat", items: [{ id: "c1" }] }]);
  const linesBefore = [...intakeSentences()];

  choosePhotos(null);
  choosePhotos([]);

  assert.equal(newListingDrafts().length, 1);
  assert.deepEqual(intakeSentences(), linesBefore);
});

test("a canvas that keeps none of the photos adds no sentence and no drafts", () => {
  rememberNewListingDrafts([{ id: "coat", items: [{ id: "c1" }] }]);
  const linesBefore = [...intakeSentences()];
  const stop = registerPhotoIntake(() => false);

  choosePhotos([photo("a.jpg")]);
  stop();

  assert.equal(newListingDrafts().length, 1);
  assert.equal(newListingDrafts()[0].id, "coat");
  assert.deepEqual(intakeSentences(), linesBefore);
});

test("a later pick stacks another sentence and the drafts stay", () => {
  const linesBefore = intakeSentences().length;
  const draftsBefore = newListingDrafts().length;

  choosePhotos([photo("a.jpg")]);
  choosePhotos([photo("b.jpg")]);

  assert.deepEqual(intakeSentences().slice(linesBefore), [
    "1 draft product is on New listing.",
    "1 draft product is on New listing.",
  ]);
  assert.equal(newListingDrafts().length, draftsBefore + 2);
  assert.equal("closeChatCard" in chatPage, false);
});

test("a selling reply keeps Undo for 9 seconds, and a second reply keeps its own", () => {
  let held = holdUndos([], [{ replyIndex: 1, kind: "selling", productId: 7, price: "12.50" }], 0);
  held = holdUndos(held, [{ replyIndex: 3, kind: "selling", productId: 9, sku: "WOOL" }], 4_000);

  assert.deepEqual(
    undoControls(held, 8_000).map((item) => item.replyIndex),
    [1, 3],
  );
  assert.deepEqual(
    undoControls(held, 9_000).map((item) => item.replyIndex),
    [3],
  );
  assert.deepEqual(undoControls(held, 13_000), []);
  assert.equal(undoWrite(held, 1, 13_000), null);
});

test("undo puts the previous selling back, including an empty price, and drops only when the write lands", () => {
  const held = holdUndos(
    [],
    [{ replyIndex: 1, kind: "selling", productId: 7, price: "", sku: "OLD" }],
    0,
  );

  assert.deepEqual(undoWrite(held, 1, 1_000), {
    method: "PUT",
    path: "/api/images/7",
    body: { price: null, sku: "OLD" },
    refresh: ["/api/images", "/api/images/group"],
  });
  assert.deepEqual(undoControls(held, 1_000), [
    { replyIndex: 1, kind: "selling", productId: 7, price: "", sku: "OLD" },
  ]);
  assert.deepEqual(undoControls(landUndo(held, 1), 1_000), []);
});

test("a thread with no previous selling shows no undo", () => {
  assert.deepEqual(undoControls([], 0), []);
  assert.equal(undoWrite([], 1, 0), null);
});

test("an inventory reply keeps Undo for 9 seconds, and the write puts the previous quantity back", () => {
  const shownAt = 1_000;
  const held = holdUndos(
    [],
    [{ replyIndex: 1, kind: "inventory", itemId: 3, quantity: 12 }],
    shownAt,
  );

  assert.deepEqual(undoControls(held, shownAt + 8_999), [
    { replyIndex: 1, kind: "inventory", itemId: 3, quantity: 12 },
  ]);
  assert.deepEqual(undoControls(held, shownAt + 9_000), []);
  assert.equal(undoWrite(held, 1, shownAt + 9_000), null);
  assert.deepEqual(undoWrite(held, 1, shownAt + 500), {
    method: "POST",
    path: "/api/inventory/items/3/adjustments",
    body: { mode: "set", quantity: 12, reason: "Undo" },
    refresh: ["/api/inventory/overview", "/api/inventory/items"],
  });
  assert.deepEqual(undoControls(landUndo(held, 1), shownAt + 500), []);
});

test("a second inventory reply keeps the first Undo until that reply's 9 seconds end", () => {
  const first = holdUndos([], [{ replyIndex: 1, kind: "inventory", itemId: 3, quantity: 12 }], 0);
  const both = holdUndos(first, [{ replyIndex: 3, kind: "inventory", itemId: 8, quantity: 4 }], 1_000);

  assert.deepEqual(
    undoControls(both, 8_999).map((control) => control.replyIndex),
    [1, 3],
  );
  assert.deepEqual(
    undoControls(both, 9_000).map((control) => control.replyIndex),
    [3],
  );
  assert.deepEqual(undoWrite(both, 1, 8_999), {
    method: "POST",
    path: "/api/inventory/items/3/adjustments",
    body: { mode: "set", quantity: 12, reason: "Undo" },
    refresh: ["/api/inventory/overview", "/api/inventory/items"],
  });
  assert.deepEqual(undoWrite(both, 3, 9_000), {
    method: "POST",
    path: "/api/inventory/items/8/adjustments",
    body: { mode: "set", quantity: 4, reason: "Undo" },
    refresh: ["/api/inventory/overview", "/api/inventory/items"],
  });
});

const EARLIER = {
  manufacturer: { name: "Old Mill", postalAddress: "2 Loom Street", email: "old@example.com" },
  manufacturerInEu: true,
};

test("a publications reply keeps Undo for 9 seconds and puts the previous set back, including an empty set", () => {
  const shownAt = 1_000;
  const held = holdUndos(
    [],
    [{ replyIndex: 1, kind: "publications", productId: 7, publicationIds: [] }],
    shownAt,
  );

  assert.deepEqual(undoControls(held, shownAt + 8_999), [
    { replyIndex: 1, kind: "publications", productId: 7, publicationIds: [] },
  ]);
  assert.deepEqual(undoWrite(held, 1, shownAt + 8_999), {
    method: "PUT",
    path: "/api/images/7",
    body: { shopifyPublicationIds: [] },
    refresh: ["/api/images", "/api/images/group"],
  });
  assert.deepEqual(undoControls(held, shownAt + 9_000), []);
  assert.equal(undoWrite(held, 1, shownAt + 9_000), null);
  assert.deepEqual(undoControls(landUndo(held, 1), shownAt + 500), []);
});

test("a shop gpsr reply keeps Undo for 9 seconds and puts the previous identity back, including none", () => {
  const named = holdUndos([], [{ replyIndex: 1, kind: "gpsr", identity: EARLIER }], 0);
  const empty = holdUndos([], [{ replyIndex: 1, kind: "gpsr" }], 0);

  assert.deepEqual(undoWrite(named, 1, 1_000), {
    method: "PUT",
    path: "/api/shopify/gpsr-identity",
    body: EARLIER,
    refresh: ["/api/shopify/status", "/api/images", "/api/images/group"],
  });
  assert.deepEqual(undoControls(named, 8_999), [
    { replyIndex: 1, kind: "gpsr", identity: EARLIER },
  ]);
  assert.deepEqual(undoControls(named, 9_000), []);
  assert.equal(undoWrite(named, 1, 9_000), null);
  assert.deepEqual(undoWrite(empty, 1, 1_000), {
    method: "PUT",
    path: "/api/shopify/gpsr-identity",
    body: null,
    refresh: ["/api/shopify/status", "/api/images", "/api/images/group"],
  });
  assert.deepEqual(undoControls(landUndo(named, 1), 1_000), []);
  assert.deepEqual(undoControls(named, 1_000), [{ replyIndex: 1, kind: "gpsr", identity: EARLIER }]);
});

test("a publications reply and a shop gpsr reply each keep Undo until their own 9 seconds end", () => {
  const held = holdUndos(
    [],
    [{ replyIndex: 1, kind: "publications", productId: 7, publicationIds: ["gid://shopify/Publication/1"] }],
    0,
  );
  const both = holdUndos(held, [{ replyIndex: 3, kind: "gpsr", identity: EARLIER }], 4_000);

  assert.deepEqual(
    undoControls(both, 8_000).map((control) => control.replyIndex),
    [1, 3],
  );
  assert.deepEqual(undoControls(both, 9_000).map((control) => control.replyIndex), [3]);
  assert.deepEqual(undoControls(both, 13_000), []);
  assert.deepEqual(undoWrite(both, 1, 1_000), {
    method: "PUT",
    path: "/api/images/7",
    body: { shopifyPublicationIds: ["gid://shopify/Publication/1"] },
    refresh: ["/api/images", "/api/images/group"],
  });
  assert.deepEqual(undoControls([], 0), []);
  assert.equal(undoWrite([], 1, 0), null);
});

const LINEN = {
  product_kind: "textile",
  is_textile: true,
  composition: [
    { name: "cotton", percent: 80 },
    { name: "polyester", percent: 20 },
  ],
  gpsr_choice: "skip",
  care_choice: "skip",
};

test("typed listing copy keeps Undo for 9 seconds and restores the previous words, including empty", () => {
  const shownAt = 1_000;
  const held = holdUndos(
    [],
    [{ replyIndex: 1, kind: "copy", productId: 7, description: "" }],
    shownAt,
  );

  assert.deepEqual(undoControls(held, shownAt + 8_999), [
    { replyIndex: 1, kind: "copy", productId: 7, description: "" },
  ]);
  assert.deepEqual(undoControls(held, shownAt + 9_000), []);
  assert.equal(undoWrite(held, 1, shownAt + 9_000), null);
  assert.deepEqual(undoWrite(held, 1, shownAt + 500), {
    method: "PUT",
    path: "/api/images/7",
    body: { description: null },
    refresh: ["/api/images", "/api/images/group"],
  });
  assert.deepEqual(undoControls(landUndo(held, 1), shownAt + 500), []);
});

test("undo restores the previous tags, and a second listing-copy reply keeps its own control", () => {
  const first = holdUndos([], [{ replyIndex: 1, kind: "copy", productId: 7, tags: "linen, blue" }], 0);
  const both = holdUndos(
    first,
    [{ replyIndex: 3, kind: "copy", productId: 7, description: "Old copy." }],
    1_000,
  );

  assert.deepEqual(
    undoControls(both, 8_999).map((control) => control.replyIndex),
    [1, 3],
  );
  assert.deepEqual(undoWrite(both, 1, 8_999), {
    method: "PUT",
    path: "/api/images/7",
    body: { tags: ["linen", "blue"] },
    refresh: ["/api/images", "/api/images/group"],
  });
  assert.deepEqual(undoWrite(both, 3, 1_500), {
    method: "PUT",
    path: "/api/images/7",
    body: { description: "Old copy." },
    refresh: ["/api/images", "/api/images/group"],
  });
  assert.deepEqual(
    undoControls(both, 9_000).map((control) => control.replyIndex),
    [3],
  );
  assert.deepEqual(undoControls([], 0), []);
});

test("a facts reply keeps Undo for 9 seconds and confirms the previous pack", () => {
  const shownAt = 2_000;
  const held = holdUndos([], [{ replyIndex: 1, kind: "facts", productId: 7, facts: LINEN }], shownAt);

  assert.deepEqual(undoWrite(held, 1, shownAt + 500), {
    method: "POST",
    path: "/api/images/7/product-facts/confirm",
    body: LINEN,
    refresh: ["/api/images", "/api/images/group"],
  });
  assert.deepEqual(undoControls(held, shownAt + 8_999), [
    { replyIndex: 1, kind: "facts", productId: 7, facts: LINEN },
  ]);
  assert.deepEqual(undoControls(held, shownAt + 9_000), []);
  assert.equal(undoWrite(held, 1, shownAt + 9_000), null);
  assert.deepEqual(undoControls(landUndo(held, 1), shownAt + 500), []);
});

test("a second facts reply keeps the first Undo until that reply's 9 seconds end", () => {
  const wool = { ...LINEN, composition: [{ name: "wool", percent: 100 }] };
  const first = holdUndos([], [{ replyIndex: 1, kind: "facts", productId: 7, facts: LINEN }], 0);
  const both = holdUndos(first, [{ replyIndex: 3, kind: "facts", productId: 9, facts: wool }], 1_000);

  assert.deepEqual(
    undoControls(both, 8_999).map((control) => control.replyIndex),
    [1, 3],
  );
  assert.deepEqual(undoWrite(both, 1, 8_999), {
    method: "POST",
    path: "/api/images/7/product-facts/confirm",
    body: LINEN,
    refresh: ["/api/images", "/api/images/group"],
  });
  assert.deepEqual(undoWrite(both, 3, 9_000), {
    method: "POST",
    path: "/api/images/9/product-facts/confirm",
    body: wool,
    refresh: ["/api/images", "/api/images/group"],
  });
  assert.deepEqual(
    undoControls(both, 9_000).map((control) => control.replyIndex),
    [3],
  );
  assert.deepEqual(undoControls([], 0), []);
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
