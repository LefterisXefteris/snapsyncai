import test from "node:test";
import assert from "node:assert/strict";

import {
  WEBSITE_BRIEF_HINT,
  WEBSITE_BRIEF_LABEL,
  WEBSITE_EMPTY,
  WEBSITE_NEEDS_SHOPIFY,
  WEBSITE_PUBLISH_WAITS,
} from "../client/src/lib/website-copy.ts";

test("website copy asks for a brief, and Publish waits for a look", () => {
  assert.equal(WEBSITE_BRIEF_LABEL, "Website brief");
  assert.match(WEBSITE_BRIEF_HINT, /Shoppers do not see it/);
  assert.match(WEBSITE_PUBLISH_WAITS, /look comes back/);
  assert.match(WEBSITE_NEEDS_SHOPIFY, /Shopify/);
  assert.match(WEBSITE_EMPTY, /listing copy/);
  assert.doesNotMatch(
    `${WEBSITE_EMPTY} ${WEBSITE_NEEDS_SHOPIFY} ${WEBSITE_BRIEF_HINT} ${WEBSITE_PUBLISH_WAITS}`,
    /lovable|palette|tone|token|api key/i,
  );
});
