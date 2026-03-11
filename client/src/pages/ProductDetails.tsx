import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useImages, useUpdateImage, useEditBackground, useGeneratePhotoshoot, useApplyImage } from "@/hooks/use-images";
import type { Image } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Check, Lock, Loader2, Wand2, ImageIcon, Download } from "lucide-react";

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

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("0.00");
  const [category, setCategory] = useState("");
  const [productType, setProductType] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [altText, setAltText] = useState("");
  const [aeoSnippet, setAeoSnippet] = useState("");

  const editBackgroundMutation = useEditBackground();
  const generatePhotoshootMutation = useGeneratePhotoshoot();
  const applyImageMutation = useApplyImage();
  
  const [bgEditKey, setBgEditKey] = useState<string | null>(null);
  const [bgEditUrl, setBgEditUrl] = useState<string | null>(null);
  const [showBgPicker, setShowBgPicker] = useState(false);
  const [photoshootStyle, setPhotoshootStyle] = useState(VALID_STYLES[0]);

  const image = images?.find((img: Image) => img.id === Number(params.id));

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
    }
  }, [image]);

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

  const handleApplyBackground = () => {
    if (!bgEditKey) return;
    applyImageMutation.mutate(
      { id: image.id, bgKey: bgEditKey },
      {
        onSuccess: () => {
          setBgEditKey(null);
          setBgEditUrl(null);
        }
      }
    );
  };

  const handleApplyConcept = (url: string) => {
    applyImageMutation.mutate({ id: image.id, imageUrl: url });
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
    <div className="min-h-screen bg-muted/10 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-lg font-semibold truncate max-w-[200px] md:max-w-md">
              {title || "Unnamed Product"}
            </h1>
            {image.shopifyStatus === "synced" && (
              <Badge variant="secondary" className="bg-green-500/10 text-green-500 hover:bg-green-500/20">
                Synced
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setLocation("/")}>
              Discard
            </Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending || isUnpaid}>
              {updateMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              Save
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {isUnpaid && (
          <div className="mb-6 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center gap-3">
            <Lock className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-medium text-sm">This product is in preview mode.</p>
              <p className="text-xs opacity-80">
                Subscribe to unlock full descriptions, pricing, SEO metadata, and variants.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Content Column */}
          <div className="md:col-span-2 space-y-6">
            <Card className="shadow-sm">
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Title</label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={isUnpaid}
                    placeholder="Short sleeve t-shirt"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={isUnpaid}
                    rows={8}
                    placeholder="Product description..."
                    className="resize-y"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-medium">Media</CardTitle>
              </CardHeader>
              <CardContent className="p-4 flex flex-col items-center justify-center">
                <div className="relative w-full aspect-square bg-muted rounded-lg overflow-hidden border border-border">
                  <img
                    src={bgEditUrl ?? `/api/images/${image.id}/file?t=${new Date(image.createdAt || Date.now()).getTime()}`}
                    alt={image.altText || image.title || "Product Image"}
                    className="w-full h-full object-contain"
                  />

                  {/* AI editing spinner overlay */}
                  {editBackgroundMutation.isPending && (
                    <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex flex-col items-center justify-center z-30 gap-2">
                      <Wand2 className="w-6 h-6 text-primary animate-pulse" />
                      <span className="text-xs font-medium">Editing background…</span>
                    </div>
                  )}

                  {/* Background style picker */}
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

                  {/* Apply background overlay */}
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
                  <div className="flex items-center gap-2 mt-4">
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
                        <Button variant="outline" size="sm" className="flex-1 text-purple-600 hover:text-purple-700 hover:bg-purple-100/50">
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
                            <SelectTrigger className="w-[200px]">
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
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-medium">Search engine listing</CardTitle>
                <CardDescription>Add a title and description to see how this product might appear in a search engine listing.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 pt-0 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Page Title</label>
                  <Input
                    value={seoTitle}
                    onChange={(e) => setSeoTitle(e.target.value)}
                    disabled={isUnpaid}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Meta Description</label>
                  <Textarea
                    value={seoDescription}
                    onChange={(e) => setSeoDescription(e.target.value)}
                    disabled={isUnpaid}
                    rows={4}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar Column */}
          <div className="space-y-6">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-medium">Status</CardTitle>
              </CardHeader>
              <CardContent className="p-6 pt-0">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isUnpaid ? 'bg-amber-400' : 'bg-green-500'}`} />
                  <span className="text-sm">{isUnpaid ? "Preview" : "Active"}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-medium">Pricing</CardTitle>
              </CardHeader>
              <CardContent className="p-6 pt-0 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Price</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      type="number"
                      step="0.01"
                      className="pl-8"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      disabled={isUnpaid}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-medium">Organization</CardTitle>
              </CardHeader>
              <CardContent className="p-6 pt-0 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Product Category</label>
                  <Input
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    disabled={isUnpaid}
                    placeholder="Apparel & Accessories..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Product Type</label>
                  <Input
                    value={productType}
                    onChange={(e) => setProductType(e.target.value)}
                    disabled={isUnpaid}
                    placeholder="e.g. Shirts"
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
