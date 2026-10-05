import { useState } from "react";
import { Link } from "wouter";
import { Globe, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StorefrontView, type StorefrontDocument } from "@/components/storefront-view";
import { useWebsitePreview, useWebsitePrototype, useWebsitePublish } from "@/hooks/use-website";
import { useOverflowConfirm } from "@/hooks/use-overflow-confirm";
import { overflowNoticeText } from "@/lib/overflow-copy";
import { workspaceNavItem } from "@/lib/workspace-nav";
import {
  WEBSITE_EMPTY,
  WEBSITE_NEEDS_SHOPIFY,
  WEBSITE_PALETTES,
  WEBSITE_PREVIEW_NOTE,
  WEBSITE_TYPES,
} from "@/lib/website-copy";

export default function WebsitePage() {
  const prototype = useWebsitePrototype();
  const preview = useWebsitePreview();
  const publish = useWebsitePublish();
  const overflow = useOverflowConfirm();
  const settings = workspaceNavItem("settings");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [palette, setPalette] = useState<string | null>(null);
  const [typePairing, setTypePairing] = useState<string | null>(null);
  const [previewSite, setPreviewSite] = useState<StorefrontDocument | null>(null);
  const [publishedHost, setPublishedHost] = useState<string | null>(null);
  const [openProductId, setOpenProductId] = useState<number | null>(null);

  const products = prototype.data?.products ?? [];
  const selected = new Set(selectedIds);
  const allSelected = products.length > 0 && selected.size === products.length;
  const ready = selectedIds.length > 0 && palette != null && typePairing != null && prototype.data?.shopConnected;

  const toggle = (id: number, checked: boolean) => {
    setSelectedIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((item) => item !== id);
    });
  };

  const draft = () => ({
    productIds: selectedIds,
    palette: palette ?? "",
    typePairing: typePairing ?? "",
  });

  const showPreview = () => {
    setOpenProductId(null);
    preview.mutate(draft(), {
      onSuccess: (site) => setPreviewSite(site),
    });
  };

  const sendPublish = () => {
    const send = (confirmOverflow: boolean) => {
      publish.mutate(
        { ...draft(), confirmOverflow },
        {
          onSuccess: (result) => setPublishedHost(result.host),
          onError: (error) => {
            if (confirmOverflow) return;
            overflow.retryIfConfirmRequired(error instanceof Error ? error.message : "", send);
          },
        },
      );
    };
    overflow.run(send);
  };

  return (
    <div className="h-full w-full flex flex-col bg-transparent text-foreground overflow-hidden">
      <div className="p-3 glass-chrome border-b z-10 sticky top-0">
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-display text-sm font-semibold">Website</h1>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={showPreview}
              disabled={!ready || preview.isPending}
              data-testid="button-website-preview"
            >
              Preview
            </Button>
            <Button
              size="sm"
              onClick={sendPublish}
              disabled={!ready || publish.isPending}
              data-testid="button-website-publish"
            >
              {publish.isPending ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Globe className="w-3.5 h-3.5 mr-1.5" />
              )}
              Publish
            </Button>
          </div>
        </div>
        {overflow.overflowNotice ? (
          <p className="text-xs text-muted-foreground mt-2" data-testid="text-overflow-notice">
            {overflowNoticeText(overflow.overagePence)}
          </p>
        ) : null}
        {publishedHost ? (
          <p className="text-xs text-muted-foreground mt-2" data-testid="text-published-host">
            Shoppers open {publishedHost}
          </p>
        ) : null}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 max-w-2xl space-y-4">
          {prototype.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : prototype.error ? (
            <p className="text-sm text-destructive">Could not load website prototype.</p>
          ) : !prototype.data?.shopConnected ? (
            <p className="text-sm text-muted-foreground">
              {WEBSITE_NEEDS_SHOPIFY}{" "}
              <Link href={settings.path} className="text-primary underline">
                Settings
              </Link>
            </p>
          ) : products.length === 0 ? (
            <p className="text-sm text-muted-foreground">{WEBSITE_EMPTY}</p>
          ) : (
            <>
              {prototype.data.shopDomain ? (
                <p className="text-xs text-muted-foreground">Shopify shop {prototype.data.shopDomain}.</p>
              ) : null}
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Palette</legend>
                <div className="flex flex-wrap gap-2">
                  {WEBSITE_PALETTES.map((item) => (
                    <Button
                      key={item.id}
                      type="button"
                      size="sm"
                      variant={palette === item.id ? "default" : "outline"}
                      onClick={() => setPalette(item.id)}
                      data-testid={`palette-${item.id}`}
                    >
                      {item.label}
                    </Button>
                  ))}
                </div>
              </fieldset>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Type</legend>
                <div className="flex flex-wrap gap-2">
                  {WEBSITE_TYPES.map((item) => (
                    <Button
                      key={item.id}
                      type="button"
                      size="sm"
                      variant={typePairing === item.id ? "default" : "outline"}
                      onClick={() => setTypePairing(item.id)}
                      data-testid={`type-${item.id}`}
                    >
                      {item.label}
                    </Button>
                  ))}
                </div>
              </fieldset>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{selectedIds.length} selected</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedIds(allSelected ? [] : products.map((product) => product.id))}
                >
                  {allSelected ? "Clear" : "Select all"}
                </Button>
              </div>
              <ul className="space-y-2">
                {products.map((product) => {
                  const checked = selected.has(product.id);
                  return (
                    <li
                      key={product.id}
                      className="flex items-center gap-3 rounded-md border border-border/60 p-2"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => toggle(product.id, value === true)}
                        aria-label={product.title ?? `Product ${product.id}`}
                      />
                      {product.photoUrl ? (
                        <img src={product.photoUrl} alt="" className="h-10 w-10 rounded object-cover" />
                      ) : (
                        <div className="h-10 w-10 rounded bg-muted" />
                      )}
                      <span className="text-sm truncate">{product.title ?? `Product ${product.id}`}</span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          {previewSite ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{WEBSITE_PREVIEW_NOTE}</p>
              <div className="rounded-md overflow-hidden border border-border/60">
                <StorefrontView
                  storefront={previewSite}
                  productId={openProductId}
                  onOpenProduct={setOpenProductId}
                  onOpenHome={() => setOpenProductId(null)}
                />
              </div>
            </div>
          ) : null}
        </div>
      </ScrollArea>
      {overflow.dialog}
    </div>
  );
}
