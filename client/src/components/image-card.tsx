import { useState, memo } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ImageIcon, Trash2, Lock, ChevronRight, Check } from "lucide-react";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import type { Image } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDeleteImage, useDeleteProduct } from "@/hooks/use-images";
import { api, buildUrl } from "@shared/routes";
import { apiUrl } from "@/lib/api-origin";
import { cn } from "@/lib/utils";

const CURRENCIES = [
  { code: "USD", symbol: "$" },
  { code: "GBP", symbol: "£" },
  { code: "EUR", symbol: "€" },
  { code: "CAD", symbol: "CA$" },
  { code: "AUD", symbol: "A$" },
  { code: "JPY", symbol: "¥" },
];

function getCurrency(): string {
  return localStorage.getItem("snapsyncai_currency") || "USD";
}
function setCurrency(code: string) {
  localStorage.setItem("snapsyncai_currency", code);
}
function getSymbol(code: string) {
  return CURRENCIES.find(c => c.code === code)?.symbol ?? "$";
}

interface ImageCardProps {
  image: Image;
  views?: Image[];        // other images of the same product
  index: number;
  selected?: boolean;
  highlighted?: boolean;
  /** True while AI analysis is running for this card — shows the scan-line + shimmer treatment */
  analyzing?: boolean;
  onSelect?: (id: number, selected: boolean) => void;
}

export const ImageCard = memo(function ImageCard({ image, views = [], index, selected, highlighted = false, analyzing = false, onSelect }: ImageCardProps) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const deleteMutation = useDeleteImage();
  const deleteProductMutation = useDeleteProduct();

  // ── Price editing ─────────────────────────────────────────────────────────
  const [editingPrice, setEditingPrice] = useState(false);
  const [draftPrice, setDraftPrice] = useState(image.price ? String(image.price) : "");
  const [currency, _setCurrency] = useState(getCurrency);
  const [savedFlash, setSavedFlash] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const handleCurrencyChange = (code: string) => {
    setCurrency(code);
    _setCurrency(code);
  };

  const savePrice = async () => {
    const cleaned = draftPrice.replace(/[^0-9.]/g, "");
    if (cleaned === String(image.price)) { setEditingPrice(false); return; }
    try {
      await fetch(apiUrl(buildUrl(api.images.update.path, { id: image.id })), {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price: cleaned || null }),
      });
      queryClient.invalidateQueries({ queryKey: [api.images.list.path] });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    } catch { /* silent */ }
    setEditingPrice(false);
  };

  // ── Status ────────────────────────────────────────────────────────────────
  const isUnpaid = image.paymentStatus !== "paid";
  const isSynced = image.shopifyStatus === "synced";
  const statusColor = isUnpaid
    ? "text-amber-400 bg-amber-400/10 border-amber-400/20"
    : image.shopifyStatus === "synced"
      ? "text-green-400 bg-green-400/10 border-green-400/20"
      : image.shopifyStatus === "failed"
        ? "text-red-400 bg-red-400/10 border-red-400/20"
        : "text-amber-400 bg-amber-400/10 border-amber-400/20";
  const statusLabel = isUnpaid ? "Preview"
    : image.shopifyStatus === "synced" ? "Synced"
    : image.shopifyStatus === "failed" ? "Failed"
    : "Pending";

  const syncedPlatforms = [
    image.shopifyStatus === "synced" && "shopify",
  ].filter(Boolean) as string[];

  const allImages = [image, ...views];
  const hasViews = views.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 28, delay: Math.min(index * 0.04, 0.4) }}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl glass-card cursor-pointer cv-auto",
        selected && "glow-selected",
        highlighted && !selected && "animate-bloom ring-2 ring-primary/50",
      )}
      data-testid={`card-product-${image.id}`}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button, [role="checkbox"], .no-nav, input, select')) return;
        setLocation(`/product/${image.id}`);
      }}
    >
      {/* ── Main image ── */}
      <div className="relative bg-muted/40 flex items-center justify-center overflow-hidden" style={{ height: hasViews ? "120px" : "176px" }}>
        {!imgLoaded && <Skeleton className="absolute inset-0 rounded-none" />}
        <img
          src={apiUrl(`/api/images/${image.id}/file?sz=${image.size}&t=${new Date(image.createdAt || Date.now()).getTime()}`)}
          alt={image.altText || image.title || image.originalName}
          className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-300 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
          loading="lazy"
          decoding="async"
          onLoad={() => setImgLoaded(true)}
          onError={(e) => { e.currentTarget.style.display = "none"; setImgLoaded(true); }}
          data-testid={`img-product-${image.id}`}
        />
        {imgLoaded && <ImageIcon className="w-8 h-8 text-foreground/10" />}

        {/* AI thinking scan-line */}
        {analyzing && <div className="scan-line" />}

        <div className="absolute top-2.5 left-2.5">
          <Checkbox
            data-testid={`checkbox-select-${image.id}`}
            checked={selected}
            onCheckedChange={(checked) => onSelect?.(image.id, !!checked)}
            className={cn(
              "border-white/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary transition-opacity",
              !selected && "opacity-0 group-hover:opacity-100",
            )}
          />
        </div>

        <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
          {highlighted && (
            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-amber-500/40 text-amber-600 bg-white/90 dark:bg-black/40 dark:text-amber-300">
              Merged
            </Badge>
          )}
          {hasViews && (
            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-white/20 text-white/70 bg-black/40 font-mono">
              {allImages.length} views
            </Badge>
          )}
          <Badge variant="outline" className={`text-[10px] font-mono uppercase tracking-wide ${statusColor} ${analyzing ? "animate-breathe" : ""}`}>
            {isUnpaid && <Lock className="w-2.5 h-2.5 mr-0.5" />}
            {analyzing ? "Thinking" : statusLabel}
          </Badge>
        </div>
      </div>

      {/* ── Views strip ── */}
      {hasViews && (
        <div className="flex gap-1 px-2 py-1.5 bg-muted/30">
          {views.slice(0, 5).map((v) => (
            <div key={v.id} className="relative w-9 h-9 shrink-0 rounded-md overflow-hidden bg-muted/50">
              <img
                src={apiUrl(`/api/images/${v.id}/file?sz=${v.size}`)}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
            </div>
          ))}
          {views.length > 5 && (
            <div className="w-9 h-9 shrink-0 rounded-md bg-foreground/5 flex items-center justify-center">
              <span className="text-[9px] font-mono text-muted-foreground">+{views.length - 5}</span>
            </div>
          )}
        </div>
      )}

      {/* ── Info ── */}
      <div className="flex flex-col flex-1 p-3 space-y-2">
        {analyzing ? (
          // Streaming-style skeleton while the AI writes the listing
          <div className="space-y-1.5 py-0.5">
            <div className="h-3.5 w-4/5 rounded animate-shimmer" />
            <div className="h-2.5 w-3/5 rounded animate-shimmer" />
          </div>
        ) : (
          <>
            <h3 className="font-display font-medium text-sm text-foreground truncate leading-snug" title={image.title || image.originalName}>
              {image.title || image.originalName}
            </h3>

            {image.category && !isUnpaid && (
              <p className="text-[10px] text-muted-foreground truncate" title={image.category}>
                {image.category}
              </p>
            )}
          </>
        )}

        {isUnpaid && !analyzing && (
          <div className="p-1.5 rounded-md bg-amber-500/5 text-[10px] text-amber-500 flex items-center gap-1 shadow-[inset_0_0_0_1px_hsl(38_92%_50%/0.2)]">
            <Lock className="w-2.5 h-2.5 shrink-0" />
            Preview mode — subscribe to unlock
          </div>
        )}

        {/* ── Price + currency ── */}
        {!isUnpaid && (
          <div className="no-nav flex items-center gap-1 mt-auto pt-1">
            {/* currency selector */}
            <Select value={currency} onValueChange={handleCurrencyChange}>
              <SelectTrigger className="h-7 w-16 text-[11px] font-mono bg-transparent border-white/10 px-1.5 no-nav">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map(c => (
                  <SelectItem key={c.code} value={c.code} className="text-xs font-mono">
                    {c.symbol} {c.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* price input */}
            {editingPrice ? (
              <div className="flex items-center gap-1 flex-1">
                <span className="text-xs font-mono text-muted-foreground">{getSymbol(currency)}</span>
                <input
                  autoFocus
                  className="flex-1 min-w-0 h-7 bg-foreground/5 rounded-md px-1.5 text-xs font-mono text-foreground focus:outline-none shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.4)] focus:shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.8),0_0_12px_-2px_hsl(var(--primary)/0.4)]"
                  value={draftPrice}
                  onChange={e => setDraftPrice(e.target.value)}
                  onBlur={savePrice}
                  onKeyDown={e => { if (e.key === "Enter") savePrice(); if (e.key === "Escape") setEditingPrice(false); }}
                  placeholder="0.00"
                />
              </div>
            ) : (
              <button
                className="no-nav flex items-center gap-1 text-xs text-foreground hover:text-primary transition-colors group/price"
                onClick={() => { setDraftPrice(image.price ? String(image.price) : ""); setEditingPrice(true); }}
                title="Click to edit price"
              >
                <span className="font-medium font-mono">
                  {savedFlash
                    ? <span className="text-green-400 flex items-center gap-0.5"><Check className="w-3 h-3" /> Saved</span>
                    : <>{getSymbol(currency)}{image.price ? Number(image.price).toFixed(2) : <span className="text-muted-foreground italic font-body">Add price</span>}</>
                  }
                </span>
                <ChevronRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover/price:opacity-100 transition-opacity" />
              </button>
            )}
          </div>
        )}

        {/* ── Footer: mono metadata for published cards + remove ── */}
        <div className="flex items-center justify-between pt-1 gap-2">
          {isSynced ? (
            <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/70 truncate">
              {syncedPlatforms.join(" · ")}
              {image.createdAt && (
                <> · {new Date(image.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</>
              )}
            </span>
          ) : (
            <span />
          )}
          <Button
            data-testid={`button-delete-${image.id}`}
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-[10px] no-nav text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              if (image.productGroupId) {
                deleteProductMutation.mutate(image.productGroupId);
              } else {
                deleteMutation.mutate(image.id);
              }
            }}
            disabled={deleteMutation.isPending || deleteProductMutation.isPending}
            title="Remove product"
          >
            <Trash2 className="w-3 h-3 mr-0.5" />
            Remove
          </Button>
        </div>
      </div>
    </motion.div>
  );
});
