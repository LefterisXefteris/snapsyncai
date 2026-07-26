import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

import {
  DEFAULT_SHOPIFY_SCOPES,
  createShopifyOAuthState,
  getShopifyOAuthConfig,
  isValidShopifyDomain,
  normalizeShopifyDomain,
  verifyShopifyHmac,
  verifyShopifyOAuthState,
} from "../server/shopifyOAuth.ts";

test("Shopify OAuth requests the Inventory Autopilot scopes", () => {
  assert.equal(
    DEFAULT_SHOPIFY_SCOPES,
    "read_products,write_products,read_inventory,write_inventory,read_locations",
  );
});

function signShopifyQuery(query: Record<string, string>, secret: string) {
  const message = Object.entries(query)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  return crypto.createHmac("sha256", secret).update(message).digest("hex");
}

test("normalizeShopifyDomain converts shop handles and URLs to myshopify domains", () => {
  assert.equal(normalizeShopifyDomain("snap-sync"), "snap-sync.myshopify.com");
  assert.equal(normalizeShopifyDomain("https://snap-sync.myshopify.com/admin"), "snap-sync.myshopify.com");
});

test("isValidShopifyDomain rejects non-Shopify and malformed domains", () => {
  assert.equal(isValidShopifyDomain("snap-sync.myshopify.com"), true);
  assert.equal(isValidShopifyDomain("https://snap-sync.myshopify.com"), false);
  assert.equal(isValidShopifyDomain("snap-sync.example.com"), false);
  assert.equal(isValidShopifyDomain("-bad.myshopify.com"), false);
});

test("verifyShopifyHmac validates sorted callback query params", () => {
  const secret = "shopify-secret";
  const query = {
    code: "0907a61c0c8d55e99db179b68161bc00",
    shop: "snap-sync.myshopify.com",
    state: "state-value",
    timestamp: "1337178173",
  };

  assert.equal(verifyShopifyHmac({ ...query, hmac: signShopifyQuery(query, secret) }, secret), true);
});

test("verifyShopifyHmac rejects tampered callback params", () => {
  const secret = "shopify-secret";
  const query = {
    code: "0907a61c0c8d55e99db179b68161bc00",
    shop: "snap-sync.myshopify.com",
    state: "state-value",
    timestamp: "1337178173",
  };

  const hmac = signShopifyQuery(query, secret);
  assert.equal(verifyShopifyHmac({ ...query, shop: "attacker.myshopify.com", hmac }, secret), false);
});

test("verifyShopifyOAuthState returns the originating user id", () => {
  const secret = "shopify-secret";
  const state = createShopifyOAuthState("user_123", secret, 1_000);

  assert.deepEqual(verifyShopifyOAuthState(state, secret, 1_500), { ok: true, userId: "user_123" });
});

test("verifyShopifyOAuthState rejects invalid and expired state", () => {
  const secret = "shopify-secret";
  const state = createShopifyOAuthState("user_123", secret, 1_000);

  assert.deepEqual(verifyShopifyOAuthState(`${state}tampered`, secret, 1_500), {
    ok: false,
    reason: "invalid_signature",
  });
  assert.deepEqual(verifyShopifyOAuthState(state, secret, 11 * 60 * 1_000), {
    ok: false,
    reason: "expired",
  });
});

test("getShopifyOAuthConfig accepts legacy Shopify client env names", () => {
  const original = {
    SHOPIFY_API_KEY: process.env.SHOPIFY_API_KEY,
    SHOPIFY_API_SECRET: process.env.SHOPIFY_API_SECRET,
    SHOPIFY_CLIENT_ID: process.env.SHOPIFY_CLIENT_ID,
    SHOPIFY_CLIENT_SECRET: process.env.SHOPIFY_CLIENT_SECRET,
  };

  try {
    delete process.env.SHOPIFY_API_KEY;
    delete process.env.SHOPIFY_API_SECRET;
    process.env.SHOPIFY_CLIENT_ID = "legacy-client-id";
    process.env.SHOPIFY_CLIENT_SECRET = "legacy-client-secret";

    const config = getShopifyOAuthConfig();

    assert.equal(config.apiKey, "legacy-client-id");
    assert.equal(config.apiSecret, "legacy-client-secret");
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
});
