import test from "node:test";
import assert from "node:assert/strict";

import { extractAsDraft, addToDraft, separateAsDraft, confirmCount, setThumbnail } from "../client/src/lib/draft-products.ts";

function photo(id: string) {
  return { id };
}

function draft(id: string, photoIds: string[]) {
  return { id, items: photoIds.map(photo) };
}

function shape(drafts: { id: string; items: { id: string }[] }[]) {
  return drafts.map(d => [d.id, d.items.map(i => i.id)]);
}

test("Group extracts selected photos into a new draft and leaves unselected photos", () => {
  const drafts = [
    draft("A", ["a1", "a2", "a3"]),
    draft("B", ["b1", "b2"]),
  ];

  const next = extractAsDraft(drafts, ["a1", "a2", "b1"], "C");

  assert.deepEqual(shape(next), [
    ["C", ["a1", "a2", "b1"]],
    ["A", ["a3"]],
    ["B", ["b2"]],
  ]);
});

test("Add to moves selected photos onto the chosen draft and does not replace it", () => {
  const drafts = [
    draft("coat", ["c1", "c2", "c3"]),
    draft("stray", ["s1"]),
  ];

  const next = addToDraft(drafts, ["s1"], "coat");

  assert.deepEqual(shape(next), [
    ["coat", ["c1", "c2", "c3", "s1"]],
  ]);
});

test("Separate peels the selection into its own draft including a single photo", () => {
  const drafts = [
    draft("coat", ["c1", "c2", "c3"]),
  ];

  const next = separateAsDraft(drafts, ["c2"], "peeled");

  assert.deepEqual(shape(next), [
    ["peeled", ["c2"]],
    ["coat", ["c1", "c3"]],
  ]);
});

test("Confirm count is every draft after grouping, including leftover one-photo drafts", () => {
  const singles = [
    draft("s1", ["p1"]),
    draft("s2", ["p2"]),
    draft("s3", ["p3"]),
  ];

  const grouped = extractAsDraft(singles, ["p1", "p2"], "g");

  assert.equal(confirmCount(grouped), 2);
});

test("Set as thumbnail moves that photo to the front of its draft", () => {
  const drafts = [draft("coat", ["c1", "c2", "c3"])];
  const next = setThumbnail(drafts, "c3");
  assert.deepEqual(shape(next), [["coat", ["c3", "c1", "c2"]]]);
});
