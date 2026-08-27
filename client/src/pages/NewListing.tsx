import { UploadZone } from "@/components/upload-zone";

export default function NewListing() {
  return (
    <div className="h-full w-full overflow-hidden bg-transparent text-foreground">
      <UploadZone panelSize={80} />
    </div>
  );
}
