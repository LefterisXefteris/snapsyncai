import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@clerk/clerk-react";

const DEV_BYPASS_AUTH = import.meta.env.VITE_DEV_BYPASS_AUTH === "true";

export function useImages() {
  const { user } = useUser();
  const userId = DEV_BYPASS_AUTH ? "dev_local_user" : user?.id;
  return useQuery({
    // Scoped by userId so different users never share the same cache entry
    queryKey: [api.images.list.path, userId],
    queryFn: async () => {
      const res = await fetch(api.images.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch images");
      return res.json();
    },
    enabled: !!userId,
    staleTime: 60_000, // cache for 1 min — mutations invalidate as needed
  });
}

export function usePaymentConfig() {
  return useQuery({
    queryKey: ['/api/payments/config'],
    queryFn: async () => {
      const res = await fetch('/api/payments/config', { credentials: "include" });
      if (!res.ok) throw new Error("Payment system not available");
      return res.json() as Promise<{
        publishableKey: string;
        subscriptionWeeklyPricePence: number;
        subscriptionAnnualPricePence: number;
        weeklyProductLimit: number;
      }>;
    },
  });
}

export function useSubscriptionStatus() {
  const { user } = useUser();
  const userId = DEV_BYPASS_AUTH ? "dev_local_user" : user?.id;
  return useQuery({
    queryKey: ['/api/subscription/status', userId],
    queryFn: async () => {
      if (DEV_BYPASS_AUTH) return { subscribed: true, status: "active" };
      const res = await fetch('/api/subscription/status', { credentials: "include" });
      if (!res.ok) throw new Error("Failed to check subscription");
      return res.json() as Promise<{ subscribed: boolean; status?: string; currentPeriodEnd?: string; stripeSubscriptionId?: string }>;
    },
    enabled: !!userId,
  });
}

export function useCreateSubscriptionCheckout() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (billingInterval: 'weekly' | 'annual' = 'weekly') => {
      const res = await apiRequest("POST", "/api/subscription/create-checkout", { billingInterval });
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

export function useRecoverSubscriptionByEmail() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/subscription/recover-by-email", {});
      return res.json() as Promise<{ recovered: boolean; subscribed?: boolean; message?: string }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/subscription/status'] });
      if (data.recovered && data.subscribed) {
        toast({ title: "Subscription Restored", description: "Your Pro subscription has been linked to this account." });
      } else if (data.recovered) {
        toast({ title: "Account Linked", description: data.message || "Your account has been updated." });
      } else {
        toast({ title: "No Subscription Found", description: "No active subscription was found for your email address.", variant: "destructive" });
      }
    },
    onError: (error) => {
      toast({ title: "Recovery Failed", description: error.message, variant: "destructive" });
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
        toast({ title: "Subscribed!", description: "Welcome to SnapSync AI Pro! You can now unlock unlimited AI analysis." });
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
    mutationFn: async ({ files, productContext, brandTone, groupAsOne, hideToast }: { files: File[]; productContext?: string; brandTone?: string; groupAsOne?: boolean; hideToast?: boolean }) => {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append("images", file);
      });
      if (productContext) formData.append("productContext", productContext);
      if (brandTone) formData.append("brandTone", brandTone);
      if (groupAsOne) formData.append("groupAsOne", "true");

      const res = await fetch(api.images.upload.path, {
        method: api.images.upload.method,
        body: formData,
        credentials: "include",
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

export function useUnlinkFromGroup() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (imageId: number) => {
      const res = await apiRequest("POST", `/api/images/${imageId}/unlink-from-group`, {});
      if (!res.ok) throw new Error("Failed to unlink image");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.images.list.path] });
      queryClient.invalidateQueries({ queryKey: ['/api/images/group'] });
      toast({ title: "Removed from product", description: "Image is now in your library." });
    },
    onError: (error) => {
      toast({ title: "Failed to remove image", description: error.message, variant: "destructive" });
    },
  });
}

export function useAssignMultipleToGroup() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ imageIds, productGroupId, primaryImageId }: { imageIds: number[]; productGroupId: string; primaryImageId?: number }) => {
      const res = await apiRequest("POST", "/api/images/assign-group-batch", { imageIds, productGroupId, primaryImageId });
      if (!res.ok) throw new Error("Failed to assign images");
      return res.json();
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: [api.images.list.path] });
      queryClient.invalidateQueries({ queryKey: ['/api/images/group'] });
      toast({ title: "Images added", description: `${vars.imageIds.length} image${vars.imageIds.length !== 1 ? "s" : ""} added to this product.` });
    },
    onError: (error) => {
      toast({ title: "Failed to add images", description: error.message, variant: "destructive" });
    },
  });
}

export function useAssignToGroup() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ imageId, productGroupId, primaryImageId }: { imageId: number; productGroupId: string; primaryImageId?: number }) => {
      const res = await apiRequest("POST", `/api/images/${imageId}/assign-group`, { productGroupId, primaryImageId });
      if (!res.ok) throw new Error("Failed to assign image");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.images.list.path] });
      queryClient.invalidateQueries({ queryKey: ['/api/images/group'] });
      toast({ title: "Image added", description: "Image added to this product." });
    },
    onError: (error) => {
      toast({ title: "Failed to add image", description: error.message, variant: "destructive" });
    },
  });
}

export function useProductGroup(imageId: number | undefined) {
  return useQuery({
    queryKey: ['/api/images/group', imageId],
    queryFn: async () => {
      const res = await fetch(`/api/images/${imageId}/group`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch product group");
      return res.json();
    },
    enabled: !!imageId,
    staleTime: 30_000,
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
      queryClient.invalidateQueries({ queryKey: ['/api/images/group'] });
      toast({ title: "Product Removed" });
    },
    onError: (error) => {
      toast({ title: "Delete Failed", description: error.message, variant: "destructive" });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (groupId: string) => {
      const url = buildUrl(api.images.deleteGroup.path, { groupId });
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
      const errors = Array.isArray(data.results)
        ? data.results.map((result: { error?: string }) => result.error).filter(Boolean)
        : [];
      const errorSummary = errors.length > 0
        ? errors.slice(0, 2).join(" ")
        : "Reconnect Shopify and try again.";

      if (data.failed > 0 && data.success === 0) {
        toast({
          title: "Push Failed",
          description: `All ${data.failed} product(s) failed to push. ${errorSummary}`,
          variant: "destructive",
        });
      } else if (data.failed > 0) {
        toast({
          title: "Partial Success",
          description: `${data.success} pushed, ${data.failed} failed. ${errorSummary}`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Shopify Sync Complete",
          description: `${data.success} product(s) pushed successfully.`,
        });
      }
    },
    onError: (error: any) => {
      const msg = error?.message || "Push failed";
      toast({ title: "Shopify Push Failed", description: msg, variant: "destructive" });
    },
  });
}

export function useEtsyStatus() {
  return useQuery({
    queryKey: [api.etsy.status.path],
    queryFn: async () => {
      const res = await fetch(api.etsy.status.path, { credentials: "include" });
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
      const res = await fetch(api.shopify.status.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to check Shopify status");
      return res.json();
    },
  });
}

export function useShopifyConnect() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ shopDomain }: { shopDomain: string }) => {
      const params = new URLSearchParams({ shop: shopDomain });
      window.location.assign(`${api.shopify.oauthStart.path}?${params.toString()}`);
    },
    onError: (error) => {
      toast({ title: "Connection Failed", description: error.message || "Failed to start Shopify authorization.", variant: "destructive" });
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
      const res = await fetch(api.amazon.status.path, { credentials: "include" });
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
      const res = await fetch(api.instagram.status.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to check Instagram status");
      return res.json() as Promise<{ connected: boolean; username?: string; igUserId?: string }>;
    },
  });
}

export function useInstagramOAuthConfig() {
  return useQuery({
    queryKey: [api.instagram.oauthConfig.path],
    queryFn: async () => {
      const res = await fetch(api.instagram.oauthConfig.path, { credentials: "include" });
      if (!res.ok) return { configured: false };
      return res.json() as Promise<{ configured: boolean }>;
    },
  });
}

export function useInstagramOAuthStart() {
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(api.instagram.oauthStart.path, { credentials: "include" });
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
      const res = await fetch('/api/instagram/media', { credentials: "include" });
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

export function useEditBackground() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, style }: { id: number; style: string }) => {
      const res = await apiRequest("POST", `/api/images/${id}/edit-background`, { style });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as any).message || "Failed to edit background");
      }
      return res.json() as Promise<{ key: string; url: string }>;
    },
    onError: (error) => {
      toast({ title: "Background Edit Failed", description: error.message, variant: "destructive" });
    },
  });
}

export function useApplyImage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, bgKey, imageUrl }: { id: number; bgKey?: string; imageUrl?: string }) => {
      const res = await apiRequest("POST", `/api/images/${id}/apply-image`, { bgKey, imageUrl });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as any).message || "Failed to apply image");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.images.list.path] });
      toast({ title: "Image Applied", description: "Product image has been updated successfully." });
    },
    onError: (error) => {
      toast({ title: "Apply Failed", description: error.message, variant: "destructive" });
    },
  });
}

export function useRewriteDescription() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, tone }: { id: number; tone: string }) => {
      const res = await apiRequest("POST", `/api/images/${id}/rewrite-description`, { tone });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as any).message || "Failed to rewrite description");
      }
      return res.json() as Promise<{ description: string }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.images.list.path] });
      toast({ title: "Description Rewritten", description: "Successfully generated a new description based on the selected tone." });
    },
    onError: (error) => {
      toast({ title: "Rewrite Failed", description: error.message, variant: "destructive" });
    },
  });
}


export interface GeneratedContent {
  title: string;
  description: string;
  seoKeywords: string[];
  aeoFaqs: { q: string; a: string }[];
}

export function useGenerateContent() {
  const { toast } = useToast();

  const generate = async (
    imageId: number,
    params: { category: string; styleTone: string; audience: string },
    onChunk: (text: string) => void,
    onDone: (parsed: GeneratedContent) => void,
    onError?: (msg: string) => void
  ): Promise<void> => {
    const url = buildUrl(api.images.generateContent.path, { id: imageId });
    let accumulated = "";
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(params),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ message: "Generation failed" }));
        throw new Error((err as any).message || "Generation failed");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        // SSE lines: "data: {...}\n\n"
        const lines = text.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const json = JSON.parse(line.slice(6));
          if (json.done) {
            // Parse the full accumulated JSON
            try {
              const parsed: GeneratedContent = JSON.parse(accumulated);
              onDone(parsed);
            } catch {
              // Fallback: try to extract JSON object from accumulated text
              const match = accumulated.match(/\{[\s\S]*\}/);
              if (match) onDone(JSON.parse(match[0]));
              else throw new Error("Could not parse generated content");
            }
            return;
          }
          if (json.error) throw new Error(json.error);
          if (json.content) {
            accumulated += json.content;
            onChunk(accumulated);
          }
        }
      }
    } catch (err: any) {
      const msg = err?.message || "Content generation failed";
      toast({ title: "Generation failed", description: msg, variant: "destructive" });
      onError?.(msg);
    }
  };

  return { generate };
}

export function useRegenerateField() {
  const { toast } = useToast();

  const regenerate = async (
    imageId: number,
    field: "title" | "description" | "seoKeywords" | "aeoFaqs",
    params: { category?: string; styleTone?: string; audience?: string },
    onChunk: (text: string) => void,
    onDone: (value: string | string[] | { q: string; a: string }[]) => void,
    onError?: (msg: string) => void
  ): Promise<void> => {
    const url = buildUrl(api.images.regenerateField.path, { id: imageId });
    let accumulated = "";
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ field, ...params }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ message: "Regeneration failed" }));
        throw new Error((err as any).message || "Regeneration failed");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        const lines = text.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const json = JSON.parse(line.slice(6));
          if (json.done) {
            // Parse final value based on field type
            if (field === "seoKeywords" || field === "aeoFaqs") {
              try {
                const match = accumulated.match(/\[[\s\S]*\]/);
                onDone(JSON.parse(match ? match[0] : accumulated));
              } catch {
                onDone(accumulated);
              }
            } else {
              onDone(accumulated.trim());
            }
            return;
          }
          if (json.error) throw new Error(json.error);
          if (json.content) {
            accumulated += json.content;
            onChunk(accumulated);
          }
        }
      }
    } catch (err: any) {
      const msg = err?.message || "Regeneration failed";
      toast({ title: "Regeneration failed", description: msg, variant: "destructive" });
      onError?.(msg);
    }
  };

  return { regenerate };
}
