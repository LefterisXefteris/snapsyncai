import { useState, useEffect, useRef } from "react";
import { useLocation, useRoute } from "wouter";
import { useImages, useProductGroup, useAssignToGroup, useAssignMultipleToGroup, useUnlinkFromGroup, useUpdateImage, useDeleteImage, useEditBackground, useGeneratePhotoshoot, useApplyImage, useRewriteDescription, usePushToShopify, useUploadImages } from "@/hooks/use-images";
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
import { ArrowLeft, Check, Lock, Loader2, Wand2, ImageIcon, Download, Tag, Box, BarChart3, Sparkles, Plus, ImagePlus, Store, Trash2, X, UploadCloud, Search } from "lucide-react";

const VALID_STYLES = ["Studio Lighting", "Minimalist Marble", "Natural Outdoor", "E-commerce White", "Neon Cyberpunk"];

const BG_STYLES = [
  { key: "studio",    label: "Studio",    color: "#f8f8f8" },
  { key: "gradient",  label: "Gradient",  color: "#9333ea" },
  { key: "lifestyle", label: "Lifestyle", color: "#84cc16" },
  { key: "minimal",   label: "Minimal",   color: "#e5e5e5" },
  { key: "dark",      label: "Dark",      color: "#1c1c1c" },
] as const;

export default function ProductDetails({ params }: { params: { id: string } }) {
  const [, setLocation] = useLocation();
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

  const image = images?.find((img: Image) => img.id === Number(params.id));

  // Fetch all images in the product group directly from the server
  const { data: groupImages } = useProductGroup(image?.id);

  // productImages: prefer server group result, fall back to client-side filtering, then just primary
  const productImages: Image[] = (() => {
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
    }
  }, [image]);

  const variants = Array.isArray(image?.variants) ? (image.variants as { name: string; values: string[] }[]) : [];
  const mediaGallery = Array.isArray(image?.mediaGallery) ? (image.mediaGallery as string[]) : [];

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!image) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-background">
        <h2 className="text-xl font-bold mb-4">Product not found</h2>
        <Button onClick={() => setLocation("/")}>Back to Products</Button>
      </div>
    );
  }

  const isUnpaid = image.paymentStatus !== "paid";
  const backgrounds = Array.isArray(image?.generatedBackgrounds) ? (image.generatedBackgrounds as string[]) : [];

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

  const handleAddSelected = () => {
    const groupId = image.productGroupId ?? crypto.randomUUID();
    const primaryImageId = image.productGroupId ? undefined : image.id;
    assignMultipleMutation.mutate(
      { imageIds: Array.from(pickerSelected), productGroupId: groupId, primaryImageId },
      { onSuccess: () => { setPickerSelected(new Set()); setShowLibraryPicker(false); } }
    );
  };

  const handlePickerFiles = async (files: File[]) => {
    if (!files.length) return;
    setPickerUploading(true);
    try {
      const groupId = image.productGroupId ?? crypto.randomUUID();
      const primaryImageId = image.productGroupId ? undefined : image.id;
      const uploaded = await uploadImagesMutation.mutateAsync({ files, groupAsOne: false, hideToast: true });
      const imageIds = (uploaded as { id: number }[]).map(img => img.id);
      if (imageIds.length > 0) {
        await assignMultipleMutation.mutateAsync({ imageIds, productGroupId: groupId, primaryImageId });
      }
      setShowLibraryPicker(false);
    } finally {
      setPickerUploading(false);
    }
  };

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
        },
      },
      {
        onSuccess: () => {
          setLocation("/");
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-background pb-12">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/")} className="h-8 w-8">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-sm font-semibold truncate max-w-[200px] md:max-w-md">
              {title || "Unnamed Product"}
            </h1>
            {image.shopifyStatus === "synced" && (
              <Badge variant="secondary" className="bg-green-500/10 text-green-500 hover:bg-green-500/20 text-[10px] h-5 px-1.5">
                Synced
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isUnpaid && (
              <Button 
                variant="outline" 
                size="sm" 
                className={`h-8 text-[11px] px-2.5 ${image.shopifyStatus === 'synced' ? 'bg-secondary/50 text-muted-foreground' : 'bg-[#95bf46]/10 text-[#5e8e3e] border-[#95bf46]/30 hover:bg-[#95bf46]/20'}`}
                onClick={() => pushToShopifyMutation.mutate([image.id])}
                disabled={pushToShopifyMutation.isPending || image.shopifyStatus === "synced"}
              >
                {pushToShopifyMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Store className="w-3.5 h-3.5 mr-1.5" />
                )}
                {image.shopifyStatus === "synced" ? "Synced to Shopify" : "Push to Shopify"}
              </Button>
            )}
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setLocation("/")}>
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

      <div className="max-w-6xl mx-auto px-4 py-4">
        {isUnpaid && (
          <div className="mb-4 p-3 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center gap-2">
            <Lock className="w-4 h-4 shrink-0" />
            <div>
              <p className="font-medium text-xs">This product is in preview mode.</p>
              <p className="text-[10px] opacity-80">
                Subscribe to unlock full descriptions, pricing, SEO metadata, and variants.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Main Content Column */}
          <div className="md:col-span-2 space-y-4">
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
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={isUnpaid || rewriteDescriptionMutation.isPending}
                    rows={5}
                    placeholder="Product description..."
                    className="resize-y text-sm"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="px-4 py-3 border-b border-border/50">
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
              <CardHeader className="px-4 py-3 border-b border-border/50">
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
              <CardHeader className="flex flex-row items-center justify-between px-4 py-3 border-b border-border/50">
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
                    {/* Combinations table */}
                    <Table className="text-xs">
                      <TableHeader>
                        <TableRow className="h-8">
                          <TableHead className="h-8 py-1">Variant</TableHead>
                          <TableHead className="h-8 py-1">Price</TableHead>
                          <TableHead className="h-8 py-1">Available</TableHead>
                          <TableHead className="h-8 py-1">SKU</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {variants.reduce<string[][]>((acc, v) => {
                          if (acc.length === 0) return v.values.map((val: string) => [val]);
                          return acc.flatMap((combo: string[]) => v.values.map((val: string) => [...combo, val]));
                        }, []).map((combo, i) => {
                          const label = combo.join(" / ");
                          const skuSuffix = combo.map((v: string) => v.toUpperCase().replace(/\s/g, '')).join('-');
                          return (
                            <TableRow key={i} className="h-10">
                              <TableCell className="font-medium whitespace-nowrap py-1">{label}</TableCell>
                              <TableCell className="py-1">
                                <Input defaultValue={price} disabled={isUnpaid} className="h-7 w-20 text-xs" />
                              </TableCell>
                              <TableCell className="py-1">
                                <Input type="number" defaultValue={inventoryQuantity} disabled={isUnpaid} className="h-7 w-16 text-xs" />
                              </TableCell>
                              <TableCell className="py-1">
                                <Input defaultValue={sku ? `${sku}-${skuSuffix}` : skuSuffix} disabled={isUnpaid} className="h-7 min-w-[100px] text-xs" />
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
              <CardHeader className="px-4 py-3 border-b border-border/50 flex flex-row items-center justify-between">
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
              <Dialog open={showLibraryPicker} onOpenChange={(open) => { setShowLibraryPicker(open); if (!open) { setPickerSelected(new Set()); setPickerSearch(""); setPickerTab("library"); } }}>
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
                                      src={`/api/images/${img.id}/file`}
                                      alt={img.originalName || "Image"}
                                      className="w-full h-full object-cover"
                                      loading="lazy"
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
                          const files = Array.from(e.target.files ?? []);
                          if (files.length) handlePickerFiles(files);
                          e.target.value = "";
                        }}
                      />
                      <div
                        className={`w-full max-w-md border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${pickerUploading ? "border-primary/50 bg-primary/5 cursor-default" : "border-border hover:border-primary/60 hover:bg-primary/5"}`}
                        onDragOver={e => e.preventDefault()}
                        onDrop={e => { e.preventDefault(); const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/")); if (files.length && !pickerUploading) handlePickerFiles(files); }}
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
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {productImages.map((img) => (
                    <div
                      key={img.id}
                      className={`relative group/thumb rounded-lg overflow-hidden border-2 aspect-square cursor-pointer transition-all ${
                        displayImageId === img.id
                          ? "border-primary ring-2 ring-primary/30"
                          : "border-border hover:border-foreground/30"
                      }`}
                      onClick={() => { setSelectedImageId(img.id); setBgEditUrl(null); setBgEditKey(null); }}
                    >
                      <img
                        src={`/api/images/${img.id}/file`}
                        alt={img.originalName || "Product view"}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
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
                    <div className="relative w-full aspect-square bg-muted rounded-lg overflow-hidden border border-border">
                      <img
                        src={bgEditUrl ?? `/api/images/${displayImageId}/file?t=${imageKey}`}
                        alt={image.altText || image.title || "Product Image"}
                        className="w-full h-full object-contain"
                      />

                      {editBackgroundMutation.isPending && (
                        <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex flex-col items-center justify-center z-30 gap-2">
                          <Wand2 className="w-6 h-6 text-primary animate-pulse" />
                          <span className="text-xs font-medium">Editing background…</span>
                        </div>
                      )}

                      {showBgPicker && !editBackgroundMutation.isPending && !applyImageMutation.isPending && (
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

                    {!isUnpaid && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className={`flex-1 ${showBgPicker ? 'border-primary/50 text-primary bg-primary/5' : ''}`}
                          onClick={() => setShowBgPicker(v => !v)}
                          disabled={editBackgroundMutation.isPending || applyImageMutation.isPending}
                        >
                          <Wand2 className="w-4 h-4 mr-2" />
                          AI Background
                        </Button>

                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="flex-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100/50">
                              <ImageIcon className="w-4 h-4 mr-2" />
                              AI Photoshoot
                            </Button>
                          </DialogTrigger>
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
          <div className="space-y-4">
            <Card className="shadow-sm">
              <CardHeader className="px-4 py-3 border-b border-border/50">
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
              <CardHeader className="px-4 py-3 border-b border-border/50">
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
              <CardHeader className="px-4 py-3 border-b border-border/50">
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
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
