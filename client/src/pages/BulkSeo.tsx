import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useBulkSeoAccept,
  useBulkSeoCatalogue,
  useBulkSeoRegenerate,
  useBulkSeoStart,
  type BulkSeoPackItem,
} from "@/hooks/use-bulk-seo";
import {
  BULK_SEO_EMPTY,
  bulkSeoEligibleIds,
  bulkSeoEligibleTickCount,
  bulkSeoStartEnabled,
} from "@/lib/bulk-seo";

export default function BulkSeoPage() {
  const catalogue = useBulkSeoCatalogue();
  const start = useBulkSeoStart();
  const regenerate = useBulkSeoRegenerate();
  const accept = useBulkSeoAccept();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [items, setItems] = useState<Record<number, BulkSeoPackItem>>({});
  const [packUseCount, setPackUseCount] = useState(0);
  const [acceptBlockedReason, setAcceptBlockedReason] = useState<string | null>(null);

  const rows = catalogue.data?.rows ?? [];
  const startBlockedReason = catalogue.data?.startBlockedReason ?? null;
  const ticksLocked = startBlockedReason != null;
  const eligibleIds = bulkSeoEligibleIds(rows);
  const eligibleTickCount = bulkSeoEligibleTickCount(rows, selectedIds);
  const allEligibleSelected =
    eligibleIds.length > 0 && eligibleIds.every((id) => selectedIds.has(id));
  const canStart = bulkSeoStartEnabled({ startBlockedReason, eligibleTickCount });
  const started = Object.keys(items).length > 0;
  const proposedUseCount = started ? packUseCount : eligibleTickCount;

  const toggle = (id: number, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const runStart = () => {
    start.mutate(Array.from(selectedIds), {
      onSuccess: (pack) => {
        const next: Record<number, BulkSeoPackItem> = {};
        for (const item of pack.items) next[item.id] = item;
        setItems(next);
        setPackUseCount(pack.proposedUseCount);
        setAcceptBlockedReason(null);
      },
    });
  };

  return (
    <div className="h-full w-full flex flex-col bg-transparent text-foreground overflow-hidden">
      <div className="p-3 bg-background/60 backdrop-blur-xl z-10 sticky top-0 shadow-[inset_0_-1px_0_0_hsl(var(--foreground)/0.05)]">
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-display text-sm font-semibold">Bulk SEO</h1>
          <Button
            size="sm"
            disabled={!canStart || start.isPending}
            onClick={runStart}
            data-testid="button-bulk-seo-start"
          >
            {start.isPending ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Search className="w-3.5 h-3.5 mr-1.5" />
            )}
            Start
            {eligibleTickCount > 0 && !started ? ` (${eligibleTickCount} uses)` : ""}
            {started ? ` (${proposedUseCount} uses)` : ""}
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 max-w-2xl space-y-4">
          {catalogue.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : catalogue.error ? (
            <p className="text-sm text-destructive">Could not load Bulk SEO.</p>
          ) : rows.length === 0 ? (
            <>
              {startBlockedReason ? (
                <p className="text-sm text-muted-foreground">{startBlockedReason}</p>
              ) : null}
              <p className="text-sm text-muted-foreground">{BULK_SEO_EMPTY}</p>
            </>
          ) : (
            <>
              {startBlockedReason ? (
                <p className="text-sm text-muted-foreground">{startBlockedReason}</p>
              ) : null}
              {!started ? (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {eligibleTickCount} selected · accepting all would spend {eligibleTickCount}{" "}
                    {eligibleTickCount === 1 ? "use" : "uses"}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={ticksLocked || eligibleIds.length === 0}
                    onClick={() =>
                      setSelectedIds(allEligibleSelected ? new Set() : new Set(eligibleIds))
                    }
                  >
                    {allEligibleSelected ? "Clear" : "Select all"}
                  </Button>
                </div>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    Accepting these proposals would spend {proposedUseCount}{" "}
                    {proposedUseCount === 1 ? "use" : "uses"}
                  </p>
                  {acceptBlockedReason ? (
                    <p className="text-sm text-muted-foreground">{acceptBlockedReason}</p>
                  ) : null}
                </>
              )}
              <ul className="space-y-2">
                {rows.map((row) => {
                  const canTick = row.eligible && !ticksLocked && !started;
                  const checked = selectedIds.has(row.id);
                  const item = items[row.id];
                  return (
                    <li
                      key={row.id}
                      className="flex flex-col gap-2 rounded-md border border-border/60 p-2"
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={checked}
                          disabled={!canTick}
                          onCheckedChange={(value) => toggle(row.id, value === true)}
                          aria-label={row.title ?? `Product ${row.id}`}
                        />
                        {row.photoUrl ? (
                          <img
                            src={row.photoUrl}
                            alt=""
                            className="h-10 w-10 rounded object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded bg-muted" />
                        )}
                        <div className="min-w-0 flex-1">
                          <span className="text-sm truncate block">
                            {row.title ?? `Product ${row.id}`}
                          </span>
                          {row.blockedReason && !item ? (
                            <span className="text-xs text-muted-foreground">{row.blockedReason}</span>
                          ) : null}
                          {item?.error ? (
                            <span className="text-xs text-muted-foreground">{item.error}</span>
                          ) : null}
                        </div>
                      </div>
                      {item?.proposal ? (
                        <div className="pl-9 space-y-2">
                          <p className="text-xs text-muted-foreground">
                            Queries: {item.queries.join(", ")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Tags: {item.proposal.tags.join(", ")}
                          </p>
                          <p className="text-sm">{item.proposal.seoTitle}</p>
                          <p className="text-xs text-muted-foreground">{item.proposal.seoDescription}</p>
                          <div
                            className="text-sm text-muted-foreground"
                            dangerouslySetInnerHTML={{ __html: item.proposal.description }}
                          />
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              disabled={accept.isPending || acceptBlockedReason != null}
                              onClick={() => {
                                const proposal = item.proposal;
                                if (!proposal) return;
                                accept.mutate(
                                  {
                                    productId: row.id,
                                    tags: proposal.tags,
                                    description: proposal.description,
                                    seoTitle: proposal.seoTitle,
                                    seoDescription: proposal.seoDescription,
                                  },
                                  {
                                    onSuccess: () => {
                                      setItems((prev) => {
                                        const next = { ...prev };
                                        delete next[row.id];
                                        return next;
                                      });
                                      setPackUseCount((count) => Math.max(0, count - 1));
                                    },
                                    onError: (error) => {
                                      const message = error instanceof Error ? error.message : "";
                                      if (message.startsWith("403:")) {
                                        setAcceptBlockedReason(message.replace(/^403:\s*/, ""));
                                      }
                                    },
                                  },
                                );
                              }}
                            >
                              Accept
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={regenerate.isPending}
                              onClick={() =>
                                regenerate.mutate(
                                  { productId: row.id, queries: item.queries },
                                  {
                                    onSuccess: (next) =>
                                      setItems((prev) => ({ ...prev, [row.id]: next })),
                                  },
                                )
                              }
                            >
                              Regenerate
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setItems((prev) => {
                                  const next = { ...prev };
                                  delete next[row.id];
                                  return next;
                                });
                                if (item.proposal) {
                                  setPackUseCount((count) => Math.max(0, count - 1));
                                }
                              }}
                            >
                              Dismiss
                            </Button>
                          </div>
                        </div>
                      ) : null}
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
