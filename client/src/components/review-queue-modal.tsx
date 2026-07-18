import { useState, useMemo } from "react";
import { Store, ChevronLeft, ChevronRight, Check, X, Pencil, Save, DollarSign, Tag, Search, Type, Layers, Loader2, ImageIcon, AlertCircle, Bot, MessageCircleQuestion, FolderTree } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Image } from "@shared/schema";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DialogHeader } from "@/components/ui/dialog";
import { useUpdateImage, usePushToShopify } from "@/hooks/use-images";
import { useToast } from "@/hooks/use-toast";

interface ReviewQueueModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  images: Image[];
  shopifyConnected: boolean;
}

interface EditState {
  title: string;
  description: string;
  price: string;
  category: string;
  productType: string;
  seoTitle: string;
  seoDescription: string;
  altText: string;
  aeoSnippet: string;
}

export function ReviewQueueModal({ open, onOpenChange, images, shopifyConnected }: ReviewQueueModalProps) {
  // Only show primary images in the queue — deduplicate by productGroupId
  // and filter out secondary view images (those without a description in a group)
  const pendingImages = useMemo(() => {
    const pending = images
      .filter(img => img.shopifyStatus === "pending")
      .sort((a, b) => {
        if (a.description && !b.description) return -1;
        if (!a.description && b.description) return 1;
        return a.id - b.id;
      });
    const seen = new Set<string>();
    return pending.filter(img => {
      if (!img.productGroupId) return true;
      if (seen.has(img.productGroupId)) return false;
      seen.add(img.productGroupId);
      return true;
    });
  }, [images]);

  // Map each primary to its companion view images
  const viewsMap = useMemo(() => {
    const map = new Map<number, Image[]>();
    for (const primary of pendingImages) {
      if (primary.productGroupId) {
        map.set(primary.id, images.filter(
          img => img.productGroupId === primary.productGroupId && img.id !== primary.id
        ));
      } else {
        map.set(primary.id, []);
      }
    }
    return map;
  }, [pendingImages, images]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [approvedIds, setApprovedIds] = useState<Set<number>>(new Set());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  // Which way the front card flicks off the deck: 1 = approve (right), -1 = skip (left)
  const [flickDirection, setFlickDirection] = useState(1);

  const updateMutation = useUpdateImage();
  const pushToShopify = usePushToShopify();
  const { toast } = useToast();

  const currentImage = pendingImages[currentIndex];
  const approvedCount = approvedIds.size;
  const totalPending = pendingImages.length;

  const startEditing = (img: Image) => {
    setEditingId(img.id);
    setEditState({
      title: img.title || "",
      description: img.description || "",
      price: img.price || "0.00",
      category: img.category || "Other",
      productType: img.productType || "",
      seoTitle: img.seoTitle || "",
      seoDescription: img.seoDescription || "",
      altText: img.altText || "",
      aeoSnippet: img.aeoSnippet || "",
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditState(null);
  };

  const saveEdits = () => {
    if (!editingId || !editState) return;
    updateMutation.mutate(
      { id: editingId, updates: editState },
      { onSuccess: () => cancelEditing() }
    );
  };

  const toggleApprove = (id: number) => {
    setApprovedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const approveAll = () => {
    setApprovedIds(new Set(pendingImages.map(img => img.id)));
  };

  const clearApprovals = () => {
    setApprovedIds(new Set());
  };

  const handlePushApproved = () => {
    const ids = Array.from(approvedIds);
    if (ids.length === 0) {
      toast({ title: "No Products Approved", description: "Approve at least one product before pushing.", variant: "destructive" });
      return;
    }
    if (!shopifyConnected) {
      toast({ title: "Not Connected", description: "Connect to Shopify first before pushing products.", variant: "destructive" });
      return;
    }
    pushToShopify.mutate(ids, {
      onSuccess: () => {
        setApprovedIds(new Set());
        onOpenChange(false);
      },
    });
  };

  const goNext = () => {
    if (currentIndex < totalPending - 1) {
      setFlickDirection(-1);
      cancelEditing();
      setCurrentIndex(currentIndex + 1);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setFlickDirection(-1);
      cancelEditing();
      setCurrentIndex(currentIndex - 1);
    }
  };

  // Approve flicks the card off the deck and advances
  const approveAndAdvance = () => {
    if (!currentImage) return;
    if (approvedIds.has(currentImage.id)) {
      toggleApprove(currentImage.id); // un-approve, no flick
      return;
    }
    toggleApprove(currentImage.id);
    if (currentIndex < totalPending - 1) {
      setFlickDirection(1);
      cancelEditing();
      setCurrentIndex(currentIndex + 1);
    }
  };

  if (totalPending === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Review Queue</DialogTitle>
            <DialogDescription>No pending products to review.</DialogDescription>
          </DialogHeader>
          <div className="text-center py-8 animate-settle">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3 animate-bloom">
              <Check className="w-7 h-7 text-primary" />
            </div>
            <p className="text-muted-foreground">All products have been reviewed and pushed.</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const isEditing = editingId === currentImage?.id;
  const isApproved = currentImage ? approvedIds.has(currentImage.id) : false;
  const variants = currentImage && Array.isArray(currentImage.variants) ? currentImage.variants as { name: string; values: string[] }[] : [];
  const descriptionText = isEditing
    ? editState?.description || ""
    : (currentImage?.description || "").replace(/<[^>]*>/g, ' ').trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] flex flex-col p-0 gap-0 bg-transparent shadow-none backdrop-blur-none">
        {/* Deck header */}
        <div className="flex items-center justify-between gap-4 px-2 pb-3">
          <div>
            <DialogTitle className="text-lg font-display text-foreground">Review Deck</DialogTitle>
            <DialogDescription className="text-xs mt-0.5">
              Approve flicks the card off the stack. Edit anything before it ships.
            </DialogDescription>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-muted-foreground tracking-wider">
              {currentIndex + 1} / {totalPending} · {approvedCount} approved
            </span>
            <Button data-testid="button-approve-all" variant="outline" size="sm" onClick={approvedIds.size === totalPending ? clearApprovals : approveAll}>
              {approvedIds.size === totalPending ? "Clear All" : "Approve All"}
            </Button>
          </div>
        </div>

        {/* The deck */}
        <div className="relative h-[62vh] min-h-0">
          {/* Stack depth: the next cards peeking out behind */}
          {pendingImages.slice(currentIndex + 1, currentIndex + 3).map((img, i) => (
            <div
              key={`stack-${img.id}`}
              aria-hidden
              className="absolute inset-x-0 top-0 bottom-0 rounded-3xl glass-panel pointer-events-none"
              style={{
                transform: `translateY(${(i + 1) * 10}px) scale(${1 - (i + 1) * 0.03})`,
                opacity: 0.5 - i * 0.2,
                zIndex: 1 - i,
              }}
            />
          ))}

          <AnimatePresence mode="popLayout" custom={flickDirection}>
            {currentImage && (
              <motion.div
                key={currentImage.id}
                custom={flickDirection}
                variants={{
                  enter: { opacity: 0, y: 24, scale: 0.96 },
                  center: { opacity: 1, y: 0, x: 0, rotate: 0, scale: 1 },
                  exit: (dir: number) => ({
                    opacity: 0,
                    x: dir * 420,
                    rotate: dir * 8,
                    transition: { duration: 0.32, ease: [0.32, 0, 0.67, 0] },
                  }),
                }}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: "spring", stiffness: 300, damping: 28 }}
                className="relative z-10 h-full rounded-3xl glass-panel flex flex-col overflow-hidden"
              >
                {/* Card controls */}
                <div className="flex items-center justify-between gap-2 px-4 py-2.5 shadow-[inset_0_-1px_0_0_hsl(var(--foreground)/0.05)]">
                  <div className="flex items-center gap-1">
                    <Button data-testid="button-prev-product" variant="ghost" size="icon" onClick={goPrev} disabled={currentIndex === 0}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button data-testid="button-next-product" variant="ghost" size="icon" onClick={goNext} disabled={currentIndex === totalPending - 1}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isEditing ? (
                      <Button data-testid={`button-edit-review-${currentImage.id}`} variant="outline" size="sm" onClick={() => startEditing(currentImage)}>
                        <Pencil className="w-3.5 h-3.5 mr-1.5" />
                        Edit
                      </Button>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <Button data-testid={`button-save-review-${currentImage.id}`} size="sm" onClick={saveEdits} disabled={updateMutation.isPending}>
                          {updateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                          Save
                        </Button>
                        <Button data-testid={`button-cancel-review-${currentImage.id}`} variant="outline" size="sm" onClick={cancelEditing}>
                          <X className="w-3.5 h-3.5 mr-1.5" />
                          Cancel
                        </Button>
                      </div>
                    )}
                    <Button
                      data-testid={`button-toggle-approve-${currentImage.id}`}
                      variant={isApproved ? "default" : "outline"}
                      size="sm"
                      onClick={approveAndAdvance}
                    >
                      {isApproved ? (
                        <>
                          <Check className="w-3.5 h-3.5 mr-1.5" />
                          Approved
                        </>
                      ) : (
                        "Approve"
                      )}
                    </Button>
                  </div>
                </div>

                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-5 max-w-2xl mx-auto">
                    <div className="flex items-start gap-4">
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        <div className="w-24 h-24 rounded-xl bg-muted/30 flex items-center justify-center overflow-hidden relative shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.06)]">
                          <img
                            src={`/api/images/${currentImage.id}/file?sz=${currentImage.size}&t=${new Date(currentImage.createdAt || Date.now()).getTime()}`}
                            alt={currentImage.altText || currentImage.title || currentImage.originalName}
                            className="absolute inset-0 w-full h-full object-cover"
                            loading="lazy"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            data-testid={`img-review-product-${currentImage.id}`}
                          />
                          <ImageIcon className="w-8 h-8 text-muted-foreground" />
                        </div>
                        {/* View images strip */}
                        {(viewsMap.get(currentImage.id)?.length ?? 0) > 0 && (
                          <div className="flex gap-1">
                            {viewsMap.get(currentImage.id)!.slice(0, 3).map(v => (
                              <div key={v.id} className="w-7 h-7 rounded-md overflow-hidden relative bg-muted/30">
                                <img
                                  src={`/api/images/${v.id}/file?sz=${v.size}`}
                                  alt=""
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                              </div>
                            ))}
                            {(viewsMap.get(currentImage.id)?.length ?? 0) > 3 && (
                              <div className="w-7 h-7 rounded-md bg-foreground/5 flex items-center justify-center">
                                <span className="text-[8px] font-mono text-muted-foreground">+{(viewsMap.get(currentImage.id)?.length ?? 0) - 3}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-[10px] text-muted-foreground mb-1 truncate">{currentImage.originalName}</p>
                        {isEditing ? (
                          <Input
                            data-testid={`input-review-title-${currentImage.id}`}
                            value={editState?.title || ""}
                            onChange={(e) => setEditState(prev => prev ? { ...prev, title: e.target.value } : prev)}
                            className="text-lg font-display font-semibold"
                          />
                        ) : (
                          <h3 className="text-lg font-display font-semibold" data-testid={`text-review-title-${currentImage.id}`}>
                            {currentImage.title || currentImage.originalName}
                          </h3>
                        )}
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          {isEditing ? (
                            <>
                              <div className="flex items-center gap-1.5">
                                <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                                <Input
                                  data-testid={`input-review-price-${currentImage.id}`}
                                  value={editState?.price || ""}
                                  onChange={(e) => setEditState(prev => prev ? { ...prev, price: e.target.value } : prev)}
                                  type="number"
                                  step="0.01"
                                  className="w-24"
                                />
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                                <Input
                                  data-testid={`input-review-product-type-${currentImage.id}`}
                                  value={editState?.productType || ""}
                                  onChange={(e) => setEditState(prev => prev ? { ...prev, productType: e.target.value } : prev)}
                                  placeholder="Product type"
                                  className="w-36"
                                />
                              </div>
                            </>
                          ) : (
                            <>
                              <span className="flex items-center gap-1 text-sm font-mono text-muted-foreground">
                                <DollarSign className="w-3.5 h-3.5" />
                                ${currentImage.price || "0.00"}
                              </span>
                              {currentImage.productType && (
                                <Badge variant="secondary" className="text-xs">
                                  {currentImage.productType}
                                </Badge>
                              )}
                            </>
                          )}
                        </div>
                        {isEditing ? (
                          <div className="mt-2 space-y-1">
                            <label className="text-xs text-muted-foreground">Category Path</label>
                            <Input
                              data-testid={`input-review-category-${currentImage.id}`}
                              value={editState?.category || ""}
                              onChange={(e) => setEditState(prev => prev ? { ...prev, category: e.target.value } : prev)}
                              placeholder="e.g. Apparel & Accessories > Clothing > Hoodies"
                              className="text-sm"
                            />
                          </div>
                        ) : currentImage.category ? (
                          <div className="flex items-center gap-1.5 mt-2 text-xs">
                            <FolderTree className="w-3 h-3 text-yellow-400 shrink-0" />
                            <span className="text-muted-foreground truncate" title={currentImage.category}>{currentImage.category}</span>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <Tabs defaultValue="product" className="w-full">
                      <TabsList className="w-full">
                        <TabsTrigger data-testid="tab-review-product" value="product" className="flex-1">Product</TabsTrigger>
                        <TabsTrigger data-testid="tab-review-seo" value="seo" className="flex-1">SEO</TabsTrigger>
                        <TabsTrigger data-testid="tab-review-aeo" value="aeo" className="flex-1">AEO</TabsTrigger>
                      </TabsList>

                      <TabsContent value="product" className="space-y-4 mt-4">
                        <div className="space-y-2">
                          <Label className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.15em]">Description</Label>
                          {isEditing ? (
                            <Textarea
                              data-testid={`input-review-description-${currentImage.id}`}
                              value={editState?.description || ""}
                              onChange={(e) => setEditState(prev => prev ? { ...prev, description: e.target.value } : prev)}
                              rows={5}
                              className="resize-none"
                            />
                          ) : (
                            <div className="p-3 rounded-xl bg-muted/20 text-sm leading-relaxed shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.05)]" data-testid={`text-review-description-${currentImage.id}`}>
                              {descriptionText || "No description generated."}
                            </div>
                          )}
                        </div>

                        {currentImage.tags && currentImage.tags.length > 0 && (
                          <div className="space-y-2">
                            <Label className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.15em]">Tags</Label>
                            <div className="flex flex-wrap gap-1.5">
                              {currentImage.tags.map((tag, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">{tag}</Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {variants.length > 0 && (
                          <div className="space-y-2">
                            <Label className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.15em] flex items-center gap-1.5">
                              <Layers className="w-3.5 h-3.5" />
                              Variants
                            </Label>
                            <div className="space-y-2">
                              {variants.map((v, i) => (
                                <div key={i} className="p-2.5 rounded-xl bg-muted/20 shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.05)]">
                                  <p className="text-xs font-medium mb-1.5">{v.name}</p>
                                  <div className="flex flex-wrap gap-1">
                                    {v.values.map((val, vi) => (
                                      <Badge key={vi} variant="outline" className="text-xs">{val}</Badge>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </TabsContent>

                      <TabsContent value="seo" className="space-y-4 mt-4">
                        <div className="space-y-2">
                          <Label className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.15em] flex items-center gap-1.5">
                            <Search className="w-3.5 h-3.5" />
                            SEO Title
                          </Label>
                          {isEditing ? (
                            <div>
                              <Input
                                data-testid={`input-review-seo-title-${currentImage.id}`}
                                value={editState?.seoTitle || ""}
                                onChange={(e) => setEditState(prev => prev ? { ...prev, seoTitle: e.target.value } : prev)}
                                placeholder="SEO page title (50-60 chars)"
                              />
                              <p className="text-[10px] font-mono text-muted-foreground mt-1">{(editState?.seoTitle || "").length}/60 characters</p>
                            </div>
                          ) : (
                            <p className="text-sm" data-testid={`text-review-seo-title-${currentImage.id}`}>
                              {currentImage.seoTitle || <span className="text-muted-foreground">Not set</span>}
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.15em]">Meta Description</Label>
                          {isEditing ? (
                            <div>
                              <Textarea
                                data-testid={`input-review-seo-desc-${currentImage.id}`}
                                value={editState?.seoDescription || ""}
                                onChange={(e) => setEditState(prev => prev ? { ...prev, seoDescription: e.target.value } : prev)}
                                placeholder="Meta description (140-160 chars)"
                                rows={3}
                                className="resize-none"
                              />
                              <p className="text-[10px] font-mono text-muted-foreground mt-1">{(editState?.seoDescription || "").length}/160 characters</p>
                            </div>
                          ) : (
                            <p className="text-sm" data-testid={`text-review-seo-desc-${currentImage.id}`}>
                              {currentImage.seoDescription || <span className="text-muted-foreground">Not set</span>}
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.15em] flex items-center gap-1.5">
                            <Type className="w-3.5 h-3.5" />
                            Image Alt Text
                          </Label>
                          {isEditing ? (
                            <Input
                              data-testid={`input-review-alt-text-${currentImage.id}`}
                              value={editState?.altText || ""}
                              onChange={(e) => setEditState(prev => prev ? { ...prev, altText: e.target.value } : prev)}
                              placeholder="Alt text for accessibility"
                            />
                          ) : (
                            <p className="text-sm" data-testid={`text-review-alt-text-${currentImage.id}`}>
                              {currentImage.altText || <span className="text-muted-foreground">Not set</span>}
                            </p>
                          )}
                        </div>

                        <div className="p-3 rounded-xl bg-muted/20 space-y-1.5 shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.05)]">
                          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.15em]">Google Preview</p>
                          <p className="text-sm text-blue-400 truncate">
                            {(isEditing ? editState?.seoTitle : currentImage.seoTitle) || currentImage.title || "Product Title"}
                          </p>
                          <p className="text-xs text-yellow-400 truncate">yourstore.myshopify.com/products/...</p>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {(isEditing ? editState?.seoDescription : currentImage.seoDescription) || "No meta description set."}
                          </p>
                        </div>
                      </TabsContent>

                      <TabsContent value="aeo" className="space-y-4 mt-4">
                        <div className="space-y-2">
                          <Label className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.15em] flex items-center gap-1.5">
                            <Bot className="w-3.5 h-3.5" />
                            AI Answer Snippet
                          </Label>
                          {isEditing ? (
                            <Textarea
                              data-testid={`input-review-aeo-snippet-${currentImage.id}`}
                              value={editState?.aeoSnippet || ""}
                              onChange={(e) => setEditState(prev => prev ? { ...prev, aeoSnippet: e.target.value } : prev)}
                              placeholder="Conversational summary for AI assistants..."
                              rows={3}
                              className="resize-none"
                            />
                          ) : (
                            <div className="p-3 rounded-xl bg-muted/20 text-sm leading-relaxed shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.05)]" data-testid={`text-review-aeo-snippet-${currentImage.id}`}>
                              {currentImage.aeoSnippet || <span className="text-muted-foreground">No AI answer snippet generated yet. This will appear after full AI analysis.</span>}
                            </div>
                          )}
                          <p className="text-[10px] text-muted-foreground">This is how AI assistants like ChatGPT, Perplexity, and Google AI Overviews would describe this product.</p>
                        </div>

                        {Array.isArray(currentImage.aeoFaqs) && (currentImage.aeoFaqs as { question: string; answer: string }[]).length > 0 && (
                          <div className="space-y-2">
                            <Label className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.15em] flex items-center gap-1.5">
                              <MessageCircleQuestion className="w-3.5 h-3.5" />
                              Product FAQs ({(currentImage.aeoFaqs as { question: string; answer: string }[]).length})
                            </Label>
                            <div className="space-y-2">
                              {(currentImage.aeoFaqs as { question: string; answer: string }[]).map((faq, i) => (
                                <div key={i} className="p-3 rounded-xl bg-muted/20 space-y-1 shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.05)]">
                                  <p className="text-sm font-medium text-yellow-400" data-testid={`text-review-faq-q-${i}`}>{faq.question}</p>
                                  <p className="text-sm text-muted-foreground" data-testid={`text-review-faq-a-${i}`}>{faq.answer}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="p-3 rounded-xl bg-yellow-500/5 space-y-1.5 shadow-[inset_0_0_0_1px_hsl(48_100%_55%/0.2)]">
                          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.15em]">AI Assistant Preview</p>
                          <p className="text-xs italic text-yellow-200/80">
                            "{(isEditing ? editState?.aeoSnippet : currentImage.aeoSnippet) || "Tell me about this product..."}"
                          </p>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>
                </ScrollArea>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Deck footer */}
        <div className="flex items-center justify-between gap-4 px-2 pt-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {!shopifyConnected && (
              <span className="flex items-center gap-1.5 text-amber-400">
                <AlertCircle className="w-4 h-4" />
                Connect Shopify first
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button data-testid="button-close-review" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button
              data-testid="button-push-approved"
              onClick={handlePushApproved}
              disabled={approvedCount === 0 || pushToShopify.isPending || !shopifyConnected}
            >
              {pushToShopify.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Store className="w-4 h-4 mr-2" />
              )}
              Push {approvedCount} to Shopify
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
