import { useState, useMemo } from "react";
import { Store, ChevronLeft, ChevronRight, Check, X, Pencil, Save, DollarSign, Tag, Search, Type, Layers, Loader2, ImageIcon, AlertCircle, Bot, MessageCircleQuestion, FolderTree } from "lucide-react";
import type { Image } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
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
  const pendingImages = useMemo(() => images.filter(img => img.shopifyStatus === "pending"), [images]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [approvedIds, setApprovedIds] = useState<Set<number>>(new Set());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);

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
    if (currentIndex < totalPending - 1) setCurrentIndex(currentIndex + 1);
  };

  const goPrev = () => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  };

  if (totalPending === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Queue</DialogTitle>
            <DialogDescription>No pending products to review.</DialogDescription>
          </DialogHeader>
          <div className="text-center py-8">
            <Check className="w-12 h-12 text-green-400 mx-auto mb-3" />
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
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0">
        <div className="flex items-center justify-between gap-4 px-6 pt-6 pb-3 border-b border-border">
          <div>
            <DialogTitle className="text-lg font-display">Review Queue</DialogTitle>
            <DialogDescription className="text-xs mt-0.5">
              Review AI-generated details, edit if needed, then approve before pushing to Shopify.
            </DialogDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {approvedCount}/{totalPending} approved
            </Badge>
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          <div className="w-56 border-r border-border flex-shrink-0 flex flex-col">
            <div className="flex items-center justify-between gap-1 px-3 py-2 border-b border-border">
              <Button data-testid="button-approve-all" variant="ghost" size="sm" className="text-xs flex-1" onClick={approvedIds.size === totalPending ? clearApprovals : approveAll}>
                {approvedIds.size === totalPending ? "Clear All" : "Approve All"}
              </Button>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {pendingImages.map((img, idx) => (
                  <button
                    key={img.id}
                    data-testid={`button-queue-item-${img.id}`}
                    onClick={() => { setCurrentIndex(idx); cancelEditing(); }}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 transition-colors ${
                      idx === currentIndex ? "bg-primary/10 text-primary" : "text-muted-foreground hover-elevate"
                    }`}
                  >
                    <Checkbox
                      checked={approvedIds.has(img.id)}
                      onCheckedChange={() => toggleApprove(img.id)}
                      className="flex-shrink-0"
                      data-testid={`checkbox-approve-${img.id}`}
                    />
                    <span className="truncate flex-1 text-xs">{img.title || img.originalName}</span>
                    {approvedIds.has(img.id) && (
                      <Check className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          <div className="flex-1 flex flex-col min-h-0">
            {currentImage && (
              <>
                <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Button data-testid="button-prev-product" variant="ghost" size="icon" onClick={goPrev} disabled={currentIndex === 0}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {currentIndex + 1} of {totalPending}
                    </span>
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
                      onClick={() => toggleApprove(currentImage.id)}
                      className={isApproved ? "" : ""}
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
                      <div className="w-24 h-24 rounded-md bg-muted/30 border border-border flex items-center justify-center flex-shrink-0 overflow-hidden relative">
                        <img
                          src={`/api/images/${currentImage.id}/file`}
                          alt={currentImage.altText || currentImage.title || currentImage.originalName}
                          className="absolute inset-0 w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          data-testid={`img-review-product-${currentImage.id}`}
                        />
                        <ImageIcon className="w-8 h-8 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground mb-1">{currentImage.originalName}</p>
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
                              <span className="flex items-center gap-1 text-sm text-muted-foreground">
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
                            <FolderTree className="w-3 h-3 text-purple-400 shrink-0" />
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
                          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Description</Label>
                          {isEditing ? (
                            <Textarea
                              data-testid={`input-review-description-${currentImage.id}`}
                              value={editState?.description || ""}
                              onChange={(e) => setEditState(prev => prev ? { ...prev, description: e.target.value } : prev)}
                              rows={5}
                              className="resize-none"
                            />
                          ) : (
                            <div className="p-3 rounded-md bg-muted/20 border border-border text-sm leading-relaxed" data-testid={`text-review-description-${currentImage.id}`}>
                              {descriptionText || "No description generated."}
                            </div>
                          )}
                        </div>

                        {currentImage.tags && currentImage.tags.length > 0 && (
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Tags</Label>
                            <div className="flex flex-wrap gap-1.5">
                              {currentImage.tags.map((tag, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">{tag}</Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {variants.length > 0 && (
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                              <Layers className="w-3.5 h-3.5" />
                              Variants
                            </Label>
                            <div className="space-y-2">
                              {variants.map((v, i) => (
                                <div key={i} className="p-2.5 rounded-md bg-muted/20 border border-border">
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
                          <Label className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
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
                              <p className="text-[10px] text-muted-foreground mt-1">{(editState?.seoTitle || "").length}/60 characters</p>
                            </div>
                          ) : (
                            <p className="text-sm" data-testid={`text-review-seo-title-${currentImage.id}`}>
                              {currentImage.seoTitle || <span className="text-muted-foreground">Not set</span>}
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Meta Description</Label>
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
                              <p className="text-[10px] text-muted-foreground mt-1">{(editState?.seoDescription || "").length}/160 characters</p>
                            </div>
                          ) : (
                            <p className="text-sm" data-testid={`text-review-seo-desc-${currentImage.id}`}>
                              {currentImage.seoDescription || <span className="text-muted-foreground">Not set</span>}
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
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

                        <div className="p-3 rounded-md bg-muted/20 border border-border space-y-1.5">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Google Preview</p>
                          <p className="text-sm text-blue-400 truncate">
                            {(isEditing ? editState?.seoTitle : currentImage.seoTitle) || currentImage.title || "Product Title"}
                          </p>
                          <p className="text-xs text-green-400 truncate">yourstore.myshopify.com/products/...</p>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {(isEditing ? editState?.seoDescription : currentImage.seoDescription) || "No meta description set."}
                          </p>
                        </div>
                      </TabsContent>

                      <TabsContent value="aeo" className="space-y-4 mt-4">
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
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
                            <div className="p-3 rounded-md bg-muted/20 border border-border text-sm leading-relaxed" data-testid={`text-review-aeo-snippet-${currentImage.id}`}>
                              {currentImage.aeoSnippet || <span className="text-muted-foreground">No AI answer snippet generated yet. This will appear after full AI analysis.</span>}
                            </div>
                          )}
                          <p className="text-[10px] text-muted-foreground">This is how AI assistants like ChatGPT, Perplexity, and Google AI Overviews would describe this product.</p>
                        </div>

                        {currentImage.aeoFaqs && Array.isArray(currentImage.aeoFaqs) && (currentImage.aeoFaqs as { question: string; answer: string }[]).length > 0 && (
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                              <MessageCircleQuestion className="w-3.5 h-3.5" />
                              Product FAQs ({(currentImage.aeoFaqs as { question: string; answer: string }[]).length})
                            </Label>
                            <div className="space-y-2">
                              {(currentImage.aeoFaqs as { question: string; answer: string }[]).map((faq, i) => (
                                <div key={i} className="p-3 rounded-md bg-muted/20 border border-border space-y-1">
                                  <p className="text-sm font-medium text-purple-400" data-testid={`text-review-faq-q-${i}`}>{faq.question}</p>
                                  <p className="text-sm text-muted-foreground" data-testid={`text-review-faq-a-${i}`}>{faq.answer}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="p-3 rounded-md bg-purple-500/5 border border-purple-500/20 space-y-1.5">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">AI Assistant Preview</p>
                          <p className="text-xs italic text-purple-300/80">
                            "{(isEditing ? editState?.aeoSnippet : currentImage.aeoSnippet) || "Tell me about this product..."}"
                          </p>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>
                </ScrollArea>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 px-6 py-4 border-t border-border">
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
