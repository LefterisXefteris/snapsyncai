import { ImagePlus, Layers, Star, Trash2, Unplug } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Group } from "@/hooks/use-staged-images";
import { addTargets, confirmCount } from "@/lib/draft-products";

export function ListingLightTable({
  drafts,
  selectedIds,
  failedDraftIds,
  isUploading,
  onChoosePhotos,
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
  failedDraftIds: Set<string>;
  isUploading: boolean;
  onChoosePhotos: () => void;
  onSelectPhoto: (photoId: string, e: React.MouseEvent) => void;
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
  const [addOpen, setAddOpen] = useState(false);
  const cells = drafts.flatMap((draft) => draft.items.map((photo) => ({ draft, photo })));
  const selectedPhotos = cells
    .filter((cell) => selectedIds.has(cell.photo.id))
    .map((cell) => cell.photo);
  const selectedDraft = draftForSelection(drafts, selectedIds);
  const targets = addTargets(drafts, selectedIds);
  const n = confirmCount(drafts);
  const selectedPhotoId = selectedIds.size === 1 ? [...selectedIds][0] : null;

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-black/40">
      <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary/80">New listing</p>
          <h1 className="mt-1 font-display text-lg font-semibold">Create products from photos</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Select photos — they collect in the dock. Group angles of one product, then create.
          </p>
        </div>
        <Button size="sm" variant="outline" disabled={isUploading} onClick={onChoosePhotos}>
          <ImagePlus /> Choose photos
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-6 pb-40">
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
          {cells.map(({ draft, photo }) => {
            const clustered = draft.items.length > 1;
            const failed = failedDraftIds.has(draft.id);
            const isThumb = clustered && draft.items[0]?.id === photo.id;
            return (
              <div key={photo.id} className="relative">
                <button
                  type="button"
                  onClick={(e) => onSelectPhoto(photo.id, e)}
                  className={cn(
                    "w-full overflow-hidden rounded-2xl",
                    selectedIds.has(photo.id) && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                    clustered && "outline outline-2 outline-white/30",
                    failed && "outline outline-2 outline-destructive/70",
                  )}
                >
                  <img
                    src={photo.url}
                    alt={photo.file.name}
                    className="aspect-[3/4] w-full object-cover"
                  />
                </button>
                {isThumb && (
                  <span className="pointer-events-none absolute left-1 top-1 rounded bg-black/70 px-1 py-0.5 text-[9px] uppercase tracking-wide text-white/90">
                    Thumbnail
                  </span>
                )}
                {failed && (
                  <button
                    type="button"
                    className="absolute bottom-1 left-1 rounded bg-destructive px-1.5 py-0.5 text-[10px] font-medium text-destructive-foreground"
                    onClick={() => onRetry(draft.id)}
                  >
                    Retry
                  </button>
                )}
                <button
                  type="button"
                  className="absolute -right-1 -top-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] text-white/80 hover:bg-red-600"
                  aria-label="Delete photo"
                  onClick={() => onDeletePhoto(photo.id)}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-4">
        <div className="pointer-events-auto w-full max-w-3xl rounded-2xl bg-card/95 p-3 shadow-2xl backdrop-blur">
          <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {selectedIds.size === 0
                ? "Select photos — they collect here"
                : `${selectedIds.size} selected`}
            </span>
            <Button
              size="sm"
              disabled={isUploading || drafts.length === 0}
              onClick={onConfirm}
              data-testid="button-upload-preview"
            >
              Create {n} product{n === 1 ? "" : "s"}
            </Button>
          </div>
          <div className="flex items-end gap-3">
            <div className="flex min-h-16 flex-1 gap-1 overflow-x-auto">
              {selectedPhotos.map((photo) => (
                <img
                  key={photo.id}
                  src={photo.url}
                  alt={photo.file.name}
                  className="h-16 w-12 shrink-0 rounded-md object-cover"
                />
              ))}
            </div>
            <div className="flex shrink-0 flex-col gap-1">
              <Button size="sm" disabled={selectedIds.size < 2 || isUploading} onClick={onGroup}>
                <Layers /> Group
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={selectedIds.size === 0 || targets.length === 0 || isUploading}
                onClick={() => setAddOpen(true)}
              >
                Add to…
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={selectedIds.size === 0 || isUploading}
                onClick={onSeparate}
              >
                <Unplug /> Separate
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={!selectedPhotoId || isUploading}
                onClick={() => selectedPhotoId && onSetThumbnail(selectedPhotoId)}
              >
                <Star /> Thumbnail
              </Button>
              {selectedDraft && selectedDraft.items.length > 1 && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={isUploading}
                  onClick={() => onSplit(selectedDraft.id)}
                >
                  Split
                </Button>
              )}
              {selectedDraft && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={isUploading}
                  onClick={() => onDeleteDraft(selectedDraft.id)}
                >
                  <Trash2 /> Delete draft
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to draft product</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {targets.map((draft) => {
              const thumb = draft.items[0];
              if (!thumb) return null;
              return (
                <button
                  key={draft.id}
                  type="button"
                  className="flex items-center gap-2 rounded-xl bg-background p-2 text-left text-sm"
                  onClick={() => {
                    onAddTo(draft.id);
                    setAddOpen(false);
                  }}
                >
                  <img src={thumb.url} alt="" className="h-12 w-12 rounded-lg object-cover" />
                  {draft.items.length} photo{draft.items.length === 1 ? "" : "s"}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function draftForSelection(drafts: Group[], selectedIds: Set<string>): Group | null {
  const ids = [...selectedIds];
  if (ids.length === 0) return null;
  const first = drafts.find((draft) => draft.items.some((item) => item.id === ids[0]));
  if (!first) return null;
  if (ids.every((id) => first.items.some((item) => item.id === id))) return first;
  return null;
}
