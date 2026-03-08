import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function useImages() {
  return useQuery({
    queryKey: [api.images.list.path],
    queryFn: async () => {
      const res = await fetch(api.images.list.path);
      if (!res.ok) throw new Error("Failed to fetch images");
      return res.json();
    },
  });
}

export function usePaymentConfig() {
  return useQuery({
    queryKey: ['/api/payments/config'],
    queryFn: async () => {
      const res = await fetch('/api/payments/config');
      if (!res.ok) throw new Error("Payment system not available");
      return res.json() as Promise<{ publishableKey: string; subscriptionPricePence: number }>;
    },
  });
}

export function useSubscriptionStatus() {
  return useQuery({
    queryKey: ['/api/subscription/status'],
    queryFn: async () => {
      const res = await fetch('/api/subscription/status');
      if (!res.ok) throw new Error("Failed to check subscription");
      return res.json() as Promise<{ subscribed: boolean; status?: string; currentPeriodEnd?: string; stripeSubscriptionId?: string }>;
    },
  });
}

export function useCreateSubscriptionCheckout() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/subscription/create-checkout", {});
      return res.json() as Promise<{ checkoutUrl: string; sessionId: string }>;
    },
    onError: (error) => {
      toast({
        title: "Subscription Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useVerifySubscription() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (checkoutSessionId: string) => {
      try {
        const res = await apiRequest("POST", "/api/subscription/verify", { checkoutSessionId });
        return res.json() as Promise<{ verified: boolean; subscribed?: boolean; alreadyActive?: boolean }>;
      } catch (verifyErr) {
        const recoverRes = await apiRequest("POST", "/api/subscription/recover", { checkoutSessionId });
        const recoverData = await recoverRes.json() as { recovered: boolean; subscribed?: boolean; alreadyActive?: boolean };
        if (recoverData.recovered) {
          return { verified: true, subscribed: recoverData.subscribed, alreadyActive: recoverData.alreadyActive };
        }
        throw verifyErr;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/subscription/status'] });
      if (data.alreadyActive) {
        toast({ title: "Already Subscribed", description: "Your subscription is already active." });
      } else {
        toast({ title: "Subscribed!", description: "Welcome to ListAI Pro! You can now unlock unlimited AI analysis." });
      }
    },
    onError: (error) => {
      toast({
        title: "Subscription Verification Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useCancelSubscription() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/subscription/cancel", {});
      return res.json() as Promise<{ cancelled: boolean; message: string }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/subscription/status'] });
      toast({ title: "Subscription Cancelled", description: data.message });
    },
    onError: (error) => {
      toast({ title: "Cancel Failed", description: error.message, variant: "destructive" });
    },
  });
}

export function useUploadImages() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ files, productContext, brandTone, hideToast }: { files: File[]; productContext?: string; brandTone?: string; hideToast?: boolean }) => {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append("images", file);
      });
      if (productContext) formData.append("productContext", productContext);
      if (brandTone) formData.append("brandTone", brandTone);

      const res = await fetch(api.images.upload.path, {
        method: api.images.upload.method,
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to upload images");
      }

      return res.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.images.list.path] });
      if (variables.hideToast) return;

      const allPaid = data.every((img: any) => img.paymentStatus === 'paid');
      toast({
        title: allPaid ? "Products Ready" : "Images Uploaded",
        description: allPaid
          ? `${data.length} products uploaded with full AI analysis. Ready to review and push to your stores.`
          : `${data.length} images uploaded with AI preview. Subscribe to unlock full descriptions and pricing.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUnlockImages() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ imageIds }: { imageIds: number[] }) => {
      const res = await apiRequest("POST", "/api/subscription/unlock-images", { imageIds });
      return res.json() as Promise<{ processed: number; results: any[]; message?: string }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.images.list.path] });
      if (data.processed === 0) {
        toast({ title: "Already Analyzed", description: data.message || "All images already have full AI analysis." });
      } else {
        toast({
          title: "Analysis Complete",
          description: `Full AI analysis completed for ${data.processed} products. You can now review and push to your stores.`,
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Analysis Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUpdateImage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: any }) => {
      const url = buildUrl(api.images.update.path, { id });
      const res = await apiRequest("PUT", url, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.images.list.path] });
      toast({ title: "Product Updated", description: "Product details saved." });
    },
    onError: (error) => {
      toast({ title: "Update Failed", description: error.message, variant: "destructive" });
    },
  });
}

export function useDeleteImage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.images.delete.path, { id });
      await apiRequest("DELETE", url);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.images.list.path] });
      toast({ title: "Product Removed" });
    },
    onError: (error) => {
      toast({ title: "Delete Failed", description: error.message, variant: "destructive" });
    },
  });
}

export function usePushToShopify() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (ids: number[]) => {
      const res = await apiRequest("POST", api.images.pushToShopify.path, { ids });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.images.list.path] });
      toast({
        title: "Shopify Sync Complete",
        description: `${data.success} products pushed, ${data.failed} failed.`,
      });
    },
    onError: (error) => {
      toast({ title: "Shopify Push Failed", description: error.message, variant: "destructive" });
    },
  });
}

export function useEtsyStatus() {
  return useQuery({
    queryKey: [api.etsy.status.path],
    queryFn: async () => {
      const res = await fetch(api.etsy.status.path);
      if (!res.ok) throw new Error("Failed to check Etsy status");
      return res.json();
    },
  });
}

export function useEtsyConnect() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ apiKeystring, accessToken, shopId }: { apiKeystring: string; accessToken: string; shopId: string }) => {
      const res = await apiRequest("POST", api.etsy.connect.path, { apiKeystring, accessToken, shopId });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to connect to Etsy");
      }
      return res.json() as Promise<{ connected: boolean; shopName: string; shopId: string }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.etsy.status.path] });
      toast({ title: "Etsy Connected", description: `Connected to ${data.shopName}` });
    },
    onError: (error) => {
      toast({ title: "Connection Failed", description: error.message, variant: "destructive" });
    },
  });
}

export function useEtsyDisconnect() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", api.etsy.disconnect.path);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.etsy.status.path] });
      toast({ title: "Disconnected", description: "Your Etsy store has been disconnected." });
    },
    onError: (error) => {
      toast({ title: "Disconnect Failed", description: error.message, variant: "destructive" });
    },
  });
}

export function usePushToEtsy() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (ids: number[]) => {
      const res = await apiRequest("POST", api.images.pushToEtsy.path, { ids });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.images.list.path] });
      toast({
        title: "Etsy Sync Complete",
        description: `${data.success} products pushed, ${data.failed} failed.`,
      });
    },
    onError: (error) => {
      toast({ title: "Etsy Push Failed", description: error.message, variant: "destructive" });
    },
  });
}

export function useShopifyStatus() {
  return useQuery({
    queryKey: [api.shopify.status.path],
    queryFn: async () => {
      const res = await fetch(api.shopify.status.path);
      if (!res.ok) throw new Error("Failed to check Shopify status");
      return res.json();
    },
  });
}

export function useShopifyConnect() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ shopDomain, accessToken }: { shopDomain: string; accessToken: string }) => {
      const res = await apiRequest("POST", api.shopify.connect.path, { shopDomain, accessToken });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to connect to Shopify");
      }
      return res.json() as Promise<{ connected: boolean; shopName: string; shopDomain: string }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.shopify.status.path] });
      toast({ title: "Shopify Connected", description: `Connected to ${data.shopName}` });
    },
    onError: (error) => {
      toast({ title: "Connection Failed", description: error.message, variant: "destructive" });
    },
  });
}

export function useShopifyDisconnect() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", api.shopify.disconnect.path);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.shopify.status.path] });
      toast({ title: "Disconnected", description: "Your Shopify store has been disconnected." });
    },
    onError: (error) => {
      toast({ title: "Disconnect Failed", description: error.message, variant: "destructive" });
    },
  });
}

export function useAmazonStatus() {
  return useQuery({
    queryKey: [api.amazon.status.path],
    queryFn: async () => {
      const res = await fetch(api.amazon.status.path);
      if (!res.ok) throw new Error("Failed to check Amazon status");
      return res.json();
    },
  });
}

export function useAmazonConnect() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ lwaClientId, lwaClientSecret, lwaRefreshToken, sellerId, marketplaceId }: {
      lwaClientId: string; lwaClientSecret: string; lwaRefreshToken: string; sellerId: string; marketplaceId: string;
    }) => {
      const res = await apiRequest("POST", api.amazon.connect.path, { lwaClientId, lwaClientSecret, lwaRefreshToken, sellerId, marketplaceId });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to connect to Amazon");
      }
      return res.json() as Promise<{ connected: boolean; sellerName: string; sellerId: string; marketplaceId: string }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.amazon.status.path] });
      toast({ title: "Amazon Connected", description: `Connected as ${data.sellerName}` });
    },
    onError: (error) => {
      toast({ title: "Connection Failed", description: error.message, variant: "destructive" });
    },
  });
}

export function useAmazonDisconnect() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", api.amazon.disconnect.path);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.amazon.status.path] });
      toast({ title: "Disconnected", description: "Your Amazon seller account has been disconnected." });
    },
    onError: (error) => {
      toast({ title: "Disconnect Failed", description: error.message, variant: "destructive" });
    },
  });
}

export function useInstagramStatus() {
  return useQuery({
    queryKey: [api.instagram.status.path],
    queryFn: async () => {
      const res = await fetch(api.instagram.status.path);
      if (!res.ok) throw new Error("Failed to check Instagram status");
      return res.json() as Promise<{ connected: boolean; username?: string; igUserId?: string }>;
    },
  });
}

export function useInstagramOAuthConfig() {
  return useQuery({
    queryKey: [api.instagram.oauthConfig.path],
    queryFn: async () => {
      const res = await fetch(api.instagram.oauthConfig.path);
      if (!res.ok) return { configured: false };
      return res.json() as Promise<{ configured: boolean }>;
    },
  });
}

export function useInstagramOAuthStart() {
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(api.instagram.oauthStart.path);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to start Instagram connection");
      }
      return res.json() as Promise<{ authUrl: string }>;
    },
  });
}

export function useInstagramConnect() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ accessToken }: { accessToken: string }) => {
      const res = await apiRequest("POST", api.instagram.connect.path, { accessToken });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to connect to Instagram");
      }
      return res.json() as Promise<{ connected: boolean; username: string; igUserId: string }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.instagram.status.path] });
      toast({ title: "Instagram Connected", description: `Connected as @${data.username}` });
    },
    onError: (error) => {
      toast({ title: "Connection Failed", description: error.message, variant: "destructive" });
    },
  });
}

export function useInstagramDisconnect() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", api.instagram.disconnect.path);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.instagram.status.path] });
      toast({ title: "Disconnected", description: "Your Instagram account has been disconnected." });
    },
    onError: (error) => {
      toast({ title: "Disconnect Failed", description: error.message, variant: "destructive" });
    },
  });
}

export function useInstagramMedia() {
  return useQuery({
    queryKey: ['/api/instagram/media'],
    queryFn: async () => {
      const res = await fetch('/api/instagram/media');
      if (!res.ok) return { media: [] };
      return res.json() as Promise<{ media: { id: string; caption?: string; media_type: string; media_url: string; thumbnail_url?: string; timestamp: string }[] }>;
    },
    enabled: false,
  });
}

export function useInstagramImport() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ mediaIds, productContext, brandTone }: { mediaIds?: string[]; productContext?: string; brandTone?: string }) => {
      const res = await apiRequest("POST", api.instagram.importMedia.path, { mediaIds, productContext, brandTone });
      return res.json() as Promise<{ imported: number; images?: any[]; message?: string }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.images.list.path] });
      toast({
        title: "Instagram Import Complete",
        description: `${data.imported} image(s) imported from Instagram.`,
      });
    },
    onError: (error) => {
      toast({ title: "Import Failed", description: error.message, variant: "destructive" });
    },
  });
}

export function useInstagramGenerateCaption() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (imageId: number) => {
      const res = await apiRequest("POST", api.instagram.generateCaption.path, { imageId });
      return res.json() as Promise<{ caption: string; hashtags: string[] }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.images.list.path] });
      toast({ title: "Caption Generated", description: "Instagram caption has been generated for your product." });
    },
    onError: (error) => {
      toast({ title: "Caption Generation Failed", description: error.message, variant: "destructive" });
    },
  });
}

export function useInstagramPost() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ imageId, caption }: { imageId: number; caption?: string }) => {
      const res = await apiRequest("POST", api.instagram.postProduct.path, { imageId, caption });
      return res.json() as Promise<{ posted: boolean; postId: string; caption: string }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.images.list.path] });
      toast({ title: "Posted to Instagram", description: "Your product has been posted to Instagram!" });
    },
    onError: (error) => {
      toast({ title: "Instagram Post Failed", description: error.message, variant: "destructive" });
    },
  });
}

export function usePushToAmazon() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (ids: number[]) => {
      const res = await apiRequest("POST", api.images.pushToAmazon.path, { ids });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.images.list.path] });
      toast({
        title: "Amazon Sync Complete",
        description: `${data.success} products pushed, ${data.failed} failed.`,
      });
    },
  });
}

export function useGeneratePhotoshoot() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, style }: { id: number; style: string }) => {
      const res = await apiRequest("POST", `/api/images/${id}/generate-photoshoot`, { style });
      if (!res.ok) {
        throw new Error(await res.text().catch(() => "Failed to generate photoshoot"));
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.images.list.path] });
      toast({ title: "Concept Generated", description: "Successfully rendered new AI concept." });
    },
    onError: (error) => {
      toast({ title: "Generation Failed", description: error.message, variant: "destructive" });
    },
  });
}
