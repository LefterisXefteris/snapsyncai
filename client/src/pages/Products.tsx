import { useState, useMemo, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { BrainCircuit, CheckSquare, ImagePlus, Loader2, Store } from "lucide-react";
import { useImages, usePushToShopify, useShopifyStatus, useVerifySubscription } from "@/hooks/use-images";
import { ImageCard } from "@/components/image-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import type { Image } from "@shared/schema";
import { ScrollArea } from "@/components/ui/scroll-area";
import { workspaceNavItem } from "@/lib/workspace-nav";

export default function Products() {
  const { data: images, isLoading } = useImages();
  const { data: shopifyStatus } = useShopifyStatus();
  const queryClient = useQueryClient();
  const pushToShopify = usePushToShopify();
  const verifySubscription = useVerifySubscription();
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const newListing = workspaceNavItem("new-listing");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const subscriptionParam = params.get("subscription");
    const sessionId = params.get("checkout_session_id") || localStorage.getItem("snapsyncai_checkout_session_id");

    if (subscriptionParam === "success" && sessionId) {
      verifySubscription.mutate(sessionId);
      localStorage.removeItem("snapsyncai_checkout_session_id");
      window.history.replaceState({}, "", "/");
    } else if (subscriptionParam === "cancelled") {
      localStorage.removeItem("snapsyncai_checkout_session_id");
      toast({
        title: "Subscription Cancelled",
        description: "Your subscription checkout was cancelled. You can try again.",
        variant: "destructive",
      });
      window.history.replaceState({}, "", "/");
    } else if (params.get("shopify") === "connected") {
      queryClient.invalidateQueries({ queryKey: ["/api/shopify/status"] });
      toast({ title: "Shopify Connected", description: "Your Shopify store is ready to receive products." });
      window.history.replaceState({}, "", "/");
    } else if (params.get("shopify") === "error") {
      const reason = params.get("reason");
      const messages: Record<string, string> = {
        invalid_shop: "Shopify sent an invalid shop domain. Please try connecting again.",
        invalid_hmac: "Shopify callback verification failed. Check the app callback URL and API secret.",
        missing_write_products: "SnapSync AI needs Shopify's write_products permission to create draft products.",
        missing_inventory_scopes: "Reconnect Shopify and approve product, inventory, and location access.",
        token_exchange_failed: "Shopify authorization succeeded, but SnapSync AI could not exchange the code for an access token.",
        not_configured: "Shopify OAuth is not configured for this deployment.",
      };
      toast({
        title: "Shopify Connection Failed",
        description: messages[reason || ""] || "Shopify could not be connected. Please try again.",
        variant: "destructive",
      });
      window.history.replaceState({}, "", "/");
    }
  }, []);

  const handleSelect = useCallback((id: number, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const selectAll = () => {
    if (images) {
      setSelectedIds(new Set(images.map((img: Image) => img.id)));
    }
  };

  const deselectAll = () => setSelectedIds(new Set());

  const handlePushToShopify = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      toast({ title: "No Products Selected", description: "Select products to push to Shopify.", variant: "destructive" });
      return;
    }
    const unpaidSelected = images?.filter((img: Image) => selectedIds.has(img.id) && img.paymentStatus !== "paid") || [];
    if (unpaidSelected.length > 0) {
      toast({
        title: "Listing copy required",
        description: `${unpaidSelected.length} selected product(s) still need listing copy. Subscribe to SnapSync AI Pro.`,
        variant: "destructive",
      });
      return;
    }
    pushToShopify.mutate(ids, {
      onSuccess: () => setSelectedIds(new Set()),
    });
  };

  const productEntries = useMemo(() => {
    if (!images) return [];
    const grouped = new Map<string, Image[]>();
    const singles: Image[] = [];

    for (const img of images as Image[]) {
      if (img.productGroupId) {
        const arr = grouped.get(img.productGroupId) ?? [];
        arr.push(img);
        grouped.set(img.productGroupId, arr);
      } else {
        singles.push(img);
      }
    }

    const entries: { primary: Image; views: Image[] }[] = [];

    grouped.forEach((imgs) => {
      const sorted = [...imgs].sort((a, b) => {
        if (a.description && !b.description) return -1;
        if (!a.description && b.description) return 1;
        return a.id - b.id;
      });
      entries.push({ primary: sorted[0], views: sorted.slice(1) });
    });

    for (const img of singles) {
      entries.push({ primary: img, views: [] });
    }

    return entries.sort((a, b) =>
      new Date(b.primary.createdAt || 0).getTime() - new Date(a.primary.createdAt || 0).getTime()
    );
  }, [images]);

  const groupedImages = useMemo(() => {
    return productEntries.reduce((acc, entry) => {
      const cat = entry.primary.mainCategory || "Uncategorized";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(entry);
      return acc;
    }, {} as Record<string, { primary: Image; views: Image[] }[]>);
  }, [productEntries]);

  return (
    <div className="h-full w-full flex flex-col bg-transparent text-foreground overflow-hidden">
      <div className="p-3 bg-background/60 backdrop-blur-xl z-10 sticky top-0 shadow-[inset_0_-1px_0_0_hsl(var(--foreground)/0.05)]">
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 no-scrollbar flex-nowrap">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-sm font-semibold">Products</h1>
            <span className="text-xs text-muted-foreground whitespace-nowrap hidden lg:inline-block">
              {images?.length || 0} items &middot; {selectedIds.size} selected
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-nowrap overflow-x-auto no-scrollbar pb-1">
            <Button asChild size="sm" data-testid="button-new-listing">
              <Link href={newListing.path}>
                <ImagePlus className="w-3.5 h-3.5 mr-1.5" />
                New listing
              </Link>
            </Button>

            {images && images.length > 0 && (
              <>
                <Button
                  data-testid="button-select-all"
                  variant="outline"
                  size="sm"
                  onClick={selectedIds.size === images.length ? deselectAll : selectAll}
                >
                  <CheckSquare className="w-3.5 h-3.5 mr-1.5" />
                  {selectedIds.size === images.length ? "Deselect All" : "Select All"}
                </Button>

                <Button
                  data-testid="button-push-shopify"
                  size="sm"
                  onClick={handlePushToShopify}
                  disabled={selectedIds.size === 0 || pushToShopify.isPending || !shopifyStatus?.connected}
                >
                  {pushToShopify.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Store className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Push to Shopify ({selectedIds.size})
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 h-full w-full">
        <div className="p-4">
          {isLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
              {Array.from({ length: 20 }).map((_, i) => (
                <Card key={i} className="border-border overflow-hidden">
                  <CardContent className="p-0">
                    <Skeleton className="h-44 w-full rounded-none" />
                    <div className="p-3 space-y-2">
                      <Skeleton className="h-3 w-3/4" />
                      <Skeleton className="h-2.5 w-1/2" />
                      <Skeleton className="h-2 w-1/3" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : images && images.length > 0 ? (
            <div className="space-y-6 pb-20">
              {Object.entries(groupedImages).sort(([a], [b]) => a.localeCompare(b)).map(([category, entries]) => (
                <div key={category} className="space-y-3">
                  <h3 className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground sticky top-0 py-1.5 bg-background/70 backdrop-blur-md z-10">
                    {category} <span className="opacity-50">· {entries.length}</span>
                  </h3>
                  <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                    {entries.map((entry, idx) => (
                      <ImageCard
                        key={entry.primary.id}
                        image={entry.primary}
                        views={entry.views}
                        index={idx}
                        selected={selectedIds.has(entry.primary.id)}
                        onSelect={handleSelect}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-[50vh] flex flex-col items-center justify-center text-center animate-settle">
              <div className="w-16 h-16 rounded-full portal-ring bg-primary/5 flex items-center justify-center mx-auto mb-5">
                <BrainCircuit className="w-7 h-7 text-primary/60" />
              </div>
              <h3 className="font-display text-lg font-semibold">A quiet workspace</h3>
              <p className="text-xs text-muted-foreground mt-1.5 max-w-[240px]">
                Create a product from photos. New listing is the grouping workspace.
              </p>
              <Button asChild size="sm" className="mt-4" data-testid="button-new-listing-empty">
                <Link href={newListing.path}>
                  <ImagePlus className="w-3.5 h-3.5 mr-1.5" />
                  New listing
                </Link>
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
