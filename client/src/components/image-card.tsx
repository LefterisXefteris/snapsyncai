import { useState, memo, useMemo } from "react";
import { FileJson, ImageIcon, Download, Calendar, Pencil, Trash2, DollarSign, Tag, Check, X, Search, Type, Layers, Lock, MessageCircleQuestion, Bot, FolderTree, Instagram } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Image } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUpdateImage, useDeleteImage, useGeneratePhotoshoot } from "@/hooks/use-images";

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
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(image.title || "");
  const [description, setDescription] = useState(image.description || "");
  const [price, setPrice] = useState(image.price || "0.00");
  const [category, setCategory] = useState(image.category || "Other");
  const [productType, setProductType] = useState(image.productType || "");
  const [seoTitle, setSeoTitle] = useState(image.seoTitle || "");
  const [seoDescription, setSeoDescription] = useState(image.seoDescription || "");
  const [altText, setAltText] = useState(image.altText || "");
  const aeoFaqs = Array.isArray(image.aeoFaqs) ? image.aeoFaqs as { question: string; answer: string }[] : [];
  const [aeoSnippet, setAeoSnippet] = useState(image.aeoSnippet || "");
  const [photoshootStyle, setPhotoshootStyle] = useState(VALID_STYLES[0]);

  const updateMutation = useUpdateImage();
  const deleteMutation = useDeleteImage();
  const generatePhotoshootMutation = useGeneratePhotoshoot();

  const aiDataDisplay = useMemo(() => image.aiData ? JSON.stringify(image.aiData, null, 2) : "No analysis data available.", [image.aiData]);
  const variants = useMemo(() => Array.isArray(image.variants) ? image.variants as { name: string; values: string[] }[] : [], [image.variants]);
  const backgrounds = useMemo(() => Array.isArray(image.generatedBackgrounds) ? image.generatedBackgrounds as string[] : [], [image.generatedBackgrounds]);
  const dateLabel = useMemo(() => image.createdAt ? formatDistanceToNow(new Date(image.createdAt), { addSuffix: true }) : 'Just now', [image.createdAt]);

  const handleSave = () => {
    updateMutation.mutate({
      id: image.id,
      updates: { title, description, price, category, productType, seoTitle, seoDescription, altText, aeoSnippet },
    }, {
      onSuccess: () => setEditing(false),
    });
  };

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
      className="group relative flex flex-col overflow-hidden rounded-2xl glass-card animate-in fade-in duration-300"
      data-testid={`card-product-${image.id}`}
      style={{ animationDelay: `${Math.min(index * 20, 300)}ms` }}
    >
      <div className="relative h-40 bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center border-b border-white/5">
        <img
          src={`/api/images/${image.id}/file`}
          alt={image.altText || image.title || image.originalName}
          className="absolute inset-0 w-full h-full object-cover"
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
                  {image.createdAt ? formatDistanceToNow(new Date(image.createdAt), { addSuffix: true }) : 'Just now'}
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
                className="bg-transparent border-white/10 text-destructive"
                onClick={() => deleteMutation.mutate(image.id)}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Remove
              </Button>
            </div>
          </>
        ) : editing ? (
          <div className="space-y-2.5">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="w-full bg-black/30 border border-white/10">
                <TabsTrigger data-testid={`tab-basic-${image.id}`} value="basic" className="flex-1 text-xs">Product</TabsTrigger>
                <TabsTrigger data-testid={`tab-seo-${image.id}`} value="seo" className="flex-1 text-xs">SEO</TabsTrigger>
                <TabsTrigger data-testid={`tab-aeo-${image.id}`} value="aeo" className="flex-1 text-xs">AEO</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-2.5 mt-2.5">
                <Input
                  data-testid={`input-title-${image.id}`}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Product title"
                  className="bg-black/30 border-white/10 text-white text-sm"
                />
                <Textarea
                  data-testid={`input-description-${image.id}`}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Description"
                  className="bg-black/30 border-white/10 text-white text-sm resize-none"
                  rows={3}
                />
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      data-testid={`input-price-${image.id}`}
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="Price"
                      className="bg-black/30 border-white/10 text-white text-sm"
                      type="number"
                      step="0.01"
                    />
                  </div>
                  <div className="flex-1">
                    <Input
                      data-testid={`input-product-type-${image.id}`}
                      value={productType}
                      onChange={(e) => setProductType(e.target.value)}
                      placeholder="Product type (e.g. Hoodie)"
                      className="bg-black/30 border-white/10 text-white text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Category Path</label>
                  <Input
                    data-testid={`input-category-${image.id}`}
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="e.g. Apparel & Accessories > Clothing > Hoodies"
                    className="bg-black/30 border-white/10 text-white text-sm"
                  />
                </div>
                <Input
                  data-testid={`input-alt-text-${image.id}`}
                  value={altText}
                  onChange={(e) => setAltText(e.target.value)}
                  placeholder="Image alt text (for accessibility)"
                  className="bg-black/30 border-white/10 text-white text-sm"
                />
              </TabsContent>

              <TabsContent value="seo" className="space-y-2.5 mt-2.5">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">SEO Page Title</label>
                  <Input
                    data-testid={`input-seo-title-${image.id}`}
                    value={seoTitle}
                    onChange={(e) => setSeoTitle(e.target.value)}
                    placeholder="SEO title (50-60 chars)"
                    className="bg-black/30 border-white/10 text-white text-sm"
                  />
                  <p className="text-[10px] text-muted-foreground">{seoTitle.length}/60 characters</p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Meta Description</label>
                  <Textarea
                    data-testid={`input-seo-desc-${image.id}`}
                    value={seoDescription}
                    onChange={(e) => setSeoDescription(e.target.value)}
                    placeholder="Meta description (140-160 chars)"
                    className="bg-black/30 border-white/10 text-white text-sm resize-none"
                    rows={2}
                  />
                  <p className="text-[10px] text-muted-foreground">{seoDescription.length}/160 characters</p>
                </div>

                <div className="p-2.5 rounded-lg bg-black/20 border border-white/5 space-y-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Google Preview</p>
                  <p className="text-sm text-blue-400 truncate">{seoTitle || title || "Product Title"}</p>
                  <p className="text-xs text-green-400 truncate">yourstore.myshopify.com/products/...</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{seoDescription || "No meta description set."}</p>
                </div>
              </TabsContent>

              <TabsContent value="aeo" className="space-y-2.5 mt-2.5">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Bot className="w-3 h-3" />
                    AI Answer Snippet
                  </label>
                  <Textarea
                    data-testid={`input-aeo-snippet-${image.id}`}
                    value={aeoSnippet}
                    onChange={(e) => setAeoSnippet(e.target.value)}
                    placeholder="Conversational product summary for AI assistants..."
                    className="bg-black/30 border-white/10 text-white text-sm resize-none"
                    rows={3}
                  />
                  <p className="text-[10px] text-muted-foreground">How AI assistants describe this product</p>
                </div>

                {aeoFaqs.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground flex items-center gap-1">
                      <MessageCircleQuestion className="w-3 h-3" />
                      Product FAQs ({aeoFaqs.length})
                    </label>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {aeoFaqs.map((faq, i) => (
                        <div key={i} className="p-2 rounded-lg bg-black/20 border border-white/5 space-y-0.5">
                          <p className="text-xs font-medium text-purple-300">{faq.question}</p>
                          <p className="text-xs text-muted-foreground">{faq.answer}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-2.5 rounded-lg bg-purple-500/5 border border-purple-500/20 space-y-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">AI Assistant Preview</p>
                  <p className="text-xs text-purple-300/80 italic">
                    {aeoSnippet || "No AI answer snippet generated yet."}
                  </p>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex gap-2 pt-1">
              <Button data-testid={`button-save-${image.id}`} size="sm" onClick={handleSave} disabled={updateMutation.isPending} className="flex-1">
                <Check className="w-3.5 h-3.5 mr-1" />
                Save
              </Button>
              <Button data-testid={`button-cancel-${image.id}`} size="sm" variant="outline" onClick={() => setEditing(false)} className="bg-transparent border-white/10">
                <X className="w-3.5 h-3.5 mr-1" />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div>
              <h3 className="font-display font-semibold text-base text-white truncate" title={image.title || image.originalName}>
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
                <FolderTree className="w-3 h-3 text-purple-400 shrink-0" />
                <span className="text-muted-foreground truncate" title={image.category}>{image.category}</span>
              </div>
            )}

            <div className="p-2.5 rounded-lg bg-black/20 border border-white/5 text-sm text-muted-foreground line-clamp-2 min-h-[3rem]">
              {image.description ? image.description.replace(/<[^>]*>/g, ' ').trim() : "No description generated."}
            </div>

            {image.tags && image.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {image.tags.map((tag, i) => (
                  <Badge key={i} variant="secondary" className="text-[10px] bg-white/5 border-white/10">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-1.5">
              {image.seoTitle && (
                <Badge variant="outline" className="text-[10px] text-blue-400 bg-blue-400/5 border-blue-400/20">
                  <Search className="w-2.5 h-2.5 mr-0.5" />
                  SEO
                </Badge>
              )}
              {image.altText && (
                <Badge variant="outline" className="text-[10px] text-cyan-400 bg-cyan-400/5 border-cyan-400/20">
                  <Type className="w-2.5 h-2.5 mr-0.5" />
                  Alt Text
                </Badge>
              )}
              {image.aeoSnippet && (
                <Badge variant="outline" className="text-[10px] text-purple-400 bg-purple-400/5 border-purple-400/20">
                  <Bot className="w-2.5 h-2.5 mr-0.5" />
                  AEO
                </Badge>
              )}
              {variants.length > 0 && (
                <Badge variant="outline" className="text-[10px] text-amber-400 bg-amber-400/5 border-amber-400/20">
                  <Layers className="w-2.5 h-2.5 mr-0.5" />
                  {variants.map(v => `${v.values.length} ${v.name}`).join(', ')}
                </Badge>
              )}
            </div>

            {image.instagramStatus === 'posted' && (
              <Badge variant="outline" className="text-[10px] text-pink-400 bg-pink-400/5 border-pink-400/20">
                <Instagram className="w-2.5 h-2.5 mr-0.5" />
                Posted
              </Badge>
            )}

            <div className="mt-auto flex items-center justify-between gap-1.5 pt-2">
              <Button
                data-testid={`button-edit-${image.id}`}
                variant="outline"
                size="sm"
                onClick={() => setEditing(true)}
                className="flex-1 bg-transparent border-white/10"
              >
                <Pencil className="w-3.5 h-3.5 mr-1.5" />
                Edit
              </Button>

              {instagramConnected && onInstagramPost && (
                <Button
                  data-testid={`button-ig-post-${image.id}`}
                  variant="outline"
                  size="icon"
                  className="bg-transparent border-white/10"
                  onClick={() => onInstagramPost(image.id)}
                  title="Post to Instagram"
                >
                  <Instagram className="w-4 h-4" />
                </Button>
              )}

              <Dialog>
                <DialogTrigger asChild>
                  <Button data-testid={`button-json-${image.id}`} variant="outline" size="icon" className="bg-transparent border-white/10">
                    <FileJson className="w-4 h-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl bg-[#0a0a0b] border-white/10 text-white">
                  <DialogHeader>
                    <DialogTitle>AI Analysis Data</DialogTitle>
                    <DialogDescription>Raw JSON output for {image.originalName}</DialogDescription>
                  </DialogHeader>
                  <div className="mt-4 relative">
                    <pre className="max-h-[60vh] overflow-y-auto text-xs md:text-sm">
                      {aiDataDisplay}
                    </pre>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="absolute top-2 right-2"
                      onClick={handleDownloadJson}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog>
                <DialogTrigger asChild>
                  <Button data-testid={`button-photoshoot-${image.id}`} variant="outline" size="sm" className="bg-transparent border-white/10 text-purple-400 hover:text-purple-300">
                    <ImageIcon className="w-3.5 h-3.5 mr-1" />
                    AI Photoshoot
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl bg-[#0a0a0b] border-white/10 text-white">
                  <DialogHeader>
                    <DialogTitle>AI Concept Generator</DialogTitle>
                    <DialogDescription>
                      Generate high-quality 4k photorealistic environments based on "{image.title}".
                    </DialogDescription>
                  </DialogHeader>

                  <div className="flex items-center gap-3 py-4">
                    <Select value={photoshootStyle} onValueChange={setPhotoshootStyle}>
                      <SelectTrigger className="w-[200px] border-white/10 bg-black">
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
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      {generatePhotoshootMutation.isPending ? "Rendering (10-15s)..." : "Generate Concept"}
                    </Button>
                  </div>

                  {backgrounds.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium mb-3 text-muted-foreground">Generated Concepts</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-[50vh] overflow-y-auto pr-2">
                        {backgrounds.map((url, i) => (
                          <div key={i} className="relative group rounded-lg overflow-hidden border border-white/10 aspect-square">
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
                className="bg-transparent border-white/10 text-destructive"
                onClick={() => deleteMutation.mutate(image.id)}
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
