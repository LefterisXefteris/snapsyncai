/**
 * SPA path helpers. Paths match FastAPI 1:1; `apiUrl()` prefixes the origin.
 */

export const api = {
  images: {
    upload: { method: "POST" as const, path: "/api/images/upload" as const },
    list: { method: "GET" as const, path: "/api/images" as const },
    update: { method: "PUT" as const, path: "/api/images/:id" as const },
    delete: { method: "DELETE" as const, path: "/api/images/:id" as const },
    deleteGroup: { method: "DELETE" as const, path: "/api/images/group/:groupId" as const },
    pushToShopify: { method: "POST" as const, path: "/api/images/push-to-shopify" as const },
    generateContent: { method: "POST" as const, path: "/api/images/:id/generate-content" as const },
    regenerateField: { method: "POST" as const, path: "/api/images/:id/regenerate-field" as const },
    confirmProductFacts: {
      method: "POST" as const,
      path: "/api/images/:id/product-facts/confirm" as const,
    },
  },
  shopify: {
    status: { method: "GET" as const, path: "/api/shopify/status" as const },
    oauthStart: { method: "GET" as const, path: "/api/shopify/oauth/start" as const },
    disconnect: { method: "POST" as const, path: "/api/shopify/disconnect" as const },
    gpsrIdentity: { method: "PUT" as const, path: "/api/shopify/gpsr-identity" as const },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    }
  }
  return url;
}
