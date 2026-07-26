import crypto from "crypto";

export const DEFAULT_SHOPIFY_SCOPES = "read_products,write_products,read_inventory,write_inventory,read_locations";
export const DEFAULT_APP_BASE_URL = "https://snapsyncai.co.uk";

const SHOPIFY_SHOP_DOMAIN_RE = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;
const STATE_TTL_MS = 10 * 60 * 1000;

type ShopifyOAuthState = {
  userId: string;
  nonce: string;
  ts: number;
};

export type ShopifyOAuthStateResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "malformed" | "invalid_signature" | "expired" };

function hmacSha256Hex(secret: string, message: string) {
  return crypto.createHmac("sha256", secret).update(message).digest("hex");
}

function timingSafeEqualHex(a: string, b: string) {
  if (!/^[a-f0-9]+$/i.test(a) || !/^[a-f0-9]+$/i.test(b) || a.length !== b.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

export function normalizeShopifyDomain(rawShop: string) {
  const domain = rawShop
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
  return domain.includes(".myshopify.com") ? domain : `${domain}.myshopify.com`;
}

export function isValidShopifyDomain(shop: string) {
  return SHOPIFY_SHOP_DOMAIN_RE.test(shop);
}

export function createShopifyOAuthState(userId: string, secret: string, now = Date.now()) {
  const payload: ShopifyOAuthState = {
    userId,
    nonce: crypto.randomBytes(16).toString("hex"),
    ts: now,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${hmacSha256Hex(secret, encoded)}`;
}

export function verifyShopifyOAuthState(
  state: string,
  secret: string,
  now = Date.now(),
): ShopifyOAuthStateResult {
  const [encoded, signature] = state.split(".");
  if (!encoded || !signature) return { ok: false, reason: "malformed" };

  const expected = hmacSha256Hex(secret, encoded);
  if (!timingSafeEqualHex(signature, expected)) {
    return { ok: false, reason: "invalid_signature" };
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as ShopifyOAuthState;
    if (!payload.userId || !payload.nonce || typeof payload.ts !== "number") {
      return { ok: false, reason: "malformed" };
    }
    if (now - payload.ts > STATE_TTL_MS) {
      return { ok: false, reason: "expired" };
    }
    return { ok: true, userId: payload.userId };
  } catch {
    return { ok: false, reason: "malformed" };
  }
}

export function verifyShopifyHmac(
  query: Record<string, unknown>,
  secret: string,
) {
  const hmac = query.hmac;
  const provided = Array.isArray(hmac) ? hmac[0] : hmac;
  if (typeof provided !== "string") return false;

  const entries: [string, string][] = [];
  for (const [key, value] of Object.entries(query)) {
    if (key === "hmac" || key === "signature") continue;
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      if (item === undefined) continue;
      entries.push([key, String(item)]);
    }
  }

  const message = entries
    .sort(([aKey, aValue], [bKey, bValue]) => aKey.localeCompare(bKey) || aValue.localeCompare(bValue))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  const expected = hmacSha256Hex(secret, message);
  return timingSafeEqualHex(provided, expected);
}

export function buildShopifyOAuthAuthorizeUrl({
  shop,
  apiKey,
  scopes,
  redirectUri,
  state,
}: {
  shop: string;
  apiKey: string;
  scopes: string;
  redirectUri: string;
  state: string;
}) {
  const params = new URLSearchParams({
    client_id: apiKey,
    scope: scopes,
    redirect_uri: redirectUri,
    state,
  });

  return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
}

export function getShopifyOAuthConfig() {
  return {
    apiKey: process.env.SHOPIFY_API_KEY || process.env.SHOPIFY_CLIENT_ID || "",
    apiSecret: process.env.SHOPIFY_API_SECRET || process.env.SHOPIFY_CLIENT_SECRET || "",
    scopes: process.env.SHOPIFY_SCOPES || DEFAULT_SHOPIFY_SCOPES,
    appBaseUrl: (process.env.APP_BASE_URL || DEFAULT_APP_BASE_URL).replace(/\/$/, ""),
  };
}
