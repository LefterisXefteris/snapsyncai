import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { IMPORT_IDLE, importStartEnabled } from "../client/src/lib/import-copy.ts";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const page = readFileSync(path.join(root, "client/src/pages/Import.tsx"), "utf8");
const inventory = readFileSync(path.join(root, "client/src/pages/Inventory.tsx"), "utf8");

test("Start is disabled when Shopify is not connected or a run is in progress", () => {
  assert.equal(
    importStartEnabled({
      startBlockedReason: "Connect Shopify in Settings before you Import.",
      inProgress: false,
    }),
    false,
  );
  assert.equal(importStartEnabled({ startBlockedReason: null, inProgress: true }), false);
  assert.equal(importStartEnabled({ startBlockedReason: null, inProgress: false }), true);
});

test("Import page is the job, not a stub, and has no Push chrome", () => {
  assert.match(page, /from ["']@\/lib\/import-copy["']/);
  assert.match(page, /useImportStart/);
  assert.match(page, /Start/);
  assert.doesNotMatch(page, /WorkspaceStubPage/);
  assert.doesNotMatch(page, /Push to Shopify/);
  assert.doesNotMatch(page, /not available yet/i);
  assert.match(IMPORT_IDLE, /catalogue/i);
});

test("Inventory Autopilot does not label stock setup as Import", () => {
  assert.doesNotMatch(inventory, /Import Shopify catalog/);
  assert.doesNotMatch(inventory, /Import your Shopify catalog/);
});
