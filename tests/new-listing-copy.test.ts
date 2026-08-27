import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const uploadZone = readFileSync(path.join(root, "client/src/components/upload-zone.tsx"), "utf8");
const inspector = readFileSync(path.join(root, "client/src/components/listing-inspector.tsx"), "utf8");

test("New listing copy does not tell the seller to drag to regroup", () => {
  assert.doesNotMatch(uploadZone, /Drag to regroup/);
  assert.doesNotMatch(inspector, /Drag to regroup/);
});

test("New listing grouping copy does not call grouping variants", () => {
  assert.doesNotMatch(uploadZone, /group variants/i);
  assert.doesNotMatch(inspector, /group variants/i);
});

test("Confirm is labeled Create N products", () => {
  assert.match(inspector, /Create \{n\} product/);
});
