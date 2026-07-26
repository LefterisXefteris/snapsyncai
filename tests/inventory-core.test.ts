import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateAdjustedQuantity,
  calculateSellableQuantity,
  effectiveLowStockThreshold,
  effectiveSafetyBuffer,
  isLowStock,
  parseShopifyBulkInventoryJsonl,
  shouldSendLowStockEmail,
  validateBundleRecipe,
  webhookAdjustmentDelta,
} from "../server/inventory-core.ts";

test("sellable inventory applies the safety buffer and never becomes negative", () => {
  assert.equal(calculateSellableQuantity(10, 2), 8);
  assert.equal(calculateSellableQuantity(1, 2), 0);
  assert.equal(calculateSellableQuantity(0, 2), 0);
});

test("inventory policies use defaults unless an item override is present", () => {
  assert.equal(effectiveSafetyBuffer({ safetyBuffer: null }), 2);
  assert.equal(effectiveSafetyBuffer({ safetyBuffer: 7 }), 7);
  assert.equal(effectiveLowStockThreshold({ lowStockThreshold: null }), 5);
  assert.equal(effectiveLowStockThreshold({ lowStockThreshold: 1 }), 1);
});

test("set and delta adjustments preserve a non-negative integer ledger", () => {
  assert.equal(calculateAdjustedQuantity(8, "set", 12), 12);
  assert.equal(calculateAdjustedQuantity(8, "delta", -3), 5);
  assert.throws(() => calculateAdjustedQuantity(1, "delta", -2), /cannot be negative/);
  assert.throws(() => calculateAdjustedQuantity(1, "set", 1.5), /cannot be negative/);
});

test("low-stock transitions and webhook deltas are deterministic", () => {
  assert.equal(isLowStock(5, 5), true);
  assert.equal(isLowStock(6, 5), false);
  assert.equal(webhookAdjustmentDelta(7, 10), -3);
  assert.equal(webhookAdjustmentDelta(10, 10), 0);
});

test("bundle recipes reject cycles, duplicates, nested bundles, and invalid units", () => {
  assert.doesNotThrow(() => validateBundleRecipe({
    bundleItemId: 10,
    components: [{ itemId: 11, units: 2 }, { itemId: 12, units: 1 }],
  }));
  assert.throws(() => validateBundleRecipe({
    bundleItemId: 10,
    components: [{ itemId: 10, units: 1 }],
  }), /cannot contain itself/);
  assert.throws(() => validateBundleRecipe({
    bundleItemId: 10,
    components: [{ itemId: 11, units: 1 }, { itemId: 11, units: 2 }],
  }), /only once/);
  assert.throws(() => validateBundleRecipe({
    bundleItemId: 10,
    components: [{ itemId: 11, units: 1, kind: "bundle" }],
  }), /Nested bundles/);
  assert.throws(() => validateBundleRecipe({
    bundleItemId: 10,
    components: [{ itemId: 11, units: 0 }],
  }), /positive whole numbers/);
});

test("low-stock email suppression lasts exactly 24 hours", () => {
  const now = new Date("2026-07-26T12:00:00.000Z");
  assert.equal(shouldSendLowStockEmail(null, now), true);
  assert.equal(shouldSendLowStockEmail(new Date("2026-07-25T12:00:01.000Z"), now), false);
  assert.equal(shouldSendLowStockEmail(new Date("2026-07-25T12:00:00.000Z"), now), true);
});

test("Shopify bulk JSONL imports 10,000 variants at the selected location", () => {
  const locationId = "gid://shopify/Location/44";
  const lines: string[] = [];
  for (let index = 1; index <= 10_000; index += 1) {
    const inventoryItemId = `gid://shopify/InventoryItem/${index}`;
    lines.push(JSON.stringify({
      id: inventoryItemId,
      sku: `SKU-${index}`,
      tracked: true,
      variant: {
        id: `gid://shopify/ProductVariant/${index}`,
        title: `Variant ${index}`,
        product: {
          id: `gid://shopify/Product/${Math.ceil(index / 5)}`,
          title: `Product ${Math.ceil(index / 5)}`,
          status: "ACTIVE",
        },
      },
    }));
    lines.push(JSON.stringify({
      id: `gid://shopify/InventoryLevel/${index}`,
      __parentId: inventoryItemId,
      location: { id: locationId },
      quantities: [{ name: "available", quantity: index % 17 }],
    }));
  }

  const records = parseShopifyBulkInventoryJsonl(lines.join("\n"), locationId);
  assert.equal(records.length, 10_000);
  assert.equal(records[0].quantity, 1);
  assert.equal(records[9_999].sku, "SKU-10000");
  assert.equal(records[9_999].quantity, 10_000 % 17);
});
