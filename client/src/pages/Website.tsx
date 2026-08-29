import { useState } from "react";
import { Link } from "wouter";
import { Globe, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useWebsiteHandoff, useWebsitePrototype } from "@/hooks/use-website";
import { workspaceNavItem } from "@/lib/workspace-nav";
import { WEBSITE_EMPTY, WEBSITE_LOOK_HINT, WEBSITE_NEEDS_SHOPIFY } from "@/lib/website-copy";

export default function WebsitePage() {
  const prototype = useWebsitePrototype();
  const handoff = useWebsiteHandoff();
  const settings = workspaceNavItem("settings");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [look, setLook] = useState("");

  const products = prototype.data?.products ?? [];
  const allSelected = products.length > 0 && selectedIds.size === products.length;

  const selectedCount = selectedIds.size;

  const toggle = (id: number, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const build = () => {
    handoff.mutate(
      { productIds: Array.from(selectedIds), look },
      {
        onSuccess: (result) => {
          window.open(result.lovableUrl, "_blank", "noopener,noreferrer");
        },
      },
    );
  };

  return (
    <div className="h-full w-full flex flex-col bg-transparent text-foreground overflow-hidden">
      <div className="p-3 bg-background/60 backdrop-blur-xl z-10 sticky top-0 shadow-[inset_0_-1px_0_0_hsl(var(--foreground)/0.05)]">
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-display text-sm font-semibold">Website</h1>
          <Button
            size="sm"
            onClick={build}
            disabled={handoff.isPending || selectedCount === 0 || !prototype.data?.shopConnected}
            data-testid="button-website-handoff"
          >
            {handoff.isPending ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Globe className="w-3.5 h-3.5 mr-1.5" />
            )}
            Build website
          </Button>
        </div>
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
                <p className="text-xs text-muted-foreground">
                  Shopify shop {prototype.data.shopDomain}. Checkout stays there. Lovable will ask you to
                  Install its app — SnapSync will not pass credentials.
                </p>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="website-look">Look</Label>
                <p className="text-xs text-muted-foreground">{WEBSITE_LOOK_HINT}</p>
                <Textarea
                  id="website-look"
                  value={look}
                  onChange={(event) => setLook(event.target.value)}
                  rows={3}
                  data-testid="input-website-look"
                />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{selectedCount} selected</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setSelectedIds(allSelected ? new Set() : new Set(products.map((p) => p.id)))
                  }
                >
                  {allSelected ? "Clear" : "Select all"}
                </Button>
              </div>
              <ul className="space-y-2">
                {products.map((product) => {
                  const checked = selectedIds.has(product.id);
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
                        <img
                          src={product.photoUrl}
                          alt=""
                          className="h-10 w-10 rounded object-cover"
                        />
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
    </div>
  );
}
