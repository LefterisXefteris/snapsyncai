import { useState, useEffect, useRef, type DragEvent } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useImages, useProductGroup, useAssignToGroup, useAssignMultipleToGroup, useUnlinkFromGroup, useUpdateImage, useDeleteImage, usePushToShopify, useUploadImages, useConfirmProductFacts, useShopifyStatus, useSaveShopGpsrIdentity } from "@/hooks/use-images";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { filterImageLikeFiles } from "@/lib/image-file-utils";
import { api, buildUrl } from "@/lib/api-routes";
import { apiUrl } from "@/lib/api-origin";
import { productFacts, draftComposition, EU_FIBRE_NAMES, OTHER_FIBRE, emptyGpsrIdentity, isCompleteGpsr, emptyCare, isCompleteCare, CARE_FAMILIES, CARE_PICKS, type FibreRowDraft, type GpsrChoice, type GpsrIdentity, type CareChoice, type CareInstructions } from "@/lib/product-facts";
import type { Image } from "@/lib/image";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Check, Lock, Loader2, ImageIcon, Plus, ImagePlus, Store, X, UploadCloud, Search, GripVertical } from "lucide-react";
import { AiContentPanel } from "@/components/ai-content-panel";
import { GpsrIdentityFields } from "@/components/gpsr-identity-fields";
import {
  PRODUCT_EDITOR_DETAILS_TITLE,
  PRODUCT_EDITOR_FACTS_TITLE,
  PRODUCT_EDITOR_LISTING_COPY_TITLE,
  PRODUCT_EDITOR_SELLING_TITLE,
  PRODUCT_EDITOR_WORK,
  UNPAID_PREVIEW_DETAIL,
  UNPAID_PREVIEW_TITLE,
  productEditorShowsVariants,
} from "@/lib/product-editor-copy";

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
  return apiUrl(`/api/images/${image.id}/file?${params.toString()}`);
}

export default function ProductDetails({ params }: { params: { id: string } }) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: images, isLoading } = useImages();
  const updateMutation = useUpdateImage();
  const pushToShopifyMutation = usePushToShopify();
  const confirmFactsMutation = useConfirmProductFacts();
  const { data: shopifyStatus } = useShopifyStatus();
  const saveShopGpsr = useSaveShopGpsrIdentity();

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
  const [draggedImageId, setDraggedImageId] = useState<number | null>(null);
  const [dragOverImageId, setDragOverImageId] = useState<number | null>(null);
  const [thumbnailDragActive, setThumbnailDragActive] = useState(false);
  const [proxyImageIds, setProxyImageIds] = useState<Set<number>>(new Set());
  const [compositionRows, setCompositionRows] = useState<FibreRowDraft[]>([
    { name: "cotton", percent: "", otherName: "" },
  ]);
  const [gpsrChoice, setGpsrChoice] = useState<GpsrChoice | "">("");
  const [gpsrDraft, setGpsrDraft] = useState<GpsrIdentity>(emptyGpsrIdentity());
  const [shopGpsrDraft, setShopGpsrDraft] = useState<GpsrIdentity>(emptyGpsrIdentity());
  const [careChoice, setCareChoice] = useState<CareChoice | "">("");
  const [careDraft, setCareDraft] = useState<CareInstructions>(emptyCare());

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
      setCompositionRows(draftComposition(productFacts(image)));
    }
  }, [image]);

  useEffect(() => {
    const identity = shopifyStatus?.gpsrIdentity as GpsrIdentity | undefined;
    if (identity && isCompleteGpsr(identity)) {
      setShopGpsrDraft(identity);
      setGpsrChoice((current) => (current === "" ? "shop_default" : current));
    }
  }, [shopifyStatus?.gpsrIdentity]);

  const variants = Array.isArray(image?.variants) ? (image.variants as { name: string; values: string[] }[]) : [];
  const mediaGallery = Array.isArray(image?.mediaGallery) ? (image.mediaGallery as string[]) : [];
  const productImages = orderProductImages(rawProductImages, mediaGallery);
  const displayImage = productImages.find((img) => img.id === displayImageId) ?? image;

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
  const facts = productFacts(image);
  const canGenerate = image.mayGenerateListingCopy === true;
  const shopGpsr = (shopifyStatus?.gpsrIdentity ?? null) as GpsrIdentity | null;
  const shopConnected = Boolean(shopifyStatus?.connected);
  const shopHasGpsr = isCompleteGpsr(shopGpsr);

  const gpsrConfirmFields = {
    gpsrChoice: gpsrChoice as GpsrChoice,
    gpsrIdentity: gpsrChoice === "override" ? gpsrDraft : undefined,
  };
  const gpsrReady =
    gpsrChoice === "skip" ||
    (gpsrChoice === "shop_default" && shopHasGpsr) ||
    (gpsrChoice === "override" && isCompleteGpsr(gpsrDraft));
  const careConfirmFields = {
    careChoice: careChoice as CareChoice,
    care: careChoice === "fill" ? careDraft : undefined,
  };
  const careReady =
    careChoice === "skip" || (careChoice === "fill" && isCompleteCare(careDraft));

  const persistMediaOrder = async (orderedIds: number[], primaryId?: number) => {
    if (!image || orderedIds.length === 0) return;
    const mediaGallery = orderedIds.map(String);
    try {
      await Promise.all(productImages.map((productImage) =>
        apiRequest("PUT", buildUrl(api.images.update.path, { id: productImage.id }), { mediaGallery })
      ));
      if (primaryId) {
        setSelectedImageId(primaryId);
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
            <h1 className="font-display text-sm font-semibold truncate min-w-0">
              {title || "Unnamed Product"}
            </h1>
            {image.shopifyStatus === "synced" && (
              <Badge variant="secondary" className="bg-green-500/10 text-green-500 hover:bg-green-500/20 text-[10px] h-5 px-1.5 font-mono uppercase tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-breathe mr-1" />
                Synced
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
        <div className="grid grid-cols-1 md:grid-cols-[minmax(16rem,1fr)_minmax(0,1.7fr)] gap-4 flex-1 min-h-0">
          <div className="md:sticky md:top-0 md:self-start space-y-3 overflow-y-auto md:max-h-full order-first">
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
                {/* Selected image large preview */}
                {displayImageId && (
                  <div
                    className={`relative w-full aspect-[4/5] max-h-[28rem] bg-muted/40 rounded-xl overflow-hidden transition-all shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.06),0_16px_40px_-16px_hsl(250_25%_2%/0.6)] ${thumbnailDragActive ? "ring-2 ring-primary/50 bg-primary/5" : ""}`}
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
                        src={productImageSrc(displayImage, proxyImageIds.has(displayImage.id))}
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
                    </div>
                )}

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
                      onClick={() => { setSelectedImageId(img.id); }}
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

              </CardContent>
            </Card>
          </div>
          <div className="space-y-4 overflow-y-auto min-h-0">
            {isUnpaid && (
              <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center gap-2">
                <Lock className="w-4 h-4 shrink-0" />
                <div>
                  <p className="font-medium text-xs">{UNPAID_PREVIEW_TITLE}</p>
                  <p className="text-xs opacity-80">
                    {UNPAID_PREVIEW_DETAIL}
                  </p>
                </div>
              </div>
            )}
            {image.listingCopyStale && (
              <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-500">
                <p className="font-medium text-xs">Listing copy no longer matches the confirmed facts.</p>
                <p className="text-xs opacity-80">
                  Generate again to update it. Existing title and description are unchanged.
                </p>
              </div>
            )}
            <Card className="shadow-sm">
                <CardHeader className="px-4 py-3">
                  <CardTitle className="text-sm font-medium">{PRODUCT_EDITOR_FACTS_TITLE}</CardTitle>
                  <CardDescription className="text-xs">
                    Confirm this is not a textile, or enter fibre composition that sums to 100% and care instructions (or explicitly skip care instructions).
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                  {facts?.suggested?.isTextile === true && (
                    <p className="text-xs text-muted-foreground">
                      Vision suggests this may be a textile. Confirm if it is not, or enter composition.
                    </p>
                  )}
                  {facts?.suggested?.isTextile === false && (
                    <p className="text-xs text-muted-foreground">
                      Vision suggests this is not a textile.
                    </p>
                  )}
                  <div className="space-y-2 pt-1">
                    <label className="text-xs font-medium">GPSR identity</label>
                    <Select
                      value={gpsrChoice || undefined}
                      onValueChange={(value) => setGpsrChoice(value as GpsrChoice)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Choose skip, shop default, or enter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="skip">Skip — omit from the listing</SelectItem>
                        {shopConnected && (
                          <SelectItem value="shop_default" disabled={!shopHasGpsr}>
                            Use shop default{shopHasGpsr ? "" : " (save a shop default first)"}
                          </SelectItem>
                        )}
                        <SelectItem value="override">
                          {shopConnected ? "Override for this product" : "Enter for this product"}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {gpsrChoice === "override" && (
                      <GpsrIdentityFields value={gpsrDraft} onChange={setGpsrDraft} />
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() =>
                      confirmFactsMutation.mutate({
                        imageId: image.id,
                        isTextile: false,
                        ...gpsrConfirmFields,
                      })
                    }
                    disabled={confirmFactsMutation.isPending || !gpsrReady}
                  >
                    {confirmFactsMutation.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : null}
                    Confirm: not a textile
                  </Button>
                  <div className="space-y-2 pt-1">
                    <label className="text-xs font-medium">Fibre composition</label>
                    {compositionRows.map((row, index) => (
                      <div key={index} className="flex flex-wrap items-center gap-2">
                        <Select
                          value={row.name}
                          onValueChange={(name) => {
                            setCompositionRows((rows) =>
                              rows.map((item, i) => (i === index ? { ...item, name } : item))
                            );
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs w-[160px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {EU_FIBRE_NAMES.map((name) => (
                              <SelectItem key={name} value={name}>{name}</SelectItem>
                            ))}
                            <SelectItem value={OTHER_FIBRE}>{OTHER_FIBRE}</SelectItem>
                          </SelectContent>
                        </Select>
                        {row.name === OTHER_FIBRE && (
                          <Input
                            value={row.otherName}
                            onChange={(e) => {
                              const otherName = e.target.value;
                              setCompositionRows((rows) =>
                                rows.map((item, i) => (i === index ? { ...item, otherName } : item))
                              );
                            }}
                            placeholder="Fibre name"
                            className="h-8 text-xs w-[140px]"
                          />
                        )}
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          value={row.percent}
                          onChange={(e) => {
                            const percent = e.target.value;
                            setCompositionRows((rows) =>
                              rows.map((item, i) => (i === index ? { ...item, percent } : item))
                            );
                          }}
                          placeholder="%"
                          className="h-8 text-xs w-[72px]"
                        />
                        {compositionRows.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setCompositionRows((rows) => rows.filter((_, i) => i !== index))}
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <div className="flex items-center justify-between gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() =>
                          setCompositionRows((rows) => [...rows, { name: "cotton", percent: "", otherName: "" }])
                        }
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Add fibre
                      </Button>
                      <p className="text-[11px] text-muted-foreground font-mono">
                        {compositionRows.reduce((sum, row) => sum + (Number(row.percent) || 0), 0)} / 100
                      </p>
                    </div>
                    <div className="space-y-2 pt-1">
                      <label className="text-xs font-medium">Care instructions</label>
                      <Select
                        value={careChoice || undefined}
                        onValueChange={(value) => setCareChoice(value as CareChoice)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Fill all five, or skip" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="skip">Skip — omit from the listing</SelectItem>
                          <SelectItem value="fill">Enter care instructions</SelectItem>
                        </SelectContent>
                      </Select>
                      {careChoice === "fill" &&
                        CARE_FAMILIES.map(({ key, label }) => (
                          <div key={key} className="space-y-1">
                            <label className="text-[11px] text-muted-foreground">{label}</label>
                            <Select
                              value={careDraft[key] || undefined}
                              onValueChange={(code) =>
                                setCareDraft((current) => ({ ...current, [key]: code }))
                              }
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder={`Choose ${label.toLowerCase()}`} />
                              </SelectTrigger>
                              <SelectContent>
                                {CARE_PICKS[key].map((pick) => (
                                  <SelectItem key={pick.code} value={pick.code}>
                                    {pick.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                    </div>
                    <Button
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() =>
                        confirmFactsMutation.mutate({
                          imageId: image.id,
                          isTextile: true,
                          composition: compositionRows.map((row) => ({
                            name: row.name,
                            percent: row.percent === "" ? null : Number(row.percent),
                            otherName: row.otherName || undefined,
                          })),
                          ...gpsrConfirmFields,
                          ...careConfirmFields,
                        })
                      }
                      disabled={confirmFactsMutation.isPending || !gpsrReady || !careReady}
                    >
                      {confirmFactsMutation.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      ) : null}
                      Confirm textile composition
                    </Button>
                  </div>
                </CardContent>
              </Card>
            {shopConnected && (
              <Card className="shadow-sm">
                <CardHeader className="px-4 py-3">
                  <CardTitle className="text-sm font-medium">Shop GPSR identity</CardTitle>
                  <CardDescription className="text-xs">
                    Saved once for this Shopify shop. Products can use it as the default.
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                  <GpsrIdentityFields value={shopGpsrDraft} onChange={setShopGpsrDraft} />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    disabled={saveShopGpsr.isPending || !isCompleteGpsr(shopGpsrDraft)}
                    onClick={() => saveShopGpsr.mutate(shopGpsrDraft)}
                  >
                    {saveShopGpsr.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : null}
                    Save shop GPSR identity
                  </Button>
                </CardContent>
              </Card>
            )}
            <Card className="shadow-sm">
              <CardHeader className="px-4 py-3">
                <CardTitle className="text-sm font-medium">{PRODUCT_EDITOR_LISTING_COPY_TITLE}</CardTitle>
                <CardDescription className="text-xs">
                  Title, description, tags, SEO, and AEO. Generate after product facts are confirmed.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-4">
                {!isUnpaid && (
                  <AiContentPanel
                    imageId={image.id}
                    defaultCategory={category}
                    canGenerate={canGenerate}
                    onAcceptTitle={(v) => setTitle(v)}
                    onAcceptDescription={(v) => setDescription(v)}
                    onAcceptTags={(v) => setTags(v)}
                    onAcceptAeoFaqs={(v) => setAeoFaqs(v)}
                  />
                )}
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
                  <label className="text-xs font-medium">Description</label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={isUnpaid}
                    rows={6}
                    placeholder="Product description..."
                    className="resize-y text-sm"
                  />
                </div>
                <div className="p-3 bg-background border rounded-md font-sans">
                  <div className="text-xs text-[#202124] mb-1 flex items-center gap-1 opacity-70">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary/20 flex items-center justify-center text-[6px]">S</span>
                    yourstore.com › products › {title.toLowerCase().replace(/[^a-z0-9]/g, '-')}
                  </div>
                  <div className="text-[#1a0dab] text-[15px] leading-[1.2] hover:underline cursor-pointer truncate">
                    {seoTitle || title || "Your Product Title"}
                  </div>
                  <div className="text-[#4d5156] text-xs leading-[1.5] mt-1 line-clamp-2">
                    {seoDescription || description?.slice(0, 160) || "Add a description to see how it will display in search results."}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-medium">Page title</label>
                    <span className="text-xs text-muted-foreground">{seoTitle.length} / 70</span>
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
                    <label className="text-xs font-medium">Meta description</label>
                    <span className="text-xs text-muted-foreground">{seoDescription.length} / 320</span>
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
                    <label className="text-xs font-medium">Tags</label>
                    <div className="flex flex-wrap gap-1">
                      {tags.map((t, i) => (
                        <Badge key={i} variant="secondary" className="text-xs h-5 px-1.5 font-normal">{t}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="px-4 py-3 hairline-b">
                <CardTitle className="text-sm font-medium">{PRODUCT_EDITOR_SELLING_TITLE}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                    <label className="text-xs font-medium">Quantity available</label>
                    <Input
                      type="number"
                      value={inventoryQuantity}
                      onChange={(e) => setInventoryQuantity(Number(e.target.value))}
                      disabled={isUnpaid || !trackQuantity}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">SKU</label>
                    <Input
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      disabled={isUnpaid}
                      placeholder="e.g. TSHIRT-RED-L"
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Compare-at price</label>
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
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Barcode</label>
                    <Input
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                      disabled={isUnpaid}
                      placeholder="000000000000"
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="trackQuantity"
                    checked={trackQuantity}
                    onCheckedChange={(checked) => setTrackQuantity(checked as boolean)}
                    disabled={isUnpaid}
                    className="w-4 h-4"
                  />
                  <label
                    htmlFor="trackQuantity"
                    className="text-xs font-medium leading-none text-muted-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Track quantity
                  </label>
                </div>
                {price && costPerItem && !isNaN(Number(price)) && !isNaN(Number(costPerItem)) && Number(price) > 0 && (
                  <div className="flex items-center gap-4 p-2 bg-muted/50 rounded-md border border-border/50">
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground">Profit</span>
                      <span className="text-sm font-medium">${(Number(price) - Number(costPerItem)).toFixed(2)}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground">Margin</span>
                      <span className="text-sm font-medium">{(((Number(price) - Number(costPerItem)) / Number(price)) * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <details className="rounded-lg border border-border bg-card shadow-sm">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-muted-foreground">
                {PRODUCT_EDITOR_DETAILS_TITLE}
              </summary>
              <div className="px-4 pb-4 space-y-3">
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
              </div>
            </details>

            {productEditorShowsVariants(variants.length) && (
              <Card className="shadow-sm">
                <CardHeader className="px-4 py-3">
                  <CardTitle className="text-sm font-medium">Variants</CardTitle>
                  <CardDescription className="text-xs">
                    These options already exist on the product. They cannot be edited here yet.
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  {variants.map((v, i) => (
                    <div key={i} className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-muted-foreground w-12 shrink-0">{v.name}</span>
                      <div className="flex flex-wrap gap-1">
                        {v.values.map((val: string) => (
                          <Badge key={val} variant="secondary" className="text-xs h-5 px-1.5 font-normal">{val}</Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
