import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@/lib/api-routes";
import { apiFetch } from "@/lib/api-fetch";

export type TrendyolStorefront = { code: string; currency: string };

export type TrendyolLink = {
  available: boolean;
  connected: boolean;
  message: string | null;
  storefront: string | null;
  currency: string | null;
  vatRate: number | null;
  storefronts: TrendyolStorefront[];
};

export type TrendyolChoice = { id: string; name: string };

export type TrendyolAttribute = {
  id: string;
  name: string;
  valueId: string | null;
  custom: string | null;
  choices: TrendyolChoice[];
};

export type TrendyolPage = {
  connected: boolean;
  storefront: string | null;
  currency: string | null;
  vatRate: number | null;
  categoryId: string | null;
  categoryName: string | null;
  brandId: string | null;
  brandName: string | null;
  salePrice: string | null;
  listPrice: string | null;
  attributes: TrendyolAttribute[];
  approval: "waiting" | "approved" | "rejected" | null;
  reason: string | null;
  pushWait: string | null;
};

export type TrendyolListingInput = {
  categoryId: string | null;
  categoryName: string | null;
  brandId: string | null;
  brandName: string | null;
  salePrice: string;
  listPrice: string;
  attributes: { attributeId: string; valueId: string | null; custom: string | null }[];
};

async function trendyolError(res: Response): Promise<string> {
  const text = (await res.text()) || res.statusText;
  try {
    const body = JSON.parse(text) as { detail?: unknown; message?: unknown };
    if (typeof body.detail === "string") return body.detail;
    if (typeof body.message === "string") return body.message;
  } catch {
    /* The body is already the message. */
  }
  return text;
}

async function trendyolJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) throw new Error(await trendyolError(res));
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function useTrendyolStatus() {
  return useQuery({
    queryKey: [api.trendyol.status.path],
    queryFn: () => trendyolJson<TrendyolLink>(api.trendyol.status.path),
  });
}

export function useTrendyolConnect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      sellerId: string;
      apiKey: string;
      apiSecret: string;
      storefrontCode?: string;
      vatRate?: number;
    }) =>
      trendyolJson<TrendyolLink>(api.trendyol.connect.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: (link) => {
      if (link.connected) queryClient.invalidateQueries({ queryKey: [api.trendyol.status.path] });
    },
  });
}

export function useTrendyolDisconnect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => trendyolJson<void>(api.trendyol.disconnect.path, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.trendyol.status.path] });
    },
  });
}

export function useTrendyolProduct(imageId: number) {
  return useQuery({
    queryKey: [api.trendyol.product.path, imageId],
    queryFn: () => trendyolJson<TrendyolPage>(buildUrl(api.trendyol.product.path, { id: imageId })),
  });
}

export function useTrendyolCategories(enabled: boolean) {
  return useQuery({
    queryKey: [api.trendyol.categories.path],
    queryFn: () => trendyolJson<TrendyolChoice[]>(api.trendyol.categories.path),
    enabled,
  });
}

export function useTrendyolPush(imageId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: TrendyolListingInput) =>
      trendyolJson<TrendyolPage>(buildUrl(api.trendyol.push.path, { id: imageId }), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: (page) => {
      queryClient.setQueryData([api.trendyol.product.path, imageId], page);
    },
  });
}

export async function trendyolAttributes(categoryId: string): Promise<TrendyolAttribute[]> {
  return trendyolJson(buildUrl(api.trendyol.attributes.path, { categoryId }));
}

export async function trendyolBrands(query: string): Promise<TrendyolChoice[]> {
  const path = `${api.trendyol.brands.path}?q=${encodeURIComponent(query)}`;
  return trendyolJson(path);
}
