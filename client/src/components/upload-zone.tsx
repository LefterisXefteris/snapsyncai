import { useCallback, useState, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import {
  DndContext, DragOverlay, useDraggable, useDroppable,
  MouseSensor, TouchSensor, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { UploadCloud, Loader2, X, MessageSquare, Mic, Package, GripVertical, Plus, Ungroup, Images, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUploadImages } from "@/hooks/use-images";
import { ShinyButton } from "@/components/ui/shiny-button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const TONES = [
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual" },
  { value: "luxury", label: "Luxury" },
  { value: "playful", label: "Playful" },
  { value: "technical", label: "Technical" },
];

const PRESETS = [1, 2, 3, 4, 5];

interface FileItem {
  id: string;
  file: File;
  url: string;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return arr.map(i => [i]);
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

// ── Draggable thumbnail ──────────────────────────────────────────────────────
function DraggableThumbnail({ item, onRemove, isHero }: { item: FileItem; onRemove: () => void; isHero?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: item.id });
  const size = isHero ? "w-20 h-20" : "w-14 h-14";

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative group/thumb shrink-0 touch-none",
        isDragging ? "opacity-20 scale-95" : "cursor-grab active:cursor-grabbing"
      )}
      {...listeners}
      {...attributes}
    >
      <div className={cn("relative", size)}>
        <img
          src={item.url}
          alt={item.file.name}
          className={cn(size, "rounded-lg object-cover select-none ring-1 ring-white/10 transition-all",
            !isDragging && "group-hover/thumb:ring-primary/50 group-hover/thumb:ring-2"
          )}
          draggable={false}
        />
        <div className="absolute inset-0 rounded-lg bg-black/0 group-hover/thumb:bg-black/30 transition-colors flex items-center justify-center">
          <GripVertical className="w-4 h-4 text-white opacity-0 group-hover/thumb:opacity-80 transition-opacity drop-shadow" />
        </div>
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={onRemove}
          className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 bg-red-500/90 rounded-full flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-all hover:bg-red-500 hover:scale-110 z-10 shadow-lg"
        >
          <X className="w-2.5 h-2.5 text-white" />
        </button>
      </div>
    </div>
  );
}

// ── Droppable product group card ─────────────────────────────────────────────
function DroppableGroup({
  groupId, groupIdx, items, onRemoveItem, onSplit, onDeleteGroup, totalGroups,
}: {
  groupId: string;
  groupIdx: number;
  items: FileItem[];
  onRemoveItem: (itemId: string) => void;
  onSplit: () => void;
  onDeleteGroup: () => void;
  totalGroups: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: groupId });
  const hero = items[0];
  const rest = items.slice(1);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-xl border transition-all duration-200 overflow-hidden",
        isOver
          ? "border-primary/60 bg-primary/[0.06] shadow-[0_0_20px_-4px_hsl(var(--primary)/0.2)]"
          : "border-white/[0.08] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.03]"
      )}
    >
      {/* Card header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06]">
        <div className="w-5 h-5 rounded-md bg-primary/15 flex items-center justify-center">
          <span className="text-[10px] font-bold text-primary">{groupIdx + 1}</span>
        </div>
        <span className="text-xs font-medium text-white/90">Product {groupIdx + 1}</span>
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

      {/* Images area */}
      <div className="p-3">
        <div className="flex items-start gap-2.5">
          {/* Hero image */}
          {hero && (
            <DraggableThumbnail
              key={hero.id}
              item={hero}
              onRemove={() => onRemoveItem(hero.id)}
              isHero
            />
          )}
          {/* Rest of images + drop placeholder */}
          {(rest.length > 0 || isOver) && (
            <div className="flex flex-wrap gap-2 flex-1 min-h-[56px] items-start">
              {rest.map(item => (
                <DraggableThumbnail
                  key={item.id}
                  item={item}
                  onRemove={() => onRemoveItem(item.id)}
                />
              ))}
              {isOver && (
                <div className="w-14 h-14 rounded-lg border-2 border-dashed border-primary/50 bg-primary/5 flex items-center justify-center shrink-0 animate-pulse">
                  <Plus className="w-3.5 h-3.5 text-primary/60" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
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
  const [groups, setGroups] = useState<FileItem[][]>([]);
  const [activeItem, setActiveItem] = useState<FileItem | null>(null);
  const [groupSize, setGroupSize] = useState(1);
  const [productContext, setProductContext] = useState("");
  const [brandTone, setBrandTone] = useState("professional");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [uploadingQueue, setUploadingQueue] = useState<File[]>([]);
  const uploadMutation = useUploadImages();
  const { toast } = useToast();

  // Revoke object URLs on unmount
  const urlsRef = useRef<string[]>([]);
  useEffect(() => () => { urlsRef.current.forEach(URL.revokeObjectURL); }, []);

  useEffect(() => { onUploadingChange?.(uploadingQueue); }, [uploadingQueue, onUploadingChange]);

  const totalFiles = groups.flat().length;

  // ── DnD sensors ─────────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  // ── Find group index by item id ──────────────────────────────────────────────
  const findGroupIdx = (itemId: string) =>
    groups.findIndex(g => g.some(i => i.id === itemId));

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveItem(groups.flat().find(i => i.id === active.id) ?? null);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveItem(null);
    if (!over) return;

    const fromIdx = findGroupIdx(active.id as string);
    if (fromIdx === -1) return;

    setGroups(prev => {
      const next = prev.map(g => [...g]);
      const item = next[fromIdx].find(i => i.id === active.id)!;

      if (over.id === "new-group") {
        next[fromIdx] = next[fromIdx].filter(i => i.id !== active.id);
        next.push([item]);
      } else {
        const toIdx = next.findIndex((_, idx) => `group-${idx}` === over.id);
        if (toIdx === -1 || toIdx === fromIdx) return prev;
        next[fromIdx] = next[fromIdx].filter(i => i.id !== active.id);
        next[toIdx] = [...next[toIdx], item];
      }

      return next.filter(g => g.length > 0);
    });
  };

  // ── File drop ────────────────────────────────────────────────────────────────
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newItems: FileItem[] = acceptedFiles.map(f => {
      const url = URL.createObjectURL(f);
      urlsRef.current.push(url);
      return { id: crypto.randomUUID(), file: f, url };
    });

    setGroups(prev => {
      const all = [...prev.flat(), ...newItems];
      const total = all.length;
      if (total > 200) return prev; // cap
      return chunkArray(all, groupSize);
    });
  }, [groupSize]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: { "image/*": [".png", ".jpg", ".jpeg", ".webp"] },
    noClick: totalFiles > 0,
  });

  // ── Auto-arrange ───────────────────────────────────────────────────────────
  const setGroupSizeAndRechunk = (newSize: number) => {
    const clamped = Math.max(1, Math.min(20, newSize));
    setGroupSize(clamped);
    setGroups(prev => chunkArray(prev.flat(), clamped));
  };

  // ── Split a group into individual products ─────────────────────────────────
  const splitGroup = (groupIdx: number) => {
    setGroups(prev => {
      const next = [...prev];
      const items = next.splice(groupIdx, 1)[0];
      const singles = items.map(i => [i]);
      next.splice(groupIdx, 0, ...singles);
      return next;
    });
  };

  // ── Delete entire group ────────────────────────────────────────────────────
  const deleteGroup = (groupIdx: number) => {
    setGroups(prev => prev.filter((_, i) => i !== groupIdx));
  };

  // ── Remove item ──────────────────────────────────────────────────────────────
  const removeItem = (itemId: string) => {
    setGroups(prev =>
      prev
        .map(g => g.filter(i => i.id !== itemId))
        .filter(g => g.length > 0)
    );
  };

  // ── Upload ───────────────────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (groups.length === 0) return;

    const snapshot = groups.map(g => g.map(i => i.file));
    const allFiles = snapshot.flat();

    setIsUploading(true);
    setUploadProgress({ current: 0, total: snapshot.length });
    setGroups([]);
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
            productContext,
            brandTone,
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
    setProductContext("");

    toast({
      title: hasPaid && !hasUnpaid ? "Products Ready" : "Images Uploaded",
      description: hasPaid && !hasUnpaid
        ? `${snapshot.length} product${snapshot.length !== 1 ? "s" : ""} analyzed and ready.`
        : `${allFiles.length} images uploaded. Subscribe to unlock full descriptions.`,
    });
  };

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-3xl mx-auto space-y-4">

      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={cn(
          "relative group cursor-pointer overflow-hidden rounded-xl border border-dashed transition-all duration-200 text-center",
          totalFiles > 0 ? "p-3" : "p-6",
          isDragActive
            ? "border-primary bg-primary/10 scale-[1.01]"
            : "border-border hover:border-primary/50 hover:bg-muted/50 bg-muted/20"
        )}
      >
        <input {...getInputProps()} data-testid="input-file-upload" />
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

      {/* Groups section */}
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

              <div className="h-4 w-px bg-white/10" />

              {/* Preset buttons */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-white/40 uppercase tracking-wider font-medium hidden sm:block">Per product:</span>
                <div className="flex gap-0.5">
                  {PRESETS.map(n => (
                    <button
                      key={n}
                      onClick={() => setGroupSizeAndRechunk(n)}
                      className={cn(
                        "w-7 h-7 rounded-md text-xs font-medium transition-all duration-150",
                        groupSize === n
                          ? "bg-primary text-white shadow-sm shadow-primary/30"
                          : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80"
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Add more */}
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
                Drag images between products to regroup — or use the presets above to auto-arrange
              </p>
            </div>

            {/* ── Product groups list ─────────────────────────────────── */}
            <div className="max-h-[480px] overflow-y-auto p-2.5 space-y-2">
              {groups.map((group, idx) => (
                <DroppableGroup
                  key={`group-${idx}`}
                  groupId={`group-${idx}`}
                  groupIdx={idx}
                  items={group}
                  onRemoveItem={removeItem}
                  onSplit={() => splitGroup(idx)}
                  onDeleteGroup={() => deleteGroup(idx)}
                  totalGroups={groups.length}
                />
              ))}
              <DroppableNewGroup />
            </div>
          </div>

          {/* Drag overlay — floating thumbnail */}
          <DragOverlay>
            {activeItem ? (
              <div className="flex flex-col items-center gap-1 rotate-2 scale-105">
                <div className="w-16 h-16 rounded-lg overflow-hidden ring-2 ring-primary shadow-2xl shadow-primary/20">
                  <img src={activeItem.url} alt="" className="w-full h-full object-cover" draggable={false} />
                </div>
                <span className="text-[9px] text-white bg-black/80 px-1.5 py-0.5 rounded-full backdrop-blur-sm shadow-lg">
                  {activeItem.file.name.replace(/\.[^/.]+$/, "").slice(0, 14)}
                </span>
              </div>
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

      {/* AI Prompt + Tone */}
      <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-white">
          <MessageSquare className="w-4 h-4 text-primary" />
          Custom AI Prompt
        </div>
        <Textarea
          data-testid="input-product-context"
          value={productContext}
          onChange={e => setProductContext(e.target.value)}
          placeholder="Custom instructions for SEO, AEO tags, descriptions, etc. E.g., 'Target audience: men 25-45. Focus on durability and classic style.'"
          className="bg-black/30 border-white/10 text-white text-sm resize-none min-h-[70px]"
          rows={3}
        />
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Mic className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Voice:</span>
          </div>
          <Select value={brandTone} onValueChange={setBrandTone}>
            <SelectTrigger data-testid="select-brand-tone" className="w-[140px] h-8 bg-black/30 border-white/10 text-white text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TONES.map(t => (
                <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Analyze button */}
      {!isUploading && (
        <div className="flex justify-center">
          <ShinyButton
            onClick={handleUpload}
            disabled={groups.length === 0}
            className="w-full sm:w-auto min-w-[200px]"
            data-testid="button-upload-preview"
          >
            <UploadCloud className="w-4 h-4 mr-2" />
            {groups.length > 0
              ? `Analyze ${groups.length} Product${groups.length !== 1 ? "s" : ""}`
              : "Upload & Analyze"}
          </ShinyButton>
        </div>
      )}
    </div>
  );
}
