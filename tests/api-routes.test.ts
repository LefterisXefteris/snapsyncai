import test from "node:test";
import assert from "node:assert/strict";

import { api, buildUrl } from "../client/src/lib/api-routes.ts";

test("list and upload paths stay the existing /api/images routes", () => {
  assert.equal(api.images.list.path, "/api/images");
  assert.equal(api.images.list.method, "GET");
  assert.equal(api.images.upload.path, "/api/images/upload");
  assert.equal(api.images.upload.method, "POST");
});

test("buildUrl substitutes path params used by the SPA", () => {
  assert.equal(buildUrl(api.images.update.path, { id: 12 }), "/api/images/12");
  assert.equal(buildUrl(api.images.delete.path, { id: 12 }), "/api/images/12");
  assert.equal(buildUrl(api.images.deleteGroup.path, { groupId: "g1" }), "/api/images/group/g1");
  assert.equal(
    buildUrl(api.images.generateContent.path, { id: 7 }),
    "/api/images/7/generate-content",
  );
  assert.equal(
    buildUrl(api.images.regenerateField.path, { id: 7 }),
    "/api/images/7/regenerate-field",
  );
  assert.equal(
    buildUrl(api.images.confirmProductFacts.path, { id: 7 }),
    "/api/images/7/product-facts/confirm",
  );
});

test("Shopify connect paths stay on /api/shopify", () => {
  assert.equal(api.shopify.status.path, "/api/shopify/status");
  assert.equal(api.shopify.oauthStart.path, "/api/shopify/oauth/start");
  assert.equal(api.shopify.disconnect.path, "/api/shopify/disconnect");
  assert.equal(api.shopify.gpsrIdentity.path, "/api/shopify/gpsr-identity");
  assert.equal(api.shopify.gpsrIdentity.method, "PUT");
  assert.equal(api.images.pushToShopify.path, "/api/images/push-to-shopify");
});
