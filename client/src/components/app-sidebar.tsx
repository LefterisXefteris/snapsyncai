import { useState } from "react";
import { Crown, Loader2, CalendarDays } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { usePaymentConfig, useSubscriptionStatus, useCreateSubscriptionCheckout, useCancelSubscription, useRecoverSubscriptionByEmail } from "@/hooks/use-images";
import snapsyncaiLogo from "../assets/snapsyncai-logo.png";

export function AppSidebar() {
  const { data: paymentConfig } = usePaymentConfig();
  const { data: subscriptionStatus, isLoading: subLoading } = useSubscriptionStatus();
  const createSubscriptionCheckout = useCreateSubscriptionCheckout();
  const cancelSubscription = useCancelSubscription();
  const recoverSubscription = useRecoverSubscriptionByEmail();
  const [showSubscribeDialog, setShowSubscribeDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [billingInterval, setBillingInterval] = useState<'weekly' | 'annual'>('weekly');

  const isSubscribed = subscriptionStatus?.subscribed === true;
  const weeklyPrice = (paymentConfig?.subscriptionWeeklyPricePence ?? 400) / 100;
  const annualPrice = (paymentConfig?.subscriptionAnnualPricePence ?? 17300) / 100;

  const handleSubscribe = () => {
    createSubscriptionCheckout.mutate(billingInterval, {
      onSuccess: (data) => {
        if (data.checkoutUrl) {
          if (data.sessionId) {
            localStorage.setItem('snapsyncai_checkout_session_id', data.sessionId);
          }
          window.location.href = data.checkoutUrl;
        }
      },
    });
  };

  const handleCancelSubscription = () => {
    cancelSubscription.mutate(undefined, {
      onSuccess: () => {
        setShowCancelDialog(false);
      },
    });
  };

  return (
    <>
      <Sidebar side="left" collapsible="offcanvas">
        <SidebarHeader>
          <div className="flex items-center gap-2.5 px-2 py-1">
            <img src={snapsyncaiLogo} alt="SnapSync AI" className="w-7 h-7 rounded-md" />
            <span className="font-display text-base font-bold tracking-tight">SnapSync AI</span>
            {isSubscribed && (
              <Badge variant="outline" className="no-default-active-elevate text-xs" data-testid="sidebar-badge-pro">
                <Crown className="w-3 h-3 mr-1" />
                Pro
              </Badge>
            )}
          </div>
        </SidebarHeader>

        <SidebarContent />

        <SidebarFooter>
          <div className="px-2 py-2">
            {isSubscribed ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Crown className="w-3 h-3 text-emerald-400" />
                  <span data-testid="text-subscription-status">Pro active</span>
                  {subscriptionStatus?.currentPeriodEnd && (
                    <span data-testid="text-renewal-date" className="text-[10px]">
                      · renews {new Date(subscriptionStatus.currentPeriodEnd).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <button
                  data-testid="button-cancel-subscription"
                  className="text-[10px] text-muted-foreground/50 hover:text-destructive transition-colors"
                  onClick={() => setShowCancelDialog(true)}
                >
                  cancel
                </button>
              </div>
            ) : (
              <button
                data-testid="button-sidebar-subscribe"
                className="w-full text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors text-left flex items-center gap-1.5 py-0.5"
                onClick={() => setShowSubscribeDialog(true)}
              >
                <Crown className="w-3 h-3 shrink-0" />
                Upgrade to Pro
              </button>
            )}
            {!subLoading && !isSubscribed && (
              <button
                data-testid="button-restore-subscription"
                className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors"
                onClick={() => recoverSubscription.mutate()}
                disabled={recoverSubscription.isPending}
              >
                {recoverSubscription.isPending ? "Checking..." : "Restore access"}
              </button>
            )}
          </div>
        </SidebarFooter>
      </Sidebar>

      <Dialog open={showSubscribeDialog} onOpenChange={setShowSubscribeDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="items-center text-center pb-2">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
              <Crown className="w-6 h-6 text-primary" />
            </div>
            <DialogTitle className="text-xl">Unlock SnapSync AI Pro</DialogTitle>
            <DialogDescription className="text-sm text-center">
              Full AI analysis, SEO metadata, AEO content, and one-click store publishing for every product.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Billing interval toggle */}
            <div className="grid grid-cols-2 gap-2">
              <button
                data-testid="billing-toggle-weekly"
                onClick={() => setBillingInterval('weekly')}
                className={`flex flex-col items-start p-3.5 rounded-xl border-2 transition-all ${
                  billingInterval === 'weekly'
                    ? 'border-primary bg-primary/5'
                    : 'border-border text-muted-foreground hover:border-primary/40'
                }`}
              >
                <span className="text-base font-bold">£{weeklyPrice}<span className="text-xs font-normal text-muted-foreground ml-0.5">/wk</span></span>
                <span className="text-xs text-muted-foreground mt-0.5">Billed weekly</span>
              </button>
              <button
                data-testid="billing-toggle-annual"
                onClick={() => setBillingInterval('annual')}
                className={`relative flex flex-col items-start p-3.5 rounded-xl border-2 transition-all ${
                  billingInterval === 'annual'
                    ? 'border-primary bg-primary/5'
                    : 'border-border text-muted-foreground hover:border-primary/40'
                }`}
              >
                <span className="absolute top-2 right-2 text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 rounded-full">Save 17%</span>
                <span className="text-base font-bold">£{(annualPrice / 52).toFixed(2)}<span className="text-xs font-normal text-muted-foreground ml-0.5">/wk</span></span>
                <span className="text-xs text-muted-foreground mt-0.5">£{annualPrice} billed annually</span>
              </button>
            </div>

            {/* Feature grid */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 py-1">
              {[
                "Full AI descriptions & pricing",
                "SEO titles & meta descriptions",
                "AEO FAQs & snippets",
                "Variant suggestions",
                "Push to Shopify, Etsy & Amazon",
                "Cancel anytime",
              ].map((feat) => (
                <div key={feat} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Check className="w-3.5 h-3.5 shrink-0 text-primary" />
                  {feat}
                </div>
              ))}
            </div>

            <p className="text-[11px] text-muted-foreground text-center">
              No setup fees · Secure checkout via Stripe · Cancel anytime
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              data-testid="button-cancel-subscribe-dialog"
              variant="outline"
              onClick={() => setShowSubscribeDialog(false)}
            >
              Not now
            </Button>
            <Button
              data-testid="button-confirm-subscribe"
              className="flex-1"
              onClick={() => { setShowSubscribeDialog(false); handleSubscribe(); }}
              disabled={createSubscriptionCheckout.isPending}
            >
              {createSubscriptionCheckout.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Redirecting...</>
              ) : (
                <><Crown className="w-4 h-4 mr-2" />
                  {billingInterval === 'annual'
                    ? `Start Pro — £${annualPrice}/yr`
                    : `Start Pro — £${weeklyPrice}/wk`}
                </>
              )}
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
              Are you sure you want to cancel your SnapSync AI Pro subscription? You'll continue to have access until the end of your current billing period.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {subscriptionStatus?.currentPeriodEnd && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-muted text-sm">
                <CalendarDays className="w-4 h-4 shrink-0" />
                <span data-testid="text-cancel-access-until">
                  You'll have access until {new Date(subscriptionStatus.currentPeriodEnd).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              data-testid="button-keep-subscription"
              variant="outline"
              onClick={() => setShowCancelDialog(false)}
            >
              Keep Subscription
            </Button>
            <Button
              data-testid="button-confirm-cancel"
              variant="destructive"
              onClick={handleCancelSubscription}
              disabled={cancelSubscription.isPending}
            >
              {cancelSubscription.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Cancelling...
                </>
              ) : (
                "Yes, Cancel"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
