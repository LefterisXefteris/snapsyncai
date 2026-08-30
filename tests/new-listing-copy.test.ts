import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const uploadZone = readFileSync(path.join(root, "client/src/components/upload-zone.tsx"), "utf8");
const lightTable = readFileSync(
  path.join(root, "client/src/components/listing-light-table.tsx"),
  "utf8",
);

test("New listing copy does not tell the seller to drag to regroup", () => {
  assert.doesNotMatch(uploadZone, /Drag to regroup/);
  assert.doesNotMatch(lightTable, /Drag to regroup/);
});

test("New listing grouping copy does not call grouping variants", () => {
  assert.doesNotMatch(uploadZone, /group variants/i);
  assert.doesNotMatch(lightTable, /group variants/i);
});

test("Confirm is labeled Create N products", () => {
  assert.match(lightTable, /Create \{n\} product/);
});

test("thumbnail can be set from the selection dock without drag", () => {
  assert.match(lightTable, /onSetThumbnail/);
  assert.match(lightTable, /Thumbnail/);
});

test("selected photos collect in a dock with Group Add to Separate and Create", () => {
  assert.match(lightTable, /collect/i);
  assert.match(lightTable, /\bGroup\b/);
  assert.match(lightTable, /Add to/);
  assert.match(lightTable, /\bSeparate\b/);
});

test("multi-photo drafts are one frame with a clickable photo count", () => {
  assert.match(lightTable, /data-testid="multi-photo-draft"/);
  assert.match(lightTable, /data-testid="multi-photo-draft-count"/);
  assert.match(lightTable, /onSelectDraft/);
});

test("New listing packs multi-photo drafts on restore and after a photo is removed", () => {
  assert.match(uploadZone, /packMultiPhotoFirst/);
});
