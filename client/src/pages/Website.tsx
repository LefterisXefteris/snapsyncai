import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWebsitePrototype, useWebsitePrototypeSave } from "@/hooks/use-website";
import { useOverflowConfirm } from "@/hooks/use-overflow-confirm";
import { overflowNoticeText } from "@/lib/overflow-copy";
import { workspaceNavItem } from "@/lib/workspace-nav";
import {
  WEBSITE_BRIEF_HINT,
  WEBSITE_BRIEF_LABEL,
  WEBSITE_EMPTY,
  WEBSITE_NEEDS_SHOPIFY,
  WEBSITE_PUBLISH_WAITS,
} from "@/lib/website-copy";

export default function WebsitePage() {
  const prototype = useWebsitePrototype();
  const save = useWebsitePrototypeSave();
  const overflow = useOverflowConfirm();
  const settings = workspaceNavItem("settings");
  const [hydrated, setHydrated] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [brief, setBrief] = useState("");

  useEffect(() => {
    if (!prototype.data || hydrated) return;
    setSelectedIds(prototype.data.productIds);
    setBrief(prototype.data.brief);
    setHydrated(true);
  }, [prototype.data, hydrated]);

  const products = prototype.data?.products ?? [];
  const selected = new Set(selectedIds);
  const allSelected = products.length > 0 && selected.size === products.length;

  const persist = (productIds: number[], nextBrief: string) => {
    save.mutate(
      { productIds, brief: nextBrief },
      {
        onSuccess: (saved) => {
          setSelectedIds(saved.productIds);
          setBrief(saved.brief);
        },
      },
    );
  };

  const toggle = (id: number, checked: boolean) => {
    const next = checked
      ? selectedIds.includes(id)
        ? selectedIds
        : [...selectedIds, id]
      : selectedIds.filter((item) => item !== id);
    setSelectedIds(next);
    persist(next, brief);
  };

  return (
    <div className="h-full w-full flex flex-col bg-transparent text-foreground overflow-hidden">
      <div className="p-3 glass-chrome border-b z-10 sticky top-0">
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-display text-sm font-semibold">Website</h1>
          <Button size="sm" disabled data-testid="button-website-publish">
            <Globe className="w-3.5 h-3.5 mr-1.5" />
            Publish
          </Button>
        </div>
        {overflow.overflowNotice ? (
          <p className="text-xs text-muted-foreground mt-2" data-testid="text-overflow-notice">
            {overflowNoticeText(overflow.overagePence)}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground mt-2" data-testid="text-publish-waits">
          {WEBSITE_PUBLISH_WAITS}
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 max-w-2xl space-y-4">
          {prototype.isLoading || (prototype.data && !hydrated) ? (
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
              <label className="block space-y-2">
                <span className="text-sm font-medium">{WEBSITE_BRIEF_LABEL}</span>
                <textarea
                  value={brief}
                  onChange={(event) => setBrief(event.target.value)}
                  onBlur={() => persist(selectedIds, brief)}
                  className="w-full min-h-20 rounded-md border border-border/60 bg-transparent p-2 text-sm"
                  data-testid="input-website-brief"
                />
                <span className="text-xs text-muted-foreground">{WEBSITE_BRIEF_HINT}</span>
              </label>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{selectedIds.length} selected</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const next = allSelected ? [] : products.map((product) => product.id);
                    setSelectedIds(next);
                    persist(next, brief);
                  }}
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
        </div>
      </ScrollArea>
      {overflow.dialog}
    </div>
  );
}
