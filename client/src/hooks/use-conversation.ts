import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-routes";
import { apiFetch } from "@/lib/api-fetch";
import { apiRequest } from "@/lib/queryClient";
import { useAppUserId } from "@/hooks/use-app-user-id";

export type ConversationSilence = {
  offers: boolean;
  bulkSeo: boolean;
  listingCopyRefresh: boolean;
  website: boolean;
};

export type ConversationProposalItem = {
  productId: number;
  error: string | null;
  proposal: {
    description?: string;
    tags?: string[];
    seoTitle?: string;
    seoDescription?: string;
  } | null;
  queries: string[];
};

export type ConversationView = {
  reply: string;
  thread: { role: string; text: string }[];
  silence: ConversationSilence;
  proposal: { job: string; items: ConversationProposalItem[] } | null;
  connectPath: string | null;
  shopConnected: boolean;
};

export type ConversationAct = {
  kind: string;
  productId?: number;
  confirmOverflow?: boolean;
  look?: string;
  productIds?: number[];
  silence?: ConversationSilence;
};

export function useConversation() {
  const userId = useAppUserId();
  return useQuery({
    queryKey: [api.conversation.read.path, userId],
    queryFn: async () => {
      const res = await apiFetch(api.conversation.read.path);
      if (!res.ok) throw new Error("Failed to load the conversation");
      return res.json() as Promise<ConversationView>;
    },
    enabled: !!userId,
  });
}

export function useSendConversation() {
  const userId = useAppUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { text?: string; act?: ConversationAct }) => {
      const res = await apiRequest(api.conversation.post.method, api.conversation.post.path, body);
      return res.json() as Promise<ConversationView>;
    },
    onSuccess: (view, body) => {
      queryClient.setQueryData([api.conversation.read.path, userId], view);
      if (body.act?.kind === "accept" || body.act?.kind === "handoff") {
        queryClient.invalidateQueries({ queryKey: ["/api/subscription/status"] });
        queryClient.invalidateQueries({ queryKey: [api.images.list.path] });
        queryClient.invalidateQueries({ queryKey: ["/api/images/group"] });
      }
    },
  });
}
