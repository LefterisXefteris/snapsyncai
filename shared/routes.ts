import { z } from 'zod';
import { images } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  images: {
    upload: {
      method: 'POST' as const,
      path: '/api/images/upload' as const,
      responses: {
        200: z.array(z.custom<typeof images.$inferSelect>()),
        400: errorSchemas.validation,
        500: errorSchemas.internal,
      },
    },
    list: {
      method: 'GET' as const,
      path: '/api/images' as const,
      responses: {
        200: z.array(z.custom<typeof images.$inferSelect>()),
        500: errorSchemas.internal,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/images/:id' as const,
      responses: {
        200: z.custom<typeof images.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/images/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
    pushToShopify: {
      method: 'POST' as const,
      path: '/api/images/push-to-shopify' as const,
      responses: {
        200: z.object({
          success: z.number(),
          failed: z.number(),
          results: z.array(z.object({
            id: z.number(),
            shopifyProductId: z.string().optional(),
            error: z.string().optional(),
          })),
        }),
        400: errorSchemas.validation,
        500: errorSchemas.internal,
      },
    },
    pushToEtsy: {
      method: 'POST' as const,
      path: '/api/images/push-to-etsy' as const,
      responses: {
        200: z.object({
          success: z.number(),
          failed: z.number(),
          results: z.array(z.object({
            id: z.number(),
            etsyListingId: z.string().optional(),
            error: z.string().optional(),
          })),
        }),
        400: errorSchemas.validation,
        500: errorSchemas.internal,
      },
    },
    pushToAmazon: {
      method: 'POST' as const,
      path: '/api/images/push-to-amazon' as const,
      responses: {
        200: z.object({
          success: z.number(),
          failed: z.number(),
          results: z.array(z.object({
            id: z.number(),
            amazonListingId: z.string().optional(),
            error: z.string().optional(),
          })),
        }),
        400: errorSchemas.validation,
        500: errorSchemas.internal,
      },
    },
  },
  etsy: {
    status: {
      method: 'GET' as const,
      path: '/api/etsy/status' as const,
      responses: {
        200: z.object({
          connected: z.boolean(),
          shopName: z.string().optional(),
          shopId: z.string().optional(),
        }),
      },
    },
    connect: {
      method: 'POST' as const,
      path: '/api/etsy/connect' as const,
    },
    disconnect: {
      method: 'POST' as const,
      path: '/api/etsy/disconnect' as const,
    },
  },
  amazon: {
    status: {
      method: 'GET' as const,
      path: '/api/amazon/status' as const,
      responses: {
        200: z.object({
          connected: z.boolean(),
          sellerName: z.string().optional(),
          sellerId: z.string().optional(),
          marketplaceId: z.string().optional(),
        }),
      },
    },
    connect: {
      method: 'POST' as const,
      path: '/api/amazon/connect' as const,
    },
    disconnect: {
      method: 'POST' as const,
      path: '/api/amazon/disconnect' as const,
    },
  },
  instagram: {
    status: {
      method: 'GET' as const,
      path: '/api/instagram/status' as const,
      responses: {
        200: z.object({
          connected: z.boolean(),
          username: z.string().optional(),
          igUserId: z.string().optional(),
        }),
      },
    },
    oauthConfig: {
      method: 'GET' as const,
      path: '/api/instagram/oauth/config' as const,
    },
    oauthStart: {
      method: 'GET' as const,
      path: '/api/instagram/oauth/start' as const,
    },
    connect: {
      method: 'POST' as const,
      path: '/api/instagram/connect' as const,
    },
    disconnect: {
      method: 'POST' as const,
      path: '/api/instagram/disconnect' as const,
    },
    importMedia: {
      method: 'POST' as const,
      path: '/api/instagram/import-media' as const,
    },
    postProduct: {
      method: 'POST' as const,
      path: '/api/instagram/post-product' as const,
    },
    generateCaption: {
      method: 'POST' as const,
      path: '/api/instagram/generate-caption' as const,
    },
  },
  shopify: {
    status: {
      method: 'GET' as const,
      path: '/api/shopify/status' as const,
      responses: {
        200: z.object({
          connected: z.boolean(),
          shopName: z.string().optional(),
          shopDomain: z.string().optional(),
        }),
      },
    },
    connect: {
      method: 'POST' as const,
      path: '/api/shopify/connect' as const,
    },
    disconnect: {
      method: 'POST' as const,
      path: '/api/shopify/disconnect' as const,
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
