import { useState } from "react";
import { Crown, CreditCard, Zap, Loader2, XCircle, Settings, CalendarDays } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { usePaymentConfig, useSubscriptionStatus, useCreateSubscriptionCheckout, useCancelSubscription } from "@/hooks/use-images";
import snapsyncaiLogo from "../assets/snapsyncai-logo.png";

export function AppSidebar() {
  const { data: paymentConfig } = usePaymentConfig();
  const { data: subscriptionStatus } = useSubscriptionStatus();
  const createSubscriptionCheckout = useCreateSubscriptionCheckout();
  const cancelSubscription = useCancelSubscription();
  const [showSubscribeDialog, setShowSubscribeDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const isSubscribed = subscriptionStatus?.subscribed === true;
  const subscriptionPrice = (paymentConfig?.subscriptionPricePence || 3000) / 100;

  const handleSubscribe = () => {
    createSubscriptionCheckout.mutate(undefined, {
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

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>
              <Settings className="w-3.5 h-3.5 mr-1.5" />
              Subscription
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="px-2 space-y-3">
                {isSubscribed ? (
                  <Card className="border-emerald-500/20 bg-emerald-500/5" data-testid="card-subscription-active">
                    <CardContent className="p-3 space-y-3">
                      <div className="flex items-center gap-2">
                        <Crown className="w-4 h-4 text-emerald-400" />
                        <span className="text-sm font-medium" data-testid="text-subscription-status">SnapSync AI Pro Active</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Unlimited AI analysis, SEO, AEO & more.
                      </p>
                      {subscriptionStatus?.currentPeriodEnd && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <CalendarDays className="w-3 h-3" />
                          <span data-testid="text-renewal-date">
                            Renews {new Date(subscriptionStatus.currentPeriodEnd).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      <Separator />
                      <Button
                        data-testid="button-cancel-subscription"
                        variant="ghost"
                        size="sm"
                        className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setShowCancelDialog(true)}
                      >
                        <XCircle className="w-3.5 h-3.5 mr-1.5" />
                        Cancel Subscription
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <Card data-testid="card-subscription-inactive">
                    <CardContent className="p-3 space-y-3">
                      <div className="flex items-center gap-2">
                        <Crown className="w-4 h-4" />
                        <span className="text-sm font-medium">SnapSync AI Pro</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Subscribe for unlimited AI-powered product analysis.
                      </p>
                      <ul className="space-y-1.5 text-xs text-muted-foreground">
                        <li className="flex items-center gap-1.5"><Zap className="w-3 h-3 shrink-0" /> Unlimited AI analysis</li>
                        <li className="flex items-center gap-1.5"><Zap className="w-3 h-3 shrink-0" /> Full descriptions & pricing</li>
                        <li className="flex items-center gap-1.5"><Zap className="w-3 h-3 shrink-0" /> SEO & AEO content</li>
                        <li className="flex items-center gap-1.5"><Zap className="w-3 h-3 shrink-0" /> Push to all stores</li>
                      </ul>
                      <Button
                        data-testid="button-sidebar-subscribe"
                        className="w-full"
                        size="sm"
                        onClick={() => setShowSubscribeDialog(true)}
                      >
                        <CreditCard className="w-3.5 h-3.5 mr-1.5" />
                        Subscribe - {"\u00A3"}{subscriptionPrice}/mo
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <div className="px-2 py-1">
            <p className="text-[10px] text-muted-foreground text-center">
              Manage your subscription & billing
            </p>
          </div>
        </SidebarFooter>
      </Sidebar>

      <Dialog open={showSubscribeDialog} onOpenChange={setShowSubscribeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5" />
              SnapSync AI Pro Subscription
            </DialogTitle>
            <DialogDescription>
              Subscribe to unlock unlimited AI-powered product analysis — full descriptions, pricing, SEO, AEO content, and variant suggestions for all your products.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3 p-3 rounded-md bg-muted">
              <Crown className="w-4 h-4 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium" data-testid="text-subscription-price">
                  {"\u00A3"}{subscriptionPrice} per month
                </p>
                <p className="text-xs text-muted-foreground">
                  Unlimited product analysis, SEO, AEO & more
                </p>
              </div>
            </div>
            <Separator />
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2"><Zap className="w-3.5 h-3.5 shrink-0" /> Unlimited AI product analysis</li>
              <li className="flex items-center gap-2"><Zap className="w-3.5 h-3.5 shrink-0" /> Full descriptions, pricing & variants</li>
              <li className="flex items-center gap-2"><Zap className="w-3.5 h-3.5 shrink-0" /> SEO titles, descriptions & alt text</li>
              <li className="flex items-center gap-2"><Zap className="w-3.5 h-3.5 shrink-0" /> AEO FAQs & conversational snippets</li>
              <li className="flex items-center gap-2"><Zap className="w-3.5 h-3.5 shrink-0" /> Push to Shopify, Etsy & Amazon</li>
            </ul>
          </div>
          <DialogFooter>
            <Button
              data-testid="button-cancel-subscribe-dialog"
              variant="outline"
              onClick={() => setShowSubscribeDialog(false)}
            >
              Cancel
            </Button>
            <Button
              data-testid="button-confirm-subscribe"
              onClick={() => { setShowSubscribeDialog(false); handleSubscribe(); }}
              disabled={createSubscriptionCheckout.isPending}
            >
              {createSubscriptionCheckout.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Redirecting to checkout...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Subscribe - {"\u00A3"}{subscriptionPrice}/mo
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
