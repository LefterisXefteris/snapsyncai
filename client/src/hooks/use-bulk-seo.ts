import { useMutation, useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/clerk-react";
import { api } from "@/lib/api-routes";
import { apiFetch } from "@/lib/api-fetch";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { BulkSeoCatalogueRow } from "@/lib/bulk-seo";

const DEV_BYPASS_AUTH = import.meta.env.VITE_DEV_BYPASS_AUTH === "true";

function useAppUserId(): string | undefined {
  if (DEV_BYPASS_AUTH) return "dev_local_user";
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { user } = useUser();
  return user?.id;
}

export type BulkSeoCatalogue = {
  startBlockedReason: string | null;
  proposedUseCount: number;
  rows: BulkSeoCatalogueRow[];
};

export type BulkSeoProposal = {
  tags: string[];
  description: string;
  seoTitle: string;
  seoDescription: string;
};

export type BulkSeoPackItem = {
  id: number;
  error: string | null;
  proposal: BulkSeoProposal | null;
  queries: string[];
};

export type BulkSeoPack = {
  error: string | null;
  items: BulkSeoPackItem[];
  proposedUseCount: number;
};

export function useBulkSeoCatalogue() {
  const userId = useAppUserId();
  return useQuery({
    queryKey: [api.bulkSeo.catalogue.path, userId],
    queryFn: async () => {
      const res = await apiFetch(api.bulkSeo.catalogue.path);
      if (!res.ok) throw new Error("Failed to load Bulk SEO");
      return res.json() as Promise<BulkSeoCatalogue>;
    },
    enabled: !!userId,
  });
}

export function useBulkSeoStart() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (productIds: number[]) => {
      const res = await apiRequest(api.bulkSeo.start.method, api.bulkSeo.start.path, {
        productIds,
      });
      return res.json() as Promise<BulkSeoPack>;
    },
    onError: (error) => {
      toast({
        title: "Could not start Bulk SEO",
        description: error instanceof Error ? error.message : "Bulk SEO start failed",
        variant: "destructive",
      });
    },
  });
}

export function useBulkSeoRegenerate() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (body: { productId: number; queries: string[] }) => {
      const res = await apiRequest(api.bulkSeo.regenerate.method, api.bulkSeo.regenerate.path, body);
      return res.json() as Promise<BulkSeoPackItem>;
    },
    onError: (error) => {
      toast({
        title: "Could not regenerate",
        description: error instanceof Error ? error.message : "Bulk SEO regenerate failed",
        variant: "destructive",
      });
    },
  });
}

export function useBulkSeoAccept() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (body: {
      productId: number;
      tags: string[];
      description: string;
      seoTitle: string;
      seoDescription: string;
    }) => {
      const res = await apiRequest(api.bulkSeo.accept.method, api.bulkSeo.accept.path, body);
      return res.json() as Promise<{ ok: boolean }>;
    },
    onError: (error) => {
      toast({
        title: "Could not accept",
        description: error instanceof Error ? error.message : "Bulk SEO accept failed",
        variant: "destructive",
      });
    },
  });
}

