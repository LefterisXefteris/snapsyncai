import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  trendyolAttributes,
  trendyolBrands,
  useTrendyolCategories,
  useTrendyolProduct,
  useTrendyolPush,
  type TrendyolAttribute,
  type TrendyolPage,
} from "@/hooks/use-trendyol";

function approvalText(page: TrendyolPage): string | null {
  if (page.approval === "rejected") {
    return page.reason ? `Rejected. ${page.reason}` : "Rejected.";
  }
  if (page.approval === "approved") return "Approved on Trendyol International.";
  if (page.approval === "waiting") return "Waiting for Trendyol to approve this product.";
  return null;
}

export function TrendyolListing({ imageId }: { imageId: number }) {
  const [, setLocation] = useLocation();
  const { data, isLoading } = useTrendyolProduct(imageId);
  const categories = useTrendyolCategories(data?.connected === true);
  const push = useTrendyolPush(imageId);
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [brandName, setBrandName] = useState("");
  const [brandQuery, setBrandQuery] = useState("");
  const [brandHits, setBrandHits] = useState<{ id: string; name: string }[]>([]);
  const [salePrice, setSalePrice] = useState("");
  const [listPrice, setListPrice] = useState("");
  const [attributes, setAttributes] = useState<TrendyolAttribute[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setCategoryId(data.categoryId ?? "");
    setBrandId(data.brandId ?? "");
    setBrandName(data.brandName ?? "");
    setSalePrice(data.salePrice ?? "");
    setListPrice(data.listPrice ?? "");
    setAttributes(data.attributes);
    setNotice(data.pushWait);
  }, [data]);

  if (isLoading || !data) {
    return (
      <Card className="shadow-sm" data-testid="card-trendyol">
        <CardHeader className="px-4 py-3 hairline-b">
          <CardTitle className="text-sm font-medium">Trendyol International</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const categoryName =
    categories.data?.find((category) => category.id === categoryId)?.name ?? data.categoryName;
  const status = approvalText(data);

  const send = () => {
    setNotice(null);
    push.mutate(
      {
        categoryId: categoryId || null,
        categoryName,
        brandId: brandId || null,
        brandName: brandName || null,
        salePrice,
        listPrice,
        attributes: attributes.map((attribute) => ({
          attributeId: attribute.id,
          valueId: attribute.valueId,
          custom: attribute.custom,
        })),
      },
      {
        onError: (error) => setNotice(error.message),
      },
    );
  };

  return (
    <Card className="shadow-sm" data-testid="card-trendyol">
      <CardHeader className="px-4 py-3 hairline-b">
        <CardTitle className="text-sm font-medium">Trendyol International</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-3">
        {data.currency ? (
          <p className="text-xs text-muted-foreground">
            {data.storefront} · {data.currency}
            {data.vatRate != null ? ` · VAT ${data.vatRate}%` : ""}
          </p>
        ) : null}
        {status ? (
          <p className="text-xs text-muted-foreground" data-testid="trendyol-approval">
            {status}
          </p>
        ) : null}
        {notice ? (
          <p className="text-xs text-muted-foreground" data-testid="trendyol-wait">
            {notice}{" "}
            {!data.connected ? (
              <button type="button" className="underline" onClick={() => setLocation("/settings")}>
                Settings
              </button>
            ) : null}
          </p>
        ) : null}
        <div className="space-y-1.5">
          <label className="text-xs font-medium">Category</label>
          <Select
            value={categoryId || undefined}
            onValueChange={async (value) => {
              setCategoryId(value);
              setAttributes(await trendyolAttributes(value));
            }}
            disabled={!data.connected}
          >
            <SelectTrigger className="h-8 text-sm" data-testid="trendyol-category">
              <SelectValue placeholder={categoryName || "Trendyol category"} />
            </SelectTrigger>
            <SelectContent>
              {(categories.data ?? []).map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium">Brand</label>
          <div className="flex gap-2">
            <Input
              value={brandQuery}
              onChange={(event) => setBrandQuery(event.target.value)}
              placeholder={brandName || "Search Trendyol brands"}
              className="h-8 text-sm"
              disabled={!data.connected}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              disabled={!data.connected || !brandQuery.trim()}
              onClick={async () => setBrandHits(await trendyolBrands(brandQuery.trim()))}
            >
              Find
            </Button>
          </div>
          {brandName ? <p className="text-xs text-muted-foreground">{brandName}</p> : null}
          {brandHits.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {brandHits.map((brand) => (
                <Button
                  key={brand.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    setBrandId(brand.id);
                    setBrandName(brand.name);
                    setBrandHits([]);
                  }}
                >
                  {brand.name}
                </Button>
              ))}
            </div>
          ) : null}
        </div>
        {attributes.map((attribute) => (
          <div key={attribute.id} className="space-y-1.5">
            <label className="text-xs font-medium">{attribute.name}</label>
            {attribute.choices.length > 0 ? (
              <Select
                value={attribute.valueId || undefined}
                onValueChange={(value) =>
                  setAttributes((current) =>
                    current.map((item) =>
                      item.id === attribute.id ? { ...item, valueId: value, custom: null } : item,
                    ),
                  )
                }
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder={attribute.name} />
                </SelectTrigger>
                <SelectContent>
                  {attribute.choices.map((choice) => (
                    <SelectItem key={choice.id} value={choice.id}>
                      {choice.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={attribute.custom ?? ""}
                onChange={(event) =>
                  setAttributes((current) =>
                    current.map((item) =>
                      item.id === attribute.id
                        ? { ...item, custom: event.target.value, valueId: null }
                        : item,
                    ),
                  )
                }
                className="h-8 text-sm"
              />
            )}
          </div>
        ))}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Sale price</label>
            <Input
              value={salePrice}
              onChange={(event) => setSalePrice(event.target.value)}
              className="h-8 text-sm tabular-nums"
              inputMode="decimal"
              data-testid="trendyol-sale-price"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">List price</label>
            <Input
              value={listPrice}
              onChange={(event) => setListPrice(event.target.value)}
              className="h-8 text-sm tabular-nums"
              inputMode="decimal"
              data-testid="trendyol-list-price"
            />
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          data-testid="button-trendyol-push"
          onClick={send}
          disabled={push.isPending}
        >
          {push.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
          Push
        </Button>
      </CardContent>
    </Card>
  );
}
