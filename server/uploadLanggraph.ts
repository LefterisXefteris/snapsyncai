export type UploadProcessingMode =
  | "groupedPaid"
  | "groupedPreview"
  | "singlePaid"
  | "singlePreview";

export function resolveUploadProcessingMode(input: {
  fileCount: number;
  groupAsOne: boolean;
  hasActiveSubscription: boolean;
}): UploadProcessingMode {
  if (input.fileCount < 1) {
    throw new Error("No files uploaded");
  }
  const shouldGroup = input.groupAsOne && input.fileCount > 1;
  if (shouldGroup && input.hasActiveSubscription) return "groupedPaid";
  if (shouldGroup && !input.hasActiveSubscription) return "groupedPreview";
  if (!shouldGroup && input.hasActiveSubscription) return "singlePaid";
  return "singlePreview";
}
