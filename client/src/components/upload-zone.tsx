import { useCallback, useState, useEffect, useMemo, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, Loader2, ImagePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { isImageLikeFile } from "@/lib/image-file-utils";
import { useUploadImages } from "@/hooks/use-images";
import { useToast } from "@/hooks/use-toast";
import { Group, FileItem, useStagedImages } from "@/hooks/use-staged-images";
import { useGroupSelection } from "@/hooks/use-group-selection";
import { ListingInspector } from "@/components/listing-inspector";
import {
  addToDraft,
  extractAsDraft,
  separateAsDraft,
  setThumbnail,
} from "@/lib/draft-products";

interface GroupWithLabel extends Group {
  label?: string;
  confidence?: "high" | "medium" | "low";
}

// ── Main component ────────────────────────────────────────────────────────────

export function UploadZone({
  onUploadingChange,
  onStagedCountChange,
  onFreshDrop,
  panelSize,
}: {
  onUploadingChange?: (files: File[]) => void;
  onStagedCountChange?: (count: number) => void;
  /** Fires when the user actively drops/selects new files (NOT on IDB restore). */
  onFreshDrop?: () => void;
  /** Current sidebar panel width as a percentage (from react-resizable-panels).
   *  Drives responsive thumbnail scaling so images grow as the user drags
   *  the sidebar wider. */
  panelSize?: number;
}) {
  const [groups, setGroups] = useState<GroupWithLabel[]>([]);
  const orderedItemIds = useMemo(
    () => groups.flatMap(g => g.items.map(i => i.id)),
    [groups],
  );
  const {
    selected: selectedIds,
    handleClick: handleThumbnailClick,
    clear: clearSelection,
    setSelected,
  } = useGroupSelection(orderedItemIds);
  const [focusedGroupId, setFocusedGroupId] = useState<string | null>(null);
  const [failedGroupIds, setFailedGroupIds] = useState<Set<string>>(new Set());
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [uploadingQueue, setUploadingQueue] = useState<File[]>([]);
  const uploadMutation = useUploadImages();
  const { toast } = useToast();
  const { loadStaged, saveBlob, deleteBlob, saveGroups, clearAll } = useStagedImages();

  // Revoke object URLs on unmount
  const urlsRef = useRef<string[]>([]);
  useEffect(() => () => { urlsRef.current.forEach(URL.revokeObjectURL); }, []);

  // Restore staged images on mount
  useEffect(() => {
    async function restore() {
      const { groups: restored, urlsCreated } = await loadStaged();
      if (restored.length === 0) return;
      urlsCreated.forEach(u => urlsRef.current.push(u));
      setGroups(restored);
    }
    restore();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { onUploadingChange?.(uploadingQueue); }, [uploadingQueue, onUploadingChange]);

  const totalFiles = groups.reduce((sum, g) => sum + g.items.length, 0);

  // Notify parent whenever staged item count changes so the workspace can
  // expand the sidebar to give the grouping grid more room.
  useEffect(() => { onStagedCountChange?.(totalFiles); }, [totalFiles, onStagedCountChange]);

  // ── Thumbnail click adapter: update focused group + delegate to hook ───────
  const onThumbnailSelect = useCallback(
    (id: string, groupId: string, e: React.MouseEvent) => {
      setFocusedGroupId(groupId);
      handleThumbnailClick(id, e);
    },
    [handleThumbnailClick],
  );

  // ── Esc clears selection; Cmd/Ctrl+A selects everything in focused group ──
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        clearSelection();
        setFocusedGroupId(null);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "a" || e.key === "A")) {
        if (focusedGroupId === null) return; // no focused group → let browser default run
        const focusedGroup = groups.find(g => g.id === focusedGroupId);
        if (!focusedGroup) return;
        e.preventDefault();
        setSelected(new Set(focusedGroup.items.map(i => i.id)));
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [groups, focusedGroupId, clearSelection, setSelected]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newItems: FileItem[] = acceptedFiles.map(f => {
      const url = URL.createObjectURL(f);
      urlsRef.current.push(url);
      return { id: crypto.randomUUID(), file: f, url };
    });

    setGroups(prev => {
      const existingCount = prev.reduce((n, g) => n + g.items.length, 0);
      if (existingCount + newItems.length > 200) {
        toast({ title: "Too many images", description: "Max 200 per upload.", variant: "destructive" });
        return prev;
      }
      // Each dropped file becomes its own one-item group, appended to the end.
      // No rechunking of existing groups — manual-first UX (GROUP-05/06/08).
      const newGroups: GroupWithLabel[] = newItems.map(item => ({
        id: crypto.randomUUID(),
        items: [item],
        maxImages: Number.MAX_SAFE_INTEGER, // vestigial; kept for IDB back-compat
      }));
      const next = [...prev, ...newGroups];
      // Persist new blobs and updated groups (fire-and-forget)
      Promise.all(newItems.map(item => saveBlob(item.id, item.file)))
        .then(() => saveGroups(next))
        .catch(err => console.warn('[upload-zone] IDB save failed:', err));
      return next;
    });

    // Signal parent that user actively dropped files (not IDB restore)
    onFreshDrop?.();
  }, [toast, saveBlob, saveGroups, onFreshDrop]);

  const handleDropRejected = useCallback(() => {
    toast({
      title: "Unsupported image format",
      description: "Drop PNG, JPG, WEBP, GIF, BMP, TIFF, HEIC, or AVIF images.",
      variant: "destructive",
    });
  }, [toast]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    onDropRejected: handleDropRejected,
    accept: {
      "image/*": [
        ".png",
        ".jpg",
        ".jpeg",
        ".webp",
        ".gif",
        ".bmp",
        ".tif",
        ".tiff",
        ".heic",
        ".heif",
        ".avif",
      ],
    },
    validator: (file) =>
      isImageLikeFile({ name: file.name, type: file.type })
        ? null
        : { code: "file-invalid-type", message: "Unsupported image format" },
    noClick: true,
    noKeyboard: true,
    noDragEventsBubbling: true,
  });

  // ── Split a group into individual products ─────────────────────────────────
  const splitGroup = (groupId: string) => {
    setGroups(prev => {
      const idx = prev.findIndex(g => g.id === groupId);
      if (idx === -1) return prev;
      const next = [...prev];
      const [group] = next.splice(idx, 1);
      const singles = group.items.map(item => ({ id: crypto.randomUUID(), items: [item], maxImages: Number.MAX_SAFE_INTEGER }));
      next.splice(idx, 0, ...singles);
      saveGroups(next);
      return next;
    });
  };

  // ── Delete entire group ────────────────────────────────────────────────────
  const deleteGroup = (groupId: string) => {
    setGroups(prev => {
      const group = prev.find(g => g.id === groupId);
      if (group) group.items.forEach(i => deleteBlob(i.id));
      const next = prev.filter(g => g.id !== groupId);
      saveGroups(next);
      return next;
    });
  };

  // ── Remove item ──────────────────────────────────────────────────────────────
  const removeItem = (itemId: string) => {
    deleteBlob(itemId); // fire-and-forget
    setGroups(prev => {
      const next = prev.map(g => ({ ...g, items: g.items.filter(i => i.id !== itemId) }))
        .filter(g => g.items.length > 0);
      saveGroups(next); // fire-and-forget
      return next;
    });
  };

  const stampDrafts = (next: { id: string; items: FileItem[] }[], prev: GroupWithLabel[]): GroupWithLabel[] =>
    next.map(d => ({
      id: d.id,
      items: d.items,
      maxImages: prev.find(g => g.id === d.id)?.maxImages ?? Number.MAX_SAFE_INTEGER,
    }));

  const handleGroup = () => {
    const ids = Array.from(selectedIds);
    if (ids.length < 2) return;
    const newId = crypto.randomUUID();
    setGroups(prev => {
      const stamped = stampDrafts(extractAsDraft(prev, ids, newId), prev);
      saveGroups(stamped);
      return stamped;
    });
    setFocusedGroupId(newId);
    clearSelection();
  };

  const handleAddTo = (destId: string) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setGroups(prev => {
      const stamped = stampDrafts(addToDraft(prev, ids, destId), prev);
      saveGroups(stamped);
      return stamped;
    });
    setFocusedGroupId(destId);
    clearSelection();
  };

  const handleSeparate = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const newId = crypto.randomUUID();
    setGroups(prev => {
      const stamped = stampDrafts(separateAsDraft(prev, ids, newId), prev);
      saveGroups(stamped);
      return stamped;
    });
    setFocusedGroupId(newId);
    clearSelection();
  };

  const handleSetThumbnail = (photoId: string) => {
    setGroups(prev => {
      const stamped = stampDrafts(setThumbnail(prev, photoId), prev);
      saveGroups(stamped);
      return stamped;
    });
  };

  // ── Confirm / Upload with per-group failure isolation (GROUP-10) ───────────
  // Each group uploads independently. Successful groups have their IDB blobs
  // cleared. Failed groups remain in the grid with an inline Retry button.
  // A single failure never wipes other successful groups.
  const handleConfirm = async () => {
    if (groups.length === 0) return;

    // Snapshot at start so concurrent state updates don't mutate our plan.
    const snapshot: GroupWithLabel[] = groups.map(g => ({ ...g, items: [...g.items] }));
    const allFiles = snapshot.flatMap(g => g.items.map(i => i.file));

    setIsUploading(true);
    setUploadProgress({ current: 0, total: snapshot.length });
    setUploadingQueue(allFiles);

    const failed: GroupWithLabel[] = [];
    const CONCURRENCY = 2;

    for (let i = 0; i < snapshot.length; i += CONCURRENCY) {
      const batch = snapshot.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map(async (group) => {
        try {
          await uploadMutation.mutateAsync({
            files: group.items.map(it => it.file),
            groupAsOne: group.items.length > 1,
            hideToast: true,
          });
          // Per-group success → clear IDB blobs for this group only.
          for (const it of group.items) {
            await deleteBlob(it.id);
          }
        } catch (err) {
          console.error("[upload-zone] group upload failed:", err);
          failed.push(group);
        } finally {
          setUploadProgress(prev => ({ ...prev, current: prev.current + 1 }));
        }
      }));
    }

    // After all batches settle: ONLY failed groups remain in React state + IDB.
    setGroups(failed);
    await saveGroups(failed);
    // CRITICAL: populate failedGroupIds from the settled failed array so
    // Retry buttons actually render. Without this line GROUP-10 silently
    // breaks — the user sees failed groups but no affordance to recover.
    setFailedGroupIds(new Set(failed.map(g => g.id)));

    setUploadingQueue([]);
    setIsUploading(false);

    if (failed.length === 0) {
      clearAll(); // fire-and-forget — nothing left to stage
      setFailedGroupIds(new Set());
      toast({
        title: "Products Ready",
        description: `${snapshot.length} product${snapshot.length !== 1 ? "s" : ""} created`,
      });
    } else {
      toast({
        title: "Some uploads failed",
        description: `${failed.length} of ${snapshot.length} groups failed. Click Retry on each.`,
        variant: "destructive",
      });
    }
  };

  // ── Retry a single failed group ────────────────────────────────────────────
  const retryGroup = async (groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    try {
      await uploadMutation.mutateAsync({
        files: group.items.map(it => it.file),
        groupAsOne: group.items.length > 1,
        hideToast: true,
      });
      // Success: clear blobs for every item in this group.
      for (const it of group.items) {
        await deleteBlob(it.id);
      }
      // Remove this id from failedGroupIds and from groups.
      setFailedGroupIds(prev => {
        const next = new Set(prev);
        next.delete(groupId);
        return next;
      });
      setGroups(prev => {
        const next = prev.filter(g => g.id !== groupId);
        if (next.length === 0) {
          clearAll(); // fire-and-forget
        } else {
          saveGroups(next); // fire-and-forget
        }
        return next;
      });
      toast({
        title: "Upload successful",
        description: "Product created.",
      });
    } catch (err) {
      console.error("[upload-zone] retry failed:", err);
      // Leave failedGroupIds unchanged — the Retry button stays visible.
      toast({
        title: "Retry failed",
        description: "The upload failed again. You can try once more.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (focusedGroupId && groups.some(g => g.id === focusedGroupId)) return;
    setFocusedGroupId(groups[0]?.id ?? null);
  }, [groups, focusedGroupId]);

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div
      {...getRootProps({
        className: "flex h-full min-h-0 w-full flex-col",
      })}
    >
      <input {...getInputProps()} data-testid="input-file-upload" />

      {totalFiles === 0 && !isUploading && (
      <div className="mx-auto w-full max-w-3xl space-y-4 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary/80">New listing</p>
          <h2 className="mt-1 font-display text-lg font-semibold tracking-tight text-foreground">
            Create products from photos
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Choose photos. Each photo starts as its own draft product. Group angles of the same product before you create.
          </p>
        </div>
      </div>

      {/* Empty state is a confident primary action; the staged state collapses
          to a compact add-more row so the product groups stay in focus. */}
      <button
        type="button"
        onClick={() => {
          if (!isUploading) open();
        }}
        disabled={isUploading}
        aria-label="Choose product photos"
        className={cn(
          "relative group w-full overflow-hidden border text-left transition-all duration-300 disabled:cursor-wait disabled:opacity-60 min-h-[220px] rounded-2xl p-5 sm:p-6",
          isDragActive
            ? "border-primary bg-primary/10 shadow-[0_0_36px_-12px_hsl(var(--primary)/0.55)]"
            : "border-dashed border-foreground/15 bg-card/35 hover:border-primary/45 hover:bg-card/55"
        )}
      >
        <div
          aria-hidden
          className={cn(
            "absolute inset-0 pointer-events-none transition-opacity duration-500",
            isDragActive ? "opacity-100" : "opacity-40 group-hover:opacity-70",
          )}
          style={{
            background:
              "radial-gradient(circle at 100% 120%, hsl(var(--aurora-1) / 0.18), transparent 55%), radial-gradient(circle at 0% 0%, hsl(var(--aurora-2) / 0.12), transparent 48%)",
          }}
        />
        <div className={cn(
          "relative z-10 flex min-h-[168px] flex-col items-center justify-center text-center"
        )}>
          <div className={cn(
            "flex shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-105 h-12 w-12",
            isDragActive && "scale-110"
          )}>
            {isDragActive
              ? <UploadCloud className="h-5 w-5" />
              : <ImagePlus className="h-5 w-5" />}
          </div>

          <p className="mt-4 font-display text-base font-semibold text-foreground">
            {isDragActive ? "Drop your photos here" : "Choose product photos"}
          </p>
          <p className="mt-1.5 max-w-[250px] text-xs leading-relaxed text-muted-foreground">
            Each photo starts as its own draft product. Group several photos of one product, then create.
          </p>
          <span className="mt-4 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-[0_8px_24px_-10px_hsl(var(--primary)/0.8)]">
            Choose photos
          </span>
          <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground/65">
            PNG · JPG · WEBP · HEIC · up to 200
          </p>
        </div>
      </button>
      </div>
      )}

      {totalFiles > 0 && !isUploading && (
        <div className="min-h-0 flex-1">
          <ListingInspector
            drafts={groups}
            selectedIds={selectedIds}
            focusedDraftId={focusedGroupId}
            failedDraftIds={failedGroupIds}
            isUploading={isUploading}
            onChoosePhotos={open}
            onFocusDraft={setFocusedGroupId}
            onSelectPhoto={onThumbnailSelect}
            onGroup={handleGroup}
            onAddTo={handleAddTo}
            onSeparate={handleSeparate}
            onSetThumbnail={handleSetThumbnail}
            onSplit={splitGroup}
            onDeleteDraft={deleteGroup}
            onDeletePhoto={removeItem}
            onConfirm={handleConfirm}
            onRetry={retryGroup}
          />
        </div>
      )}

      {isUploading && (
        <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
          <div className="flex items-center gap-3">
            <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-white">
                Creating product {uploadProgress.current} of {uploadProgress.total}...
              </p>
            </div>
          </div>
          <div className="w-full bg-white/10 rounded-full h-1.5">
            <div
              className="bg-primary h-1.5 rounded-full transition-all duration-500"
              style={{ width: uploadProgress.total > 0 ? `${(uploadProgress.current / uploadProgress.total) * 100}%` : "0%" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
