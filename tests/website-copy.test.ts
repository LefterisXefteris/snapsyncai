import test from "node:test";
import assert from "node:assert/strict";

import {
  WEBSITE_EMPTY,
  WEBSITE_LOOK_HINT,
  WEBSITE_NEEDS_SHOPIFY,
} from "../client/src/lib/website-copy.ts";

test("website copy does not ask for tokens or a brand tone", () => {
  assert.match(WEBSITE_LOOK_HINT, /listing copy/i);
  assert.doesNotMatch(WEBSITE_LOOK_HINT, /tone|token|api key/i);
  assert.match(WEBSITE_NEEDS_SHOPIFY, /Shopify/);
  assert.match(WEBSITE_EMPTY, /listing copy/);
});
