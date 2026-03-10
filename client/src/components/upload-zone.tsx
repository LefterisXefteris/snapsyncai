import { useCallback, useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, File, Loader2, X, MessageSquare, Mic } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useUploadImages } from "@/hooks/use-images";
import { ShinyButton } from "@/components/ui/shiny-button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const MIN_IMAGES = 1;

const TONES = [
  { value: "professional", label: "Professional", desc: "Polished & authoritative" },
  { value: "casual", label: "Casual", desc: "Friendly & approachable" },
  { value: "luxury", label: "Luxury", desc: "Aspirational & refined" },
  { value: "playful", label: "Playful", desc: "Fun & energetic" },
  { value: "technical", label: "Technical", desc: "Specs & detail-focused" },
];

export function UploadZone({ onUploadingChange }: { onUploadingChange?: (files: File[]) => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [productContext, setProductContext] = useState("");
  const [brandTone, setBrandTone] = useState("professional");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [uploadingQueue, setUploadingQueue] = useState<File[]>([]);
  const uploadMutation = useUploadImages();
  const { toast } = useToast();

  useEffect(() => {
    onUploadingChange?.(uploadingQueue);
  }, [uploadingQueue, onUploadingChange]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles((prev) => [...prev, ...acceptedFiles].slice(0, 100));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp']
    }
  });

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length < MIN_IMAGES) return;

    setIsUploading(true);
    setUploadProgress({ current: 0, total: files.length });

    const filesToProcess = [...files];
    setFiles([]); // Clear UI immediately so user sees them jumping into the grid below
    setUploadingQueue(filesToProcess);

    let hasPaid = false;
    let hasUnpaid = false;

    const CONCURRENCY = 2;
    for (let i = 0; i < filesToProcess.length; i += CONCURRENCY) {
      const chunk = filesToProcess.slice(i, i + CONCURRENCY);

      await Promise.all(
        chunk.map(async (file) => {
          try {
            const data = await uploadMutation.mutateAsync({
              files: [file],
              productContext,
              brandTone,
              hideToast: true
            });
            const allPaid = data.every((img: any) => img.paymentStatus === 'paid');
            if (allPaid) hasPaid = true; else hasUnpaid = true;
          } catch (e) {
            console.error(e);
          } finally {
            setUploadProgress(prev => ({ ...prev, current: prev.current + 1 }));
            setUploadingQueue(prev => prev.filter(f => f.name !== file.name));
          }
        })
      );
    }

    setIsUploading(false);
    setProductContext("");

    if (hasPaid && !hasUnpaid) {
      toast({ title: "Products Ready", description: `${filesToProcess.length} products uploaded with full AI analysis.` });
    } else {
      toast({ title: "Images Uploaded", description: `${filesToProcess.length} images uploaded. Subscribe to unlock full descriptions.` });
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      <div
        {...getRootProps()}
        className={cn(
          "relative group cursor-pointer overflow-hidden rounded-xl border border-dashed transition-all duration-200 p-4 text-center",
          isDragActive
            ? "border-primary bg-primary/10 scale-[1.01]"
            : "border-border hover:border-primary/50 hover:bg-muted/50 bg-muted/20"
        )}
      >
        <input {...getInputProps()} data-testid="input-file-upload" />
        <div className="relative z-10 flex flex-col items-center gap-2.5">
          <div className={cn(
            "p-2.5 rounded-lg bg-muted border border-border transition-transform duration-200",
            isDragActive ? "scale-110" : "group-hover:scale-105"
          )}>
            <UploadCloud className={cn(
              "w-5 h-5 transition-colors",
              isDragActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
            )} />
          </div>
          <div>
            <p className="text-xs font-medium text-foreground">
              {isDragActive ? "Drop images here" : "Drag & drop or click to upload"}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              1–100 images · PNG, JPG, WEBP
            </p>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {(files.length > 0 || isUploading) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4"
          >
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-white">
                <MessageSquare className="w-4 h-4 text-primary" />
                Describe Your Products
              </div>
              <Textarea
                data-testid="input-product-context"
                value={productContext}
                onChange={(e) => setProductContext(e.target.value)}
                placeholder="Tell the AI about your products to get better results. E.g., 'Handmade leather wallets made from Italian full-grain leather. Target audience: men 25-45 who appreciate craftsmanship. Price range $80-$150. Emphasize durability and classic style.'"
                className="bg-black/30 border-white/10 text-white text-sm resize-none min-h-[80px]"
                rows={3}
              />
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Mic className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Brand Voice:</span>
                </div>
                <Select value={brandTone} onValueChange={setBrandTone}>
                  <SelectTrigger data-testid="select-brand-tone" className="w-[180px] bg-black/30 border-white/10 text-white text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TONES.map(t => (
                      <SelectItem key={t.value} value={t.value}>
                        <span>{t.label}</span>
                        <span className="text-muted-foreground ml-1.5 text-xs">- {t.desc}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="flex-1">
                <p className="text-sm font-medium text-white">
                  {isUploading ? `Uploading ${uploadProgress.total} image(s)...` : `${files.length} image${files.length !== 1 ? 's' : ''} selected`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isUploading
                    ? "Images will appear below automatically..."
                    : files.length < MIN_IMAGES
                      ? `Add ${MIN_IMAGES - files.length} more (minimum ${MIN_IMAGES} images)`
                      : "Ready to upload for free AI preview"
                  }
                </p>
              </div>
            </div>

            {!isUploading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {files.map((file, index) => (
                  <motion.div
                    key={`${file.name}-${index}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10"
                  >
                    <div className="p-2 rounded-lg bg-black/40">
                      <File className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFile(index); }}
                      className="p-1 hover:bg-white/10 rounded-full text-muted-foreground hover:text-white transition-colors"
                      data-testid={`button-remove-file-${index}`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </motion.div>
                ))}
              </div>
            )}

            <div className="flex justify-center pt-4">
              <ShinyButton
                onClick={handleUpload}
                disabled={isUploading || (!isUploading && files.length < MIN_IMAGES)}
                className="w-full sm:w-auto min-w-[200px]"
                data-testid="button-upload-preview"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Analyzing {uploadProgress.current}/{uploadProgress.total}...
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4 mr-2" />
                    Upload & Preview ({files.length})
                  </>
                )}
              </ShinyButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
