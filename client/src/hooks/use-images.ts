import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@/lib/api-routes";
import { apiRequest } from "@/lib/queryClient";
import { apiUrl } from "@/lib/api-origin";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@clerk/clerk-react";
import { useAmbient } from "@/components/ambient/AmbientProvider";
import type { Image } from "@/lib/image";

const DEV_BYPASS_AUTH = import.meta.env.VITE_DEV_BYPASS_AUTH === "true";

function useAppUserId(): string | undefined {
  if (DEV_BYPASS_AUTH) return "dev_local_user";
  // Compile-time constant: bypass builds never call useUser (no ClerkProvider).
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { user } = useUser();
  return user?.id;
}

export function useImages() {
  const userId = useAppUserId();
  return useQuery({
    // Scoped by userId so different users never share the same cache entry
    queryKey: [api.images.list.path, userId],
    queryFn: async () => {
      const res = await fetch(apiUrl(api.images.list.path), { credentials: "include" });
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
      const res = await fetch(apiUrl('/api/payments/config'), { credentials: "include" });
      if (!res.ok) throw new Error("Payment system not available");
      return res.json() as Promise<{
        publishableKey: string;
        planMonthlyPricePence: number;
        planAnnualPricePence: number;
        allowanceMonthly: number;
        overagePence: number;
      }>;
    },
  });
}

export function useSubscriptionStatus() {
  const userId = useAppUserId();
  return useQuery({
    queryKey: ['/api/subscription/status', userId],
    queryFn: async () => {
      if (DEV_BYPASS_AUTH) {
        return {
          subscribed: true,
          status: "active",
          entitlement: "local_bypass",
          allowanceUsed: 0,
          allowanceIncluded: null,
          overageThisMonth: 0,
        };
      }
      const res = await fetch(apiUrl('/api/subscription/status'), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to check subscription");
      return res.json() as Promise<{
        subscribed: boolean;
        entitlement?: string;
        allowanceUsed?: number;
        allowanceIncluded?: number | null;
        overageThisMonth?: number;
        status?: string;
        currentPeriodEnd?: string;
        stripeSubscriptionId?: string;
      }>;
    },
    enabled: !!userId,
  });
}

export function useCreateSubscriptionCheckout() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (billingInterval: 'monthly' | 'annual' = 'monthly') => {
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
        toast({ title: "Plan active", description: "You have 20 listing-copy writes this calendar month." });
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
  const { beginThinking, endThinking } = useAmbient();

  return useMutation({
    onMutate: () => beginThinking(),
    mutationFn: async ({ files, productContext, brandTone, groupAsOne, hideToast }: { files: File[]; productContext?: string; brandTone?: string; groupAsOne?: boolean; hideToast?: boolean }) => {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append("images", file);
      });
      if (productContext) formData.append("productContext", productContext);
      if (brandTone) formData.append("brandTone", brandTone);
      if (groupAsOne) formData.append("groupAsOne", "true");

      const res = await fetch(apiUrl(api.images.upload.path), {
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
      endThinking(true);
      queryClient.invalidateQueries({ queryKey: [api.images.list.path] });
      if (variables.hideToast) return;

      toast({
        title: "Photos uploaded",
        description: `${data.length} photos are in New listing. Confirm facts, then listing copy.`,
      });
    },
    onError: (error) => {
      endThinking(false);
      toast({
        title: "Upload Failed",
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
      const res = await fetch(apiUrl(`/api/images/${imageId}/group`), { credentials: "include" });
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
      queryClient.invalidateQueries({ queryKey: ["/api/images/group"] });
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
  const { beginThinking, endThinking } = useAmbient();

  return useMutation({
    onMutate: () => beginThinking(),
    mutationFn: async (
      input: number[] | { ids: number[]; publicationIds?: string[]; productStatus?: string },
    ) => {
      const body = Array.isArray(input) ? { ids: input } : input;
      const res = await apiRequest("POST", api.images.pushToShopify.path, body);
      return res.json();
    },
    onSuccess: (data) => {
      endThinking(data.failed === 0);
      queryClient.invalidateQueries({ queryKey: [api.images.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.shopify.publications.path] });
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
      endThinking(false);
      const msg = error?.message || "Push failed";
      toast({ title: "Shopify Push Failed", description: msg, variant: "destructive" });
    },
  });
}

export function useShopifyStatus() {
  return useQuery({
    queryKey: [api.shopify.status.path],
    queryFn: async () => {
      const res = await fetch(apiUrl(api.shopify.status.path), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to check Shopify status");
      return res.json();
    },
  });
}

export type ShopifyPublication = {
  id: string;
  name: string;
  published: boolean;
};

export function useShopifyPublications(imageId?: number) {
  const userId = useAppUserId();
  return useQuery({
    queryKey: [api.shopify.publications.path, userId, imageId],
    queryFn: async () => {
      const path =
        imageId != null
          ? `${api.shopify.publications.path}?imageId=${imageId}`
          : api.shopify.publications.path;
      const res = await fetch(apiUrl(path), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load Shopify publications");
      return res.json() as Promise<{
        connected: boolean;
        publicationsReady: boolean;
        productStatus: string | null;
        publications: ShopifyPublication[];
      }>;
    },
    enabled: !!userId,
  });
}

export function useShopifyConnect() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ shopDomain }: { shopDomain: string }) => {
      const params = new URLSearchParams({ shop: shopDomain });
      window.location.assign(`${apiUrl(api.shopify.oauthStart.path)}?${params.toString()}`);
    },
    onError: (error) => {
      toast({ title: "Connection Failed", description: error.message || "Failed to start Shopify authorization.", variant: "destructive" });
    },
  });
}

export function useSaveShopGpsrIdentity() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (gpsrIdentity: {
      manufacturer: { name: string; postalAddress: string; email: string };
      manufacturerInEu: boolean;
      euResponsiblePerson?: { name: string; postalAddress: string; email: string } | null;
    }) => {
      const res = await apiRequest("PUT", api.shopify.gpsrIdentity.path, gpsrIdentity);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData([api.shopify.status.path], data);
      queryClient.invalidateQueries({ queryKey: [api.images.list.path] });
      queryClient.invalidateQueries({ queryKey: ["/api/images/group"] });
      toast({
        title: "Shop GPSR identity saved",
        description: "New products can use this as the default.",
      });
    },
    onError: (error: { message?: string }) => {
      toast({
        title: "Could not save shop GPSR identity",
        description: error.message,
        variant: "destructive",
      });
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

export type GeneratedListingCopy = {
  title?: string;
  description?: string;
  tags?: string[];
  seoTitle?: string;
  seoDescription?: string;
  aeoFaqs?: { q: string; a: string }[] | { question: string; answer: string }[];
  aeoSnippet?: string;
};

export function useAcceptGeneratedListingCopy() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      imageId,
      generated,
    }: {
      imageId: number;
      generated: GeneratedListingCopy;
    }) => {
      const res = await apiRequest(
        "POST",
        buildUrl(api.images.acceptListingCopy.path, { id: imageId }),
        generated,
      );
      return res.json() as Promise<Image>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.images.list.path] });
      queryClient.invalidateQueries({ queryKey: ["/api/images/group"] });
    },
    onError: (error) => {
      toast({
        title: "Could not accept listing copy",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export type ListingCopyRefreshPack = {
  tags: string[];
  description: string;
  seoTitle: string;
  seoDescription: string;
  queries: string[];
};

export function useListingCopyRefresh() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (imageId: number) => {
      const res = await apiRequest(
        "POST",
        buildUrl(api.images.refreshListingCopy.path, { id: imageId }),
      );
      return res.json() as Promise<ListingCopyRefreshPack>;
    },
    onError: (error: { message?: string }) => {
      toast({
        title: "Could not refresh listing copy",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useRegenerateListingCopyRefresh() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ imageId, queries }: { imageId: number; queries: string[] }) => {
      const res = await apiRequest(
        "POST",
        buildUrl(api.images.regenerateListingCopyRefresh.path, { id: imageId }),
        { queries },
      );
      return res.json() as Promise<ListingCopyRefreshPack>;
    },
    onError: (error: { message?: string }) => {
      toast({
        title: "Could not refresh listing copy",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useAcceptListingCopyRefresh() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      imageId,
      pack,
    }: {
      imageId: number;
      pack: Omit<ListingCopyRefreshPack, "queries">;
    }) => {
      const res = await apiRequest(
        "POST",
        buildUrl(api.images.acceptListingCopyRefresh.path, { id: imageId }),
        pack,
      );
      return res.json() as Promise<Image>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.images.list.path] });
      queryClient.invalidateQueries({ queryKey: ["/api/images/group"] });
    },
    onError: (error: { message?: string }) => {
      toast({
        title: "Could not accept listing copy refresh",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useConfirmProductFacts() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      imageId,
      isTextile,
      composition,
      gpsrChoice,
      gpsrIdentity,
      careChoice,
      care,
    }: {
      imageId: number;
      isTextile: boolean;
      composition?: { name: string; percent: number | null; otherName?: string }[];
      gpsrChoice: "skip" | "shop_default" | "override";
      gpsrIdentity?: {
        manufacturer: { name: string; postalAddress: string; email: string };
        manufacturerInEu: boolean;
        euResponsiblePerson?: { name: string; postalAddress: string; email: string } | null;
      };
      careChoice?: "skip" | "fill";
      care?: {
        washing: string;
        bleaching: string;
        drying: string;
        ironing: string;
        professionalTextileCare: string;
      };
    }) => {
      const res = await apiRequest(
        "POST",
        buildUrl(api.images.confirmProductFacts.path, { id: imageId }),
        { isTextile, composition, gpsrChoice, gpsrIdentity, careChoice, care },
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.images.list.path] });
      queryClient.invalidateQueries({ queryKey: ["/api/images/group"] });
      toast({
        title: "Facts confirmed",
        description: "You can generate listing copy for this product.",
      });
    },
    onError: (error) => {
      toast({
        title: "Could not confirm facts",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export interface GeneratedContent {
  title: string;
  description: string;
  seoKeywords: string[];
  seoTitle?: string;
  seoDescription?: string;
  aeoFaqs: { q: string; a: string }[];
}

export type RegenerableListingCopyField =
  | "title"
  | "description"
  | "seoKeywords"
  | "seoTitle"
  | "seoDescription"
  | "aeoFaqs";

export function useGenerateContent() {
  const { toast } = useToast();
  const { beginThinking, endThinking } = useAmbient();

  const generate = async (
    imageId: number,
    params: { category: string; styleTone: string; audience: string },
    onChunk: (text: string) => void,
    onDone: (parsed: GeneratedContent) => void,
    onError?: (msg: string) => void
  ): Promise<void> => {
    const url = apiUrl(buildUrl(api.images.generateContent.path, { id: imageId }));
    let accumulated = "";
    beginThinking();
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
            endThinking(true);
            return;
          }
          if (json.error) throw new Error(json.error);
          if (json.content) {
            accumulated += json.content;
            onChunk(accumulated);
          }
        }
      }
      endThinking(false);
    } catch (err: any) {
      endThinking(false);
      const msg = err?.message || "Content generation failed";
      toast({ title: "Generation failed", description: msg, variant: "destructive" });
      onError?.(msg);
    }
  };

  return { generate };
}

export function useRegenerateField() {
  const { toast } = useToast();
  const { beginThinking, endThinking } = useAmbient();

  const regenerate = async (
    imageId: number,
    field: RegenerableListingCopyField,
    params: { category?: string; styleTone?: string; audience?: string },
    onChunk: (text: string) => void,
    onDone: (value: string | string[] | { q: string; a: string }[]) => void,
    onError?: (msg: string) => void
  ): Promise<void> => {
    const url = apiUrl(buildUrl(api.images.regenerateField.path, { id: imageId }));
    let accumulated = "";
    beginThinking();
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
            endThinking(true);
            return;
          }
          if (json.error) throw new Error(json.error);
          if (json.content) {
            accumulated += json.content;
            onChunk(accumulated);
          }
        }
      }
      endThinking(false);
    } catch (err: any) {
      endThinking(false);
      const msg = err?.message || "Regeneration failed";
      toast({ title: "Regeneration failed", description: msg, variant: "destructive" });
      onError?.(msg);
    }
  };

  return { regenerate };
}
