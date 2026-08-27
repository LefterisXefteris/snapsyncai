import { ImagePlus, Layers, Star, Trash2, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Group } from "@/hooks/use-staged-images";
import { addTargets, confirmCount } from "@/lib/draft-products";
import { useState } from "react";

export function ListingInspector({
  drafts,
  selectedIds,
  focusedDraftId,
  failedDraftIds,
  isUploading,
  onChoosePhotos,
  onFocusDraft,
  onSelectPhoto,
  onGroup,
  onAddTo,
  onSeparate,
  onSetThumbnail,
  onSplit,
  onDeleteDraft,
  onDeletePhoto,
  onConfirm,
  onRetry,
}: {
  drafts: Group[];
  selectedIds: Set<string>;
  focusedDraftId: string | null;
  failedDraftIds: Set<string>;
  isUploading: boolean;
  onChoosePhotos: () => void;
  onFocusDraft: (id: string) => void;
  onSelectPhoto: (photoId: string, draftId: string, e: React.MouseEvent) => void;
  onGroup: () => void;
  onAddTo: (destId: string) => void;
  onSeparate: () => void;
  onSetThumbnail: (photoId: string) => void;
  onSplit: (draftId: string) => void;
  onDeleteDraft: (draftId: string) => void;
  onDeletePhoto: (photoId: string) => void;
  onConfirm: () => void;
  onRetry: (draftId: string) => void;
}) {
  const [chooser, setChooser] = useState(false);
  const focus = drafts.find(d => d.id === focusedDraftId) ?? drafts[0];
  const preview = focus?.items.find(i => selectedIds.has(i.id)) ?? focus?.items[0];
  const targets = addTargets(drafts, selectedIds);
  const n = confirmCount(drafts);

  return (
    <div className="grid h-full min-h-0 grid-cols-[240px_1fr] grid-rows-[auto_1fr_auto]">
      <div className="col-span-2 flex items-center justify-between gap-2 border-b border-white/5 px-4 py-2">
        <div>
          <h1 className="font-display text-sm font-semibold">New listing</h1>
          <p className="text-[11px] text-muted-foreground">
            Choose photos, then Group angles of one product. Create makes every draft on this canvas.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="outline" disabled={isUploading} onClick={onChoosePhotos}>
            <ImagePlus /> Choose photos
          </Button>
          {drafts.length > 0 && (
            <Button size="sm" disabled={isUploading} onClick={onConfirm} data-testid="button-upload-preview">
              Create {n} product{n === 1 ? "" : "s"}
            </Button>
          )}
        </div>
      </div>

      <aside className="min-h-0 overflow-auto border-r border-white/5 bg-black/30">
        {drafts.map(d => {
          const thumb = d.items[0];
          if (!thumb) return null;
          const active = d.id === focus?.id;
          const failed = failedDraftIds.has(d.id);
          return (
            <div
              key={d.id}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-white/5",
                active && "bg-white/10",
                failed && "bg-destructive/10",
              )}
            >
              <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => onFocusDraft(d.id)}>
                <img src={thumb.url} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
                <div className="min-w-0">
                  <div className="truncate font-medium">
                    {d.items.length} photo{d.items.length === 1 ? "" : "s"}
                  </div>
                </div>
              </button>
              {failed && (
                <button
                  type="button"
                  className="text-destructive underline"
                  onClick={() => onRetry(d.id)}
                >
                  Retry
                </button>
              )}
            </div>
          );
        })}
      </aside>

      <main className="flex min-h-0 flex-col bg-black/50">
        <div className="flex min-h-0 flex-1 items-center justify-center p-6">
          {preview ? (
            <img
              src={preview.url}
              alt={preview.file.name}
              className="max-h-full max-w-lg rounded-2xl object-contain"
            />
          ) : (
            <p className="text-sm text-muted-foreground">Choose photos to start a New listing.</p>
          )}
        </div>
        {focus && (
          <div className="flex gap-2 overflow-x-auto border-t border-white/5 p-3">
            {focus.items.map((photo, index) => (
              <div key={photo.id} className="relative shrink-0">
                <button
                  type="button"
                  onClick={e => onSelectPhoto(photo.id, focus.id, e)}
                  className={cn(
                    "w-16 overflow-hidden rounded-md",
                    selectedIds.has(photo.id) && "ring-2 ring-primary",
                    index === 0 && "outline outline-1 outline-white/40",
                  )}
                >
                  <img src={photo.url} alt="" className="aspect-square w-full object-cover" />
                </button>
                <button
                  type="button"
                  className="absolute -right-1 -top-1 rounded-full bg-black/70 p-0.5 text-[10px] text-white/80 hover:bg-red-600"
                  aria-label="Delete photo"
                  onClick={() => onDeletePhoto(photo.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="col-span-2 flex flex-wrap items-center gap-2 border-t border-white/5 px-4 py-2">
        <Button size="sm" disabled={selectedIds.size < 2 || isUploading} onClick={onGroup}>
          <Layers /> Group
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={selectedIds.size === 0 || targets.length === 0 || isUploading}
          onClick={() => setChooser(v => !v)}
        >
          Add to…
        </Button>
        {chooser && (
          <div className="flex max-w-xl flex-wrap gap-1">
            {targets.map(d => {
              const thumb = d.items[0];
              if (!thumb) return null;
              return (
                <button
                  key={d.id}
                  type="button"
                  className="flex items-center gap-1 rounded bg-white/10 px-1.5 py-1 text-[11px]"
                  onClick={() => {
                    onAddTo(d.id);
                    setChooser(false);
                  }}
                >
                  <img src={thumb.url} alt="" className="h-6 w-6 rounded-sm object-cover" />
                  {d.items.length} photo{d.items.length === 1 ? "" : "s"}
                </button>
              );
            })}
          </div>
        )}
        <Button size="sm" variant="outline" disabled={selectedIds.size === 0 || isUploading} onClick={onSeparate}>
          <Unplug /> Separate
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={!preview || isUploading}
          onClick={() => preview && onSetThumbnail(preview.id)}
        >
          <Star /> Set as thumbnail
        </Button>
        {focus && focus.items.length > 1 && (
          <Button size="sm" variant="ghost" disabled={isUploading} onClick={() => onSplit(focus.id)}>
            Split
          </Button>
        )}
        {focus && (
          <Button size="sm" variant="ghost" disabled={isUploading} onClick={() => onDeleteDraft(focus.id)}>
            <Trash2 /> Delete draft
          </Button>
        )}
      </footer>
    </div>
  );
}
