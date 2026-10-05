import test from "node:test";
import assert from "node:assert/strict";

import {
  WEBSITE_EMPTY,
  WEBSITE_NEEDS_SHOPIFY,
  WEBSITE_PALETTES,
  WEBSITE_PREVIEW_NOTE,
  WEBSITE_TYPES,
} from "../client/src/lib/website-copy.ts";

test("website copy asks for a palette and type, not a Lovable account", () => {
  assert.deepEqual(
    WEBSITE_PALETTES.map((item) => item.label),
    ["Ground", "Ink", "Clay"],
  );
  assert.deepEqual(
    WEBSITE_TYPES.map((item) => item.id),
    ["sans", "serif"],
  );
  assert.match(WEBSITE_NEEDS_SHOPIFY, /Shopify/);
  assert.match(WEBSITE_EMPTY, /listing copy/);
  assert.match(WEBSITE_PREVIEW_NOTE, /not the site shoppers open/i);
  assert.doesNotMatch(
    `${WEBSITE_EMPTY} ${WEBSITE_NEEDS_SHOPIFY} ${WEBSITE_PREVIEW_NOTE}`,
    /lovable|tone|token|api key/i,
  );
});
