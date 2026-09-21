import { useMutation, useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/clerk-react";
import { api } from "@/lib/api-routes";
import { apiFetch } from "@/lib/api-fetch";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const DEV_BYPASS_AUTH = import.meta.env.VITE_DEV_BYPASS_AUTH === "true";

function useAppUserId(): string | undefined {
  if (DEV_BYPASS_AUTH) return "dev_local_user";
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { user } = useUser();
  return user?.id;
}

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

export function useWebsiteHandoff() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (body: { productIds: number[]; look: string }) => {
      const res = await apiRequest(api.website.handoff.method, api.website.handoff.path, body);
      return res.json() as Promise<{ lovableUrl: string; productCount: number }>;
    },
    onError: (error) => {
      toast({
        title: "Could not hand off to Lovable",
        description: error instanceof Error ? error.message : "Website handoff failed",
        variant: "destructive",
      });
    },
  });
}
