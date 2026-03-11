import { useState, memo, useMemo } from "react";
import { useLocation } from "wouter";
import { BrainCircuit, FileJson, ImageIcon, Download, Calendar, Pencil, Trash2, DollarSign, Tag, Check, X, Search, Type, Layers, Lock, MessageCircleQuestion, Bot, FolderTree, Instagram, Wand2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Image } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDeleteImage, useGeneratePhotoshoot, useEditBackground } from "@/hooks/use-images";

const VALID_STYLES = ["Studio Lighting", "Minimalist Marble", "Natural Outdoor", "E-commerce White", "Neon Cyberpunk"];

interface ImageCardProps {
  image: Image;
  index: number;
  selected?: boolean;
  onSelect?: (id: number, selected: boolean) => void;
  instagramConnected?: boolean;
  onInstagramPost?: (imageId: number) => void;
}

function categoryLabel(category: string): string {
  if (!category) return "Uncategorized";
  const parts = category.split(" > ");
  return parts[parts.length - 1];
}

export const ImageCard = memo(function ImageCard({ image, index, selected, onSelect, instagramConnected, onInstagramPost }: ImageCardProps) {
  const [, setLocation] = useLocation();

  const [photoshootStyle, setPhotoshootStyle] = useState(VALID_STYLES[0]);
  const deleteMutation = useDeleteImage();
  const generatePhotoshootMutation = useGeneratePhotoshoot();
  const editBackgroundMutation = useEditBackground();

  const [bgEditUrl, setBgEditUrl] = useState<string | null>(null);
  const [showBgPicker, setShowBgPicker] = useState(false);

  const BG_STYLES = [
    { key: "studio",    label: "Studio",    color: "#f8f8f8" },
    { key: "gradient",  label: "Gradient",  color: "#9333ea" },
    { key: "lifestyle", label: "Lifestyle", color: "#84cc16" },
    { key: "minimal",   label: "Minimal",   color: "#e5e5e5" },
    { key: "dark",      label: "Dark",      color: "#1c1c1c" },
  ] as const;

  const handleEditBackground = (style: string) => {
    setShowBgPicker(false);
    editBackgroundMutation.mutate(
      { id: image.id, style },
      {
        onSuccess: (data) => {
          setBgEditUrl(data.url);
        },
      }
    );
  };

  const aiDataDisplay = useMemo(() => image.aiData ? JSON.stringify(image.aiData, null, 2) : "No analysis data available.", [image.aiData]);
  const variants = useMemo(() => Array.isArray(image.variants) ? image.variants as { name: string; values: string[] }[] : [], [image.variants]);
  const backgrounds = useMemo(() => Array.isArray(image.generatedBackgrounds) ? image.generatedBackgrounds as string[] : [], [image.generatedBackgrounds]);
  const dateLabel = useMemo(() => image.createdAt ? formatDistanceToNow(new Date(image.createdAt), { addSuffix: true }) : 'Just now', [image.createdAt]);

  const handleDownloadJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(image.aiData || {}, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${image.originalName}-analysis.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

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
          src={bgEditUrl ?? `/api/images/${image.id}/file`}
          alt={image.altText || image.title || image.originalName}
          className="absolute inset-0 w-full h-full object-contain bg-muted"
          loading="lazy"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
          data-testid={`img-product-${image.id}`}
        />
        <ImageIcon className="w-10 h-10 text-white/20" />

        {/* AI editing spinner overlay */}
        {editBackgroundMutation.isPending && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-30 rounded-t-2xl gap-2">
            <Wand2 className="w-6 h-6 text-primary animate-pulse" />
            <span className="text-xs text-white/80">Editing background…</span>
          </div>
        )}

        {/* Background style picker */}
        {showBgPicker && !editBackgroundMutation.isPending && (
          <div className="absolute inset-0 bg-black/70 z-30 rounded-t-2xl flex flex-col items-center justify-center gap-3 p-3">
            <p className="text-xs font-semibold text-white">Pick a background</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {BG_STYLES.map((s) => (
                <button
                  key={s.key}
                  onClick={() => handleEditBackground(s.key)}
                  className="flex flex-col items-center gap-1 group"
                  title={s.label}
                >
                  <span
                    className="w-8 h-8 rounded-full border-2 border-white/20 group-hover:border-primary transition-colors block"
                    style={{ background: s.color }}
                  />
                  <span className="text-[9px] text-white/70">{s.label}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setShowBgPicker(false)} className="text-[10px] text-white/40 hover:text-white/70 transition-colors mt-1">Cancel</button>
          </div>
        )}

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

      <div className="flex flex-col flex-1 p-4 space-y-3">
        {isUnpaid ? (
          <>
            <div>
              <h3 className="font-display font-semibold text-base text-white truncate" title={image.title || image.originalName}>
                {image.title || image.originalName}
              </h3>
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {dateLabel}
                </span>
              </div>
            </div>

            {image.category && (
              <div className="flex items-center gap-1.5 text-xs" data-testid={`text-category-path-${image.id}`}>
                <FolderTree className="w-3 h-3 text-purple-400 shrink-0" />
                <span className="text-muted-foreground truncate" title={image.category}>{image.category}</span>
              </div>
            )}

            {image.tags && image.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {image.tags.map((tag, i) => (
                  <Badge key={i} variant="secondary" className="text-[10px] bg-white/5 border-white/10">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-sm text-amber-400/80 flex items-center gap-2">
              <Lock className="w-4 h-4 shrink-0" />
              <span>Subscribe to get full description, pricing, SEO & variants</span>
            </div>

            <div className="mt-auto flex items-center justify-between gap-1.5 pt-2">
              <Button
                data-testid={`button-delete-${image.id}`}
                variant="outline"
                size="sm"
                className="no-nav bg-transparent border-border text-destructive hover:bg-destructive/10"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteMutation.mutate(image.id);
                }}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Remove
              </Button>
            </div>
          </>
        ) : (
          <>
            <div>
              <h3 className="font-display font-semibold text-base truncate" title={image.title || image.originalName}>
                {image.title || image.originalName}
              </h3>
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {image.createdAt ? formatDistanceToNow(new Date(image.createdAt), { addSuffix: true }) : 'Just now'}
                </span>
                <span className="flex items-center gap-1">
                  <DollarSign className="w-3 h-3" />
                  ${image.price || "0.00"}
                </span>
                {image.productType && (
                  <Badge variant="secondary" className="text-[10px]">
                    {image.productType}
                  </Badge>
                )}
              </div>
            </div>

            {image.category && (
              <div className="flex items-center gap-1.5 text-xs" data-testid={`text-category-path-paid-${image.id}`}>
                <FolderTree className="w-3 h-3 shrink-0" />
                <span className="text-muted-foreground truncate" title={image.category}>{image.category}</span>
              </div>
            )}

            <div className="p-2.5 rounded-lg bg-muted border text-sm text-muted-foreground line-clamp-2 min-h-[3rem]">
              {image.description ? image.description.replace(/<[^>]*>/g, ' ').trim() : "No description generated."}
            </div>

            {image.tags && image.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {image.tags.map((tag, i) => (
                  <Badge key={i} variant="secondary" className="text-[10px]">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-1.5">
              {image.seoTitle && (
                <Badge variant="outline" className="text-[10px] text-blue-500 bg-blue-500/10 border-blue-500/20">
                  <Search className="w-2.5 h-2.5 mr-0.5" />
                  SEO
                </Badge>
              )}
              {image.altText && (
                <Badge variant="outline" className="text-[10px] text-cyan-500 bg-cyan-500/10 border-cyan-500/20">
                  <Type className="w-2.5 h-2.5 mr-0.5" />
                  Alt Text
                </Badge>
              )}
              {image.aeoSnippet && (
                <Badge variant="outline" className="text-[10px] text-purple-500 bg-purple-500/10 border-purple-500/20">
                  <Bot className="w-2.5 h-2.5 mr-0.5" />
                  AEO
                </Badge>
              )}
              {variants.length > 0 && (
                <Badge variant="outline" className="text-[10px] text-amber-500 bg-amber-500/10 border-amber-500/20">
                  <Layers className="w-2.5 h-2.5 mr-0.5" />
                  {variants.map(v => `${v.values.length} ${v.name}`).join(', ')}
                </Badge>
              )}
            </div>

            {image.instagramStatus === 'posted' && (
              <Badge variant="outline" className="text-[10px] text-pink-500 bg-pink-500/10 border-pink-500/20">
                <Instagram className="w-2.5 h-2.5 mr-0.5" />
                Posted
              </Badge>
            )}

            <div className="mt-auto flex items-center justify-between gap-1.5 pt-2">
              <Button
                data-testid={`button-edit-${image.id}`}
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setLocation(`/product/${image.id}`);
                }}
                className="flex-1 no-nav"
              >
                <Pencil className="w-3.5 h-3.5 mr-1.5" />
                Edit
              </Button>

              {/* AI Background edit button */}
              <Button
                data-testid={`button-bg-edit-${image.id}`}
                variant="outline"
                size="icon"
                className={`no-nav ${showBgPicker ? 'border-primary/50 text-primary' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowBgPicker(v => !v);
                }}
                disabled={editBackgroundMutation.isPending}
                title="AI Background Editor"
              >
                <Wand2 className="w-4 h-4" />
              </Button>

              {instagramConnected && onInstagramPost && (
                <Button
                  data-testid={`button-ig-post-${image.id}`}
                  variant="outline"
                  size="icon"
                  className="no-nav"
                  onClick={(e) => {
                    e.stopPropagation();
                    onInstagramPost(image.id);
                  }}
                  title="Post to Instagram"
                >
                  <Instagram className="w-4 h-4" />
                </Button>
              )}

              <Dialog>
                <DialogTrigger asChild>
                  <Button data-testid={`button-json-${image.id}`} variant="outline" size="icon" className="no-nav">
                    <FileJson className="w-4 h-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl bg-background border text-foreground" onClick={(e) => e.stopPropagation()}>
                  <DialogHeader>
                    <DialogTitle>AI Analysis Data</DialogTitle>
                    <DialogDescription>Raw JSON output for {image.originalName}</DialogDescription>
                  </DialogHeader>
                  <div className="mt-4 relative">
                    <pre className="max-h-[60vh] overflow-y-auto text-xs md:text-sm bg-muted p-4 rounded-md">
                      {aiDataDisplay}
                    </pre>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="absolute top-2 right-2 border bg-background"
                      onClick={handleDownloadJson}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog>
                <DialogTrigger asChild>
                  <Button data-testid={`button-photoshoot-${image.id}`} variant="outline" size="sm" className="no-nav text-purple-500 hover:text-purple-600 hover:bg-purple-500/10">
                    <ImageIcon className="w-3.5 h-3.5 mr-1" />
                    AI Photoshoot
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl bg-background border text-foreground" onClick={(e) => e.stopPropagation()}>
                  <DialogHeader>
                    <DialogTitle>AI Concept Generator</DialogTitle>
                    <DialogDescription>
                      Generate high-quality 4k photorealistic environments based on "{image.title}".
                    </DialogDescription>
                  </DialogHeader>

                  <div className="flex items-center gap-3 py-4">
                    <Select value={photoshootStyle} onValueChange={setPhotoshootStyle}>
                      <SelectTrigger className="w-[200px] border">
                        <SelectValue placeholder="Select Style" />
                      </SelectTrigger>
                      <SelectContent>
                        {VALID_STYLES.map(style => (
                          <SelectItem key={style} value={style}>{style}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      onClick={() => generatePhotoshootMutation.mutate({ id: image.id, style: photoshootStyle })}
                      disabled={generatePhotoshootMutation.isPending}
                    >
                      {generatePhotoshootMutation.isPending ? "Rendering (10-15s)..." : "Generate Concept"}
                    </Button>
                  </div>

                  {backgrounds.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium mb-3 text-muted-foreground">Generated Concepts</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-[50vh] overflow-y-auto pr-2">
                        {backgrounds.map((url, i) => (
                          <div key={i} className="relative group rounded-lg overflow-hidden border aspect-square">
                            <img src={url} alt="Generated Concept" className="w-full h-full object-cover" loading="lazy" />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Button size="sm" variant="secondary" onClick={() => window.open(url, '_blank')}>
                                <Download className="w-3.5 h-3.5 mr-1.5" />
                                Download Hires
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </DialogContent>
              </Dialog>

              <Button
                data-testid={`button-delete-${image.id}`}
                variant="outline"
                size="icon"
                className="no-nav text-destructive hover:bg-destructive/10"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteMutation.mutate(image.id);
                }}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
});
