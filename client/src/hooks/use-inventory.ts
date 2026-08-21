import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { apiUrl } from "@/lib/api-origin";

export type InventoryLocation = { id: string; name: string; isActive: boolean };

export type InventorySettingsDto = {
  status: string;
  enabled: boolean;
  locationId: string;
  locationName: string;
  defaultSafetyBuffer: number;
  defaultLowStockThreshold: number;
  graceEndsAt: string | null;
  lastReconciledAt: string | null;
};

export type InventoryOverview = {
  settings: InventorySettingsDto | null;
  latestImport: { id: number; status: string; preview?: Record<string, number>; error?: string | null } | null;
  totalItems: number;
  totalUnits: number;
  lowStockItems: number;
  soldOutItems: number;
  syncFailures: number;
  unreadAlerts: number;
};

export type InventoryItemDto = {
  id: number;
  title: string;
  variantTitle: string | null;
  sku: string | null;
  kind: string;
  ledgerQuantity: number;
  sellableQuantity: number;
  safetyBuffer: number | null;
  lowStockThreshold: number | null;
  trackingEnabled: boolean;
  state: string;
  channelLink?: {
    syncState: string;
    lastError: string | null;
    externalVariantId: string;
  } | null;
};

export type InventoryNotificationDto = {
  id: number;
  type: string;
  severity: string;
  title: string;
  body: string;
  readAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(apiUrl(url), { credentials: "include" });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(body.message || "Inventory request failed");
  }
  return response.json() as Promise<T>;
}

export function useInventoryOverview() {
  return useQuery({
    queryKey: ["/api/inventory/overview"],
    queryFn: () => getJson<InventoryOverview>("/api/inventory/overview"),
    retry: false,
    refetchInterval: 30_000,
  });
}

export function useInventoryLocations(enabled = true) {
  return useQuery({
    queryKey: ["/api/inventory/locations"],
    queryFn: () => getJson<InventoryLocation[]>("/api/inventory/locations"),
    enabled,
    retry: false,
  });
}

export function useInventoryItems(search = "", state = "all") {
  const params = new URLSearchParams({ limit: "100" });
  if (search) params.set("search", search);
  if (state !== "all") params.set("state", state);
  return useQuery({
    queryKey: ["/api/inventory/items", search, state],
    queryFn: () => getJson<{ items: InventoryItemDto[]; nextCursor: number | null }>(
      `/api/inventory/items?${params.toString()}`,
    ),
    retry: false,
  });
}

export function useInventoryNotifications() {
  return useQuery({
    queryKey: ["/api/inventory/notifications"],
    queryFn: () => getJson<InventoryNotificationDto[]>("/api/inventory/notifications"),
    retry: false,
  });
}

export function useInventoryBundles() {
  return useQuery({
    queryKey: ["/api/inventory/bundles"],
    queryFn: () => getJson<any[]>("/api/inventory/bundles"),
    retry: false,
  });
}

export function useInventoryImport(importId: number | null) {
  return useQuery({
    queryKey: ["/api/inventory/imports", importId],
    queryFn: () => getJson<any>(`/api/inventory/imports/${importId}`),
    enabled: importId !== null,
    refetchInterval: (query) => {
      const status = (query.state.data as any)?.status;
      return ["preview_ready", "enabled", "failed"].includes(status) ? false : 2_000;
    },
  });
}

function useInventoryMutation<TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
  invalidate: string[][],
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await Promise.all(invalidate.map((queryKey) => client.invalidateQueries({ queryKey })));
    },
  });
}

export function useStartInventorySetup() {
  return useInventoryMutation(
    async (body: { locationId: string; defaultSafetyBuffer: number; defaultLowStockThreshold: number }) => {
      const response = await apiRequest("POST", "/api/inventory/setup", body);
      return response.json() as Promise<{ id: number; status: string }>;
    },
    [["/api/inventory/overview"]],
  );
}

export function useEnableInventory() {
  return useInventoryMutation(
    async (importId: number) => {
      const response = await apiRequest("POST", `/api/inventory/setup/${importId}/enable`, {});
      return response.json();
    },
    [["/api/inventory/overview"], ["/api/inventory/items"]],
  );
}

export function useAdjustInventory() {
  return useInventoryMutation(
    async (input: { itemId: number; mode: "set" | "delta"; quantity: number; reason: string }) => {
      const response = await apiRequest("POST", `/api/inventory/items/${input.itemId}/adjustments`, {
        mode: input.mode,
        quantity: input.quantity,
        reason: input.reason,
      });
      return response.json();
    },
    [["/api/inventory/overview"], ["/api/inventory/items"], ["/api/inventory/notifications"]],
  );
}

export function useUpdateInventoryPolicy() {
  return useInventoryMutation(
    async (input: {
      itemId: number;
      safetyBuffer: number | null;
      lowStockThreshold: number | null;
      trackingEnabled: boolean;
    }) => {
      const response = await apiRequest("PATCH", `/api/inventory/items/${input.itemId}/policy`, input);
      return response.json();
    },
    [["/api/inventory/overview"], ["/api/inventory/items"]],
  );
}

export function useInventoryLedger(itemId: number | null) {
  return useQuery({
    queryKey: ["/api/inventory/ledger", itemId],
    queryFn: () => getJson<any[]>(`/api/inventory/items/${itemId}/ledger`),
    enabled: itemId !== null,
  });
}

export function useSaveInventoryBundle() {
  return useInventoryMutation(
    async (input: { bundleItemId: number; components: Array<{ itemId: number; units: number }> }) => {
      const response = await apiRequest("POST", "/api/inventory/bundles", input);
      return response.json();
    },
    [["/api/inventory/bundles"], ["/api/inventory/items"]],
  );
}

export function useDeleteInventoryBundle() {
  return useInventoryMutation(
    async (bundleItemId: number) => {
      await apiRequest("DELETE", `/api/inventory/bundles/${bundleItemId}`);
      return true;
    },
    [["/api/inventory/bundles"], ["/api/inventory/items"]],
  );
}

export function useReadInventoryNotification() {
  return useInventoryMutation(
    async (notificationId: number) => {
      const response = await apiRequest("POST", `/api/inventory/notifications/${notificationId}/read`, {});
      return response.json();
    },
    [["/api/inventory/notifications"], ["/api/inventory/overview"]],
  );
}

export function useReconcileInventory() {
  return useInventoryMutation(
    async () => {
      const response = await apiRequest("POST", "/api/inventory/reconcile", {});
      return response.json();
    },
    [["/api/inventory/overview"], ["/api/inventory/items"]],
  );
}
