import { useState, useMemo, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Store, History, BrainCircuit, Download, CheckSquare, Loader2, Unplug, Key, ClipboardList, Lock, Crown, Zap, PanelLeft, Instagram, ImageDown, Send } from "lucide-react";
import { useImages, usePushToShopify, useShopifyStatus, useShopifyConnect, useShopifyDisconnect, usePushToEtsy, useEtsyStatus, useEtsyConnect, useEtsyDisconnect, useAmazonStatus, useAmazonConnect, useAmazonDisconnect, usePushToAmazon, useSubscriptionStatus, useVerifySubscription, useUnlockImages, useInstagramStatus, useInstagramConnect, useInstagramDisconnect, useInstagramImport, useInstagramPost, useInstagramGenerateCaption, useInstagramOAuthConfig, useInstagramOAuthStart } from "@/hooks/use-images";
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
import listaiLogo from "../assets/listai-logo.png";
import { dark } from "@clerk/themes";
import type { Image } from "@shared/schema";

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
  const { toggleSidebar } = useSidebar();
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
    const sessionId = params.get('checkout_session_id') || localStorage.getItem('listai_checkout_session_id');

    if (subscriptionParam === 'success' && sessionId) {
      verifySubscription.mutate(sessionId);
      localStorage.removeItem('listai_checkout_session_id');
      window.history.replaceState({}, '', '/');
    } else if (subscriptionParam === 'cancelled') {
      localStorage.removeItem('listai_checkout_session_id');
      toast({
        title: "Subscription Cancelled",
        description: "Your subscription checkout was cancelled. You can try again.",
        variant: "destructive",
      });
      window.history.replaceState({}, '', '/');
    }
  }, []);

  const handleSelect = (id: number, selected: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  };

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
        description: `${unpaidSelected.length} selected product(s) need full AI analysis. Subscribe to ListAI Pro — new uploads will be fully analyzed automatically.`,
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

  const openInstagramPostDialog = (imageId: number) => {
    setInstagramPostImageId(imageId);
    const img = images?.find((i: Image) => i.id === imageId);
    setInstagramPostCaption(img?.instagramCaption || "");
    setShowInstagramPostDialog(true);
  };

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
        description: `${unpaidSelected.length} selected product(s) need full AI analysis. Subscribe to ListAI Pro — new uploads will be fully analyzed automatically.`,
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
        description: `${unpaidSelected.length} selected product(s) need full AI analysis. Subscribe to ListAI Pro — new uploads will be fully analyzed automatically.`,
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
    if (!isSubscribed) {
      toggleSidebar();
      return;
    }
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
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 space-y-8">

        <header className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2.5">
            <Button
              data-testid="button-sidebar-toggle"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={toggleSidebar}
            >
              <PanelLeft className="w-4 h-4" />
            </Button>
            <img src={listaiLogo} alt="ListAI" className="w-8 h-8 rounded-md" />
            <span className="font-display text-lg font-bold tracking-tight">ListAI</span>
            {isSubscribed && (
              <Badge variant="outline" className="no-default-active-elevate" data-testid="badge-pro">
                <Crown className="w-3 h-3 mr-1" />
                Pro
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3" data-testid="user-button-container">
            {!isSubscribed && (
              <Button
                data-testid="button-upgrade-header"
                variant="outline"
                size="sm"
                onClick={toggleSidebar}
              >
                <Crown className="w-3.5 h-3.5 mr-1.5" />
                Upgrade to Pro
              </Button>
            )}
            <UserButton
              appearance={{
                baseTheme: dark,
                elements: {
                  avatarBox: "w-8 h-8",
                },
              }}
            />
          </div>
        </header>

        <Separator />

        <section className="text-center space-y-4">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-3xl md:text-4xl font-display font-bold tracking-tight"
          >
            From Photo to Product{" "}
            <span className="bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">in Seconds.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="max-w-2xl mx-auto text-sm text-muted-foreground"
          >
            Drop your product photos and let AI build ready-to-sell listings for Shopify, Etsy & Amazon.
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex items-center justify-center gap-3 flex-wrap"
          >
            {shopifyStatus?.connected ? (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="no-default-active-elevate">
                  <Store className="w-3 h-3 mr-1.5" />
                  Shopify: {shopifyStatus.shopName}
                </Badge>
                <Button
                  data-testid="button-disconnect-shopify"
                  variant="ghost"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={shopifyDisconnect.isPending}
                >
                  <Unplug className="w-3.5 h-3.5 mr-1" />
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button
                data-testid="button-connect-shopify"
                variant="outline"
                size="sm"
                onClick={() => setShowConnectDialog(true)}
              >
                <Store className="w-4 h-4 mr-2" />
                Connect Shopify
              </Button>
            )}

            {etsyStatus?.connected ? (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="no-default-active-elevate">
                  <Store className="w-3 h-3 mr-1.5" />
                  Etsy: {etsyStatus.shopName}
                </Badge>
                <Button
                  data-testid="button-disconnect-etsy"
                  variant="ghost"
                  size="sm"
                  onClick={handleEtsyDisconnect}
                  disabled={etsyDisconnect.isPending}
                >
                  <Unplug className="w-3.5 h-3.5 mr-1" />
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button
                data-testid="button-connect-etsy"
                variant="outline"
                size="sm"
                onClick={() => setShowEtsyConnectDialog(true)}
              >
                <Store className="w-4 h-4 mr-2" />
                Connect Etsy
              </Button>
            )}

            {amazonStatus?.connected ? (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="no-default-active-elevate">
                  <Store className="w-3 h-3 mr-1.5" />
                  Amazon: {amazonStatus.sellerName}
                </Badge>
                <Button
                  data-testid="button-disconnect-amazon"
                  variant="ghost"
                  size="sm"
                  onClick={handleAmazonDisconnect}
                  disabled={amazonDisconnect.isPending}
                >
                  <Unplug className="w-3.5 h-3.5 mr-1" />
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button
                data-testid="button-connect-amazon"
                variant="outline"
                size="sm"
                onClick={() => setShowAmazonConnectDialog(true)}
              >
                <Store className="w-4 h-4 mr-2" />
                Connect Amazon
              </Button>
            )}

            {instagramStatus?.connected ? (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="no-default-active-elevate">
                  <Instagram className="w-3 h-3 mr-1.5" />
                  @{instagramStatus.username}
                </Badge>
                <Button
                  data-testid="button-import-instagram"
                  variant="ghost"
                  size="sm"
                  onClick={handleInstagramImport}
                  disabled={instagramImport.isPending}
                >
                  {instagramImport.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                  ) : (
                    <ImageDown className="w-3.5 h-3.5 mr-1" />
                  )}
                  Import Posts
                </Button>
                <Button
                  data-testid="button-disconnect-instagram"
                  variant="ghost"
                  size="sm"
                  onClick={handleInstagramDisconnect}
                  disabled={instagramDisconnect.isPending}
                >
                  <Unplug className="w-3.5 h-3.5 mr-1" />
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button
                data-testid="button-connect-instagram"
                variant="outline"
                size="sm"
                onClick={instagramOAuthConfig?.configured ? handleInstagramOAuth : () => setShowInstagramConnectDialog(true)}
                disabled={instagramOAuthStart.isPending}
              >
                {instagramOAuthStart.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Instagram className="w-4 h-4 mr-2" />
                )}
                Connect Instagram
              </Button>
            )}
          </motion.div>
        </section>

        <motion.section
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <UploadZone onUploadingChange={setUploadingFiles} />
        </motion.section>

        {unlockImages.isPending && (
          <Card data-testid="card-unlocking-progress">
            <CardContent className="flex items-center gap-3 pt-6">
              <Loader2 className="w-5 h-5 animate-spin shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">Running Full AI Analysis...</p>
                <p className="text-xs text-muted-foreground">
                  Generating detailed descriptions, pricing, SEO data, and variants for your products. This may take a moment.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {isSubscribed && unpaidImages.length > 0 && (
          <Card data-testid="card-unlock-banner">
            <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {unpaidImages.length} Product{unpaidImages.length !== 1 ? 's' : ''} Need Full Analysis
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    These products were uploaded before your subscription. Analyze them now to get full descriptions, pricing, SEO & variants.
                  </p>
                </div>
              </div>
              <Button
                data-testid="button-unlock-all"
                onClick={handleUnlockAll}
                disabled={unlockImages.isPending}
                className="shrink-0"
              >
                {unlockImages.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Analyze All
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-display font-semibold">Products</h2>
                <p className="text-xs text-muted-foreground">
                  {images?.length || 0} total &middot; {unpaidImages.length} locked &middot; {pendingCount} pending review &middot; {syncedCount} Shopify &middot; {etsySyncedCount} Etsy &middot; {amazonSyncedCount} Amazon &middot; {instagramPostedCount} Instagram
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
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

          <Separator />

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}>
                  <CardContent className="p-0">
                    <Skeleton className="h-40 w-full rounded-t-md rounded-b-none" />
                    <div className="p-4 space-y-3">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : images && images.length > 0 ? (
            <div className="space-y-12">
              {uploadingFiles.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-xl font-display font-semibold flex items-center gap-2">
                    <Badge variant="secondary" className="px-2 py-0.5 text-sm bg-primary/20 text-primary hover:bg-primary/30 border-primary/20">
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      Uploading
                    </Badge>
                    <span className="text-muted-foreground text-sm font-normal">
                      {uploadingFiles.length} item{uploadingFiles.length !== 1 ? 's' : ''}
                    </span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {uploadingFiles.map((file, idx) => (
                      <Card key={`uploading-${idx}`} className="overflow-hidden border-primary/20 bg-primary/5">
                        <CardContent className="p-0">
                          <div className="h-40 w-full flex items-center justify-center bg-black/40">
                            <Loader2 className="w-8 h-8 text-primary animate-spin" />
                          </div>
                          <div className="p-4 space-y-3">
                            <Skeleton className="h-4 w-3/4 opacity-50" />
                            <Skeleton className="h-3 w-1/2 opacity-50" />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
              {Object.entries(groupedImages).sort(([a], [b]) => a.localeCompare(b)).map(([category, categoryImages]) => (
                <div key={category} className="space-y-4">
                  <h3 className="text-xl font-display font-semibold flex items-center gap-2">
                    <Badge variant="secondary" className="px-2 py-0.5 text-sm">{category}</Badge>
                    <span className="text-muted-foreground text-sm font-normal">{(categoryImages as Image[]).length} item{(categoryImages as Image[]).length !== 1 ? 's' : ''}</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
            <Card data-testid="card-empty-state">
              <CardContent className="text-center py-16">
                <div className="w-14 h-14 rounded-md bg-muted flex items-center justify-center mx-auto mb-4">
                  <BrainCircuit className="w-7 h-7 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-1">No products yet</h3>
                <p className="text-sm text-muted-foreground">Upload product images above to get started.</p>
              </CardContent>
            </Card>
          )}
        </section>
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
    </div>
  );
}
