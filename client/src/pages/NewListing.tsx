import { UploadZone } from "@/components/upload-zone";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function NewListing() {
  return (
    <div className="h-full w-full flex flex-col bg-transparent text-foreground overflow-hidden">
      <div className="px-6 py-4 shrink-0">
        <h1 className="font-display text-lg font-semibold">New listing</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Drop photos to create a product. Stay here to group more; the catalogue is under Products.
        </p>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-6 max-w-5xl">
          <UploadZone panelSize={80} />
        </div>
      </ScrollArea>
    </div>
  );
}
