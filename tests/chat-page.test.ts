import assert from "node:assert/strict";
import test from "node:test";

import {
  applyGroupedDraftPhotos,
  chatBody,
  choosePhotos,
  closeChatCard,
  importRunning,
  intakeSentences,
  newListingDrafts,
  openProductId,
  registerPhotoIntake,
  rememberBulkSeoTicks,
  rememberNewListingDrafts,
  rememberNewListingSelection,
  rememberPageProposal,
  selectedDraftPhotoIds,
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
  closeChatCard();
  rememberNewListingDrafts([]);
  rememberNewListingSelection([]);

  choosePhotos([photo("coat.jpg")]);

  const drafts = newListingDrafts();
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].items.length, 1);
  assert.deepEqual(selectedDraftPhotoIds(), []);
  assert.deepEqual(intakeSentences(), ["1 draft product is on New listing."]);
  assert.deepEqual(chatBody("hello", "/products"), { message: "hello" });
});

test("four photos become four unselected drafts after the ones already there", () => {
  closeChatCard();
  rememberNewListingDrafts([{ id: "coat", items: [{ id: "c1" }] }]);
  rememberNewListingSelection(["c1"]);

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
  assert.deepEqual(intakeSentences(), ["4 draft products are on New listing."]);
});

test("a file that is not a photo is skipped", () => {
  closeChatCard();
  rememberNewListingDrafts([{ id: "coat", items: [{ id: "c1" }] }]);
  rememberNewListingSelection([]);

  choosePhotos([photo("a.jpg"), { name: "notes.txt", type: "text/plain" }]);

  assert.equal(newListingDrafts().length, 2);
  assert.equal(newListingDrafts()[0].id, "coat");
  assert.deepEqual(intakeSentences(), ["1 draft product is on New listing."]);
});

test("a pick with no photos yields the failure sentence and no drafts", () => {
  closeChatCard();
  rememberNewListingDrafts([{ id: "coat", items: [{ id: "c1" }] }]);

  choosePhotos([{ name: "notes.txt", type: "text/plain" }]);

  assert.equal(newListingDrafts().length, 1);
  assert.equal(newListingDrafts()[0].id, "coat");
  assert.deepEqual(intakeSentences(), ["None of those are photos."]);
});

test("a cancelled pick yields no sentence and no drafts", () => {
  closeChatCard();
  rememberNewListingDrafts([{ id: "coat", items: [{ id: "c1" }] }]);

  choosePhotos(null);
  choosePhotos([]);

  assert.equal(newListingDrafts().length, 1);
  assert.deepEqual(intakeSentences(), []);
});

test("a canvas that keeps none of the photos adds no sentence and no drafts", () => {
  closeChatCard();
  rememberNewListingDrafts([{ id: "coat", items: [{ id: "c1" }] }]);
  const stop = registerPhotoIntake(() => false);

  choosePhotos([photo("a.jpg")]);
  stop();

  assert.equal(newListingDrafts().length, 1);
  assert.equal(newListingDrafts()[0].id, "coat");
  assert.deepEqual(intakeSentences(), []);
});

test("close clears the sentences and leaves the drafts", () => {
  closeChatCard();
  rememberNewListingDrafts([]);

  choosePhotos([photo("a.jpg")]);
  choosePhotos([photo("b.jpg")]);

  assert.deepEqual(intakeSentences(), [
    "1 draft product is on New listing.",
    "1 draft product is on New listing.",
  ]);
  assert.equal(newListingDrafts().length, 2);

  closeChatCard();

  assert.deepEqual(intakeSentences(), []);
  assert.equal(newListingDrafts().length, 2);
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
