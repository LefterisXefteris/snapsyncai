import { useState, memo, useMemo } from "react";
import { useLocation } from "wouter";
import { ImageIcon, Calendar, Trash2, DollarSign, FolderTree, Lock, Instagram } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Image } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useDeleteImage } from "@/hooks/use-images";

interface ImageCardProps {
  image: Image;
  index: number;
  selected?: boolean;
  onSelect?: (id: number, selected: boolean) => void;
  instagramConnected?: boolean;
  onInstagramPost?: (imageId: number) => void;
}

export const ImageCard = memo(function ImageCard({ image, index, selected, onSelect }: ImageCardProps) {
  const [, setLocation] = useLocation();
  const deleteMutation = useDeleteImage();

  const isUnpaid = image.paymentStatus !== 'paid';

  const statusColor = isUnpaid
    ? "text-amber-400 bg-amber-400/10 border-amber-400/20"
    : image.shopifyStatus === "synced"
      ? "text-green-400 bg-green-400/10 border-green-400/20"
      : image.shopifyStatus === "failed"
        ? "text-red-400 bg-red-400/10 border-red-400/20"
        : "text-yellow-400 bg-yellow-400/10 border-yellow-400/20";

  const statusLabel = isUnpaid
    ? "Preview"
    : image.shopifyStatus === "synced"
      ? "Synced"
      : image.shopifyStatus === "failed"
        ? "Failed"
        : "Pending";

  return (
    <div
      className="group relative flex flex-col overflow-hidden rounded-xl bg-card border shadow-sm hover:shadow-md transition-all animate-in fade-in duration-300 cursor-pointer"
      data-testid={`card-product-${image.id}`}
      style={{ animationDelay: `${Math.min(index * 20, 300)}ms` }}
      onClick={(e) => {
        // Prevent navigation if clicking on actions/buttons
        if ((e.target as HTMLElement).closest('button, [role="checkbox"], .no-nav')) return;
        setLocation(`/product/${image.id}`);
      }}
    >
      <div className="relative h-44 bg-muted flex items-center justify-center border-b">
        <img
          src={`/api/images/${image.id}/file?t=${new Date(image.createdAt || Date.now()).getTime()}`}
          alt={image.altText || image.title || image.originalName}
          className="absolute inset-0 w-full h-full object-contain bg-muted"
          loading="lazy"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
          data-testid={`img-product-${image.id}`}
        />
        <ImageIcon className="w-10 h-10 text-white/20" />

        <div className="absolute top-3 left-3">
          <Checkbox
            data-testid={`checkbox-select-${image.id}`}
            checked={selected}
            onCheckedChange={(checked) => onSelect?.(image.id, !!checked)}
            className="border-white/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
          />
        </div>

        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          <Badge variant="outline" className={`text-[10px] ${statusColor}`}>
            {isUnpaid && <Lock className="w-2.5 h-2.5 mr-0.5" />}
            {statusLabel}
          </Badge>
        </div>
      </div>

      <div className="flex flex-col flex-1 p-3 space-y-2">
        <div>
          <h3 className="font-display font-medium text-sm text-foreground truncate" title={image.title || image.originalName}>
            {image.title || image.originalName}
          </h3>
          <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {image.createdAt ? formatDistanceToNow(new Date(image.createdAt), { addSuffix: true }) : 'Just now'}
            </span>
            {!isUnpaid && (
              <span className="flex items-center gap-1">
                <DollarSign className="w-3 h-3" />
                ${image.price || "0.00"}
              </span>
            )}
            {image.productType && !isUnpaid && (
              <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
                {image.productType}
              </Badge>
            )}
          </div>
        </div>

        {image.category && !isUnpaid && (
          <div className="flex items-center gap-1.5 text-[11px]" data-testid={`text-category-path-${image.id}`}>
            <FolderTree className="w-3 h-3 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground truncate" title={image.category}>{image.category}</span>
          </div>
        )}

        {isUnpaid && (
          <div className="p-2 rounded-md bg-amber-500/5 border border-amber-500/20 text-[11px] text-amber-500 flex items-center gap-1.5">
            <Lock className="w-3 h-3 shrink-0" />
            <span className="truncate">Preview mode</span>
          </div>
        )}

        <div className="mt-auto pt-2 flex items-center justify-between">
          {image.instagramStatus === 'posted' && !isUnpaid ? (
            <Badge variant="outline" className="text-[9px] text-pink-500 bg-pink-500/10 border-pink-500/20 px-1 py-0 h-4">
              <Instagram className="w-2.5 h-2.5 mr-0.5" />
              Posted
            </Badge>
          ) : <div />}

          <Button
            data-testid={`button-delete-${image.id}`}
            variant="ghost"
            size="icon"
            className="h-6 w-6 no-nav text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={(e) => {
              e.stopPropagation();
              deleteMutation.mutate(image.id);
            }}
            disabled={deleteMutation.isPending}
            title="Delete Image"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
});
