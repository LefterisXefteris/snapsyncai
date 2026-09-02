import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  BULK_SEO_EMPTY,
  bulkSeoEligibleIds,
  bulkSeoEligibleTickCount,
  bulkSeoStartEnabled,
} from "../client/src/lib/bulk-seo.ts";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const page = readFileSync(path.join(root, "client/src/pages/BulkSeo.tsx"), "utf8");

const rows = [
  { id: 1, eligible: true },
  { id: 2, eligible: false },
  { id: 3, eligible: true },
];

test("Select all means eligible catalogue rows only", () => {
  assert.deepEqual(bulkSeoEligibleIds(rows), [1, 3]);
});

test("Start is disabled without a Plan, without demand, or with no eligible ticks", () => {
  assert.equal(
    bulkSeoStartEnabled({ startBlockedReason: "Subscribe to a Plan", eligibleTickCount: 2 }),
    false,
  );
  assert.equal(
    bulkSeoStartEnabled({
      startBlockedReason: "Search demand is not configured.",
      eligibleTickCount: 2,
    }),
    false,
  );
  assert.equal(
    bulkSeoStartEnabled({ startBlockedReason: null, eligibleTickCount: 0 }),
    false,
  );
  assert.equal(
    bulkSeoStartEnabled({ startBlockedReason: null, eligibleTickCount: 2 }),
    true,
  );
});

test("proposed uses count ticked eligible products, not blocked rows", () => {
  assert.equal(bulkSeoEligibleTickCount(rows, [1, 2, 3]), 2);
  assert.equal(bulkSeoEligibleTickCount(rows, [2]), 0);
});

test("empty catalogue copy is an empty state, not a broken picker", () => {
  assert.match(BULK_SEO_EMPTY, /catalogue/i);
  assert.doesNotMatch(BULK_SEO_EMPTY, /not available yet/i);
});

test("Bulk SEO page is the picker, not a stub, and has no Push chrome", () => {
  assert.match(page, /from ["']@\/lib\/bulk-seo["']/);
  assert.match(page, /useBulkSeoStart/);
  assert.match(page, /Regenerate/);
  assert.match(page, /Dismiss/);
  assert.match(page, /Accept/);
  assert.doesNotMatch(page, /WorkspaceStubPage/);
  assert.doesNotMatch(page, /Push to Shopify/);
  assert.doesNotMatch(page, /Agentic SEO|SEO agent/i);
});
