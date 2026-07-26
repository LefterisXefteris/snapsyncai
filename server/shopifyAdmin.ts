import crypto from "node:crypto";
import type { ShopifyConnection } from "@shared/schema";

export const SHOPIFY_API_VERSION = "2026-07";
export const INVENTORY_SHOPIFY_SCOPES = [
  "read_products",
  "write_products",
  "read_inventory",
  "write_inventory",
  "read_locations",
] as const;

type GraphqlEnvelope<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

function encryptionKey() {
  const source = process.env.CONNECTION_ENCRYPTION_KEY;
  if (!source) {
    throw new Error("CONNECTION_ENCRYPTION_KEY is required to store Shopify credentials");
  }
  return crypto.createHash("sha256").update(source).digest();
}

export function encryptShopifyToken(token: string) {
  if (token.startsWith("enc:v1:")) return token;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptShopifyToken(storedToken: string) {
  if (!storedToken.startsWith("enc:v1:")) return storedToken;
  const [, version, ivText, tagText, encryptedText] = storedToken.split(":");
  if (version !== "v1" || !ivText || !tagText || !encryptedText) {
    throw new Error("Stored Shopify credential is malformed");
  }
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivText, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function verifyShopifyWebhookHmac(rawBody: Buffer, signature: string | undefined) {
  const secret = process.env.SHOPIFY_API_SECRET || process.env.SHOPIFY_CLIENT_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  return expectedBuffer.length === signatureBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}

export async function shopifyGraphql<T>(
  connection: Pick<ShopifyConnection, "shopDomain" | "accessToken">,
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const token = decryptShopifyToken(connection.accessToken);
  const endpoint = `https://${connection.shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (response.status === 429 || response.status >= 500) {
      if (attempt === 2) {
        throw new Error(`Shopify GraphQL request failed with ${response.status}`);
      }
      const retryAfter = Number(response.headers.get("retry-after") || 0);
      await new Promise((resolve) => setTimeout(resolve, retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt));
      continue;
    }

    const body = await response.json() as GraphqlEnvelope<T>;
    if (!response.ok || body.errors?.length) {
      const message = body.errors?.map((error) => error.message).join("; ")
        || `Shopify GraphQL request failed with ${response.status}`;
      throw new Error(message);
    }
    if (!body.data) throw new Error("Shopify returned an empty GraphQL response");
    return body.data;
  }

  throw new Error("Shopify GraphQL request exhausted retries");
}

export async function getShopifyLocations(connection: ShopifyConnection) {
  const data = await shopifyGraphql<{
    locations: { nodes: Array<{ id: string; name: string; isActive: boolean }> };
  }>(connection, `
    query InventoryLocations {
      locations(first: 100, query: "active:true") {
        nodes { id name isActive }
      }
    }
  `);
  return data.locations.nodes.filter((location) => location.isActive);
}

export async function getShopifyShopIdentity(
  connection: Pick<ShopifyConnection, "shopDomain" | "accessToken">,
) {
  const data = await shopifyGraphql<{
    shop: { name: string };
    currentAppInstallation: { accessScopes: Array<{ handle: string }> };
  }>(connection, `
    query SnapSyncShopIdentity {
      shop { name }
      currentAppInstallation {
        accessScopes { handle }
      }
    }
  `);
  return {
    name: data.shop.name,
    grantedScopes: data.currentAppInstallation.accessScopes.map((scope) => scope.handle),
  };
}

export async function startShopifyCatalogBulkImport(connection: ShopifyConnection) {
  const bulkQuery = `{
    inventoryItems {
      id
      sku
      tracked
      variant {
        id
        title
        inventoryPolicy
        product { id title status }
      }
      inventoryLevels {
        id
        location { id name }
        quantities(names: ["available"]) { name quantity }
      }
    }
  }`;

  const data = await shopifyGraphql<{
    bulkOperationRunQuery: {
      bulkOperation?: { id: string; status: string };
      userErrors: Array<{ field?: string[]; message: string }>;
    };
  }>(connection, `
    mutation StartInventoryCatalogImport($query: String!) {
      bulkOperationRunQuery(query: $query) {
        bulkOperation { id status }
        userErrors { field message }
      }
    }
  `, { query: bulkQuery });

  const errors = data.bulkOperationRunQuery.userErrors;
  if (errors.length || !data.bulkOperationRunQuery.bulkOperation) {
    throw new Error(errors.map((error) => error.message).join("; ") || "Shopify did not start the catalog import");
  }
  return data.bulkOperationRunQuery.bulkOperation;
}

export async function getShopifyBulkOperation(
  connection: ShopifyConnection,
  operationId: string,
) {
  const data = await shopifyGraphql<{
    node: null | {
      id: string;
      status: string;
      objectCount: string;
      url: string | null;
      partialDataUrl: string | null;
      errorCode: string | null;
    };
  }>(connection, `
    query InventoryBulkOperation($id: ID!) {
      node(id: $id) {
        ... on BulkOperation {
          id status objectCount url partialDataUrl errorCode
        }
      }
    }
  `, { id: operationId });
  if (!data.node) throw new Error("Shopify catalog import no longer exists");
  return data.node;
}

export async function getShopifyInventoryQuantity(
  connection: ShopifyConnection,
  inventoryItemId: string,
  locationId: string,
) {
  const data = await shopifyGraphql<{
    inventoryItem: null | {
      inventoryLevel: null | { quantities: Array<{ name: string; quantity: number }> };
    };
  }>(connection, `
    query CurrentInventoryQuantity($inventoryItemId: ID!, $locationId: ID!) {
      inventoryItem(id: $inventoryItemId) {
        inventoryLevel(locationId: $locationId) {
          quantities(names: ["available"]) { name quantity }
        }
      }
    }
  `, { inventoryItemId, locationId });
  const quantity = data.inventoryItem?.inventoryLevel?.quantities.find((item) => item.name === "available")?.quantity;
  if (quantity === undefined) throw new Error("Shopify inventory level was not found");
  return quantity;
}

export async function setShopifyInventoryQuantity(input: {
  connection: ShopifyConnection;
  inventoryItemId: string;
  locationId: string;
  quantity: number;
  compareQuantity: number;
  idempotencyKey: string;
}) {
  const data = await shopifyGraphql<{
    inventorySetQuantities: {
      inventoryAdjustmentGroup?: { changes: Array<{ name: string; delta: number; quantityAfterChange: number }> };
      userErrors: Array<{ code?: string; field?: string[]; message: string }>;
    };
  }>(input.connection, `
    mutation SetInventoryQuantity($input: InventorySetQuantitiesInput!, $idempotencyKey: String!) {
      inventorySetQuantities(input: $input) @idempotent(key: $idempotencyKey) {
        inventoryAdjustmentGroup {
          changes { name delta quantityAfterChange }
        }
        userErrors { code field message }
      }
    }
  `, {
    idempotencyKey: input.idempotencyKey,
    input: {
      name: "available",
      reason: "correction",
      referenceDocumentUri: `snapsync://inventory/${input.idempotencyKey}`,
      quantities: [{
        inventoryItemId: input.inventoryItemId,
        locationId: input.locationId,
        quantity: input.quantity,
        changeFromQuantity: input.compareQuantity,
      }],
    },
  });

  const errors = data.inventorySetQuantities.userErrors;
  if (errors.length) {
    const mismatch = errors.some((error) =>
      error.code === "CHANGE_FROM_QUANTITY_STALE"
      || error.code === "COMPARE_QUANTITY_STALE"
    );
    const error = new Error(errors.map((item) => item.message).join("; "));
    (error as Error & { compareMismatch?: boolean }).compareMismatch = mismatch;
    throw error;
  }
  return data.inventorySetQuantities.inventoryAdjustmentGroup;
}

const WEBHOOK_TOPICS = [
  "INVENTORY_LEVELS_UPDATE",
  "PRODUCTS_CREATE",
  "PRODUCTS_UPDATE",
  "PRODUCTS_DELETE",
  "LOCATIONS_DELETE",
  "BULK_OPERATIONS_FINISH",
  "APP_UNINSTALLED",
] as const;

export async function registerInventoryWebhooks(
  connection: ShopifyConnection,
  callbackUrl: string,
) {
  const results: Array<{ topic: string; id?: string }> = [];
  for (const topic of WEBHOOK_TOPICS) {
    const data = await shopifyGraphql<{
      webhookSubscriptionCreate: {
        webhookSubscription?: { id: string; topic: string };
        userErrors: Array<{ message: string }>;
      };
    }>(connection, `
      mutation RegisterInventoryWebhook(
        $topic: WebhookSubscriptionTopic!,
        $subscription: WebhookSubscriptionInput!
      ) {
        webhookSubscriptionCreate(topic: $topic, webhookSubscription: $subscription) {
          webhookSubscription { id topic }
          userErrors { message }
        }
      }
    `, { topic, subscription: { uri: callbackUrl, format: "JSON" } });

    const errors = data.webhookSubscriptionCreate.userErrors;
    if (errors.length) {
      const alreadyExists = errors.every((error) => /already|taken/i.test(error.message));
      if (!alreadyExists) throw new Error(errors.map((error) => error.message).join("; "));
    }
    results.push({ topic, id: data.webhookSubscriptionCreate.webhookSubscription?.id });
  }
  return results;
}

export async function unregisterInventoryWebhooks(
  connection: ShopifyConnection,
  callbackUrl: string,
) {
  const data = await shopifyGraphql<{
    webhookSubscriptions: { nodes: Array<{ id: string; uri: string }> };
  }>(connection, `
    query InventoryWebhookSubscriptions($uri: String!) {
      webhookSubscriptions(first: 100, uri: $uri) {
        nodes { id uri }
      }
    }
  `, { uri: callbackUrl });

  const deleted: string[] = [];
  for (const subscription of data.webhookSubscriptions.nodes) {
    const result = await shopifyGraphql<{
      webhookSubscriptionDelete: {
        deletedWebhookSubscriptionId?: string;
        userErrors: Array<{ message: string }>;
      };
    }>(connection, `
      mutation DeleteInventoryWebhook($id: ID!) {
        webhookSubscriptionDelete(id: $id) {
          deletedWebhookSubscriptionId
          userErrors { field message }
        }
      }
    `, { id: subscription.id });
    const errors = result.webhookSubscriptionDelete.userErrors;
    if (errors.length) throw new Error(errors.map((error) => error.message).join("; "));
    if (result.webhookSubscriptionDelete.deletedWebhookSubscriptionId) {
      deleted.push(result.webhookSubscriptionDelete.deletedWebhookSubscriptionId);
    }
  }
  return deleted;
}

export async function replaceShopifyBundleComponents(input: {
  connection: ShopifyConnection;
  parentVariantId: string;
  components: Array<{ variantId: string; units: number }>;
}) {
  const mutation = `
    mutation UpdateInventoryBundle($input: [ProductVariantRelationshipUpdateInput!]!) {
      productVariantRelationshipBulkUpdate(input: $input) {
        parentProductVariants { id requiresComponents }
        userErrors { code field message }
      }
    }
  `;

  const removeData = await shopifyGraphql<{
    productVariantRelationshipBulkUpdate: {
      userErrors: Array<{ message: string }>;
    };
  }>(input.connection, mutation, {
    input: [{
      parentProductVariantId: input.parentVariantId,
      removeAllProductVariantRelationships: true,
    }],
  });
  if (removeData.productVariantRelationshipBulkUpdate.userErrors.length) {
    throw new Error(removeData.productVariantRelationshipBulkUpdate.userErrors.map((error) => error.message).join("; "));
  }
  if (input.components.length === 0) return;

  const createData = await shopifyGraphql<{
    productVariantRelationshipBulkUpdate: {
      userErrors: Array<{ message: string }>;
    };
  }>(input.connection, mutation, {
    input: [{
      parentProductVariantId: input.parentVariantId,
      productVariantRelationshipsToCreate: input.components.map((component) => ({
        id: component.variantId,
        quantity: component.units,
      })),
    }],
  });
  const errors = createData.productVariantRelationshipBulkUpdate.userErrors;
  if (errors.length) throw new Error(errors.map((error) => error.message).join("; "));
}

export async function setShopifyVariantInventoryPolicies(input: {
  connection: ShopifyConnection;
  productId: string;
  variantIds: string[];
}) {
  if (input.variantIds.length === 0) return;
  const data = await shopifyGraphql<{
    productVariantsBulkUpdate: {
      userErrors: Array<{ field?: string[]; message: string }>;
    };
  }>(input.connection, `
    mutation ProtectInventoryVariants($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        userErrors { field message }
      }
    }
  `, {
    productId: input.productId,
    variants: input.variantIds.map((id) => ({ id, inventoryPolicy: "DENY" })),
  });
  const errors = data.productVariantsBulkUpdate.userErrors;
  if (errors.length) throw new Error(errors.map((error) => error.message).join("; "));
}

export async function createShopifyProductGraphql(input: {
  connection: ShopifyConnection;
  image: any;
  viewImages?: Array<{ image: any }>;
}) {
  const imageVariants = Array.isArray(input.image.variants)
    ? input.image.variants as Array<{ name: string; values: string[] }>
    : [];
  const combinations = imageVariants.length === 0
    ? [[]]
    : imageVariants.reduce<string[][]>((all, option) => {
      if (all.length === 0) return option.values.map((value) => [value]);
      return all.flatMap((combination) => option.values.map((value) => [...combination, value]));
    }, []);
  if (combinations.length > 2048) throw new Error("Shopify supports at most 2048 variants per product");

  const baseSku = String(input.image.sku || `SS-${input.image.id}`);
  const productSet = {
    title: input.image.title || input.image.originalName || "Untitled product",
    descriptionHtml: input.image.description || "",
    productType: input.image.productType || input.image.category || "Other",
    tags: Array.isArray(input.image.tags) ? input.image.tags : [],
    status: "DRAFT",
    seo: {
      title: input.image.seoTitle || input.image.title || "",
      description: input.image.seoDescription || "",
    },
    productOptions: imageVariants.map((option, index) => ({
      name: option.name,
      position: index + 1,
      values: option.values.map((value) => ({ name: value })),
    })),
    variants: combinations.map((combination, variantIndex) => ({
      optionValues: combination.map((value, optionIndex) => ({
        optionName: imageVariants[optionIndex].name,
        name: value,
      })),
      price: Number.parseFloat(input.image.price || "0") || 0,
      compareAtPrice: input.image.compareAtPrice
        ? Number.parseFloat(input.image.compareAtPrice)
        : undefined,
      barcode: input.image.barcode || undefined,
      inventoryPolicy: "DENY",
      inventoryItem: {
        sku: combinations.length === 1 ? baseSku : `${baseSku}-${variantIndex + 1}`,
        tracked: input.image.trackQuantity !== "false",
        cost: input.image.costPerItem ? Number.parseFloat(input.image.costPerItem) : undefined,
      },
    })),
  };

  const data = await shopifyGraphql<{
    productSet: {
      product?: {
        id: string;
        variants: {
          nodes: Array<{
            id: string;
            sku: string | null;
            inventoryItem: { id: string; tracked: boolean };
          }>;
        };
      };
      userErrors: Array<{ field?: string[]; message: string }>;
    };
  }>(input.connection, `
    mutation CreateSnapSyncProduct($productSet: ProductSetInput!) {
      productSet(synchronous: true, input: $productSet) {
        product {
          id
          variants(first: 2048) {
            nodes { id sku inventoryItem { id tracked } }
          }
        }
        userErrors { field message }
      }
    }
  `, { productSet });

  const errors = data.productSet.userErrors;
  if (errors.length || !data.productSet.product) {
    throw new Error(errors.map((error) => error.message).join("; ") || "Shopify did not create the product");
  }

  const media = [input.image, ...(input.viewImages || []).map((view) => view.image)]
    .filter((image) => typeof image.storageUrl === "string" && /^https:\/\//.test(image.storageUrl))
    .map((image) => ({
      originalSource: image.storageUrl,
      alt: image.altText || image.title || image.originalName || "",
      mediaContentType: "IMAGE",
    }));
  if (media.length > 0) {
    const mediaData = await shopifyGraphql<{
      productCreateMedia: { mediaUserErrors: Array<{ message: string }> };
    }>(input.connection, `
      mutation AddSnapSyncProductMedia($productId: ID!, $media: [CreateMediaInput!]!) {
        productCreateMedia(productId: $productId, media: $media) {
          mediaUserErrors { field message }
        }
      }
    `, { productId: data.productSet.product.id, media });
    if (mediaData.productCreateMedia.mediaUserErrors.length) {
      console.warn(
        "Shopify product created but media attachment failed:",
        mediaData.productCreateMedia.mediaUserErrors.map((error) => error.message).join("; "),
      );
    }
  }

  return data.productSet.product;
}
