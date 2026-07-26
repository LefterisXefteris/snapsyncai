import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

import {
  decryptShopifyToken,
  encryptShopifyToken,
  INVENTORY_SHOPIFY_SCOPES,
  SHOPIFY_API_VERSION,
  verifyShopifyWebhookHmac,
} from "../server/shopifyAdmin.ts";

test("Shopify inventory integration uses the stable 2026-07 API and required scopes", () => {
  assert.equal(SHOPIFY_API_VERSION, "2026-07");
  assert.deepEqual([...INVENTORY_SHOPIFY_SCOPES], [
    "read_products",
    "write_products",
    "read_inventory",
    "write_inventory",
    "read_locations",
  ]);
});

test("Shopify tokens round-trip through authenticated AES-256-GCM encryption", () => {
  const previousKey = process.env.CONNECTION_ENCRYPTION_KEY;
  try {
    process.env.CONNECTION_ENCRYPTION_KEY = "inventory-test-key";
    const encrypted = encryptShopifyToken("shpat_secret");
    assert.match(encrypted, /^enc:v1:/);
    assert.notEqual(encrypted, "shpat_secret");
    assert.equal(decryptShopifyToken(encrypted), "shpat_secret");
    assert.equal(encryptShopifyToken(encrypted), encrypted);

    const tampered = `${encrypted.slice(0, -1)}${encrypted.endsWith("a") ? "b" : "a"}`;
    assert.throws(() => decryptShopifyToken(tampered));
  } finally {
    if (previousKey === undefined) delete process.env.CONNECTION_ENCRYPTION_KEY;
    else process.env.CONNECTION_ENCRYPTION_KEY = previousKey;
  }
});

test("Shopify webhook HMAC validates the exact raw request body", () => {
  const previousSecret = process.env.SHOPIFY_API_SECRET;
  try {
    process.env.SHOPIFY_API_SECRET = "webhook-test-secret";
    const body = Buffer.from('{"inventory_item_id":123,"available":4}');
    const signature = crypto.createHmac("sha256", process.env.SHOPIFY_API_SECRET)
      .update(body)
      .digest("base64");

    assert.equal(verifyShopifyWebhookHmac(body, signature), true);
    assert.equal(verifyShopifyWebhookHmac(Buffer.from(`${body.toString()} `), signature), false);
    assert.equal(verifyShopifyWebhookHmac(body, undefined), false);
  } finally {
    if (previousSecret === undefined) delete process.env.SHOPIFY_API_SECRET;
    else process.env.SHOPIFY_API_SECRET = previousSecret;
  }
});
