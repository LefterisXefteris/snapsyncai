import { useState, useEffect } from "react";
import { CalendarDays, CreditCard, Crown, Loader2, Store, XCircle, Zap } from "lucide-react";
import {
  useShopifyStatus,
  useShopifyConnect,
  useShopifyDisconnect,
  useSaveShopGpsrIdentity,
  useSubscriptionStatus,
  usePaymentConfig,
  useCreateSubscriptionCheckout,
  useCancelSubscription,
} from "@/hooks/use-images";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { UserButton } from "@clerk/clerk-react";
import { dark } from "@clerk/themes";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GpsrIdentityFields } from "@/components/gpsr-identity-fields";
import { emptyGpsrIdentity, isCompleteGpsr, type GpsrIdentity } from "@/lib/product-facts";

const DEV_BYPASS_AUTH = import.meta.env.VITE_DEV_BYPASS_AUTH === "true";

export default function Settings() {
  const { toast } = useToast();
  const { data: shopifyStatus } = useShopifyStatus();
  const shopifyConnect = useShopifyConnect();
  const shopifyDisconnect = useShopifyDisconnect();
  const saveShopGpsr = useSaveShopGpsrIdentity();
  const { data: subscriptionStatus } = useSubscriptionStatus();
  const { data: paymentConfig } = usePaymentConfig();
  const createSubscriptionCheckout = useCreateSubscriptionCheckout();
  const cancelSubscription = useCancelSubscription();

  const [shopDomain, setShopDomain] = useState("");
  const [shopGpsrDraft, setShopGpsrDraft] = useState(emptyGpsrIdentity());
  const [showSubscribeDialog, setShowSubscribeDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [billingInterval, setBillingInterval] = useState<"weekly" | "annual">("weekly");

  const isSubscribed = subscriptionStatus?.subscribed === true;
  const weeklyPrice = (paymentConfig?.subscriptionWeeklyPricePence ?? 400) / 100;
  const annualPrice = (paymentConfig?.subscriptionAnnualPricePence ?? 17300) / 100;

  useEffect(() => {
    const identity = shopifyStatus?.gpsrIdentity as GpsrIdentity | undefined;
    if (identity && isCompleteGpsr(identity)) setShopGpsrDraft(identity);
  }, [shopifyStatus?.gpsrIdentity]);

  const handleConnect = () => {
    if (!shopDomain.trim()) {
      toast({ title: "Missing store", description: "Please enter your Shopify store URL.", variant: "destructive" });
      return;
    }
    shopifyConnect.mutate({ shopDomain: shopDomain.trim() });
  };

  const handleSubscribe = () => {
    createSubscriptionCheckout.mutate(billingInterval, {
      onSuccess: (data) => {
        if (data.checkoutUrl) {
          if (data.sessionId) {
            localStorage.setItem("snapsyncai_checkout_session_id", data.sessionId);
          }
          window.location.href = data.checkoutUrl;
        }
      },
    });
  };

  const handleCancelSubscription = () => {
    cancelSubscription.mutate(undefined, {
      onSuccess: () => setShowCancelDialog(false),
    });
  };

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      <div className="px-6 py-4 shrink-0">
        <h1 className="font-display text-lg font-semibold">Settings</h1>
        <p className="text-xs text-muted-foreground mt-1">Channels, Shop GPSR, billing, and account.</p>
      </div>
      <ScrollArea className="flex-1">
        <div className="px-6 pb-16 max-w-xl space-y-10">
          <section className="space-y-4">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Channels</h2>

            <div className="glass-panel rounded-2xl p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-medium">Shopify</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {shopifyStatus?.connected ? "Connected. Products can be pushed from the catalogue." : "Connect to push products."}
                  </p>
                </div>
                {shopifyStatus?.connected ? (
                  <Button
                    data-testid="button-disconnect-shopify"
                    variant="outline"
                    size="sm"
                    onClick={() => shopifyDisconnect.mutate()}
                    disabled={shopifyDisconnect.isPending}
                  >
                    {shopifyDisconnect.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Store className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    Disconnect
                  </Button>
                ) : null}
              </div>

              {!shopifyStatus?.connected && (
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
                  <Button
                    data-testid="button-submit-connect"
                    size="sm"
                    onClick={handleConnect}
                    disabled={shopifyConnect.isPending || !shopDomain.trim()}
                  >
                    {shopifyConnect.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Opening Shopify...
                      </>
                    ) : (
                      "Authorize in Shopify"
                    )}
                  </Button>
                </div>
              )}
            </div>

            <div className="glass-panel rounded-2xl p-4">
              <h3 className="text-sm font-medium">Wix</h3>
              <p className="text-xs text-muted-foreground mt-1">Wix is not connected yet.</p>
            </div>

            <div className="glass-panel rounded-2xl p-4">
              <h3 className="text-sm font-medium">Vinted</h3>
              <p className="text-xs text-muted-foreground mt-1">Vinted is not connected yet.</p>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Shop GPSR identity</h2>
            <div className="glass-panel rounded-2xl p-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                Saved once for this Shopify shop. Products can use it as the default, override it, or skip.
              </p>
              {shopifyStatus?.connected ? (
                <>
                  <GpsrIdentityFields value={shopGpsrDraft} onChange={setShopGpsrDraft} />
                  <Button
                    data-testid="button-shop-gpsr"
                    size="sm"
                    onClick={() => saveShopGpsr.mutate(shopGpsrDraft)}
                    disabled={saveShopGpsr.isPending}
                  >
                    {saveShopGpsr.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Shop GPSR"
                    )}
                  </Button>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Connect Shopify under Channels to save a shop default.</p>
              )}
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Billing</h2>
            <div className="glass-panel rounded-2xl p-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium">{isSubscribed ? "SnapSync AI Pro" : "Subscription"}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isSubscribed
                    ? "Pro is active for this account."
                    : "Subscribe for full listing copy on new listings."}
                </p>
              </div>
              {isSubscribed ? (
                <Button
                  data-testid="button-cancel-subscription"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCancelDialog(true)}
                >
                  <XCircle className="w-3.5 h-3.5 mr-1.5" />
                  Cancel
                </Button>
              ) : (
                <Button
                  data-testid="button-subscribe"
                  size="sm"
                  onClick={() => setShowSubscribeDialog(true)}
                >
                  <Crown className="w-3.5 h-3.5 mr-1.5" />
                  Subscribe
                </Button>
              )}
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Account</h2>
            <div className="glass-panel rounded-2xl p-4 flex items-center gap-3">
              {DEV_BYPASS_AUTH ? (
                <div className="w-8 h-8 rounded-full bg-muted" title="Local dev user" />
              ) : (
                <UserButton appearance={{ baseTheme: dark, elements: { avatarBox: "w-8 h-8" } }} />
              )}
              <p className="text-xs text-muted-foreground">
                {DEV_BYPASS_AUTH ? "Local dev user" : "Manage your account from the avatar."}
              </p>
            </div>
          </section>
        </div>
      </ScrollArea>

      <Dialog open={showSubscribeDialog} onOpenChange={setShowSubscribeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5" />
              SnapSync AI Pro
            </DialogTitle>
            <DialogDescription>
              Unlock AI-powered analysis for up to 30 products per week.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setBillingInterval("weekly")}
                className={`flex flex-col items-center p-3 rounded-md border text-sm transition-colors ${billingInterval === "weekly" ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:border-primary/50"}`}
              >
                <span className="font-semibold">£{weeklyPrice}/wk</span>
                <span className="text-xs mt-0.5">Weekly</span>
              </button>
              <button
                onClick={() => setBillingInterval("annual")}
                className={`flex flex-col items-center p-3 rounded-md border text-sm transition-colors ${billingInterval === "annual" ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:border-primary/50"}`}
              >
                <span className="font-semibold">£{annualPrice}/yr</span>
                <span className="text-xs mt-0.5">Annual · save 2 months</span>
              </button>
            </div>
            <Separator />
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2"><Zap className="w-3.5 h-3.5 shrink-0" /> 30 products per week</li>
              <li className="flex items-center gap-2"><Zap className="w-3.5 h-3.5 shrink-0" /> Full AI descriptions, pricing &amp; variants</li>
              <li className="flex items-center gap-2"><Zap className="w-3.5 h-3.5 shrink-0" /> SEO &amp; AEO content</li>
              <li className="flex items-center gap-2"><Zap className="w-3.5 h-3.5 shrink-0" /> Push to Shopify</li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubscribeDialog(false)}>Cancel</Button>
            <Button onClick={() => { setShowSubscribeDialog(false); handleSubscribe(); }} disabled={createSubscriptionCheckout.isPending}>
              {createSubscriptionCheckout.isPending
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Redirecting...</>
                : <><CreditCard className="w-4 h-4 mr-2" />{billingInterval === "annual" ? `Subscribe £${annualPrice}/yr` : `Subscribe £${weeklyPrice}/wk`}</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="w-5 h-5" />
              Cancel Subscription
            </DialogTitle>
            <DialogDescription>
              You'll keep access until the end of your current billing period.
            </DialogDescription>
          </DialogHeader>
          {subscriptionStatus?.currentPeriodEnd && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-muted text-sm">
              <CalendarDays className="w-4 h-4 shrink-0" />
              <span>Access until {new Date(subscriptionStatus.currentPeriodEnd).toLocaleDateString()}</span>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>Keep Subscription</Button>
            <Button variant="destructive" onClick={handleCancelSubscription} disabled={cancelSubscription.isPending}>
              {cancelSubscription.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Cancelling...</> : "Yes, Cancel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
