import { Link } from "wouter";
import { Inbox, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useImportStart, useImportStatus } from "@/hooks/use-import";
import { IMPORT_IDLE, importStartEnabled } from "@/lib/import-copy";
import { workspaceNavItem } from "@/lib/workspace-nav";

export default function ImportPage() {
  const status = useImportStatus();
  const start = useImportStart();
  const settings = workspaceNavItem("settings");

  const startBlockedReason = status.data?.startBlockedReason ?? null;
  const inProgress = Boolean(status.data?.inProgress) || start.isPending;
  const canStart = importStartEnabled({ startBlockedReason, inProgress });
  const created = status.data?.created ?? 0;
  const skipped = status.data?.skipped ?? 0;
  const failed = status.data?.failed ?? 0;
  const failures = status.data?.failures ?? [];
  const hasCounts = Boolean(status.data?.completed);

  return (
    <div className="h-full w-full flex flex-col bg-transparent text-foreground overflow-hidden">
      <div className="p-3 bg-background/60 backdrop-blur-xl z-10 sticky top-0 shadow-[inset_0_-1px_0_0_hsl(var(--foreground)/0.05)]">
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-display text-sm font-semibold">Import</h1>
          <Button
            size="sm"
            disabled={!canStart}
            onClick={() => start.mutate()}
            data-testid="button-import-start"
          >
            {inProgress ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Inbox className="w-3.5 h-3.5 mr-1.5" />
            )}
            Start
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 max-w-2xl space-y-4">
          {status.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : status.error ? (
            <p className="text-sm text-destructive">Could not load Import.</p>
          ) : startBlockedReason ? (
            <p className="text-sm text-muted-foreground">
              {startBlockedReason}{" "}
              {status.data?.shopConnected === false ? (
                <Link href={settings.path} className="text-primary underline">
                  Settings
                </Link>
              ) : null}
            </p>
          ) : inProgress ? (
            <p className="text-sm text-muted-foreground">Import is in progress.</p>
          ) : hasCounts ? (
            <>
              <p className="text-sm text-muted-foreground">
                Created {created} · skipped {skipped} · failed {failed}
              </p>
              {failures.length > 0 ? (
                <ul className="text-sm text-muted-foreground space-y-1">
                  {failures.map((item) => (
                    <li key={item.channelProductId}>
                      {item.channelProductId}: {item.reason}
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{IMPORT_IDLE}</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
