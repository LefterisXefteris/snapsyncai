import test from "node:test";
import assert from "node:assert/strict";

import {
  WEBSITE_ADDRESS_KEPT,
  WEBSITE_BRIEF_HINT,
  WEBSITE_BRIEF_LABEL,
  WEBSITE_EMPTY,
  WEBSITE_LIVE,
  WEBSITE_NEEDS_SHOPIFY,
  WEBSITE_PUBLISH_WAITS,
  WEBSITE_TAKE_DOWN,
} from "../client/src/lib/website-copy.ts";

test("website copy asks for a brief, and Publish waits for a look", () => {
  assert.equal(WEBSITE_BRIEF_LABEL, "Website brief");
  assert.match(WEBSITE_BRIEF_HINT, /Shoppers do not see it/);
  assert.match(WEBSITE_PUBLISH_WAITS, /look comes back/);
  assert.match(WEBSITE_NEEDS_SHOPIFY, /Shopify/);
  assert.match(WEBSITE_EMPTY, /listing copy/);
  assert.equal(WEBSITE_TAKE_DOWN, "Take down");
  assert.equal(WEBSITE_LIVE("tees.sites.snapsyncai.co.uk"), "Shoppers open tees.sites.snapsyncai.co.uk.");
  assert.match(WEBSITE_ADDRESS_KEPT, /address stays reserved/);
  assert.doesNotMatch(
    `${WEBSITE_EMPTY} ${WEBSITE_NEEDS_SHOPIFY} ${WEBSITE_BRIEF_HINT} ${WEBSITE_PUBLISH_WAITS} ${WEBSITE_TAKE_DOWN} ${WEBSITE_ADDRESS_KEPT}`,
    /lovable|palette|tone|token|api key/i,
  );
});
