import { useState, useMemo, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { BrainCircuit, Download, CheckSquare, Loader2, Unplug, Key, ClipboardList, Lock, Crown, Zap, PanelLeft, Instagram, ImageDown, Send, Store } from "lucide-react";
import { SiShopify, SiEtsy, SiInstagram } from "react-icons/si";
import { useImages, usePushToShopify, useShopifyStatus, useShopifyConnect, useShopifyDisconnect, usePushToEtsy, useEtsyStatus, useEtsyConnect, useEtsyDisconnect, useAmazonStatus, useAmazonConnect, useAmazonDisconnect, usePushToAmazon, useSubscriptionStatus, useVerifySubscription, useUnlockImages, useInstagramStatus, useInstagramConnect, useInstagramDisconnect, useInstagramImport, useInstagramPost, useInstagramGenerateCaption, useInstagramOAuthConfig, useInstagramOAuthStart, usePaymentConfig, useCreateSubscriptionCheckout, useCancelSubscription } from "@/hooks/use-images";
import { UploadZone } from "@/components/upload-zone";
import { ImageCard } from "@/components/image-card";
import { ReviewQueueModal } from "@/components/review-queue-modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserButton } from "@clerk/clerk-react";
import { useSidebar } from "@/components/ui/sidebar";
import snapsyncaiLogo from "../assets/snapsyncai-logo.png";
import { dark } from "@clerk/themes";
import type { Image } from "@shared/schema";
import { ModeToggle } from "@/components/mode-toggle";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function Home() {
  const { data: images, isLoading } = useImages();
  const { data: shopifyStatus } = useShopifyStatus();
  const { data: etsyStatus } = useEtsyStatus();
  const queryClient = useQueryClient();
  const { data: subscriptionStatus } = useSubscriptionStatus();
  const pushToShopify = usePushToShopify();
  const pushToEtsy = usePushToEtsy();
  const shopifyConnect = useShopifyConnect();
  const shopifyDisconnect = useShopifyDisconnect();
  const etsyConnect = useEtsyConnect();
  const etsyDisconnect = useEtsyDisconnect();
  const { data: amazonStatus } = useAmazonStatus();
  const pushToAmazon = usePushToAmazon();
  const amazonConnect = useAmazonConnect();
  const amazonDisconnect = useAmazonDisconnect();
  const { data: instagramStatus } = useInstagramStatus();
  const { data: instagramOAuthConfig } = useInstagramOAuthConfig();
  const instagramOAuthStart = useInstagramOAuthStart();
  const instagramConnect = useInstagramConnect();
  const instagramDisconnect = useInstagramDisconnect();
  const instagramImport = useInstagramImport();
  const instagramPost = useInstagramPost();
  const instagramGenerateCaption = useInstagramGenerateCaption();
  const verifySubscription = useVerifySubscription();
  const unlockImages = useUnlockImages();
  const { toast } = useToast();
  const createSubscriptionCheckout = useCreateSubscriptionCheckout();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showReviewQueue, setShowReviewQueue] = useState(false);
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [showEtsyConnectDialog, setShowEtsyConnectDialog] = useState(false);
  const [shopDomain, setShopDomain] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [etsyApiKey, setEtsyApiKey] = useState("");
  const [etsyAccessToken, setEtsyAccessToken] = useState("");
  const [etsyShopId, setEtsyShopId] = useState("");
  const [showAmazonConnectDialog, setShowAmazonConnectDialog] = useState(false);
  const [showInstagramConnectDialog, setShowInstagramConnectDialog] = useState(false);
  const [showInstagramPostDialog, setShowInstagramPostDialog] = useState(false);
  const [instagramAccessToken, setInstagramAccessToken] = useState("");
  const [instagramPostCaption, setInstagramPostCaption] = useState("");
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);
  const [instagramPostImageId, setInstagramPostImageId] = useState<number | null>(null);
  const [amazonLwaClientId, setAmazonLwaClientId] = useState("");
  const [amazonLwaClientSecret, setAmazonLwaClientSecret] = useState("");
  const [amazonLwaRefreshToken, setAmazonLwaRefreshToken] = useState("");
  const [amazonSellerId, setAmazonSellerId] = useState("");
  const [amazonMarketplaceId, setAmazonMarketplaceId] = useState("ATVPDKIKX0DER");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const subscriptionParam = params.get('subscription');
    const sessionId = params.get('checkout_session_id') || localStorage.getItem('snapsyncai_checkout_session_id');

    if (subscriptionParam === 'success' && sessionId) {
      verifySubscription.mutate(sessionId);
      localStorage.removeItem('snapsyncai_checkout_session_id');
      window.history.replaceState({}, '', '/');
    } else if (subscriptionParam === 'cancelled') {
      localStorage.removeItem('snapsyncai_checkout_session_id');
      toast({
        title: "Subscription Cancelled",
        description: "Your subscription checkout was cancelled. You can try again.",
        variant: "destructive",
      });
      window.history.replaceState({}, '', '/');
    }
  }, []);

  const handleSelect = useCallback((id: number, selected: boolean) => {
    setSelectedIds(prev => {
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
    const unpaidSelected = images?.filter((img: Image) => selectedIds.has(img.id) && img.paymentStatus !== 'paid') || [];
    if (unpaidSelected.length > 0) {
      toast({
        title: "Full Analysis Required",
        description: `${unpaidSelected.length} selected product(s) need full AI analysis. Subscribe to SnapSync AI Pro — new uploads will be fully analyzed automatically.`,
        variant: "destructive",
      });
      return;
    }
    pushToShopify.mutate(ids, {
      onSuccess: () => setSelectedIds(new Set()),
    });
  };

  const handleConnect = () => {
    if (!shopDomain.trim() || !accessToken.trim()) {
      toast({ title: "Missing fields", description: "Please enter both your store URL and access token.", variant: "destructive" });
      return;
    }
    shopifyConnect.mutate(
      { shopDomain: shopDomain.trim(), accessToken: accessToken.trim() },
      {
        onSuccess: () => {
          setShowConnectDialog(false);
          setShopDomain("");
          setAccessToken("");
        },
      }
    );
  };

  const handleDisconnect = () => {
    shopifyDisconnect.mutate();
  };

  const handleEtsyConnect = () => {
    if (!etsyApiKey.trim() || !etsyAccessToken.trim() || !etsyShopId.trim()) {
      toast({ title: "Missing fields", description: "Please enter your API key, access token, and shop ID.", variant: "destructive" });
      return;
    }
    etsyConnect.mutate(
      { apiKeystring: etsyApiKey.trim(), accessToken: etsyAccessToken.trim(), shopId: etsyShopId.trim() },
      {
        onSuccess: () => {
          setShowEtsyConnectDialog(false);
          setEtsyApiKey("");
          setEtsyAccessToken("");
          setEtsyShopId("");
        },
      }
    );
  };

  const handleEtsyDisconnect = () => {
    etsyDisconnect.mutate();
  };

  const handleAmazonConnect = () => {
    if (!amazonLwaClientId.trim() || !amazonLwaClientSecret.trim() || !amazonLwaRefreshToken.trim() || !amazonSellerId.trim() || !amazonMarketplaceId.trim()) {
      toast({ title: "Missing fields", description: "Please fill in all Amazon SP-API credentials.", variant: "destructive" });
      return;
    }
    amazonConnect.mutate(
      { lwaClientId: amazonLwaClientId.trim(), lwaClientSecret: amazonLwaClientSecret.trim(), lwaRefreshToken: amazonLwaRefreshToken.trim(), sellerId: amazonSellerId.trim(), marketplaceId: amazonMarketplaceId.trim() },
      {
        onSuccess: () => {
          setShowAmazonConnectDialog(false);
          setAmazonLwaClientId("");
          setAmazonLwaClientSecret("");
          setAmazonLwaRefreshToken("");
          setAmazonSellerId("");
          setAmazonMarketplaceId("ATVPDKIKX0DER");
        },
      }
    );
  };

  const handleAmazonDisconnect = () => {
    amazonDisconnect.mutate();
  };

  const handleInstagramOAuth = () => {
    instagramOAuthStart.mutate(undefined, {
      onSuccess: (data) => {
        const popup = window.open(data.authUrl, "instagram-oauth", "width=600,height=700,scrollbars=yes");
        if (!popup) {
          toast({ title: "Popup Blocked", description: "Please allow popups for this site to connect Instagram.", variant: "destructive" });
        }
      },
      onError: (error) => {
        toast({ title: "Connection Failed", description: error.message, variant: "destructive" });
      },
    });
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "instagram-oauth-success") {
        toast({ title: "Instagram Connected", description: `Connected as @${event.data.username}` });
        queryClient.invalidateQueries({ queryKey: ["/api/instagram/status"] });
      } else if (event.data?.type === "instagram-oauth-error") {
        toast({ title: "Connection Failed", description: event.data.message || "Could not connect Instagram", variant: "destructive" });
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [toast, queryClient]);

  const handleInstagramConnect = () => {
    if (!instagramAccessToken.trim()) {
      toast({ title: "Missing field", description: "Please paste your Instagram access token.", variant: "destructive" });
      return;
    }
    instagramConnect.mutate(
      { accessToken: instagramAccessToken.trim() },
      {
        onSuccess: () => {
          setShowInstagramConnectDialog(false);
          setInstagramAccessToken("");
        },
      }
    );
  };

  const handleInstagramDisconnect = () => {
    instagramDisconnect.mutate();
  };

  const handleInstagramImport = () => {
    instagramImport.mutate({});
  };

  const handleInstagramPostProduct = () => {
    if (!instagramPostImageId) return;
    instagramPost.mutate(
      { imageId: instagramPostImageId, caption: instagramPostCaption || undefined },
      {
        onSuccess: () => {
          setShowInstagramPostDialog(false);
          setInstagramPostCaption("");
          setInstagramPostImageId(null);
        },
      }
    );
  };

  const openInstagramPostDialog = useCallback((imageId: number) => {
    setInstagramPostImageId(imageId);
    const img = images?.find((i: Image) => i.id === imageId);
    setInstagramPostCaption(img?.instagramCaption || "");
    setShowInstagramPostDialog(true);
  }, [images]);

  const handleGenerateCaption = () => {
    if (!instagramPostImageId) return;
    instagramGenerateCaption.mutate(instagramPostImageId, {
      onSuccess: (data) => {
        setInstagramPostCaption(data.caption);
      },
    });
  };

  const handlePushToAmazon = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      toast({ title: "No Products Selected", description: "Select products to push to Amazon.", variant: "destructive" });
      return;
    }
    const unpaidSelected = images?.filter((img: Image) => selectedIds.has(img.id) && img.paymentStatus !== 'paid') || [];
    if (unpaidSelected.length > 0) {
      toast({
        title: "Full Analysis Required",
        description: `${unpaidSelected.length} selected product(s) need full AI analysis. Subscribe to SnapSync AI Pro — new uploads will be fully analyzed automatically.`,
        variant: "destructive",
      });
      return;
    }
    pushToAmazon.mutate(ids, {
      onSuccess: () => setSelectedIds(new Set()),
    });
  };

  const handlePushToEtsy = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      toast({ title: "No Products Selected", description: "Select products to push to Etsy.", variant: "destructive" });
      return;
    }
    const unpaidSelected = images?.filter((img: Image) => selectedIds.has(img.id) && img.paymentStatus !== 'paid') || [];
    if (unpaidSelected.length > 0) {
      toast({
        title: "Full Analysis Required",
        description: `${unpaidSelected.length} selected product(s) need full AI analysis. Subscribe to SnapSync AI Pro — new uploads will be fully analyzed automatically.`,
        variant: "destructive",
      });
      return;
    }
    pushToEtsy.mutate(ids, {
      onSuccess: () => setSelectedIds(new Set()),
    });
  };

  const isSubscribed = subscriptionStatus?.subscribed === true;

  const handleUnlockAll = () => {
    if (!unpaidImages || unpaidImages.length === 0) return;
    const ids = unpaidImages.map((img: Image) => img.id);
    unlockImages.mutate({ imageIds: ids });
  };

  const handleDownloadAllJson = () => {
    if (!images || images.length === 0) return;
    const exportData = images.map((img: Image) => ({
      id: img.id,
      title: img.title,
      description: img.description,
      price: img.price,
      category: img.category,
      productType: img.productType,
      tags: img.tags,
      shopifyStatus: img.shopifyStatus,
      shopifyProductId: img.shopifyProductId,
      etsyStatus: img.etsyStatus,
      etsyListingId: img.etsyListingId,
      amazonStatus: img.amazonStatus,
      amazonListingId: img.amazonListingId,
      originalName: img.originalName,
      aiData: img.aiData,
    }));
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const el = document.createElement('a');
    el.setAttribute("href", dataStr);
    el.setAttribute("download", "products-export.json");
    document.body.appendChild(el);
    el.click();
    el.remove();
  };

  const groupedImages = useMemo(() => {
    if (!images) return {};
    return images.reduce((acc: Record<string, Image[]>, img: Image) => {
      const cat = img.mainCategory || "Uncategorized";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(img);
      return acc;
    }, {});
  }, [images]);

  const unpaidImages = useMemo(() => {
    return images?.filter((img: Image) => img.paymentStatus !== 'paid') || [];
  }, [images]);

  const paidImages = useMemo(() => {
    return images?.filter((img: Image) => img.paymentStatus === 'paid') || [];
  }, [images]);

  const pendingCount = useMemo(() => {
    return paidImages.filter((img: Image) => img.shopifyStatus === "pending").length;
  }, [paidImages]);

  const syncedCount = useMemo(() => {
    return images?.filter((img: Image) => img.shopifyStatus === "synced").length || 0;
  }, [images]);

  const etsySyncedCount = useMemo(() => {
    return images?.filter((img: Image) => img.etsyStatus === "synced").length || 0;
  }, [images]);

  const amazonSyncedCount = useMemo(() => {
    return images?.filter((img: Image) => img.amazonStatus === "synced").length || 0;
  }, [images]);

  const instagramPostedCount = useMemo(() => {
    return images?.filter((img: Image) => img.instagramStatus === "posted").length || 0;
  }, [images]);

  return (
    <div className="h-screen w-full flex flex-col bg-background text-foreground overflow-hidden">
      <header className="h-14 flex items-center justify-between px-4 border-b border-border shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10 relative">
        <div className="flex items-center gap-2.5">
          <img src={snapsyncaiLogo} alt="SnapSync AI" className="w-7 h-7 rounded-sm" />
          <span className="font-display text-base font-bold tracking-tight">SnapSync AI workspace</span>
          {isSubscribed && (
            <Badge variant="outline" className="no-default-active-elevate text-[10px] h-5 py-0 px-1.5" data-testid="badge-pro">
              <Crown className="w-2.5 h-2.5 mr-0.5" />
              Pro
            </Badge>
          )}
        </div>
      </header>

      <div className="flex-1 min-h-0 relative">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={25} minSize={20} maxSize={40} className="flex flex-col border-r h-full bg-muted/20">
            <ScrollArea className="flex-1 h-full">
              <div className="p-4 space-y-6">

                <section className="space-y-4">
                  <h2 className="text-sm font-semibold tracking-tight">Upload Product Image</h2>
                  <UploadZone onUploadingChange={setUploadingFiles} />
                </section>

                <Separator />

                <section className="space-y-2">
                  <h2 className="text-xs font-semibold tracking-tight text-muted-foreground uppercase">Integrations</h2>
                  <div className="grid grid-cols-1 gap-1.5">
                    {shopifyStatus?.connected ? (
                      <div className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-secondary/50 border">
                        <span className="text-xs font-medium flex items-center gap-1.5">
                          <SiShopify className="w-3.5 h-3.5 text-[#96BF48]" /> Shopify
                        </span>
                        <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-destructive" onClick={handleDisconnect} disabled={shopifyDisconnect.isPending}><Unplug className="w-3 h-3" /></Button>
                      </div>
                    ) : (
                      <Button variant="outline" size="sm" className="w-full justify-start h-7 text-xs gap-2 px-2.5" onClick={() => setShowConnectDialog(true)}>
                        <SiShopify className="w-3.5 h-3.5 text-[#96BF48]" /> Shopify
                      </Button>
                    )}

                    {etsyStatus?.connected ? (
                      <div className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-secondary/50 border">
                        <span className="text-xs font-medium flex items-center gap-1.5">
                          <SiEtsy className="w-3.5 h-3.5 text-[#F56400]" /> Etsy
                        </span>
                        <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-destructive" onClick={handleEtsyDisconnect} disabled={etsyDisconnect.isPending}><Unplug className="w-3 h-3" /></Button>
                      </div>
                    ) : (
                      <Button variant="outline" size="sm" className="w-full justify-start h-7 text-xs gap-2 px-2.5" onClick={() => setShowEtsyConnectDialog(true)}>
                        <SiEtsy className="w-3.5 h-3.5 text-[#F56400]" /> Etsy
                      </Button>
                    )}

                    {instagramStatus?.connected ? (
                      <div className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-secondary/50 border">
                        <span className="text-xs font-medium flex items-center gap-1.5">
                          <SiInstagram className="w-3.5 h-3.5 text-[#E1306C]" /> @{instagramStatus.username}
                        </span>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={handleInstagramImport} disabled={instagramImport.isPending} title="Import Posts"><ImageDown className="w-3 h-3" /></Button>
                          <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-destructive" onClick={handleInstagramDisconnect} disabled={instagramDisconnect.isPending} title="Disconnect"><Unplug className="w-3 h-3" /></Button>
                        </div>
                      </div>
                    ) : (
                      <Button variant="outline" size="sm" className="w-full justify-start h-7 text-xs gap-2 px-2.5" onClick={instagramOAuthConfig?.configured ? handleInstagramOAuth : () => setShowInstagramConnectDialog(true)} disabled={instagramOAuthStart.isPending}>
                        {instagramOAuthStart.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <SiInstagram className="w-3.5 h-3.5 text-[#E1306C]" />} Instagram
                      </Button>
                    )}
                  </div>
                </section>
              </div>
            </ScrollArea>

            {/* Subscribe footer pinned at bottom */}
            <div className="p-3 border-t border-border shrink-0">
              {isSubscribed ? (
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-primary/5 border border-primary/20">
                  <Crown className="w-3.5 h-3.5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">SnapSync AI Pro</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {subscriptionStatus?.currentPeriodEnd
                        ? `Renews ${new Date(subscriptionStatus.currentPeriodEnd).toLocaleDateString()}`
                        : 'Active'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 ml-auto">
                    <ModeToggle />
                    <UserButton appearance={{ baseTheme: dark, elements: { avatarBox: "w-6 h-6" } }} />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    data-testid="button-sidebar-subscribe"
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-xs font-medium"
                    onClick={() => {
                      createSubscriptionCheckout.mutate(undefined, {
                        onSuccess: (data: any) => {
                          if (data.checkoutUrl) {
                            if (data.sessionId) localStorage.setItem('snapsyncai_checkout_session_id', data.sessionId);
                            window.location.href = data.checkoutUrl;
                          }
                        },
                      });
                    }}
                    disabled={createSubscriptionCheckout.isPending}
                  >
                    {createSubscriptionCheckout.isPending
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Crown className="w-3.5 h-3.5" />}
                    <span>Upgrade to Pro · £30/mo</span>
                  </button>
                  <div className="flex items-center justify-between px-1">
                    <ModeToggle />
                    <UserButton appearance={{ baseTheme: dark, elements: { avatarBox: "w-6 h-6" } }} />
                  </div>
                </div>
              )}
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={75}>
            <div className="flex flex-col h-full bg-background overflow-hidden relative">

              <div className="p-3 border-b bg-background z-10 sticky top-0">
                {unlockImages.isPending && (
                  <div className="flex items-center gap-2 text-xs text-primary bg-primary/10 border-primary/20 border p-2 rounded-md mb-2">
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    <span>Running AI Analysis on {unpaidImages.length} products...</span>
                  </div>
                )}
                {isSubscribed && unpaidImages.length > 0 && !unlockImages.isPending && (
                  <div className="flex items-center justify-between p-2 rounded-md bg-amber-500/10 border border-amber-500/20 mb-2">
                    <span className="text-xs font-medium flex items-center gap-1.5 text-amber-500">
                      <Lock className="w-3.5 h-3.5" />
                      {unpaidImages.length} unanalyzed items
                    </span>
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      onClick={handleUnlockAll}
                    >
                      <Zap className="w-3 h-3 mr-1" /> Analyze All
                    </Button>
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 no-scrollbar flex-nowrap">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground whitespace-nowrap hidden lg:inline-block">
                      {images?.length || 0} items &middot; {selectedIds.size} selected
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-nowrap overflow-x-auto no-scrollbar pb-1">
                    {images && images.length > 0 && (
                      <>
                        {pendingCount > 0 && (
                          <Button
                            data-testid="button-review-queue"
                            variant="outline"
                            size="sm"
                            onClick={() => setShowReviewQueue(true)}
                          >
                            <ClipboardList className="w-3.5 h-3.5 mr-1.5" />
                            Review Queue ({pendingCount})
                          </Button>
                        )}

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
                          data-testid="button-download-json"
                          variant="outline"
                          size="sm"
                          onClick={handleDownloadAllJson}
                        >
                          <Download className="w-3.5 h-3.5 mr-1.5" />
                          Export JSON
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

                        <Button
                          data-testid="button-push-etsy"
                          size="sm"
                          variant="secondary"
                          onClick={handlePushToEtsy}
                          disabled={selectedIds.size === 0 || pushToEtsy.isPending || !etsyStatus?.connected}
                        >
                          {pushToEtsy.isPending ? (
                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <Store className="w-3.5 h-3.5 mr-1.5" />
                          )}
                          Push to Etsy ({selectedIds.size})
                        </Button>

                        <Button
                          data-testid="button-push-amazon"
                          size="sm"
                          variant="secondary"
                          onClick={handlePushToAmazon}
                          disabled={selectedIds.size === 0 || pushToAmazon.isPending || !amazonStatus?.connected}
                        >
                          {pushToAmazon.isPending ? (
                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <Store className="w-3.5 h-3.5 mr-1.5" />
                          )}
                          Push to Amazon ({selectedIds.size})
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <ScrollArea className="flex-1 h-full w-full bg-muted/5">
                <div className="p-4">
                  {isLoading ? (
                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                      {[1, 2, 3, 4, 5, 6].map((i) => (
                        <Card key={i} className="border-border">
                          <CardContent className="p-0">
                            <Skeleton className="h-32 w-full rounded-t-md rounded-b-none" />
                            <div className="p-2 space-y-2">
                              <Skeleton className="h-3 w-3/4" />
                              <Skeleton className="h-2 w-1/2" />
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : images && images.length > 0 ? (
                    <div className="space-y-6 pb-20">
                      {uploadingFiles.length > 0 && (
                        <div className="space-y-3">
                          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                            <Loader2 className="w-3 h-3 animate-spin text-primary" />
                            Uploading ({uploadingFiles.length})
                          </h3>
                          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                            {uploadingFiles.map((file, idx) => (
                              <Card key={`uploading-${idx}`} className="overflow-hidden border-primary/20 bg-primary/5">
                                <CardContent className="p-0">
                                  <div className="h-24 w-full flex items-center justify-center bg-black/40">
                                    <Loader2 className="w-6 h-6 text-primary animate-spin" />
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}

                      {Object.entries(groupedImages).sort(([a], [b]) => a.localeCompare(b)).map(([category, categoryImages]) => (
                        <div key={category} className="space-y-3">
                          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground sticky top-0 py-1 bg-background/80 backdrop-blur z-10 border-b border-white/5">
                            {category} <span className="opacity-50">({(categoryImages as Image[]).length})</span>
                          </h3>
                          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                            {(categoryImages as Image[]).map((image: Image, idx: number) => (
                              <ImageCard
                                key={image.id}
                                image={image}
                                index={idx}
                                selected={selectedIds.has(image.id)}
                                onSelect={handleSelect}
                                instagramConnected={!!instagramStatus?.connected}
                                onInstagramPost={openInstagramPostDialog}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-[40vh] flex flex-col items-center justify-center text-center">
                      <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center mx-auto mb-3">
                        <BrainCircuit className="w-6 h-6 text-muted-foreground/50" />
                      </div>
                      <h3 className="text-sm font-medium">Empty Workspace</h3>
                      <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">Upload product images in the left panel to get started.</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {images && (
        <ReviewQueueModal
          open={showReviewQueue}
          onOpenChange={setShowReviewQueue}
          images={paidImages}
          shopifyConnected={!!shopifyStatus?.connected}
        />
      )}

      <Dialog open={showConnectDialog} onOpenChange={setShowConnectDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Store className="w-5 h-5" />
              Connect to Shopify
            </DialogTitle>
            <DialogDescription>
              Enter your Shopify store URL and custom app access token to connect.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="shop-domain" data-testid="label-shop-domain">Store URL</Label>
              <Input
                id="shop-domain"
                data-testid="input-shop-domain"
                placeholder="your-store.myshopify.com"
                value={shopDomain}
                onChange={(e) => setShopDomain(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Your Shopify store domain (e.g. my-store or my-store.myshopify.com)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="access-token" data-testid="label-access-token">
                <Key className="w-3.5 h-3.5 inline mr-1" />
                Access Token
              </Label>
              <Input
                id="access-token"
                data-testid="input-access-token"
                type="password"
                placeholder="shpat_..."
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                From your Shopify custom app: Settings &rarr; Apps &rarr; Develop apps &rarr; Your app &rarr; API credentials
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              data-testid="button-cancel-connect"
              variant="outline"
              onClick={() => setShowConnectDialog(false)}
            >
              Cancel
            </Button>
            <Button
              data-testid="button-submit-connect"
              onClick={handleConnect}
              disabled={shopifyConnect.isPending || !shopDomain.trim() || !accessToken.trim()}
            >
              {shopifyConnect.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Connect"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEtsyConnectDialog} onOpenChange={setShowEtsyConnectDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Store className="w-5 h-5" />
              Connect to Etsy
            </DialogTitle>
            <DialogDescription>
              Enter your Etsy app API key, OAuth access token, and shop ID to connect.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="etsy-api-key" data-testid="label-etsy-api-key">
                <Key className="w-3.5 h-3.5 inline mr-1" />
                API Key (Keystring)
              </Label>
              <Input
                id="etsy-api-key"
                data-testid="input-etsy-api-key"
                type="password"
                placeholder="Your Etsy API keystring"
                value={etsyApiKey}
                onChange={(e) => setEtsyApiKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                From your Etsy app: etsy.com/developers/your-apps
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="etsy-access-token" data-testid="label-etsy-access-token">
                <Key className="w-3.5 h-3.5 inline mr-1" />
                Access Token
              </Label>
              <Input
                id="etsy-access-token"
                data-testid="input-etsy-access-token"
                type="password"
                placeholder="OAuth access token"
                value={etsyAccessToken}
                onChange={(e) => setEtsyAccessToken(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Your OAuth 2.0 access token from the Etsy authorization flow
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="etsy-shop-id" data-testid="label-etsy-shop-id">Shop ID</Label>
              <Input
                id="etsy-shop-id"
                data-testid="input-etsy-shop-id"
                placeholder="12345678"
                value={etsyShopId}
                onChange={(e) => setEtsyShopId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Your numeric Etsy shop ID (found in your shop settings or API)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              data-testid="button-cancel-etsy-connect"
              variant="outline"
              onClick={() => setShowEtsyConnectDialog(false)}
            >
              Cancel
            </Button>
            <Button
              data-testid="button-submit-etsy-connect"
              onClick={handleEtsyConnect}
              disabled={etsyConnect.isPending || !etsyApiKey.trim() || !etsyAccessToken.trim() || !etsyShopId.trim()}
            >
              {etsyConnect.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Connect"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAmazonConnectDialog} onOpenChange={setShowAmazonConnectDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Store className="w-5 h-5" />
              Connect to Amazon
            </DialogTitle>
            <DialogDescription>
              Enter your Amazon SP-API credentials to connect your seller account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="amazon-lwa-client-id" data-testid="label-amazon-lwa-client-id">
                <Key className="w-3.5 h-3.5 inline mr-1" />
                LWA Client ID
              </Label>
              <Input
                id="amazon-lwa-client-id"
                data-testid="input-amazon-lwa-client-id"
                type="password"
                placeholder="amzn1.application-oa2-client...."
                value={amazonLwaClientId}
                onChange={(e) => setAmazonLwaClientId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                From your Amazon Developer account: Apps & Services &rarr; LWA credentials
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amazon-lwa-client-secret" data-testid="label-amazon-lwa-client-secret">
                <Key className="w-3.5 h-3.5 inline mr-1" />
                LWA Client Secret
              </Label>
              <Input
                id="amazon-lwa-client-secret"
                data-testid="input-amazon-lwa-client-secret"
                type="password"
                placeholder="Your LWA client secret"
                value={amazonLwaClientSecret}
                onChange={(e) => setAmazonLwaClientSecret(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                The client secret from your LWA security profile
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amazon-lwa-refresh-token" data-testid="label-amazon-lwa-refresh-token">
                <Key className="w-3.5 h-3.5 inline mr-1" />
                LWA Refresh Token
              </Label>
              <Input
                id="amazon-lwa-refresh-token"
                data-testid="input-amazon-lwa-refresh-token"
                type="password"
                placeholder="Atzr|..."
                value={amazonLwaRefreshToken}
                onChange={(e) => setAmazonLwaRefreshToken(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                The refresh token obtained during SP-API authorization
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amazon-seller-id" data-testid="label-amazon-seller-id">Seller ID</Label>
              <Input
                id="amazon-seller-id"
                data-testid="input-amazon-seller-id"
                placeholder="A1B2C3D4E5F6G7"
                value={amazonSellerId}
                onChange={(e) => setAmazonSellerId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Your Amazon Seller Central merchant ID
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amazon-marketplace-id" data-testid="label-amazon-marketplace-id">Marketplace</Label>
              <Select value={amazonMarketplaceId} onValueChange={setAmazonMarketplaceId}>
                <SelectTrigger data-testid="select-amazon-marketplace-id">
                  <SelectValue placeholder="Select marketplace" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ATVPDKIKX0DER">ATVPDKIKX0DER (US)</SelectItem>
                  <SelectItem value="A2EUQ1WTGCTBG2">A2EUQ1WTGCTBG2 (Canada)</SelectItem>
                  <SelectItem value="A1AM78C64UM0Y8">A1AM78C64UM0Y8 (Mexico)</SelectItem>
                  <SelectItem value="A1PA6795UKMFR9">A1PA6795UKMFR9 (Germany)</SelectItem>
                  <SelectItem value="A1F83G8C2ARO7P">A1F83G8C2ARO7P (UK)</SelectItem>
                  <SelectItem value="A13V1IB3VIYZZH">A13V1IB3VIYZZH (France)</SelectItem>
                  <SelectItem value="A1VC38T7YXB528">A1VC38T7YXB528 (Japan)</SelectItem>
                  <SelectItem value="A39IBJ37TRP1C6">A39IBJ37TRP1C6 (Australia)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                The Amazon marketplace you want to list products in
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              data-testid="button-cancel-amazon-connect"
              variant="outline"
              onClick={() => setShowAmazonConnectDialog(false)}
            >
              Cancel
            </Button>
            <Button
              data-testid="button-submit-amazon-connect"
              onClick={handleAmazonConnect}
              disabled={amazonConnect.isPending || !amazonLwaClientId.trim() || !amazonLwaClientSecret.trim() || !amazonLwaRefreshToken.trim() || !amazonSellerId.trim() || !amazonMarketplaceId.trim()}
            >
              {amazonConnect.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Connect"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showInstagramConnectDialog} onOpenChange={setShowInstagramConnectDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Instagram className="w-5 h-5" />
              Connect Instagram
            </DialogTitle>
            <DialogDescription>
              Connect your Instagram Business or Creator account to import posts and share products.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="ig-access-token" data-testid="label-ig-access-token">
                <Key className="w-3.5 h-3.5 inline mr-1" />
                Access Token
              </Label>
              <Input
                id="ig-access-token"
                data-testid="input-ig-access-token"
                type="password"
                placeholder="Paste your Instagram access token"
                value={instagramAccessToken}
                onChange={(e) => setInstagramAccessToken(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                You can generate this from the <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" className="text-primary underline">Meta Graph API Explorer</a>. Select your app, add <strong>instagram_basic</strong> and <strong>instagram_content_publish</strong> permissions, then click Generate Access Token.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              data-testid="button-cancel-ig-connect"
              variant="outline"
              onClick={() => setShowInstagramConnectDialog(false)}
            >
              Cancel
            </Button>
            <Button
              data-testid="button-submit-ig-connect"
              onClick={handleInstagramConnect}
              disabled={instagramConnect.isPending || !instagramAccessToken.trim()}
            >
              {instagramConnect.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Connect"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showInstagramPostDialog} onOpenChange={setShowInstagramPostDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Instagram className="w-5 h-5" />
              Post to Instagram
            </DialogTitle>
            <DialogDescription>
              Create an Instagram post for your product. You can generate an AI caption or write your own.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {instagramPostImageId && (
              <div className="rounded-lg overflow-hidden border border-white/10">
                <img
                  src={`/api/images/${instagramPostImageId}/file`}
                  alt="Product preview"
                  className="w-full h-48 object-cover"
                  data-testid="img-instagram-preview"
                />
              </div>
            )}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="ig-caption" data-testid="label-ig-caption">Caption</Label>
                <Button
                  data-testid="button-generate-caption"
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateCaption}
                  disabled={instagramGenerateCaption.isPending}
                >
                  {instagramGenerateCaption.isPending ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Zap className="w-3 h-3 mr-1" />
                      AI Generate
                    </>
                  )}
                </Button>
              </div>
              <Textarea
                id="ig-caption"
                data-testid="input-ig-caption"
                placeholder="Write your Instagram caption here or click AI Generate..."
                value={instagramPostCaption}
                onChange={(e) => setInstagramPostCaption(e.target.value)}
                className="min-h-[150px] resize-none"
                rows={6}
              />
              <p className="text-xs text-muted-foreground">
                {instagramPostCaption.length}/2200 characters
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              data-testid="button-cancel-ig-post"
              variant="outline"
              onClick={() => setShowInstagramPostDialog(false)}
            >
              Cancel
            </Button>
            <Button
              data-testid="button-submit-ig-post"
              onClick={handleInstagramPostProduct}
              disabled={instagramPost.isPending || !instagramPostCaption.trim()}
            >
              {instagramPost.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Posting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Post to Instagram
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div >
  );
}
