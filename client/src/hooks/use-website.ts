import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-routes";
import { apiFetch } from "@/lib/api-fetch";
import { apiRequest } from "@/lib/queryClient";
import { useAppUserId } from "@/hooks/use-app-user-id";
import { useToast } from "@/hooks/use-toast";
import { isOverflowConfirmError } from "@/lib/overflow-copy";
import type { StorefrontDocument } from "@/components/storefront-view";

export type WebsiteEligibleProduct = {
  id: number;
  title: string | null;
  photoUrl: string | null;
  shopifyProductId: string;
};

export type WebsitePrototype = {
  shopConnected: boolean;
  shopDomain: string | null;
  products: WebsiteEligibleProduct[];
};

export type WebsiteDraft = {
  productIds: number[];
  palette: string;
  typePairing: string;
  confirmOverflow?: boolean;
};

export function useWebsitePrototype() {
  const userId = useAppUserId();
  return useQuery({
    queryKey: [api.website.prototype.path, userId],
    queryFn: async () => {
      const res = await apiFetch(api.website.prototype.path);
      if (!res.ok) throw new Error("Failed to load website prototype");
      return res.json() as Promise<WebsitePrototype>;
    },
    enabled: !!userId,
  });
}

export function useWebsitePreview() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (body: WebsiteDraft) => {
      const res = await apiRequest(api.website.preview.method, api.website.preview.path, body);
      return res.json() as Promise<StorefrontDocument>;
    },
    onError: (error) => {
      toast({
        title: "Could not preview",
        description: error instanceof Error ? error.message : "Website preview failed",
        variant: "destructive",
      });
    },
  });
}

export function useWebsitePublish() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (body: WebsiteDraft) => {
      const res = await apiRequest(api.website.publish.method, api.website.publish.path, body);
      return res.json() as Promise<{ host: string; spent: boolean; productCount: number }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscription/status"] });
    },
    onError: (error) => {
      if (isOverflowConfirmError(error instanceof Error ? error.message : "")) return;
      toast({
        title: "Could not publish",
        description: error instanceof Error ? error.message : "Publish failed",
        variant: "destructive",
      });
    },
  });
}
