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

test("the hero names your e-commerce agent for textile listings, then facts before listing copy", () => {
  assert.match(LANDING_H1, /e-commerce agent/i);
  assert.match(LANDING_H1, /textile/i);
  assert.doesNotMatch(LANDING_H1, /workspace/i);
  const text = landingVisibleText().toLowerCase();
  assert.equal(text.includes("workspace"), false);
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

test("jobs are the live ones, listing-first", () => {
  assert.deepEqual(
    JOBS.map((job) => job.title),
    [
      "New listing",
      "Product facts, then listing copy",
      "Products",
      "Import",
      "Inventory",
      "Bulk SEO",
      "Website",
      "Settings",
    ],
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

test("pricing is £19 or £190, with no extra-use charge and no weekly cap", () => {
  const text = landingVisibleText().toLowerCase();
  assert.match(text, /£19/);
  assert.match(text, /£190/);
  assert.equal(text.includes("£0.70"), false);
  assert.equal(text.includes("£4"), false);
  assert.equal(text.includes("30 product"), false);
  assert.equal(text.includes("unlock"), false);
});

test("document meta describes SnapSync the e-commerce agent, on snapsyncai.co.uk", () => {
  assert.match(html, /<title>SnapSync — /);
  assert.doesNotMatch(html, /SnapSync AI/);
  assert.doesNotMatch(html, /listing generator/i);
  assert.match(html, /snapsyncai\.co\.uk/);
  assert.doesNotMatch(html, /replit\.app/);
});
