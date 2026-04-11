import { useCallback, useState, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import {
  DndContext, DragOverlay, useDroppable,
  MouseSensor, TouchSensor, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { UploadCloud, Loader2, X, Package, Plus, Ungroup, Images, Trash2, Sparkles, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { isImageLikeFile } from "@/lib/image-file-utils";
import { useUploadImages } from "@/hooks/use-images";
import { ShinyButton } from "@/components/ui/shiny-button";
import { useToast } from "@/hooks/use-toast";
import { Group, FileItem, useStagedImages } from "@/hooks/use-staged-images";
import { useAutoGroup } from "@/hooks/use-auto-group";

interface GroupWithLabel extends Group {
  label?: string;
  confidence?: "high" | "medium" | "low";
}

// ── Sortable thumbnail (handles within-group sort AND between-group drag) ─────
function SortableThumbnail({
  item, onRemove, isHero, isSelected, onSelect, selectedIds: allSelectedIds,
}: {
  item: FileItem;
  onRemove: () => void;
  isHero?: boolean;
  isSelected?: boolean;
  onSelect: (id: string) => void;
  selectedIds: Set<string>;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    data: { selectedIds: Array.from(allSelectedIds) },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const size = isHero ? "w-16 h-16" : "w-10 h-10";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative group/thumb flex-shrink-0 cursor-grab active:cursor-grabbing"
      {...attributes}
      {...listeners}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(item.id);
      }}
    >
      <img
        src={item.url}
        alt={item.file.name}
        draggable={false}
        className={cn(
          size,
          "rounded-lg object-cover select-none ring-1 transition-all",
          isSelected
            ? "ring-2 ring-primary ring-offset-1 ring-offset-black/50"
            : "ring-white/10 group-hover/thumb:ring-primary/50 group-hover/thumb:ring-2"
        )}
      />
      {isHero && (
        <div className="absolute -top-1 -left-1 w-3.5 h-3.5 bg-primary rounded-full flex items-center justify-center shadow-sm">
          <span className="text-[7px] font-bold text-white">1</span>
        </div>
      )}
      <button
        className="absolute -top-1 -right-1 w-4 h-4 bg-black/70 rounded-full flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity hover:bg-red-500/80"
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        onPointerDown={e => e.stopPropagation()}
      >
        <X className="w-2.5 h-2.5 text-white" />
      </button>
    </div>
  );
}

// ── Droppable product group card ─────────────────────────────────────────────
function DroppableGroup({
  groupId, groupIdx, items, onRemoveItem, onSplit, onDeleteGroup, totalGroups,
  selectedIds, onSelect, label, confidence,
}: {
  groupId: string;
  groupIdx: number;
  items: FileItem[];
  onRemoveItem: (itemId: string) => void;
  onSplit: () => void;
  onDeleteGroup: () => void;
  totalGroups: number;
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
  label?: string;
  confidence?: "high" | "medium" | "low";
}) {
  const { setNodeRef, isOver } = useDroppable({ id: groupId });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative rounded-xl border transition-all duration-200 overflow-hidden",
        isOver
          ? "border-primary/60 bg-primary/[0.06] shadow-[0_0_20px_-4px_hsl(var(--primary)/0.2)] scale-[1.02]"
          : "border-white/[0.08] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.03]"
      )}
    >
      {isOver && (
        <div className="absolute inset-0 rounded-xl bg-primary/10 border-2 border-primary/60 pointer-events-none z-10 flex items-center justify-center">
          <div className="bg-primary/20 rounded-lg px-3 py-1">
            <span className="text-xs text-primary font-medium">Drop here</span>
          </div>
        </div>
      )}

      {/* Card header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06]">
        <div className="w-5 h-5 rounded-md bg-primary/15 flex items-center justify-center">
          <span className="text-[10px] font-bold text-primary">{groupIdx + 1}</span>
        </div>
        <span className="text-xs font-medium text-white/90">
          {label || `Product ${groupIdx + 1}`}
        </span>
        {confidence && (
          <span className={cn(
            "text-[9px] px-1.5 py-0.5 rounded-full font-medium",
            confidence === "high" ? "bg-green-500/20 text-green-400" :
            confidence === "medium" ? "bg-yellow-500/20 text-yellow-400" :
            "bg-red-500/20 text-red-400"
          )}>
            {confidence}
          </span>
        )}
        <span className="text-[10px] text-white/40 ml-0.5">
          {items.length} {items.length === 1 ? "image" : "images"}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {items.length > 1 && (
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={onSplit}
              className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white/80 transition-colors px-1.5 py-0.5 rounded hover:bg-white/5"
              title="Split into individual products"
            >
              <Ungroup className="w-3 h-3" />
              <span className="hidden sm:inline">Split</span>
            </button>
          )}
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={onDeleteGroup}
            className="flex items-center gap-1 text-[10px] text-white/40 hover:text-red-400 transition-colors px-1.5 py-0.5 rounded hover:bg-red-500/10"
            title="Remove this product"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Images area — SortableContext enables within-group reordering */}
      <SortableContext items={items.map(i => i.id)} strategy={rectSortingStrategy}>
        <div className="flex flex-wrap gap-2 p-3 min-h-[120px]">
          {items.map((item, idx) => (
            <SortableThumbnail
              key={item.id}
              item={item}
              onRemove={() => onRemoveItem(item.id)}
              isHero={idx === 0}
              isSelected={selectedIds.has(item.id)}
              onSelect={onSelect}
              selectedIds={selectedIds}
            />
          ))}
          {isOver && (
            <div className="w-10 h-10 rounded-lg border-2 border-dashed border-primary/50 bg-primary/5 flex items-center justify-center shrink-0 animate-pulse">
              <Plus className="w-3 h-3 text-primary/60" />
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

// ── Droppable "New Product" zone ─────────────────────────────────────────────
function DroppableNewGroup() {
  const { setNodeRef, isOver } = useDroppable({ id: "new-group" });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex items-center justify-center gap-2 px-3 py-3 rounded-xl border border-dashed transition-all duration-200",
        isOver
          ? "border-primary bg-primary/10 text-primary shadow-[0_0_16px_-4px_hsl(var(--primary)/0.3)]"
          : "border-white/10 text-white/30 hover:border-white/20 hover:text-white/50"
      )}
    >
      <Plus className="w-3.5 h-3.5" />
      <span className="text-xs">Drop here to create a new product</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function UploadZone({ onUploadingChange }: { onUploadingChange?: (files: File[]) => void }) {
  const [groups, setGroups] = useState<GroupWithLabel[]>([]);
  const [activeItem, setActiveItem] = useState<FileItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [uploadingQueue, setUploadingQueue] = useState<File[]>([]);
  const [isAutoSorting, setIsAutoSorting] = useState(false);
  const uploadMutation = useUploadImages();
  const { toast } = useToast();
  const { loadStaged, saveBlob, deleteBlob, saveGroups, clearAll } = useStagedImages();
  const autoGroup = useAutoGroup();
  const allItemsRef = useRef<FileItem[]>([]);
  const [fallbackBannerDismissed, setFallbackBannerDismissed] = useState(false);

  // Re-show the fallback banner each time a new auto-group run begins.
  useEffect(() => {
    if (autoGroup.isGrouping) {
      setFallbackBannerDismissed(false);
    }
  }, [autoGroup.isGrouping]);

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

  const sortVariantsIntoProducts = useCallback((items: FileItem[]) => {
    if (items.length === 0) return;
    allItemsRef.current = items;
    setIsAutoSorting(true);
    autoGroup.startGrouping(items, undefined, "variant-family");
  }, [autoGroup]);

  // ── Auto-group: map streamed results to Group[] state ─────────────────────
  useEffect(() => {
    if (!isAutoSorting) return;
    if (autoGroup.groups.length === 0) return;

    const allItems = allItemsRef.current;
    if (allItems.length === 0) return;

    const newGroups: GroupWithLabel[] = autoGroup.groups.map(ag => ({
      id: crypto.randomUUID(),
      items: ag.imageIndices
        .map(idx => allItems[idx])
        .filter(Boolean),
      maxImages: Number.MAX_SAFE_INTEGER,
      label: ag.label,
      confidence: ag.confidence,
    })).filter(g => g.items.length > 0);

    setGroups(newGroups);
    saveGroups(newGroups);
  }, [autoGroup.groups.length, isAutoSorting]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-group finished (success or idle) ─────────────────────────────────
  useEffect(() => {
    if (isAutoSorting && !autoGroup.isGrouping && autoGroup.totalGroups !== null) {
      setIsAutoSorting(false);
    }
  }, [isAutoSorting, autoGroup.isGrouping, autoGroup.totalGroups]);

  // ── Auto-group error → toast + clear sorting flag ─────────────────────────
  useEffect(() => {
    if (autoGroup.error) {
      toast({ title: "Auto-grouping failed", description: autoGroup.error, variant: "destructive" });
      setIsAutoSorting(false);
    }
  }, [autoGroup.error]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── DnD sensors ─────────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveItem(groups.flatMap(g => g.items).find(i => i.id === active.id) ?? null);
  };

  // ── Selection toggle ───────────────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveItem(null);
    if (!over) { setSelectedIds(new Set()); return; }

    const activeId = active.id as string;
    const overId = over.id as string;

    // Detect within-group reorder: both active and over are item IDs in the same group
    const activeGroup = groups.find(g => g.items.some(i => i.id === activeId));
    const overGroup = groups.find(g => g.items.some(i => i.id === overId));

    if (activeGroup && overGroup && activeGroup.id === overGroup.id) {
      // Within-group reorder — use arrayMove
      setGroups(prev => {
        const next = prev.map(g => {
          if (g.id !== activeGroup.id) return g;
          const oldIndex = g.items.findIndex(i => i.id === activeId);
          const newIndex = g.items.findIndex(i => i.id === overId);
          if (oldIndex === newIndex) return g;
          const reordered = arrayMove(g.items, oldIndex, newIndex);
          return { ...g, items: reordered };
        });
        saveGroups(next); // fire-and-forget
        return next;
      });
      setSelectedIds(new Set());
      return;
    }

    // Between-group / new-group logic with multi-select batch move
    const draggedIds: string[] = selectedIds.has(activeId) && selectedIds.size > 1
      ? Array.from(selectedIds)
      : [activeId];

    setGroups(prev => {
      const next = prev.map(g => ({ ...g, items: [...g.items] }));

      if (overId === "new-group") {
        const toMove: FileItem[] = [];
        for (const g of next) {
          const moved = g.items.filter(i => draggedIds.includes(i.id));
          g.items = g.items.filter(i => !draggedIds.includes(i.id));
          toMove.push(...moved);
        }
        if (toMove.length > 0) {
          next.push({ id: crypto.randomUUID(), items: toMove, maxImages: Number.MAX_SAFE_INTEGER });
        }
      } else {
        // Resolve target group: direct group-ID match OR group that owns the hovered thumbnail
        const toGroup =
          next.find(g => g.id === overId) ??
          next.find(g => g.items.some(i => i.id === overId));
        if (!toGroup) return prev;
        const toMove: FileItem[] = [];
        for (const g of next) {
          if (g.id === overId) continue;
          const moved = g.items.filter(i => draggedIds.includes(i.id));
          g.items = g.items.filter(i => !draggedIds.includes(i.id));
          toMove.push(...moved);
        }
        toGroup.items = [...toGroup.items, ...toMove];
      }

      const filtered = next.filter(g => g.items.length > 0);
      saveGroups(filtered); // fire-and-forget
      return filtered;
    });

    setSelectedIds(new Set()); // clear selection after drag
  };

  // ── File drop ────────────────────────────────────────────────────────────────
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
  }, [toast, saveBlob, saveGroups]);

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

  // ── Upload ───────────────────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (groups.length === 0) return;

    const snapshot = groups.map(g => g.items.map(i => i.file));
    const allFiles = snapshot.flat();

    setIsUploading(true);
    setUploadProgress({ current: 0, total: snapshot.length });
    setGroups([]);
    clearAll(); // fire-and-forget — images are being uploaded, no need to keep staged copies
    setUploadingQueue(allFiles);

    let hasPaid = false;
    let hasUnpaid = false;

    const CONCURRENCY = 2;
    for (let i = 0; i < snapshot.length; i += CONCURRENCY) {
      const batch = snapshot.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map(async (group) => {
        try {
          const data = await uploadMutation.mutateAsync({
            files: group,
            groupAsOne: group.length > 1,
            hideToast: true,
          });
          if (data.every((img: any) => img.paymentStatus === "paid")) hasPaid = true;
          else hasUnpaid = true;
        } catch (e) {
          console.error(e);
        } finally {
          setUploadProgress(prev => ({ ...prev, current: prev.current + 1 }));
        }
      }));
    }

    setUploadingQueue([]);
    setIsUploading(false);

    toast({
      title: hasPaid && !hasUnpaid ? "Products Ready" : "Images Uploaded",
      description: hasPaid && !hasUnpaid
        ? `${snapshot.length} product${snapshot.length !== 1 ? "s" : ""} analyzed and ready.`
        : `${allFiles.length} images uploaded. Subscribe to unlock full descriptions.`,
    });
  };

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div
      {...getRootProps({
        className: "w-full max-w-3xl mx-auto space-y-4",
      })}
    >
      <input {...getInputProps()} data-testid="input-file-upload" />

      {/* Drop zone */}
      <div
        onClick={() => {
          if (!isUploading) open();
        }}
        className={cn(
          "relative group cursor-pointer overflow-hidden rounded-xl border border-dashed transition-all duration-200 text-center",
          totalFiles > 0 ? "p-3" : "p-6",
          isDragActive
            ? "border-primary bg-primary/10 scale-[1.01]"
            : "border-border hover:border-primary/50 hover:bg-muted/50 bg-muted/20"
        )}
      >
        <div className="relative z-10 flex flex-col items-center gap-1.5">
          <div className={cn(
            "p-2 rounded-lg bg-muted border border-border transition-transform duration-200",
            isDragActive ? "scale-110" : "group-hover:scale-105"
          )}>
            <UploadCloud className={cn(
              "transition-colors",
              totalFiles > 0 ? "w-4 h-4" : "w-5 h-5",
              isDragActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
            )} />
          </div>
          <p className={cn("font-medium text-foreground", totalFiles > 0 ? "text-xs" : "text-sm")}>
            {isDragActive ? "Drop images here" : totalFiles > 0 ? "Drop more images" : "Drag & drop or click to upload"}
          </p>
          {totalFiles === 0 && (
            <p className="text-[11px] text-muted-foreground">Up to 200 images · PNG, JPG, WEBP</p>
          )}
        </div>
      </div>

      {/* Auto-grouping progress */}
      {isAutoSorting && autoGroup.isGrouping && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/5 border border-primary/20">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <div className="flex-1">
            <p className="text-sm font-medium text-white">
              AI is sorting your variants... {autoGroup.groups.length} product{autoGroup.groups.length !== 1 ? 's' : ''} found
            </p>
            <p className="text-[11px] text-white/40">Groups appear as they are identified</p>
          </div>
          <button
            onClick={() => { autoGroup.cancel(); setIsAutoSorting(false); }}
            className="text-xs text-white/40 hover:text-white/80 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Auto-grouping completion summary */}
      {!isAutoSorting && autoGroup.totalGroups !== null && !autoGroup.isGrouping && groups.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-500/5 border border-green-500/20">
          <CheckCircle2 className="w-4 h-4 text-green-400" />
          <p className="text-xs text-white/80">
            AI identified <span className="font-medium text-white">{groups.length} products</span> — review groupings below, then confirm
          </p>
        </div>
      )}

      {/* Fallback warning banner — shown when AI embedding grouping degraded to filename-only */}
      {autoGroup.fallbackInfo.used && !fallbackBannerDismissed && (
        <div
          role="alert"
          data-testid="auto-group-fallback-banner"
          className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30"
        >
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-100">
              Grouped by filename — AI grouping unavailable
            </p>
            <p className="text-[11px] text-amber-100/70 mt-0.5">
              These groupings are less accurate than usual. Review carefully before confirming.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setFallbackBannerDismissed(true)}
            aria-label="Dismiss warning"
            className="text-amber-100/60 hover:text-amber-100 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Groups section — manual-first: renders unconditionally when any files exist */}
      {totalFiles > 0 && !isUploading && (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>

          {/* ── Toolbar ─────────────────────────────────────────────────── */}
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
            <div className="flex items-center gap-3 px-3.5 py-2.5 border-b border-white/[0.06]">
              {/* Summary pills */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-white/5 rounded-full px-2.5 py-1">
                  <Images className="w-3 h-3 text-primary" />
                  <span className="text-[11px] font-medium text-white/80">{totalFiles}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-white/5 rounded-full px-2.5 py-1">
                  <Package className="w-3 h-3 text-primary" />
                  <span className="text-[11px] font-medium text-white/80">{groups.length}</span>
                </div>
              </div>

              {/* Sort Variants — secondary AI button (GROUP-11) */}
              {totalFiles > 1 && (
                <button
                  onClick={() => sortVariantsIntoProducts(groups.flatMap(g => g.items))}
                  disabled={isAutoSorting}
                  className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-50"
                  title="Sort same-product variants into product families"
                >
                  <Sparkles className="w-3 h-3" />
                  <span className="hidden sm:inline">Sort variants</span>
                </button>
              )}

              <button
                onClick={open}
                className="ml-auto flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 transition-colors"
              >
                <Plus className="w-3 h-3" />
                <span className="hidden sm:inline">Add more</span>
              </button>
            </div>

            {/* Hint */}
            <div className="px-3.5 py-1.5 bg-white/[0.015] border-b border-white/[0.04]">
              <p className="text-[10px] text-white/30">
                Drag to regroup — click thumbnails to multi-select
              </p>
            </div>

            {/* ── Product groups list ─────────────────────────────────── */}
            <div className="max-h-[480px] overflow-y-auto p-2.5 space-y-2">
              {groups.map((group, idx) => (
                <DroppableGroup
                  key={group.id}
                  groupId={group.id}
                  groupIdx={idx}
                  items={group.items}
                  label={group.label}
                  confidence={group.confidence}
                  onRemoveItem={removeItem}
                  onSplit={() => splitGroup(group.id)}
                  onDeleteGroup={() => deleteGroup(group.id)}
                  totalGroups={groups.length}
                  selectedIds={selectedIds}
                  onSelect={toggleSelect}
                />
              ))}
              <DroppableNewGroup />
            </div>
          </div>

          {/* Drag overlay — floating thumbnail with count badge for multi-select */}
          <DragOverlay>
            {activeItem ? (
              selectedIds.size > 1 && selectedIds.has(activeItem.id) ? (
                // Multi-select ghost: stack badge
                <div className="flex flex-col items-center gap-1 rotate-2 scale-105">
                  <div className="relative w-16 h-16">
                    <div className="absolute inset-0 rounded-lg overflow-hidden ring-2 ring-primary shadow-2xl shadow-primary/20 translate-x-1 translate-y-1 opacity-50">
                      <img src={activeItem.url} alt="" className="w-full h-full object-cover" draggable={false} />
                    </div>
                    <div className="absolute inset-0 rounded-lg overflow-hidden ring-2 ring-primary shadow-2xl shadow-primary/20">
                      <img src={activeItem.url} alt="" className="w-full h-full object-cover" draggable={false} />
                    </div>
                    <div className="absolute -top-2 -right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center shadow-lg">
                      <span className="text-[9px] font-bold text-white">{selectedIds.size}</span>
                    </div>
                  </div>
                  <span className="text-[9px] text-white bg-black/80 px-1.5 py-0.5 rounded-full backdrop-blur-sm shadow-lg">
                    {selectedIds.size} images
                  </span>
                </div>
              ) : (
                // Single item ghost (existing)
                <div className="flex flex-col items-center gap-1 rotate-2 scale-105">
                  <div className="w-16 h-16 rounded-lg overflow-hidden ring-2 ring-primary shadow-2xl shadow-primary/20">
                    <img src={activeItem.url} alt="" className="w-full h-full object-cover" draggable={false} />
                  </div>
                  <span className="text-[9px] text-white bg-black/80 px-1.5 py-0.5 rounded-full backdrop-blur-sm shadow-lg">
                    {activeItem.file.name.replace(/\.[^/.]+$/, "").slice(0, 14)}
                  </span>
                </div>
              )
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Upload progress */}
      {isUploading && (
        <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
          <div className="flex items-center gap-3">
            <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-white">
                Analyzing product {uploadProgress.current} of {uploadProgress.total}...
              </p>
              <p className="text-[11px] text-muted-foreground">Products appear below as they complete</p>
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

      {/* Analyze / Confirm button */}
      {!isUploading && groups.length > 0 && (
        <div className="flex justify-center">
          <ShinyButton
            onClick={handleUpload}
            disabled={groups.length === 0}
            className="w-full sm:w-auto min-w-[200px]"
            data-testid="button-upload-preview"
          >
            <UploadCloud className="w-4 h-4 mr-2" />
            {`Analyze ${groups.length} Product${groups.length !== 1 ? "s" : ""}`}
          </ShinyButton>
        </div>
      )}
    </div>
  );
}
