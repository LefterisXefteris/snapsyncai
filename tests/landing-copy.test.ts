import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  CREDIT_PACKS,
  FAQ_DATA,
  FOOTER_BLURB,
  JOBS,
  LANDING_BRAND,
  LANDING_CHANNELS,
  LANDING_DOCUMENT_TITLE,
  LANDING_EYEBROW,
  LANDING_H1,
  LANDING_META_DESCRIPTION,
  LANDING_PRIMARY_CTA,
  LANDING_SECONDARY_CTA,
  LANDING_SUBHEAD,
  PRICING_BULLETS,
  STEPS,
  landingVisibleText,
} from "../client/src/lib/landing-copy.ts";

const html = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "../client/index.html"),
  "utf8",
);

const PRODUCT_KIND_WORDS = /textile|coffee|product kind/i;

test("the wordmark is SnapSync, not SnapSync AI", () => {
  assert.equal(LANDING_BRAND, "SnapSync");
  assert.equal(new RegExp("SnapSync AI", "i").test(landingVisibleText()), false);
});

test("the hero leads on AI listing copy from photos, facts first", () => {
  assert.equal(LANDING_EYEBROW, "Photos → facts → AI listing copy");
  assert.equal(LANDING_H1, "AI listing copy from your product photos.");
  assert.match(LANDING_SUBHEAD, /confirm/i);
  assert.match(LANDING_SUBHEAD, /facts/i);
  assert.match(LANDING_SUBHEAD, /listing copy/i);
  assert.match(LANDING_SUBHEAD, /Shopify/);
  assert.match(LANDING_SUBHEAD, /Trendyol International/);
});

test("the first viewport names both live Channels", () => {
  assert.match(LANDING_CHANNELS, /Shopify/);
  assert.match(LANDING_CHANNELS, /Trendyol International/);
});

test("Product kind stays out of the hero, meta, jobs, and step titles", () => {
  for (const claim of [
    LANDING_EYEBROW,
    LANDING_H1,
    LANDING_SUBHEAD,
    LANDING_CHANNELS,
    LANDING_DOCUMENT_TITLE,
    LANDING_META_DESCRIPTION,
    FOOTER_BLURB,
    ...JOBS.flatMap((job) => [job.title, job.description]),
    ...STEPS.flatMap((step) => [step.title, step.description]),
  ]) {
    assert.doesNotMatch(claim, PRODUCT_KIND_WORDS, claim);
  }
  assert.equal(landingVisibleText().toLowerCase().includes("textile-first"), false);
});

test("exactly one FAQ names both Product kinds and the Coffee product Shopify-only Push", () => {
  const kindFaqs = FAQ_DATA.filter((faq) => PRODUCT_KIND_WORDS.test(`${faq.question} ${faq.answer}`));
  assert.equal(kindFaqs.length, 1);
  const [faq] = kindFaqs;
  assert.equal(faq.question, "What facts do I confirm?");
  assert.match(faq.answer, /Textile product/);
  assert.match(faq.answer, /Coffee product/);
  assert.match(faq.answer, /Coffee product[^.]*Shopify only|Shopify only[^.]*Coffee product/);
  for (const phrase of [/fibre composition/i, /care instructions/i, /GPSR/]) {
    assert.match(faq.answer, phrase);
  }
});

test("jobs are Products, Import & Inventory, then Bulk SEO", () => {
  assert.deepEqual(
    JOBS.map((job) => job.title),
    ["Products", "Import & Inventory", "Bulk SEO"],
  );
  const bulkSeo = JOBS[2].description;
  assert.match(bulkSeo, /one Credit per Accept/i);
  assert.match(bulkSeo, /Accept does not Push/i);
});

test("how it works is photo, confirm facts, listing copy, then Push to a Channel", () => {
  assert.deepEqual(
    STEPS.map((step) => step.title),
    ["Photos", "Confirm facts", "Listing copy", "Push to a Channel"],
  );
  assert.match(STEPS[2].description, /confirmed facts/i);
  assert.match(STEPS[2].description, /not invented from the photo/i);
});

test("primary CTA is Start free; secondary is How it works", () => {
  assert.equal(LANDING_PRIMARY_CTA, "Start free");
  assert.equal(LANDING_SECONDARY_CTA, "How it works");
});

test("the footer names AI listing copy and New listing as one job", () => {
  assert.match(FOOTER_BLURB, /AI listing copy/);
  assert.match(FOOTER_BLURB, /New listing from photos is one job/);
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
    "listings everywhere",
    "est. 2027",
    "supercharge",
    "review queue",
    "listing generator",
    "workspace",
    "not a textile",
  ]) {
    assert.equal(text.includes(phrase), false, `forbidden: ${phrase}`);
  }
});

test("pricing is three free Credits then packs of 10, 50, and 100, one per Accept", () => {
  assert.deepEqual(
    CREDIT_PACKS.map((pack) => [pack.credits, pack.price]),
    [
      [10, "£7"],
      [50, "£30"],
      [100, "£55"],
    ],
  );
  const pricing = PRICING_BULLETS.join("\n").toLowerCase();
  assert.match(pricing, /three free credits/);
  assert.match(pricing, /one credit is spent when an accept lands/);
  assert.match(pricing, /catalogue, facts, and typed listing copy stay free/);

  const text = landingVisibleText().toLowerCase();
  for (const phrase of ["£0.70", "£19", "£190", "£4", "30 product", "unlock", "bulk seo free"]) {
    assert.equal(text.includes(phrase), false, `forbidden: ${phrase}`);
  }
  assert.doesNotMatch(text, /\bplan\b/);
});

test("index.html meta matches the landing-copy title and description on snapsyncai.co.uk", () => {
  assert.match(LANDING_DOCUMENT_TITLE, /^SnapSync — /);
  assert.match(LANDING_DOCUMENT_TITLE, /AI listing copy/);
  assert.match(LANDING_META_DESCRIPTION, /AI listing copy/);
  assert.ok(html.includes(`<title>${LANDING_DOCUMENT_TITLE}</title>`));
  assert.ok(html.includes(`<meta name="description" content="${LANDING_META_DESCRIPTION}" />`));
  assert.doesNotMatch(html, /SnapSync AI/);
  assert.doesNotMatch(html, /listing generator/i);
  assert.doesNotMatch(html, /£0\.70/);
  assert.doesNotMatch(html, /textile and coffee listings/i);
  assert.match(html, /snapsyncai\.co\.uk/);
  assert.doesNotMatch(html, /replit\.app/);
});
