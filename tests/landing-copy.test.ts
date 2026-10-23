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

test("the hero names your e-commerce agent for textile and coffee listings, then Product kind facts", () => {
  assert.match(LANDING_H1, /e-commerce agent/i);
  assert.match(LANDING_H1, /textile/i);
  assert.match(LANDING_H1, /coffee/i);
  assert.doesNotMatch(LANDING_H1, /workspace/i);
  const text = landingVisibleText().toLowerCase();
  assert.equal(text.includes("workspace"), false);
  for (const phrase of [
    "product kind",
    "fibre composition",
    "care instructions",
    "gpsr",
    "coffee",
    "listing copy",
    "shopify",
    "trendyol international",
  ]) {
    assert.match(text, new RegExp(phrase));
  }
  assert.equal(text.includes("not a textile"), false);
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
      "Settings",
    ],
  );
});

test("how it works is photo, confirm facts, listing copy, then Push to a Channel", () => {
  assert.deepEqual(
    STEPS.map((step) => step.title),
    ["Photos", "Confirm facts", "Listing copy", "Push to a Channel"],
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

test("pricing is three free writes then £0.70, with no Plan subscription", () => {
  const text = landingVisibleText().toLowerCase();
  assert.match(text, /£0\.70/);
  assert.match(text, /three free/);
  assert.equal(text.includes("£19"), false);
  assert.equal(text.includes("£190"), false);
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
