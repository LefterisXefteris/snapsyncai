import { useCallback, useState, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import {
  DndContext, DragOverlay, useDraggable, useDroppable,
  MouseSensor, TouchSensor, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { UploadCloud, Loader2, X, MessageSquare, Mic, Minus, Plus, Package, GripVertical, PlusCircle } from "lucide-react";
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
function DraggableThumbnail({ item, onRemove }: { item: FileItem; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: item.id });
  const shortName = item.file.name.replace(/\.[^/.]+$/, "").slice(0, 14);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative group/thumb shrink-0 touch-none flex flex-col items-center gap-1",
        isDragging ? "opacity-25 cursor-grabbing" : "cursor-grab"
      )}
      {...listeners}
      {...attributes}
    >
      {/* image */}
      <div className="relative w-16 h-16">
        <img
          src={item.url}
          alt={item.file.name}
          className="w-16 h-16 rounded-xl object-cover border border-white/15 select-none shadow-md"
          draggable={false}
        />
        {/* drag indicator overlay */}
        <div className="absolute inset-0 rounded-xl bg-black/0 group-hover/thumb:bg-black/20 transition-colors flex items-center justify-center">
          <GripVertical className="w-4 h-4 text-white opacity-0 group-hover/thumb:opacity-70 transition-opacity" />
        </div>
        {/* remove button */}
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={onRemove}
          className="absolute -top-2 -right-2 w-5 h-5 bg-black/90 rounded-full flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity hover:bg-red-500 z-10 shadow-md"
        >
          <X className="w-3 h-3 text-white" />
        </button>
      </div>
      {/* filename */}
      <span className="text-[10px] text-muted-foreground text-center w-16 truncate leading-tight">
        {shortName}
      </span>
    </div>
  );
}

// ── Droppable product group card ─────────────────────────────────────────────
function DroppableGroup({
  groupId, groupIdx, items, onRemoveItem,
}: {
  groupId: string;
  groupIdx: number;
  items: FileItem[];
  onRemoveItem: (itemId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: groupId });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-xl border p-3 transition-all duration-150",
        isOver
          ? "border-primary/70 bg-primary/8 shadow-[0_0_0_1px_hsl(var(--primary)/0.25)]"
          : "border-white/10 bg-white/3 hover:bg-white/[0.04]"
      )}
    >
      {/* card header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-primary/20 flex items-center justify-center">
            <span className="text-[10px] font-bold text-primary">{groupIdx + 1}</span>
          </div>
          <span className="text-xs font-semibold text-white">Product {groupIdx + 1}</span>
        </div>
        <span className="text-[11px] text-muted-foreground">
          {items.length} image{items.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* thumbnails grid */}
      <div className="flex flex-wrap gap-2 min-h-[72px]">
        {items.map(item => (
          <DraggableThumbnail
            key={item.id}
            item={item}
            onRemove={() => onRemoveItem(item.id)}
          />
        ))}
        {isOver && (
          <div className="w-16 h-16 rounded-xl border-2 border-dashed border-primary/60 bg-primary/5 flex items-center justify-center shrink-0">
            <Plus className="w-4 h-4 text-primary/70" />
          </div>
        )}
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
        "flex items-center justify-center gap-2 px-3 py-4 rounded-xl border border-dashed transition-all duration-150",
        isOver
          ? "border-primary bg-primary/10 text-primary scale-[1.01]"
          : "border-white/15 text-muted-foreground hover:border-white/30 hover:text-white/60"
      )}
    >
      <PlusCircle className="w-4 h-4" />
      <span className="text-sm">Drop here to create a new product</span>
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
        // Move to brand new group
        next[fromIdx] = next[fromIdx].filter(i => i.id !== active.id);
        next.push([item]);
      } else {
        // Move to existing group
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

  // ── Auto-arrange stepper ─────────────────────────────────────────────────────
  const setGroupSizeAndRechunk = (newSize: number) => {
    const clamped = Math.max(1, Math.min(20, newSize));
    setGroupSize(clamped);
    setGroups(prev => chunkArray(prev.flat(), clamped));
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
          {/* Header: summary + auto-arrange stepper */}
          <div className="flex items-center justify-between px-1">
            <div>
              <p className="text-sm font-semibold text-white">
                {totalFiles} image{totalFiles !== 1 ? "s" : ""} · {groups.length} product{groups.length !== 1 ? "s" : ""}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Drag thumbnails between products to regroup · or auto-arrange below
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground hidden sm:block">Auto-arrange:</span>
              <div className="flex items-center gap-0.5 bg-black/40 rounded-lg border border-white/10 p-0.5">
                <button
                  onClick={() => setGroupSizeAndRechunk(groupSize - 1)}
                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="w-6 text-center text-xs font-semibold text-white">{groupSize}</span>
                <button
                  onClick={() => setGroupSizeAndRechunk(groupSize + 1)}
                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
              <span className="text-[11px] text-muted-foreground">per product</span>
            </div>
          </div>

          {/* Product groups list */}
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 bg-white/5 border-b border-white/10">
              <Package className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-semibold text-white">{groups.length} product{groups.length !== 1 ? "s" : ""} to analyze</span>
              <button onClick={open} className="ml-auto text-[11px] text-primary hover:text-primary/80 transition-colors">
                + Add more images
              </button>
            </div>

            <div className="max-h-[460px] overflow-y-auto p-2.5 space-y-2">
              {groups.map((group, idx) => (
                <DroppableGroup
                  key={`group-${idx}`}
                  groupId={`group-${idx}`}
                  groupIdx={idx}
                  items={group}
                  onRemoveItem={removeItem}
                />
              ))}
              <DroppableNewGroup />
            </div>
          </div>

          {/* Drag overlay — floating thumbnail */}
          <DragOverlay>
            {activeItem ? (
              <div className="flex flex-col items-center gap-1 rotate-3 scale-110 drop-shadow-2xl">
                <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-primary shadow-2xl">
                  <img src={activeItem.url} alt="" className="w-full h-full object-cover" draggable={false} />
                </div>
                <span className="text-[10px] text-white bg-black/70 px-1.5 py-0.5 rounded-md backdrop-blur-sm">
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
