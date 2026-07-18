import { useCallback, useState, useEffect, useMemo, useRef } from "react";
import { useDropzone } from "react-dropzone";
import {
  DndContext, DragOverlay, useDroppable,
  MouseSensor, TouchSensor, useSensor, useSensors,
  defaultDropAnimationSideEffects,
  type DragEndEvent, type DragStartEvent, type DropAnimation,
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
import { useGroupSelection } from "@/hooks/use-group-selection";

// Soft advisory threshold (GROUP-08) — groups larger than this render an
// amber "consider splitting" badge but are NEVER blocked from accepting drops.
const LARGE_GROUP_THRESHOLD = 20;

// Thumbnail scale tiers. panelSize is the sidebar panel's current width as a
// percentage of the viewport (react-resizable-panels units). As the user
// drags the sidebar wider, thumbnails step up through these tiers so images
// are easy to inspect before upload.
function getThumbSize(panelSize: number | undefined, isHero: boolean): string {
  const size = panelSize ?? 25;
  if (size < 35) return isHero ? "w-16 h-16" : "w-10 h-10"; // default compact
  if (size < 50) return isHero ? "w-24 h-24" : "w-20 h-20";
  if (size < 65) return isHero ? "w-36 h-36" : "w-28 h-28";
  return isHero ? "w-48 h-48" : "w-40 h-40"; // zoomed inspection mode
}

// Complementary spacing tiers so the card layout breathes as thumbs scale up.
// Keeps default compact mode untouched; relaxes gap/padding/min-h at each
// zoom tier and drops the list's 480px scroll cap once thumbs go large
// (parent ScrollArea handles overflow at that point).
function getGroupSpacing(panelSize: number | undefined) {
  const size = panelSize ?? 25;
  if (size < 35) return {
    innerGap: "gap-2",
    innerPad: "p-3",
    innerMinH: "min-h-[120px]",
    headerPad: "px-3 py-2",
    cardSpacing: "space-y-2",
    listPad: "p-2.5",
    listMaxH: "max-h-[480px]",
  };
  if (size < 50) return {
    innerGap: "gap-3",
    innerPad: "p-4",
    innerMinH: "min-h-[160px]",
    headerPad: "px-4 py-2.5",
    cardSpacing: "space-y-3",
    listPad: "p-3",
    listMaxH: "",
  };
  if (size < 65) return {
    innerGap: "gap-4",
    innerPad: "p-5",
    innerMinH: "min-h-[200px]",
    headerPad: "px-5 py-3",
    cardSpacing: "space-y-4",
    listPad: "p-4",
    listMaxH: "",
  };
  return {
    innerGap: "gap-6",
    innerPad: "p-6",
    innerMinH: "min-h-[220px]",
    headerPad: "px-6 py-3.5",
    cardSpacing: "space-y-5",
    listPad: "p-5",
    listMaxH: "",
  };
}

// Snap-back drop animation — keeps DragOverlay child mounted long enough for
// dnd-kit's built-in return-to-origin transition to play on invalid drops.
const dropAnimation: DropAnimation = {
  duration: 250,
  easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)",
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: "0.4" } },
  }),
};

interface GroupWithLabel extends Group {
  label?: string;
  confidence?: "high" | "medium" | "low";
}

// ── Sortable thumbnail (handles within-group sort AND between-group drag) ─────
function SortableThumbnail({
  item, groupId, onRemove, isHero, isSelected, onSelect, selectedIds: allSelectedIds, panelSize,
}: {
  item: FileItem;
  groupId: string;
  onRemove: () => void;
  isHero?: boolean;
  isSelected?: boolean;
  onSelect: (id: string, groupId: string, e: React.MouseEvent) => void;
  selectedIds: Set<string>;
  panelSize?: number;
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

  const size = getThumbSize(panelSize, !!isHero);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative group/thumb flex-shrink-0 cursor-grab active:cursor-grabbing"
      {...attributes}
      {...listeners}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(item.id, groupId, e);
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
  selectedIds, onSelect, label, confidence, isFailed, onRetry, panelSize,
}: {
  groupId: string;
  groupIdx: number;
  items: FileItem[];
  onRemoveItem: (itemId: string) => void;
  onSplit: () => void;
  onDeleteGroup: () => void;
  totalGroups: number;
  selectedIds: Set<string>;
  onSelect: (id: string, groupId: string, e: React.MouseEvent) => void;
  label?: string;
  confidence?: "high" | "medium" | "low";
  isFailed?: boolean;
  onRetry?: () => void;
  panelSize?: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: groupId });
  const spacing = getGroupSpacing(panelSize);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative rounded-xl border transition-all duration-200 overflow-hidden",
        isFailed
          ? "border-destructive bg-destructive/[0.06]"
          : isOver
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
      <div className={cn("flex items-center gap-2 border-b border-white/[0.06]", spacing.headerPad)}>
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
            confidence === "medium" ? "bg-amber-500/20 text-amber-400" :
            "bg-red-500/20 text-red-400"
          )}>
            {confidence}
          </span>
        )}
        <span className="text-[10px] text-white/40 ml-0.5">
          {items.length} {items.length === 1 ? "image" : "images"}
        </span>
        {items.length > LARGE_GROUP_THRESHOLD && (
          <span
            className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-900"
            title="Large group — consider splitting into multiple products"
            data-testid={`large-group-warning-${groupId}`}
          >
            Large group ({items.length}) — consider splitting
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          {isFailed && onRetry && (
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={onRetry}
              data-testid={`retry-group-${groupId}`}
              className="flex items-center gap-1 text-[10px] text-red-100 bg-red-500/80 hover:bg-red-500 transition-colors px-2 py-0.5 rounded font-medium"
              title="Retry uploading this product"
            >
              <span>Retry</span>
            </button>
          )}
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
        <div className={cn("flex flex-wrap", spacing.innerGap, spacing.innerPad, spacing.innerMinH)}>
          {items.map((item, idx) => (
            <SortableThumbnail
              key={item.id}
              item={item}
              groupId={groupId}
              onRemove={() => onRemoveItem(item.id)}
              isHero={idx === 0}
              isSelected={selectedIds.has(item.id)}
              onSelect={onSelect}
              selectedIds={selectedIds}
              panelSize={panelSize}
            />
          ))}
          {isOver && (
            <div className={cn(
              getThumbSize(panelSize, false),
              "rounded-lg border-2 border-dashed border-primary/50 bg-primary/5 flex items-center justify-center shrink-0 animate-pulse",
            )}>
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
      data-testid="droppable-new-group"
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
  const [activeItem, setActiveItem] = useState<FileItem | null>(null);
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
  const listSpacing = getGroupSpacing(panelSize);

  // Notify parent whenever staged item count changes so the workspace can
  // expand the sidebar to give the grouping grid more room.
  useEffect(() => { onStagedCountChange?.(totalFiles); }, [totalFiles, onStagedCountChange]);

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
    const activeId = active.id as string;
    const dragged = groups.flatMap(g => g.items).find(i => i.id === activeId) ?? null;
    setActiveItem(dragged);

    // Preserve multi-selection if the dragged item is part of it; otherwise
    // reset selection to just this item so a grab on an unselected thumb
    // doesn't accidentally carry stale range-selection state.
    if (!(selectedIds.has(activeId) && selectedIds.size > 1)) {
      clearSelection();
      setSelected(new Set([activeId]));
    }
  };

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

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    // Invalid drop: defer clearing activeItem to the next microtask so the
    // DragOverlay child stays mounted long enough for dnd-kit's snap-back
    // dropAnimation to play. Do NOT touch selection — the user may want to
    // retry the same drag.
    if (!over) {
      queueMicrotask(() => setActiveItem(null));
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    // Resolve source + target groups (target may be a group UUID or an item UUID).
    const activeGroup = groups.find(g => g.items.some(i => i.id === activeId));
    const overGroup =
      groups.find(g => g.id === overId) ??
      groups.find(g => g.items.some(i => i.id === overId));

    // ── Branch 1: Intra-group single-item reorder ────────────────────────────
    // PRESERVED from Phase 5 — drag-reorder-to-front re-elects the hero image.
    // Falls through ONLY when source group === target group AND selection is
    // at most one item (i.e., not a batch move).
    if (
      activeGroup &&
      overGroup &&
      activeGroup.id === overGroup.id &&
      selectedIds.size <= 1
    ) {
      setActiveItem(null);
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
      // Selection state is intentionally unchanged here — Phase 5 behavior.
      return;
    }

    // ── Branch 2: Cross-group OR batch move ──────────────────────────────────
    setActiveItem(null);
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
        // Two-step overId resolution: direct group-ID match OR group that
        // owns the hovered thumbnail (RESEARCH Pitfall 2).
        const toGroup =
          next.find(g => g.id === overId) ??
          next.find(g => g.items.some(i => i.id === overId));
        if (!toGroup) return prev;
        const toMove: FileItem[] = [];
        for (const g of next) {
          if (g.id === toGroup.id) continue;
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

    clearSelection(); // clear after successful cross-group / batch move
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

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div
      {...getRootProps({
        className: "w-full max-w-3xl mx-auto space-y-4",
      })}
    >
      <input {...getInputProps()} data-testid="input-file-upload" />

      {/* Drop zone — the ambient portal */}
      <div
        onClick={() => {
          if (!isUploading) open();
        }}
        className={cn(
          "relative group cursor-pointer overflow-hidden rounded-3xl transition-all duration-500 text-center",
          totalFiles > 0 ? "p-3" : "p-8",
          isDragActive
            ? "bg-primary/10 scale-[1.02] shadow-[inset_0_0_0_1.5px_hsl(var(--primary)/0.6),0_0_48px_-6px_hsl(var(--primary)/0.45),inset_0_0_48px_0_hsl(var(--primary)/0.12)]"
            : "portal-ring bg-card/40 hover:bg-card/60 shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.06)]"
        )}
      >
        {/* Aurora bleed inside the portal on drag-over */}
        <div
          aria-hidden
          className={cn(
            "absolute inset-0 pointer-events-none transition-opacity duration-500",
            isDragActive ? "opacity-100" : "opacity-0",
          )}
          style={{
            background:
              "radial-gradient(circle at 50% 120%, hsl(var(--aurora-1) / 0.25), transparent 60%), radial-gradient(circle at 20% 0%, hsl(var(--aurora-2) / 0.18), transparent 55%)",
          }}
        />
        <div className="relative z-10 flex flex-col items-center gap-2">
          <div className={cn(
            "rounded-full bg-primary/10 flex items-center justify-center transition-all duration-500",
            totalFiles > 0 ? "w-9 h-9" : "w-14 h-14",
            isDragActive
              ? "scale-125 shadow-[0_0_32px_-4px_hsl(var(--primary)/0.6)]"
              : "group-hover:scale-110 shadow-[0_0_20px_-8px_hsl(var(--primary)/0.35)]"
          )}>
            <UploadCloud className={cn(
              "transition-colors",
              totalFiles > 0 ? "w-4 h-4" : "w-6 h-6",
              isDragActive ? "text-primary" : "text-primary/70 group-hover:text-primary"
            )} />
          </div>
          <p className={cn("font-display font-medium text-foreground", totalFiles > 0 ? "text-xs" : "text-sm")}>
            {isDragActive ? "Release into the portal" : totalFiles > 0 ? "Drop more images" : "Drop product photos here"}
          </p>
          {totalFiles === 0 && (
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
              200 max · png jpg webp heic
            </p>
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
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveItem(null)}
        >

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
                  className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 transition-colors disabled:opacity-50"
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
            <div className={cn(
              "overflow-y-auto",
              listSpacing.listPad,
              listSpacing.cardSpacing,
              listSpacing.listMaxH,
            )}>
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
                  onSelect={onThumbnailSelect}
                  isFailed={failedGroupIds.has(group.id)}
                  onRetry={failedGroupIds.has(group.id) ? () => retryGroup(group.id) : undefined}
                  panelSize={panelSize}
                />
              ))}
              {groups.length > 0 && <DroppableNewGroup />}
            </div>
          </div>

          {/* Drag overlay — floating thumbnail with count badge for multi-select */}
          <DragOverlay dropAnimation={dropAnimation}>
            {activeItem ? (
              selectedIds.size > 1 && selectedIds.has(activeItem.id) ? (
                // Multi-select ghost: stack badge
                <div className="flex flex-col items-center gap-1 rotate-2 scale-105">
                  <div className={cn("relative", getThumbSize(panelSize, true))}>
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
                  <div className={cn(getThumbSize(panelSize, true), "rounded-lg overflow-hidden ring-2 ring-primary shadow-2xl shadow-primary/20")}>
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
            onClick={handleConfirm}
            disabled={groups.length === 0}
            className="w-full sm:w-auto min-w-[200px]"
            data-testid="button-upload-preview"
          >
            <UploadCloud className="w-4 h-4 mr-2" />
            {`Confirm & Create ${groups.length} Product${groups.length === 1 ? "" : "s"}`}
          </ShinyButton>
        </div>
      )}
    </div>
  );
}
