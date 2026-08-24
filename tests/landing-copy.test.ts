import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  JOBS,
  LANDING_BRAND,
  LANDING_H1,
  LANDING_PRIMARY_CTA,
  LANDING_SECONDARY_CTA,
  STEPS,
  landingVisibleText,
} from "../client/src/lib/landing-copy.ts";

const html = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "../client/index.html"),
  "utf8",
);

test("the wordmark is SnapSync, not SnapSync AI", () => {
  assert.equal(LANDING_BRAND, "SnapSync");
  assert.equal(new RegExp("SnapSync AI", "i").test(landingVisibleText()), false);
});

test("the hero names a textile seller workspace, then facts before listing copy", () => {
  assert.match(LANDING_H1, /workspace/i);
  assert.match(LANDING_H1, /textile/i);
  const text = landingVisibleText().toLowerCase();
  for (const phrase of [
    "fibre composition",
    "care instructions",
    "gpsr",
    "listing copy",
    "shopify",
  ]) {
    assert.match(text, new RegExp(phrase));
  }
});

test("jobs are the four live ones, listing-first", () => {
  assert.deepEqual(
    JOBS.map((job) => job.title),
    ["New listing", "Product facts, then listing copy", "Products", "Inventory Autopilot"],
  );
});

test("how it works is photo, confirm facts, listing copy, Shopify", () => {
  assert.deepEqual(
    STEPS.map((step) => step.title),
    ["Photos", "Confirm facts", "Listing copy", "Push to Shopify"],
  );
});

test("primary CTA is Start free; secondary is How it works", () => {
  assert.equal(LANDING_PRIMARY_CTA, "Start free");
  assert.equal(LANDING_SECONDARY_CTA, "How it works");
});

test("copy does not sell unshipped jobs, fake proof, or the old generator story", () => {
  const text = landingVisibleText().toLowerCase();
  for (const phrase of [
    "wix",
    "vinted",
    "image editor",
    "ceramic",
    "vase",
    "500+",
    "4.9",
    "90%",
    "watch demo",
    "push to all stores",
    "listings, everywhere",
    "est. 2027",
    "supercharge",
    "review queue",
  ]) {
    assert.equal(text.includes(phrase), false, `forbidden: ${phrase}`);
  }
});

test("document meta describes SnapSync the workspace, on snapsyncai.co.uk", () => {
  assert.match(html, /<title>SnapSync — /);
  assert.doesNotMatch(html, /SnapSync AI/);
  assert.doesNotMatch(html, /listing generator/i);
  assert.match(html, /snapsyncai\.co\.uk/);
  assert.doesNotMatch(html, /replit\.app/);
});
