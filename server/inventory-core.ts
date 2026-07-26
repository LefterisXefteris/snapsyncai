export const DEFAULT_SAFETY_BUFFER = 2;
export const DEFAULT_LOW_STOCK_THRESHOLD = 5;
export const INVENTORY_GRACE_DAYS = 7;

export type InventoryPolicy = {
  safetyBuffer: number | null;
  lowStockThreshold: number | null;
};

export type BundleRecipeInput = {
  bundleItemId: number;
  components: Array<{ itemId: number; units: number; kind?: string }>;
};

export type ImportedInventoryRecord = {
  inventoryItemId: string;
  variantId: string;
  productId: string;
  title: string;
  variantTitle: string | null;
  sku: string | null;
  tracked: boolean;
  status: string | null;
  quantity: number;
};

export function effectiveSafetyBuffer(
  policy: Pick<InventoryPolicy, "safetyBuffer">,
  defaultBuffer = DEFAULT_SAFETY_BUFFER,
) {
  return Math.max(0, policy.safetyBuffer ?? defaultBuffer);
}

export function effectiveLowStockThreshold(
  policy: Pick<InventoryPolicy, "lowStockThreshold">,
  defaultThreshold = DEFAULT_LOW_STOCK_THRESHOLD,
) {
  return Math.max(0, policy.lowStockThreshold ?? defaultThreshold);
}

export function calculateSellableQuantity(ledgerQuantity: number, safetyBuffer: number) {
  return Math.max(0, Math.trunc(ledgerQuantity) - Math.max(0, Math.trunc(safetyBuffer)));
}

export function calculateAdjustedQuantity(
  currentQuantity: number,
  mode: "set" | "delta",
  quantity: number,
) {
  const next = mode === "set" ? quantity : currentQuantity + quantity;
  if (!Number.isInteger(next) || next < 0) {
    throw new Error("Inventory quantity cannot be negative");
  }
  return next;
}

export function isLowStock(
  ledgerQuantity: number,
  threshold: number,
) {
  return ledgerQuantity <= Math.max(0, threshold);
}

export function validateBundleRecipe(input: BundleRecipeInput) {
  if (!Number.isInteger(input.bundleItemId) || input.bundleItemId <= 0) {
    throw new Error("A valid bundle item is required");
  }
  if (input.components.length === 0 || input.components.length > 30) {
    throw new Error("A bundle must contain between 1 and 30 components");
  }

  const seen = new Set<number>();
  for (const component of input.components) {
    if (!Number.isInteger(component.itemId) || component.itemId <= 0) {
      throw new Error("Every component must reference a valid inventory item");
    }
    if (component.itemId === input.bundleItemId) {
      throw new Error("A bundle cannot contain itself");
    }
    if (seen.has(component.itemId)) {
      throw new Error("A component can appear only once in a bundle");
    }
    if (!Number.isInteger(component.units) || component.units <= 0) {
      throw new Error("Component quantities must be positive whole numbers");
    }
    if (component.kind === "bundle") {
      throw new Error("Nested bundles are not supported");
    }
    seen.add(component.itemId);
  }
}

export function webhookAdjustmentDelta(observedQuantity: number, expectedQuantity: number) {
  return Math.trunc(observedQuantity) - Math.trunc(expectedQuantity);
}

export function shouldSendLowStockEmail(lastEmailedAt: Date | null, now = new Date()) {
  if (!lastEmailedAt) return true;
  return now.getTime() - lastEmailedAt.getTime() >= 24 * 60 * 60 * 1000;
}

export function parseShopifyBulkInventoryJsonl(
  jsonl: string,
  locationId: string,
): ImportedInventoryRecord[] {
  const itemsById = new Map<string, Omit<ImportedInventoryRecord, "quantity">>();
  const quantitiesByItemId = new Map<string, number>();

  for (const rawLine of jsonl.split("\n")) {
    if (!rawLine.trim()) continue;
    const record = JSON.parse(rawLine) as Record<string, any>;
    const id = String(record.id || "");

    if (id.includes("/InventoryItem/")) {
      const variant = record.variant || {};
      const product = variant.product || {};
      itemsById.set(id, {
        inventoryItemId: id,
        variantId: String(variant.id || ""),
        productId: String(product.id || ""),
        title: String(product.title || variant.displayName || "Untitled product"),
        variantTitle: variant.title ? String(variant.title) : null,
        sku: record.sku ? String(record.sku) : null,
        tracked: record.tracked !== false,
        status: product.status ? String(product.status) : null,
      });
      if (Array.isArray(record.inventoryLevels?.nodes)) {
        const level = record.inventoryLevels.nodes.find(
          (candidate: any) => candidate.location?.id === locationId,
        );
        const quantity = level?.quantities?.find(
          (candidate: any) => candidate.name === "available",
        )?.quantity;
        if (Number.isFinite(quantity)) quantitiesByItemId.set(id, Number(quantity));
      }
      continue;
    }

    if (id.includes("/InventoryLevel/") && record.location?.id === locationId) {
      const parentId = String(record.__parentId || "");
      const quantity = record.quantities?.find(
        (candidate: any) => candidate.name === "available",
      )?.quantity;
      if (parentId && Number.isFinite(quantity)) quantitiesByItemId.set(parentId, Number(quantity));
    }
  }

  return Array.from(itemsById.values())
    .filter((record) => record.variantId && record.productId)
    .map((record) => ({
      ...record,
      quantity: Math.max(0, quantitiesByItemId.get(record.inventoryItemId) ?? 0),
    }));
}
