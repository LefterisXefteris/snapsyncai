import { useState, memo } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ImageIcon, Trash2, Lock, ChevronRight, Check } from "lucide-react";
import type { Image } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDeleteImage } from "@/hooks/use-images";
import { api, buildUrl } from "@shared/routes";

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
  onSelect?: (id: number, selected: boolean) => void;
  instagramConnected?: boolean;
  onInstagramPost?: (imageId: number) => void;
}

export const ImageCard = memo(function ImageCard({ image, views = [], index, selected, onSelect }: ImageCardProps) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const deleteMutation = useDeleteImage();

  // ── Price editing ─────────────────────────────────────────────────────────
  const [editingPrice, setEditingPrice] = useState(false);
  const [draftPrice, setDraftPrice] = useState(image.price ? String(image.price) : "");
  const [currency, _setCurrency] = useState(getCurrency);
  const [savedFlash, setSavedFlash] = useState(false);

  const handleCurrencyChange = (code: string) => {
    setCurrency(code);
    _setCurrency(code);
  };

  const savePrice = async () => {
    const cleaned = draftPrice.replace(/[^0-9.]/g, "");
    if (cleaned === String(image.price)) { setEditingPrice(false); return; }
    try {
      await fetch(buildUrl(api.images.update.path, { id: image.id }), {
        method: "PUT",
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
  const statusColor = isUnpaid
    ? "text-amber-400 bg-amber-400/10 border-amber-400/20"
    : image.shopifyStatus === "synced"
      ? "text-green-400 bg-green-400/10 border-green-400/20"
      : image.shopifyStatus === "failed"
        ? "text-red-400 bg-red-400/10 border-red-400/20"
        : "text-yellow-400 bg-yellow-400/10 border-yellow-400/20";
  const statusLabel = isUnpaid ? "Preview"
    : image.shopifyStatus === "synced" ? "Synced"
    : image.shopifyStatus === "failed" ? "Failed"
    : "Pending";

  const allImages = [image, ...views];
  const hasViews = views.length > 0;

  return (
    <div
      className="group relative flex flex-col overflow-hidden rounded-xl bg-card border shadow-sm hover:shadow-md transition-all animate-in fade-in duration-300 cursor-pointer"
      data-testid={`card-product-${image.id}`}
      style={{ animationDelay: `${Math.min(index * 20, 300)}ms` }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button, [role="checkbox"], .no-nav, input, select')) return;
        setLocation(`/product/${image.id}`);
      }}
    >
      {/* ── Main image ── */}
      <div className="relative bg-muted flex items-center justify-center border-b" style={{ height: hasViews ? "120px" : "176px" }}>
        <img
          src={`/api/images/${image.id}/file?sz=${image.size}&t=${new Date(image.createdAt || Date.now()).getTime()}`}
          alt={image.altText || image.title || image.originalName}
          className="absolute inset-0 w-full h-full object-contain bg-muted"
          loading="lazy"
          onError={(e) => { e.currentTarget.style.display = "none"; }}
          data-testid={`img-product-${image.id}`}
        />
        <ImageIcon className="w-8 h-8 text-white/20" />

        <div className="absolute top-2.5 left-2.5">
          <Checkbox
            data-testid={`checkbox-select-${image.id}`}
            checked={selected}
            onCheckedChange={(checked) => onSelect?.(image.id, !!checked)}
            className="border-white/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
          />
        </div>

        <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
          {hasViews && (
            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-white/20 text-white/70 bg-black/40">
              {allImages.length} views
            </Badge>
          )}
          <Badge variant="outline" className={`text-[10px] ${statusColor}`}>
            {isUnpaid && <Lock className="w-2.5 h-2.5 mr-0.5" />}
            {statusLabel}
          </Badge>
        </div>
      </div>

      {/* ── Views strip ── */}
      {hasViews && (
        <div className="flex gap-1 px-2 py-1.5 bg-muted/30 border-b border-white/5">
          {views.slice(0, 5).map((v) => (
            <div key={v.id} className="relative w-9 h-9 shrink-0 rounded overflow-hidden border border-white/10">
              <img
                src={`/api/images/${v.id}/file?sz=${v.size}`}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
            </div>
          ))}
          {views.length > 5 && (
            <div className="w-9 h-9 shrink-0 rounded bg-white/5 border border-white/10 flex items-center justify-center">
              <span className="text-[9px] text-muted-foreground">+{views.length - 5}</span>
            </div>
          )}
        </div>
      )}

      {/* ── Info ── */}
      <div className="flex flex-col flex-1 p-3 space-y-2">
        <h3 className="font-display font-medium text-sm text-foreground truncate leading-snug" title={image.title || image.originalName}>
          {image.title || image.originalName}
        </h3>

        {image.category && !isUnpaid && (
          <p className="text-[10px] text-muted-foreground truncate" title={image.category}>
            {image.category}
          </p>
        )}

        {isUnpaid && (
          <div className="p-1.5 rounded-md bg-amber-500/5 border border-amber-500/20 text-[10px] text-amber-500 flex items-center gap-1">
            <Lock className="w-2.5 h-2.5 shrink-0" />
            Preview mode — subscribe to unlock
          </div>
        )}

        {/* ── Price + currency ── */}
        {!isUnpaid && (
          <div className="no-nav flex items-center gap-1 mt-auto pt-1">
            {/* currency selector */}
            <Select value={currency} onValueChange={handleCurrencyChange}>
              <SelectTrigger className="h-7 w-16 text-[11px] bg-transparent border-white/10 px-1.5 no-nav">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map(c => (
                  <SelectItem key={c.code} value={c.code} className="text-xs">
                    {c.symbol} {c.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* price input */}
            {editingPrice ? (
              <div className="flex items-center gap-1 flex-1">
                <span className="text-xs text-muted-foreground">{getSymbol(currency)}</span>
                <input
                  autoFocus
                  className="flex-1 min-w-0 h-7 bg-white/5 border border-primary/40 rounded px-1.5 text-xs text-white focus:outline-none focus:border-primary"
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
                <span className="font-medium">
                  {savedFlash
                    ? <span className="text-green-400 flex items-center gap-0.5"><Check className="w-3 h-3" /> Saved</span>
                    : <>{getSymbol(currency)}{image.price ? Number(image.price).toFixed(2) : <span className="text-muted-foreground italic">Add price</span>}</>
                  }
                </span>
                <ChevronRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover/price:opacity-100 transition-opacity" />
              </button>
            )}
          </div>
        )}

        {/* ── Footer ── */}
        <div className="flex items-center justify-end pt-1">
          <Button
            data-testid={`button-delete-${image.id}`}
            variant="ghost"
            size="icon"
            className="h-6 w-6 no-nav text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(image.id); }}
            disabled={deleteMutation.isPending}
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
});
