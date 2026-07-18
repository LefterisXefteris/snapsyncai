import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { ClipboardList, Command as CommandIcon, Crown, Sparkles } from "lucide-react";
import { SiShopify, SiEtsy, SiAmazon, SiInstagram } from "react-icons/si";
import {
  useAmazonStatus,
  useEtsyStatus,
  useImages,
  useInstagramStatus,
  useShopifyStatus,
  useSubscriptionStatus,
} from "@/hooks/use-images";
import { useAmbient } from "@/components/ambient/AmbientProvider";
import { dispatchAppCommand, type AppCommand } from "@/lib/app-commands";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Image } from "@shared/schema";

const marketplaces = [
  { key: "shopify", label: "Shopify", Icon: SiShopify, color: "#96BF48", command: "connect-shopify" as AppCommand },
  { key: "etsy", label: "Etsy", Icon: SiEtsy, color: "#F56400", command: "connect-etsy" as AppCommand },
  { key: "amazon", label: "Amazon", Icon: SiAmazon, color: "#FF9900", command: "connect-amazon" as AppCommand },
  { key: "instagram", label: "Instagram", Icon: SiInstagram, color: "#E1306C", command: "connect-instagram" as AppCommand },
];

/**
 * Floating glass dock — the ambient replacement for a static sidebar.
 * A slim pill anchored bottom-center with the ambient status orb,
 * marketplace connection dots, review-queue badge, Pro status, and ⌘K hint.
 */
export function GlassDock() {
  const [, navigate] = useLocation();
  const { state } = useAmbient();
  const { data: images } = useImages();
  const { data: subscription } = useSubscriptionStatus();
  const { data: shopify } = useShopifyStatus();
  const { data: etsy } = useEtsyStatus();
  const { data: amazon } = useAmazonStatus();
  const { data: instagram } = useInstagramStatus();

  const connected: Record<string, boolean> = {
    shopify: !!shopify?.connected,
    etsy: !!etsy?.connected,
    amazon: !!amazon?.connected,
    instagram: !!instagram?.connected,
  };

  const pendingCount =
    (images ?? []).filter(
      (img: Image) => img.paymentStatus === "paid" && img.shopifyStatus === "pending",
    ).length;

  const isSubscribed = subscription?.subscribed === true;

  const sendCommand = (cmd: AppCommand) => {
    if (window.location.pathname !== "/") navigate("/");
    setTimeout(() => dispatchAppCommand(cmd), 50);
  };

  return (
    <motion.div
      initial={{ y: 80, opacity: 0, filter: "blur(6px)" }}
      animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
      transition={{ type: "spring", stiffness: 260, damping: 26, delay: 0.15 }}
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 hidden md:block"
      data-testid="glass-dock"
    >
      <div className="glass-panel rounded-full px-3 py-2 flex items-center gap-1.5">
        {/* Ambient status orb */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="w-8 h-8 rounded-full flex items-center justify-center">
              <span
                className={cn(
                  "w-2.5 h-2.5 rounded-full transition-colors duration-700",
                  state === "idle" && "bg-aurora-3/70 animate-breathe",
                  state === "thinking" && "bg-aurora-2 animate-pulse",
                  state === "success" && "bg-aurora-1 animate-bloom",
                )}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="font-mono text-[10px] uppercase tracking-wider">
            {state === "thinking" ? "ai working…" : state === "success" ? "done" : "ambient idle"}
          </TooltipContent>
        </Tooltip>

        <DockDivider />

        {/* Marketplace connection dots */}
        {marketplaces.map(({ key, label, Icon, color, command }) => (
          <Tooltip key={key}>
            <TooltipTrigger asChild>
              <button
                data-testid={`dock-marketplace-${key}`}
                onClick={() => sendCommand(command)}
                className="relative w-8 h-8 rounded-full flex items-center justify-center hover:bg-foreground/5 transition-colors"
              >
                <Icon
                  className="w-4 h-4 transition-opacity"
                  style={{ color, opacity: connected[key] ? 1 : 0.3 }}
                />
                {connected[key] && (
                  <span className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-primary animate-breathe" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="font-mono text-[10px] uppercase tracking-wider">
              {label} · {connected[key] ? "live" : "connect"}
            </TooltipContent>
          </Tooltip>
        ))}

        <DockDivider />

        {/* Review queue */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              data-testid="dock-review-queue"
              onClick={() => sendCommand("review-queue")}
              className="relative w-8 h-8 rounded-full flex items-center justify-center hover:bg-foreground/5 transition-colors"
            >
              <ClipboardList className="w-4 h-4 text-muted-foreground" />
              {pendingCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-mono font-semibold flex items-center justify-center">
                  {pendingCount}
                </span>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="font-mono text-[10px] uppercase tracking-wider">
            review queue
          </TooltipContent>
        </Tooltip>

        {/* Pro / upgrade */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              data-testid="dock-subscription"
              onClick={() => sendCommand(isSubscribed ? "cancel-subscription" : "subscribe")}
              className={cn(
                "h-8 rounded-full flex items-center gap-1.5 px-3 transition-colors",
                isSubscribed
                  ? "text-primary hover:bg-primary/10"
                  : "bg-primary/15 text-primary hover:bg-primary/25",
              )}
            >
              {isSubscribed ? <Crown className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span className="text-[11px] font-medium">{isSubscribed ? "Pro" : "Upgrade"}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="font-mono text-[10px] uppercase tracking-wider">
            {isSubscribed ? "manage subscription" : "unlock full ai analysis"}
          </TooltipContent>
        </Tooltip>

        <DockDivider />

        {/* Command palette hint */}
        <button
          data-testid="dock-command-palette"
          onClick={() => dispatchAppCommand("open-palette")}
          className="h-8 rounded-full flex items-center gap-1.5 px-3 text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-colors"
        >
          <CommandIcon className="w-3.5 h-3.5" />
          <span className="text-[11px] font-mono">K</span>
        </button>
      </div>
    </motion.div>
  );
}

function DockDivider() {
  return <div className="w-px h-5 bg-gradient-to-b from-transparent via-border to-transparent mx-0.5" />;
}
