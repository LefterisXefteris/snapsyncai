import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useImages, useUpdateImage } from "@/hooks/use-images";
import type { Image } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check, Lock, Loader2 } from "lucide-react";

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
              <CardContent className="p-6 pt-0">
                <div className="border rounded-md border-dashed border-muted-foreground/30 p-2 text-center bg-muted/5">
                  <img
                    src={`/api/images/${image.id}/file`}
                    alt={altText || title}
                    className="max-h-[300px] mx-auto rounded-sm object-contain"
                  />
                </div>
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
