import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

export type ImportFailure = {
  channelProductId: string;
  reason: string;
};

export type ImportStatus = {
  shopConnected: boolean;
  startBlockedReason: string | null;
  inProgress: boolean;
  completed: boolean;
  created: number;
  skipped: number;
  failed: number;
  failures: ImportFailure[];
};

export function useImportStatus() {
  const userId = useAppUserId();
  return useQuery({
    queryKey: [api.import.status.path, userId],
    queryFn: async () => {
      const res = await apiFetch(api.import.status.path);
      if (!res.ok) throw new Error("Failed to load Import");
      return res.json() as Promise<ImportStatus>;
    },
    enabled: !!userId,
    refetchInterval: (query) => (query.state.data?.inProgress ? 2000 : false),
  });
}

export function useImportStart() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest(api.import.start.method, api.import.start.path);
      return res.json() as Promise<ImportStatus>;
    },
    onMutate: () => {
      queryClient.invalidateQueries({ queryKey: [api.import.status.path] });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.import.status.path] });
      queryClient.invalidateQueries({ queryKey: [api.images.list.path] });
    },
    onError: (error) => {
      queryClient.invalidateQueries({ queryKey: [api.import.status.path] });
      toast({
        title: "Could not start Import",
        description: error instanceof Error ? error.message : "Import start failed",
        variant: "destructive",
      });
    },
  });
}
