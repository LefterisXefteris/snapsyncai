import { useState, useEffect, useRef, type DragEvent } from "react";
import { useLocation, useRoute } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useImages, useProductGroup, useAssignToGroup, useAssignMultipleToGroup, useUnlinkFromGroup, useUpdateImage, useDeleteImage, useEditBackground, useGeneratePhotoshoot, useApplyImage, useRewriteDescription, usePushToShopify, useUploadImages } from "@/hooks/use-images";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { filterImageLikeFiles } from "@/lib/image-file-utils";
import { api, buildUrl } from "@shared/routes";
import type { Image } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowLeft, Check, Lock, Loader2, Wand2, ImageIcon, Download, Tag, Box, BarChart3, Sparkles, Plus, ImagePlus, Store, Trash2, X, UploadCloud, Search, GripVertical } from "lucide-react";
import { AiContentPanel } from "@/components/ai-content-panel";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

/** Parallax frame — the product photo floats and tilts a few degrees toward the cursor. */
function TiltFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rotateX = useSpring(useTransform(my, [0, 1], [4, -4]), { stiffness: 200, damping: 25 });
  const rotateY = useSpring(useTransform(mx, [0, 1], [-4, 4]), { stiffness: 200, damping: 25 });

  return (
    <motion.div
      className={className}
      style={{ rotateX, rotateY, transformPerspective: 900 }}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        mx.set((e.clientX - rect.left) / rect.width);
        my.set((e.clientY - rect.top) / rect.height);
      }}
      onMouseLeave={() => {
        mx.set(0.5);
        my.set(0.5);
      }}
    >
      {children}
    </motion.div>
  );
}

const AI_BG_REMOVAL_ENABLED = import.meta.env.VITE_FEATURE_AI_BG_REMOVAL === "true";
const AI_PHOTOSHOOT_ENABLED = import.meta.env.VITE_FEATURE_AI_PHOTOSHOOT === "true";

const VALID_STYLES = ["Studio Lighting", "Minimalist Marble", "Natural Outdoor", "E-commerce White", "Neon Cyberpunk"];

const BG_STYLES = [
  { key: "studio",    label: "Studio",    color: "#f8f8f8" },
  { key: "gradient",  label: "Gradient",  color: "#9333ea" },
  { key: "lifestyle", label: "Lifestyle", color: "#84cc16" },
  { key: "minimal",   label: "Minimal",   color: "#e5e5e5" },
  { key: "dark",      label: "Dark",      color: "#1c1c1c" },
] as const;

function orderProductImages(images: Image[], mediaGallery: string[]) {
  if (mediaGallery.length === 0) return images;

  const rank = new Map(
    mediaGallery
      .map((id, index) => [Number(id), index] as const)
      .filter(([id]) => Number.isFinite(id))
  );

  return [...images].sort((a, b) => {
    const aRank = rank.get(a.id);
    const bRank = rank.get(b.id);
    if (aRank !== undefined || bRank !== undefined) {
      return (aRank ?? Number.MAX_SAFE_INTEGER) - (bRank ?? Number.MAX_SAFE_INTEGER) || a.id - b.id;
    }
    return a.id - b.id;
  });
}

function productImageSrc(image: Pick<Image, "id" | "size" | "createdAt">, proxy = false, cacheKey?: number) {
  const params = new URLSearchParams();
  if (image.size) params.set("sz", String(image.size));
  params.set("t", String(cacheKey ?? new Date(image.createdAt || Date.now()).getTime()));
  if (proxy) params.set("proxy", "1");
  return `/api/images/${image.id}/file?${params.toString()}`;
}

export default function ProductDetails({ params }: { params: { id: string } }) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: images, isLoading } = useImages();
  const updateMutation = useUpdateImage();
  const pushToShopifyMutation = usePushToShopify();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("0.00");
  const [category, setCategory] = useState("");
  const [productType, setProductType] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [altText, setAltText] = useState("");
  const [aeoSnippet, setAeoSnippet] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [aeoFaqs, setAeoFaqs] = useState<{ q: string; a: string }[]>([]);

  // New e-commerce fields
  const [compareAtPrice, setCompareAtPrice] = useState("");
  const [costPerItem, setCostPerItem] = useState("");
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [trackQuantity, setTrackQuantity] = useState(true);
  const [inventoryQuantity, setInventoryQuantity] = useState(0);

  const deleteImageMutation = useDeleteImage();
  const unlinkFromGroupMutation = useUnlinkFromGroup();
  const assignToGroupMutation = useAssignToGroup();
  const assignMultipleMutation = useAssignMultipleToGroup();
  const uploadImagesMutation = useUploadImages();
  const [showLibraryPicker, setShowLibraryPicker] = useState(false);
  const [pickerTab, setPickerTab] = useState<"library" | "upload">("library");
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerSelected, setPickerSelected] = useState<Set<number>>(new Set());
  const [pickerUploading, setPickerUploading] = useState(false);
  const [pickerDragActive, setPickerDragActive] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const editBackgroundMutation = useEditBackground();
  const generatePhotoshootMutation = useGeneratePhotoshoot();
  const applyImageMutation = useApplyImage();
  const rewriteDescriptionMutation = useRewriteDescription();
  
  const [bgEditKey, setBgEditKey] = useState<string | null>(null);
  const [bgEditUrl, setBgEditUrl] = useState<string | null>(null);
  const [showBgPicker, setShowBgPicker] = useState(false);
  const [photoshootStyle, setPhotoshootStyle] = useState(VALID_STYLES[0]);
  const [imageKey, setImageKey] = useState(Date.now());
  const [selectedVariantRows, setSelectedVariantRows] = useState<Set<number>>(new Set());
  const [variantRowData, setVariantRowData] = useState<{ price: string; available: number; sku: string }[]>([]);
  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkAvailable, setBulkAvailable] = useState("");
  const [bulkSku, setBulkSku] = useState("");
  const [draggedImageId, setDraggedImageId] = useState<number | null>(null);
  const [dragOverImageId, setDragOverImageId] = useState<number | null>(null);
  const [thumbnailDragActive, setThumbnailDragActive] = useState(false);
  const [proxyImageIds, setProxyImageIds] = useState<Set<number>>(new Set());

  const image = images?.find((img: Image) => img.id === Number(params.id));

  // Fetch all images in the product group directly from the server
  const { data: groupImages } = useProductGroup(image?.id);

  // productImages: prefer server group result, fall back to client-side filtering, then just primary
  const rawProductImages: Image[] = (() => {
    if (groupImages && groupImages.length > 0) return groupImages as Image[];
    if (images && image?.productGroupId) {
      const siblings = (images as Image[]).filter(img => img.productGroupId === image.productGroupId).sort((a, b) => a.id - b.id);
      if (siblings.length > 0) return siblings;
    }
    return image ? [image] : [];
  })();

  const [selectedImageId, setSelectedImageId] = useState<number | null>(null);
  const displayImageId = selectedImageId ?? image?.id;

  // Initialize form when image data is available
  useEffect(() => {
    if (image) {
      setTitle(image.title || image.originalName || "");
      setDescription(image.description || "");
      setPrice(image.price || "0.00");
      setCategory(image.category || "");
      setProductType(image.productType || "");
      setSeoTitle(image.seoTitle || "");
      setSeoDescription(image.seoDescription || "");
      setAltText(image.altText || "");
      setAeoSnippet(image.aeoSnippet || "");
      setCompareAtPrice(image.compareAtPrice || "");
      setCostPerItem(image.costPerItem || "");
      setSku(image.sku || "");
      setBarcode(image.barcode || "");
      setTrackQuantity(image.trackQuantity === "true" || image.trackQuantity === true);
      setInventoryQuantity(image.inventoryQuantity || 0);
      setTags(Array.isArray(image.tags) ? image.tags : []);
      setAeoFaqs(Array.isArray(image.aeoFaqs) ? (image.aeoFaqs as { question: string; answer: string }[]).map((f) => ({ q: f.question, a: f.answer })) : []);
      const imgVariants = Array.isArray(image.variants) ? (image.variants as { name: string; values: string[] }[]) : [];
      const combos = imgVariants.reduce<string[][]>((acc, v) => {
        if (acc.length === 0) return v.values.map((val: string) => [val]);
        return acc.flatMap((combo: string[]) => v.values.map((val: string) => [...combo, val]));
      }, []);
      setVariantRowData(combos.map((combo) => ({
        price: image.price || "0.00",
        available: image.inventoryQuantity || 0,
        sku: (image.sku ? `${image.sku}-` : "") + combo.map((v: string) => v.toUpperCase().replace(/\s/g, "")).join("-"),
      })));
    }
  }, [image]);

  const variants = Array.isArray(image?.variants) ? (image.variants as { name: string; values: string[] }[]) : [];
  const mediaGallery = Array.isArray(image?.mediaGallery) ? (image.mediaGallery as string[]) : [];
  const productImages = orderProductImages(rawProductImages, mediaGallery);
  const displayImage = productImages.find((img) => img.id === displayImageId) ?? image;
  const variantCombos = variants.reduce<string[][]>((acc, v) => {
    if (acc.length === 0) return v.values.map((val: string) => [val]);
    return acc.flatMap((combo: string[]) => v.values.map((val: string) => [...combo, val]));
  }, []);

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-transparent">
        <span className="w-3 h-3 rounded-full bg-primary animate-pulse-glow shadow-[0_0_24px_6px_hsl(var(--primary)/0.35)]" />
      </div>
    );
  }

  if (!image) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-transparent">
        <h2 className="font-display text-xl font-bold mb-4">Product not found</h2>
        <Button onClick={() => setLocation("/")}>Back to Products</Button>
      </div>
    );
  }

  const isUnpaid = image.paymentStatus !== "paid";
  const backgrounds = Array.isArray(image?.generatedBackgrounds) ? (image.generatedBackgrounds as string[]) : [];

  const persistMediaOrder = async (orderedIds: number[], primaryId?: number) => {
    if (!image || orderedIds.length === 0) return;
    const mediaGallery = orderedIds.map(String);
    try {
      await Promise.all(productImages.map((productImage) =>
        apiRequest("PUT", buildUrl(api.images.update.path, { id: productImage.id }), { mediaGallery })
      ));
      if (primaryId) {
        setSelectedImageId(primaryId);
        setBgEditUrl(null);
        setBgEditKey(null);
      }
      queryClient.invalidateQueries({ queryKey: [api.images.list.path] });
      queryClient.invalidateQueries({ queryKey: ['/api/images/group'] });
      toast({
        title: primaryId ? "Thumbnail updated" : "Media reordered",
        description: primaryId ? "This image will be used first for the product." : "Product image order saved.",
      });
    } catch (err: any) {
      toast({ title: "Failed to update media", description: err.message, variant: "destructive" });
    }
  };

  const moveImageToIndex = (imageId: number, targetIndex: number) => {
    const currentIds = productImages.map((img) => img.id);
    const fromIndex = currentIds.indexOf(imageId);
    if (fromIndex === -1) return;

    const nextIds = [...currentIds];
    const [movedId] = nextIds.splice(fromIndex, 1);
    nextIds.splice(Math.max(0, Math.min(targetIndex, nextIds.length)), 0, movedId);
    if (nextIds.every((id, index) => id === currentIds[index])) return;
    persistMediaOrder(nextIds, targetIndex === 0 ? imageId : undefined);
  };

  const getDraggedImageId = (event: DragEvent) => {
    const rawId = event.dataTransfer.getData("application/x-product-image-id") || event.dataTransfer.getData("text/plain");
    const id = Number(rawId);
    return Number.isFinite(id) ? id : null;
  };

  const handleImageLoadError = (imageId: number) => {
    setProxyImageIds((current) => {
      if (current.has(imageId)) return current;
      const next = new Set(current);
      next.add(imageId);
      return next;
    });
  };

  const handleEditBackground = (style: string) => {
    setShowBgPicker(false);
    editBackgroundMutation.mutate(
      { id: image.id, style },
      {
        onSuccess: (data) => {
          setBgEditKey(data.key);
          setBgEditUrl(data.url);
        },
      }
    );
  };

  // ── Library picker helpers ─────────────────────────────────────────────────
  const togglePickerSelect = (id: number) => {
    setPickerSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAddSelected = async () => {
    if (pickerSelected.size === 0) return;
    setPickerUploading(true);
    try {
      const groupId = image.productGroupId ?? crypto.randomUUID();
      // Update each selected library image via PUT (uses the battle-tested update endpoint)
      await Promise.all(Array.from(pickerSelected).map(id =>
        apiRequest("PUT", buildUrl(api.images.update.path, { id }), { productGroupId: groupId })
      ));
      // If the primary product had no group yet, assign it too
      if (!image.productGroupId) {
        await apiRequest("PUT", buildUrl(api.images.update.path, { id: image.id }), { productGroupId: groupId });
      }
      queryClient.invalidateQueries({ queryKey: [api.images.list.path] });
      queryClient.invalidateQueries({ queryKey: ['/api/images/group'] });
      setPickerSelected(new Set());
      setShowLibraryPicker(false);
      toast({ title: "Images added", description: `${pickerSelected.size} image${pickerSelected.size !== 1 ? "s" : ""} added to this product.` });
    } catch (err: any) {
      toast({ title: "Failed to add images", description: err.message, variant: "destructive" });
    } finally {
      setPickerUploading(false);
    }
  };

  const handlePickerFiles = async (files: File[]) => {
    if (!files.length) return;
    setPickerUploading(true);
    try {
      const groupId = image.productGroupId ?? crypto.randomUUID();
      const uploaded = await uploadImagesMutation.mutateAsync({ files, groupAsOne: false, hideToast: true });
      const uploadedIds = (uploaded as { id: number }[]).map(img => img.id);
      if (uploadedIds.length > 0) {
        await Promise.all(uploadedIds.map(id =>
          apiRequest("PUT", buildUrl(api.images.update.path, { id }), { productGroupId: groupId })
        ));
        if (!image.productGroupId) {
          await apiRequest("PUT", buildUrl(api.images.update.path, { id: image.id }), { productGroupId: groupId });
        }
        queryClient.invalidateQueries({ queryKey: [api.images.list.path] });
        queryClient.invalidateQueries({ queryKey: ['/api/images/group'] });
      }
      setShowLibraryPicker(false);
      toast({ title: "Images uploaded", description: `${uploadedIds.length} image${uploadedIds.length !== 1 ? "s" : ""} added to this product.` });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setPickerUploading(false);
    }
  };

  const normalizePickerFiles = (files: FileList | File[]) => filterImageLikeFiles(files);

  const handleApplyBackground = () => {
    if (!bgEditKey) return;
    applyImageMutation.mutate(
      { id: image.id, bgKey: bgEditKey },
      {
        onSuccess: () => {
          setBgEditKey(null);
          setBgEditUrl(null);
          setImageKey(Date.now());
        }
      }
    );
  };

  const handleApplyConcept = (url: string) => {
    applyImageMutation.mutate({ id: image.id, imageUrl: url }, {
      onSuccess: () => {
        setImageKey(Date.now());
      }
    });
  };

  const applyBulkEdit = () => {
    setVariantRowData(prev => prev.map((row, i) => {
      if (!selectedVariantRows.has(i)) return row;
      return {
        price: bulkPrice !== "" ? bulkPrice : row.price,
        available: bulkAvailable !== "" ? Number(bulkAvailable) : row.available,
        sku: bulkSku !== "" ? bulkSku : row.sku,
      };
    }));
    setBulkPrice("");
    setBulkAvailable("");
    setBulkSku("");
    setSelectedVariantRows(new Set());
  };

  const handleSave = () => {
    updateMutation.mutate(
      {
        id: image.id,
        updates: {
          title,
          description,
          price,
          category,
          productType,
          seoTitle,
          seoDescription,
          altText,
          aeoSnippet,
          compareAtPrice,
          costPerItem,
          sku,
          barcode,
          trackQuantity: trackQuantity.toString(),
          inventoryQuantity,
          tags,
          aeoFaqs: aeoFaqs.map((f) => ({ question: f.q, answer: f.a })),
        },
      },
    );
  };

  return (
    <div className="h-screen bg-transparent flex flex-col overflow-hidden">
      {/* Glowing action bar */}
      <div className="sticky top-0 z-30 bg-background/60 backdrop-blur-xl hairline-b">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/")} className="h-8 w-8">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="font-display text-sm font-semibold truncate max-w-[200px] md:max-w-md">
              {title || "Unnamed Product"}
            </h1>
            {image.shopifyStatus === "synced" && (
              <Badge variant="secondary" className="bg-green-500/10 text-green-500 hover:bg-green-500/20 text-[10px] h-5 px-1.5 font-mono uppercase tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-breathe mr-1" />
                Synced
              </Badge>
            )}
            {image.etsyStatus === "synced" && (
              <Badge variant="secondary" className="bg-orange-500/10 text-orange-400 text-[10px] h-5 px-1.5 font-mono uppercase tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-breathe mr-1" />
                Etsy
              </Badge>
            )}
            {image.amazonStatus === "synced" && (
              <Badge variant="secondary" className="bg-amber-500/10 text-amber-400 text-[10px] h-5 px-1.5 font-mono uppercase tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-breathe mr-1" />
                Amazon
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isUnpaid && (
              <Button 
                variant="outline" 
                size="sm" 
                className={`h-8 text-[11px] px-2.5 ${image.shopifyStatus === 'synced' ? 'text-muted-foreground' : 'bg-[#95bf46]/10 text-[#95bf46] hover:bg-[#95bf46]/20 shadow-[inset_0_0_0_1px_rgb(149_191_70/0.3),0_0_20px_-8px_rgb(149_191_70/0.4)]'}`}
                onClick={() => pushToShopifyMutation.mutate([image.id])}
                disabled={pushToShopifyMutation.isPending}
              >
                {pushToShopifyMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Store className="w-3.5 h-3.5 mr-1.5" />
                )}
                {image.shopifyStatus === "synced" ? "Sync updates to Shopify" : "Push to Shopify"}
              </Button>
            )}
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setLocation("/")}>
              Discard
            </Button>
            <Button size="sm" className="h-8 text-xs" onClick={handleSave} disabled={updateMutation.isPending || isUnpaid}>
              {updateMutation.isPending ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <Check className="w-3 h-3 mr-1" />
              )}
              Save
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 max-w-6xl w-full mx-auto px-4 py-3 flex flex-col">
        {isUnpaid && (
          <div className="mb-3 shrink-0 p-3 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center gap-2">
            <Lock className="w-4 h-4 shrink-0" />
            <div>
              <p className="font-medium text-xs">This product is in preview mode.</p>
              <p className="text-[10px] opacity-80">
                Subscribe to unlock full descriptions, pricing, SEO metadata, and variants.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-1 min-h-0">
          {/* Main Content Column */}
          <div className="md:col-span-2 space-y-3 overflow-y-auto">
            {!isUnpaid && (
              <AiContentPanel
                imageId={image.id}
                defaultCategory={category}
                onAcceptTitle={(v) => setTitle(v)}
                onAcceptDescription={(v) => setDescription(v)}
                onAcceptTags={(v) => setTags(v)}
                onAcceptAeoFaqs={(v) => setAeoFaqs(v)}
              />
            )}
            <Card className="shadow-sm">
              <CardContent className="p-4 space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Title</label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={isUnpaid}
                    placeholder="Short sleeve t-shirt"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium">Description</label>
                    {!isUnpaid && (
                      <div className="flex items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 text-[10px] px-2 text-primary hover:text-primary hover:bg-primary/10"
                          onClick={() => rewriteDescriptionMutation.mutate({ id: image.id, tone: "professional" })}
                          disabled={rewriteDescriptionMutation.isPending}
                        >
                          {rewriteDescriptionMutation.isPending && rewriteDescriptionMutation.variables?.tone === 'professional' ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
                          Professional
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 text-[10px] px-2 text-primary hover:text-primary hover:bg-primary/10"
                          onClick={() => rewriteDescriptionMutation.mutate({ id: image.id, tone: "playful" })}
                          disabled={rewriteDescriptionMutation.isPending}
                        >
                          {rewriteDescriptionMutation.isPending && rewriteDescriptionMutation.variables?.tone === 'playful' ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
                          Fun
                        </Button>
                      </div>
                    )}
                  </div>
                  {rewriteDescriptionMutation.isPending ? (
                    <div className="space-y-1.5 rounded-lg p-3 bg-muted/20 shadow-[inset_0_0_0_1px_hsl(var(--aurora-2)/0.25)]">
                      <div className="h-3 w-full rounded animate-shimmer" />
                      <div className="h-3 w-11/12 rounded animate-shimmer" />
                      <div className="h-3 w-3/5 rounded animate-shimmer" />
                    </div>
                  ) : (
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      disabled={isUnpaid}
                      rows={3}
                      placeholder="Product description..."
                      className="resize-y text-sm"
                    />
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="px-4 py-3 hairline-b">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                  Pricing
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Price</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                      <Input
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        disabled={isUnpaid}
                        className="pl-6 h-8 text-sm"
                        placeholder="0.00"
                        type="number"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Compare-at price</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                      <Input
                        value={compareAtPrice}
                        onChange={(e) => setCompareAtPrice(e.target.value)}
                        disabled={isUnpaid}
                        className="pl-6 h-8 text-sm"
                        placeholder="0.00"
                        type="number"
                      />
                    </div>
                    <p className="text-[9px] text-muted-foreground pt-0.5 leading-none">To show a reduced price, move the original price here.</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Cost per item</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                      <Input
                        value={costPerItem}
                        onChange={(e) => setCostPerItem(e.target.value)}
                        disabled={isUnpaid}
                        className="pl-6 h-8 text-sm"
                        placeholder="0.00"
                        type="number"
                      />
                    </div>
                    <p className="text-[9px] text-muted-foreground pt-0.5 leading-none">Customers won't see this.</p>
                  </div>
                </div>

                {price && costPerItem && !isNaN(Number(price)) && !isNaN(Number(costPerItem)) && Number(price) > 0 && (
                  <div className="flex items-center gap-4 mt-2 p-2 bg-muted/50 rounded-md border border-border/50">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-muted-foreground">Profit</span>
                      <span className="text-xs font-medium">${(Number(price) - Number(costPerItem)).toFixed(2)}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-muted-foreground">Margin</span>
                      <span className="text-xs font-medium">{(((Number(price) - Number(costPerItem)) / Number(price)) * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="px-4 py-3 hairline-b">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Box className="w-3.5 h-3.5 text-muted-foreground" />
                  Inventory
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center space-x-2 pb-3 border-b border-border/50">
                  <Checkbox 
                    id="trackQuantity" 
                    checked={trackQuantity} 
                    onCheckedChange={(checked) => setTrackQuantity(checked as boolean)}
                    disabled={isUnpaid}
                    className="w-4 h-4"
                  />
                  <label
                    htmlFor="trackQuantity"
                    className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Track quantity
                  </label>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">SKU (Stock Keeping Unit)</label>
                    <Input
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      disabled={isUnpaid}
                      placeholder="e.g. TSHIRT-RED-L"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Barcode (ISBN, UPC, GTIN, etc.)</label>
                    <Input
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                      disabled={isUnpaid}
                      placeholder="000000000000"
                      className="h-8 text-sm"
                    />
                  </div>
                </div>

                {trackQuantity && (
                  <div className="space-y-1.5 pt-3 border-t border-border/50 mt-1">
                    <label className="text-xs font-medium flex items-center gap-2 text-foreground">
                      Quantity available
                    </label>
                    <Input
                      type="number"
                      value={inventoryQuantity}
                      onChange={(e) => setInventoryQuantity(Number(e.target.value))}
                      disabled={isUnpaid}
                      className="max-w-[120px] h-8 text-sm"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between px-4 py-3 hairline-b">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Box className="w-3.5 h-3.5 text-muted-foreground" />
                  Variants
                </CardTitle>
                <Button variant="ghost" size="sm" disabled={isUnpaid} className="h-6 text-[11px] text-primary px-2">
                  <Plus className="w-3 h-3 mr-1" />
                  Add options
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {variants.length > 0 ? (
                  <>
                    {/* Option groups summary */}
                    <div className="px-4 py-3 space-y-2 border-b border-border/50">
                      {variants.map((v, i) => (
                        <div key={i} className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-medium text-muted-foreground w-12 shrink-0">{v.name}</span>
                          <div className="flex flex-wrap gap-1">
                            {v.values.map((val: string) => (
                              <Badge key={val} variant="secondary" className="text-[10px] h-5 px-1.5 font-normal">{val}</Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Bulk edit bar */}
                    {selectedVariantRows.size > 0 && (
                      <div className="flex items-center gap-2 px-4 py-2 bg-primary/5 border-b border-border/50 flex-wrap">
                        <span className="text-xs font-medium text-primary shrink-0">{selectedVariantRows.size} selected</span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Input
                            value={bulkPrice}
                            onChange={(e) => setBulkPrice(e.target.value)}
                            placeholder="Price"
                            className="h-7 w-20 text-xs"
                            type="number"
                          />
                          <Input
                            value={bulkAvailable}
                            onChange={(e) => setBulkAvailable(e.target.value)}
                            placeholder="Qty"
                            className="h-7 w-16 text-xs"
                            type="number"
                          />
                          <Input
                            value={bulkSku}
                            onChange={(e) => setBulkSku(e.target.value)}
                            placeholder="SKU"
                            className="h-7 w-28 text-xs"
                          />
                          <Button size="sm" className="h-7 text-xs px-3" onClick={applyBulkEdit}>
                            Apply
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs px-2 text-muted-foreground"
                            onClick={() => setSelectedVariantRows(new Set())}
                          >
                            Clear
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Combinations table */}
                    <Table className="text-xs">
                      <TableHeader>
                        <TableRow className="h-8">
                          <TableHead className="h-8 py-1 w-8">
                            <Checkbox
                              checked={variantCombos.length > 0 && selectedVariantRows.size === variantCombos.length}
                              onCheckedChange={(checked) => {
                                if (checked) setSelectedVariantRows(new Set(variantCombos.map((_, i) => i)));
                                else setSelectedVariantRows(new Set());
                              }}
                              className="w-3.5 h-3.5"
                            />
                          </TableHead>
                          <TableHead className="h-8 py-1">Variant</TableHead>
                          <TableHead className="h-8 py-1">Price</TableHead>
                          <TableHead className="h-8 py-1">Available</TableHead>
                          <TableHead className="h-8 py-1">SKU</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {variantCombos.map((combo, i) => {
                          const label = combo.join(" / ");
                          const skuSuffix = combo.map((v: string) => v.toUpperCase().replace(/\s/g, "")).join("-");
                          const row = variantRowData[i];
                          const isSelected = selectedVariantRows.has(i);
                          return (
                            <TableRow key={i} className={`h-10 ${isSelected ? "bg-primary/5" : ""}`}>
                              <TableCell className="py-1 w-8">
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={(checked) => {
                                    setSelectedVariantRows(prev => {
                                      const next = new Set(prev);
                                      if (checked) next.add(i); else next.delete(i);
                                      return next;
                                    });
                                  }}
                                  className="w-3.5 h-3.5"
                                />
                              </TableCell>
                              <TableCell className="font-medium whitespace-nowrap py-1">{label}</TableCell>
                              <TableCell className="py-1">
                                <Input
                                  value={row?.price ?? price}
                                  onChange={(e) => setVariantRowData(prev => prev.map((r, j) => j === i ? { ...r, price: e.target.value } : r))}
                                  disabled={isUnpaid}
                                  className="h-7 w-20 text-xs"
                                  type="number"
                                />
                              </TableCell>
                              <TableCell className="py-1">
                                <Input
                                  type="number"
                                  value={row?.available ?? inventoryQuantity}
                                  onChange={(e) => setVariantRowData(prev => prev.map((r, j) => j === i ? { ...r, available: Number(e.target.value) } : r))}
                                  disabled={isUnpaid}
                                  className="h-7 w-16 text-xs"
                                />
                              </TableCell>
                              <TableCell className="py-1">
                                <Input
                                  value={row?.sku ?? (sku ? `${sku}-${skuSuffix}` : skuSuffix)}
                                  onChange={(e) => setVariantRowData(prev => prev.map((r, j) => j === i ? { ...r, sku: e.target.value } : r))}
                                  disabled={isUnpaid}
                                  className="h-7 min-w-[100px] text-xs"
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </>
                ) : (
                  <div className="p-4 text-xs text-muted-foreground">
                    This product has no variants. Click the button above to add options like size or color.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="px-4 py-3 hairline-b flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  Media ({productImages.length} {productImages.length === 1 ? "image" : "images"})
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[11px] px-2 text-primary hover:text-primary hover:bg-primary/10"
                  onClick={() => setShowLibraryPicker(true)}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add from Library
                </Button>
              </CardHeader>

              {/* Library picker dialog — redesigned */}
              <Dialog open={showLibraryPicker} onOpenChange={(open) => { setShowLibraryPicker(open); if (!open) { setPickerSelected(new Set()); setPickerSearch(""); setPickerTab("library"); setPickerDragActive(false); } }}>
                <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
                  {/* Header */}
                  <div className="px-6 pt-5 pb-4 border-b border-border/50 shrink-0">
                    <DialogTitle className="text-base font-semibold">Add images to this product</DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                      Pick from your library or upload new images — they'll be added instantly.
                    </DialogDescription>
                  </div>

                  {/* Tabs */}
                  <div className="flex border-b border-border/50 shrink-0 bg-muted/20">
                    <button
                      onClick={() => setPickerTab("library")}
                      className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${pickerTab === "library" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                    >
                      <ImageIcon className="w-4 h-4" />
                      Library
                      {(images as Image[] | undefined)?.filter(img => !productImages.some(p => p.id === img.id)).length
                        ? <span className="ml-1 text-[10px] bg-muted px-1.5 py-0.5 rounded-full">{(images as Image[] | undefined)?.filter(img => !productImages.some(p => p.id === img.id)).length}</span>
                        : null}
                    </button>
                    <button
                      onClick={() => setPickerTab("upload")}
                      className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${pickerTab === "upload" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                    >
                      <UploadCloud className="w-4 h-4" />
                      Upload New
                    </button>
                  </div>

                  {/* Library tab */}
                  {pickerTab === "library" && (() => {
                    const availableImages = (images as Image[] | undefined)?.filter(img => !productImages.some(p => p.id === img.id)) ?? [];
                    const filtered = pickerSearch.trim()
                      ? availableImages.filter(img => (img.originalName || "").toLowerCase().includes(pickerSearch.toLowerCase()) || (img.title || "").toLowerCase().includes(pickerSearch.toLowerCase()))
                      : availableImages;
                    return (
                      <>
                        {/* Search bar */}
                        <div className="px-4 py-3 shrink-0 border-b border-border/30">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                            <input
                              type="text"
                              placeholder="Search images by name or title…"
                              value={pickerSearch}
                              onChange={e => setPickerSearch(e.target.value)}
                              className="w-full h-9 pl-9 pr-3 bg-muted/50 border border-border rounded-md text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                            />
                          </div>
                        </div>

                        {/* Grid */}
                        <div className="flex-1 overflow-y-auto px-4 py-4">
                          {filtered.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center gap-3">
                              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                                <ImageIcon className="w-7 h-7 text-muted-foreground/40" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-foreground">{pickerSearch ? "No results" : "Library is empty"}</p>
                                <p className="text-xs text-muted-foreground mt-1">{pickerSearch ? "Try a different search" : "Switch to Upload to add new images"}</p>
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
                              {filtered.map(img => {
                                const isSel = pickerSelected.has(img.id);
                                return (
                                  <div
                                    key={img.id}
                                    onClick={() => togglePickerSelect(img.id)}
                                    className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all select-none ${isSel ? "border-primary ring-2 ring-primary/40 scale-[0.97]" : "border-border hover:border-primary/50 hover:scale-[0.98]"}`}
                                  >
                                    <img
                                      src={productImageSrc(img, proxyImageIds.has(img.id))}
                                      alt={img.originalName || "Image"}
                                      className="w-full h-full object-cover"
                                      loading="lazy"
                                      onError={() => handleImageLoadError(img.id)}
                                    />
                                    {/* Checkmark overlay */}
                                    {isSel && (
                                      <div className="absolute inset-0 bg-primary/20 flex items-start justify-end p-1.5">
                                        <div className="w-5 h-5 rounded-full bg-primary shadow flex items-center justify-center">
                                          <Check className="w-3 h-3 text-white" />
                                        </div>
                                      </div>
                                    )}
                                    {/* Name label */}
                                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-2 py-2">
                                      <p className="text-[9px] text-white font-medium truncate leading-tight">{img.title || img.originalName || `Image ${img.id}`}</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Footer */}
                        <div className="px-4 py-3 border-t border-border/50 shrink-0 flex items-center justify-between bg-muted/10">
                          <span className="text-xs text-muted-foreground">
                            {pickerSelected.size > 0 ? `${pickerSelected.size} image${pickerSelected.size !== 1 ? "s" : ""} selected` : "Click images to select"}
                          </span>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setShowLibraryPicker(false)}>Cancel</Button>
                            <Button
                              size="sm"
                              disabled={pickerSelected.size === 0 || assignMultipleMutation.isPending}
                              onClick={handleAddSelected}
                              className="min-w-[100px]"
                            >
                              {assignMultipleMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <>
                                <Plus className="w-3.5 h-3.5 mr-1" />
                                Add {pickerSelected.size > 0 ? `${pickerSelected.size} ` : ""}image{pickerSelected.size !== 1 ? "s" : ""}
                              </>}
                            </Button>
                          </div>
                        </div>
                      </>
                    );
                  })()}

                  {/* Upload tab */}
                  {pickerTab === "upload" && (
                    <div className="flex-1 flex flex-col items-center justify-center px-8 py-8 gap-5">
                      <input
                        ref={uploadInputRef}
                        type="file"
                        multiple
                        accept="image/*"
                        className="hidden"
                        onChange={e => {
                          const files = normalizePickerFiles(e.target.files ?? []);
                          if (files.length) {
                            handlePickerFiles(files);
                          } else {
                            toast({ title: "No valid images found", description: "Please upload PNG, JPG, WEBP, GIF, HEIC, or AVIF files.", variant: "destructive" });
                          }
                          e.target.value = "";
                        }}
                      />
                      <div
                        className={`w-full max-w-md border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${pickerUploading ? "border-primary/50 bg-primary/5 cursor-default" : pickerDragActive ? "border-primary bg-primary/10" : "border-border hover:border-primary/60 hover:bg-primary/5"}`}
                        onDragOver={e => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!pickerUploading) setPickerDragActive(true);
                        }}
                        onDragLeave={e => {
                          e.preventDefault();
                          e.stopPropagation();
                          setPickerDragActive(false);
                        }}
                        onDrop={e => {
                          e.preventDefault();
                          e.stopPropagation();
                          setPickerDragActive(false);
                          if (pickerUploading) return;
                          const files = normalizePickerFiles(e.dataTransfer.files);
                          if (files.length) {
                            handlePickerFiles(files);
                          } else {
                            toast({ title: "No valid images found", description: "Please drop image files (PNG, JPG, WEBP, GIF, HEIC, AVIF).", variant: "destructive" });
                          }
                        }}
                        onClick={() => { if (!pickerUploading) uploadInputRef.current?.click(); }}
                      >
                        {pickerUploading ? (
                          <div className="flex flex-col items-center gap-4">
                            <Loader2 className="w-12 h-12 text-primary animate-spin" />
                            <div>
                              <p className="text-sm font-medium">Uploading & analyzing…</p>
                              <p className="text-xs text-muted-foreground mt-1">Adding to this product when done</p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                              <UploadCloud className="w-8 h-8 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold">Drop images here</p>
                              <p className="text-xs text-muted-foreground mt-1">or click to browse your device</p>
                            </div>
                            <Button size="sm" variant="outline" className="pointer-events-none">
                              <ImagePlus className="w-3.5 h-3.5 mr-1.5" />
                              Choose Files
                            </Button>
                            <p className="text-[10px] text-muted-foreground">PNG, JPG, WEBP · up to 10 MB each</p>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground text-center max-w-xs">
                        Images are uploaded with AI analysis and automatically added to this product's media gallery.
                      </p>
                    </div>
                  )}
                </DialogContent>
              </Dialog>

              <CardContent className="p-4 space-y-4">
                {/* All product images grid — always visible */}
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {productImages.map((img, index) => (
                    <div
                      key={img.id}
                      draggable={!isUnpaid}
                      className={`relative group/thumb rounded-lg overflow-hidden border-2 aspect-square cursor-grab active:cursor-grabbing transition-all ${
                        displayImageId === img.id
                          ? "border-primary ring-2 ring-primary/30"
                          : dragOverImageId === img.id
                            ? "border-primary/70 ring-2 ring-primary/20 scale-[0.98]"
                          : "border-border hover:border-foreground/30"
                      }`}
                      onDragStart={(e) => {
                        if (isUnpaid) return;
                        setDraggedImageId(img.id);
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("application/x-product-image-id", String(img.id));
                        e.dataTransfer.setData("text/plain", String(img.id));
                      }}
                      onDragOver={(e) => {
                        if (isUnpaid || draggedImageId === img.id) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        setDragOverImageId(img.id);
                      }}
                      onDragLeave={() => {
                        setDragOverImageId((current) => current === img.id ? null : current);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const droppedId = getDraggedImageId(e);
                        setDraggedImageId(null);
                        setDragOverImageId(null);
                        if (!droppedId || droppedId === img.id || isUnpaid) return;
                        moveImageToIndex(droppedId, index);
                      }}
                      onDragEnd={() => {
                        setDraggedImageId(null);
                        setDragOverImageId(null);
                        setThumbnailDragActive(false);
                      }}
                      onClick={() => { setSelectedImageId(img.id); setBgEditUrl(null); setBgEditKey(null); }}
                    >
                      <img
                        src={productImageSrc(img, proxyImageIds.has(img.id))}
                        alt={img.originalName || "Product view"}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={() => handleImageLoadError(img.id)}
                      />
                      <div className="absolute top-1.5 left-1.5 flex items-center gap-1 rounded-full bg-black/60 px-1.5 py-1 text-white shadow-sm opacity-0 group-hover/thumb:opacity-100 transition-opacity">
                        <GripVertical className="w-3 h-3" />
                        <span className="text-[9px] font-medium tabular-nums">{index + 1}</span>
                      </div>
                      {/* Remove from product button on hover — unlinks image back to library */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (displayImageId === img.id) {
                            const next = productImages.find((p) => p.id !== img.id);
                            if (next) setSelectedImageId(next.id);
                            else setLocation("/"); // last image removed — go back to library
                          }
                          unlinkFromGroupMutation.mutate(img.id);
                        }}
                        disabled={unlinkFromGroupMutation.isPending}
                        className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity hover:bg-destructive/90 shadow-sm"
                        title="Remove from product (returns to library)"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      {/* File name label */}
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-0.5 opacity-0 group-hover/thumb:opacity-100 transition-opacity">
                        <p className="text-[9px] text-white truncate">{img.originalName || `Image ${img.id}`}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Selected image large preview with AI tools */}
                {displayImageId && (
                  <>
                    <TiltFrame className="w-full">
                    <div
                      className={`relative w-full h-44 bg-muted/40 rounded-xl overflow-hidden transition-all shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.06),0_16px_40px_-16px_hsl(250_25%_2%/0.6)] ${thumbnailDragActive ? "ring-2 ring-primary/50 bg-primary/5" : ""}`}
                      onDragOver={(e) => {
                        if (isUnpaid) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        setThumbnailDragActive(true);
                      }}
                      onDragLeave={() => setThumbnailDragActive(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setThumbnailDragActive(false);
                        setDraggedImageId(null);
                        setDragOverImageId(null);
                        const droppedId = getDraggedImageId(e);
                        if (!droppedId || isUnpaid) return;
                        moveImageToIndex(droppedId, 0);
                      }}
                    >
                      <img
                        src={bgEditUrl ?? productImageSrc(displayImage, proxyImageIds.has(displayImage.id), imageKey)}
                        alt={image.altText || image.title || "Product Image"}
                        className="w-full h-full object-contain"
                        onError={() => handleImageLoadError(displayImage.id)}
                      />
                      {thumbnailDragActive && (
                        <div className="absolute inset-0 z-20 bg-background/70 backdrop-blur-sm flex items-center justify-center">
                          <div className="rounded-md border border-primary/40 bg-background px-3 py-2 text-xs font-medium text-primary shadow-sm">
                            Drop to make thumbnail
                          </div>
                        </div>
                      )}

                      {editBackgroundMutation.isPending && (
                        <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex flex-col items-center justify-center z-30 gap-2">
                          <Wand2 className="w-6 h-6 text-primary animate-pulse" />
                          <span className="text-xs font-medium">Editing background…</span>
                        </div>
                      )}

                      {showBgPicker && AI_BG_REMOVAL_ENABLED && !editBackgroundMutation.isPending && !applyImageMutation.isPending && (
                        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-30 flex flex-col items-center justify-center gap-3 p-3">
                          <p className="text-sm font-semibold">Select Background</p>
                          <div className="flex flex-wrap gap-2 justify-center max-w-[250px]">
                            {BG_STYLES.map((s) => (
                              <button
                                key={s.key}
                                onClick={() => handleEditBackground(s.key)}
                                className="flex flex-col items-center gap-1 group/btn"
                                title={s.label}
                              >
                                <span
                                  className="w-8 h-8 rounded-full border border-border group-hover/btn:border-primary group-hover/btn:scale-110 transition-all block shadow-sm"
                                  style={{ background: s.color }}
                                />
                                <span className="text-[10px] text-muted-foreground group-hover/btn:text-foreground">{s.label}</span>
                              </button>
                            ))}
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => setShowBgPicker(false)} className="mt-2 h-7 text-xs">Cancel</Button>
                        </div>
                      )}

                      {bgEditUrl && !showBgPicker && !editBackgroundMutation.isPending && (
                        <div className="absolute bottom-2 left-0 w-full flex justify-center z-20">
                          <Button
                            size="sm"
                            onClick={handleApplyBackground}
                            disabled={applyImageMutation.isPending}
                            className="shadow-lg"
                          >
                            {applyImageMutation.isPending ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <Check className="w-4 h-4 mr-2" />
                            )}
                            Save as Product Image
                          </Button>
                        </div>
                      )}
                    </div>
                    </TiltFrame>

                    {!isUnpaid && (
                      <div className="flex items-center gap-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="flex-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className={`w-full ${AI_BG_REMOVAL_ENABLED && showBgPicker ? 'border-primary/50 text-primary bg-primary/5' : ''} ${!AI_BG_REMOVAL_ENABLED ? 'opacity-50 cursor-not-allowed' : ''}`}
                                  onClick={() => AI_BG_REMOVAL_ENABLED && setShowBgPicker(v => !v)}
                                  disabled={!AI_BG_REMOVAL_ENABLED || editBackgroundMutation.isPending || applyImageMutation.isPending}
                                >
                                  <Wand2 className="w-4 h-4 mr-2" />
                                  AI Background
                                  {!AI_BG_REMOVAL_ENABLED && <span className="ml-1.5 text-[9px] font-medium text-muted-foreground">SOON</span>}
                                </Button>
                              </span>
                            </TooltipTrigger>
                            {!AI_BG_REMOVAL_ENABLED && (
                              <TooltipContent side="top">
                                <p className="text-xs">Coming soon</p>
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </TooltipProvider>

                        <Dialog>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="flex-1">
                                  <DialogTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className={`w-full text-yellow-600 hover:text-yellow-700 hover:bg-yellow-100/50 ${!AI_PHOTOSHOOT_ENABLED ? 'opacity-50 cursor-not-allowed text-muted-foreground hover:text-muted-foreground hover:bg-transparent' : ''}`}
                                      disabled={!AI_PHOTOSHOOT_ENABLED}
                                    >
                                      <ImageIcon className="w-4 h-4 mr-2" />
                                      AI Photoshoot
                                      {!AI_PHOTOSHOOT_ENABLED && <span className="ml-1.5 text-[9px] font-medium">SOON</span>}
                                    </Button>
                                  </DialogTrigger>
                                </span>
                              </TooltipTrigger>
                              {!AI_PHOTOSHOOT_ENABLED && (
                                <TooltipContent side="top">
                                  <p className="text-xs">Coming soon</p>
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </TooltipProvider>
                          <DialogContent className="max-w-3xl">
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
                                    <div key={i} className="relative group/concept rounded-lg overflow-hidden border aspect-square">
                                      <img src={url} alt="Generated Concept" className="w-full h-full object-cover" loading="lazy" />
                                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/concept:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                                        <Button
                                          size="sm"
                                          className="w-[140px]"
                                          onClick={() => handleApplyConcept(url)}
                                          disabled={applyImageMutation.isPending}
                                        >
                                          <Check className="w-3.5 h-3.5 mr-1.5" />
                                          Set as Product
                                        </Button>
                                        <Button size="sm" variant="secondary" onClick={() => window.open(url, '_blank')} className="w-[140px]">
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
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar Column */}
          <div className="space-y-3 overflow-y-auto">
            <Card className="shadow-sm">
              <CardHeader className="px-4 py-3 hairline-b">
                <CardTitle className="text-sm font-medium">Status</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isUnpaid ? 'bg-amber-400' : 'bg-green-500'}`} />
                  <span className="text-xs font-medium">{isUnpaid ? "Preview" : "Active"}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="px-4 py-3 hairline-b">
                <CardTitle className="text-sm font-medium">Organization</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Product category</label>
                  <Select
                    value={category}
                    onValueChange={setCategory}
                    disabled={isUnpaid}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Apparel & Accessories">Apparel & Accessories</SelectItem>
                      <SelectItem value="Home & Garden">Home & Garden</SelectItem>
                      <SelectItem value="Electronics">Electronics</SelectItem>
                      <SelectItem value="Health & Beauty">Health & Beauty</SelectItem>
                      <SelectItem value="Toys & Games">Toys & Games</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Product type</label>
                  <Input
                    value={productType}
                    onChange={(e) => setProductType(e.target.value)}
                    disabled={isUnpaid}
                    placeholder="e.g. T-Shirt"
                    className="h-8 text-sm"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="px-4 py-3 hairline-b">
                <CardTitle className="text-sm font-medium">Search engine listing</CardTitle>
                <CardDescription className="text-[10px]">Edit how your product shows up in search results.</CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {/* Google Snippet Preview */}
                <div className="p-3 bg-background border rounded-md font-sans mb-2">
                  <div className="text-[10px] text-[#202124] mb-1 flex items-center gap-1 opacity-70">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary/20 flex items-center justify-center text-[6px]">S</span>
                    yourstore.com › products › {title.toLowerCase().replace(/[^a-z0-9]/g, '-')}
                  </div>
                  <div className="text-[#1a0dab] text-[15px] leading-[1.2] hover:underline cursor-pointer truncate">
                    {seoTitle || title || "Your Product Title"}
                  </div>
                  <div className="text-[#4d5156] text-[11px] leading-[1.5] mt-1 line-clamp-2">
                    {seoDescription || description?.slice(0, 160) || "Add a description to see how it will display to customers in search results. This helps click-through rates."}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-medium">Page Title</label>
                    <span className="text-[10px] text-muted-foreground">{seoTitle.length} / 70</span>
                  </div>
                  <Input
                    value={seoTitle}
                    onChange={(e) => setSeoTitle(e.target.value)}
                    disabled={isUnpaid}
                    maxLength={70}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-medium">Meta Description</label>
                    <span className="text-[10px] text-muted-foreground">{seoDescription.length} / 320</span>
                  </div>
                  <Textarea
                    value={seoDescription}
                    onChange={(e) => setSeoDescription(e.target.value)}
                    disabled={isUnpaid}
                    rows={3}
                    maxLength={320}
                    className="resize-none text-sm"
                  />
                </div>
                {tags.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">SEO Keywords</label>
                    <div className="flex flex-wrap gap-1">
                      {tags.map((t, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px] h-5 px-1.5 font-normal">{t}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
