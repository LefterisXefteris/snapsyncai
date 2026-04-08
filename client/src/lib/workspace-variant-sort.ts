import type { Image } from "@shared/schema";
import type { AutoGroupResult } from "@/hooks/use-auto-group";

export interface WorkspaceProductEntry {
  primary: Image;
  views: Image[];
}

export interface WorkspaceVariantAssignment {
  productGroupId: string;
  primaryImageId: number;
  imageIds: number[];
  label: string;
}

export function collectSelectedWorkspaceImages(
  entries: WorkspaceProductEntry[],
  selectedIds: Set<number>,
): Image[] {
  const selectedImages: Image[] = [];
  const seenIds = new Set<number>();

  for (const entry of entries) {
    const entryImages = [entry.primary, ...entry.views];
    const entrySelected = entryImages.some((image) => selectedIds.has(image.id));
    if (!entrySelected) continue;

    for (const image of entryImages) {
      if (seenIds.has(image.id)) continue;
      seenIds.add(image.id);
      selectedImages.push(image);
    }
  }

  return selectedImages;
}

export function buildWorkspaceVariantAssignments(
  images: Image[],
  groups: AutoGroupResult[],
  createGroupId: (groupIndex: number, group: AutoGroupResult) => string = createWorkspaceGroupId,
): WorkspaceVariantAssignment[] {
  const assignments: WorkspaceVariantAssignment[] = [];
  const assignedIds = new Set<number>();

  groups.forEach((group, groupIndex) => {
    const imageIds = uniqueImageIds(
      group.imageIndices
        .map((imageIndex) => images[imageIndex]?.id)
        .filter((imageId): imageId is number => typeof imageId === "number"),
    );

    if (imageIds.length === 0) return;

    assignments.push({
      productGroupId: createGroupId(groupIndex, group),
      primaryImageId: imageIds[0],
      imageIds,
      label: group.label,
    });

    imageIds.forEach((imageId) => assignedIds.add(imageId));
  });

  for (const image of images) {
    if (assignedIds.has(image.id)) continue;

    const fallbackGroup: AutoGroupResult = {
      label: image.title || image.originalName || `Image ${image.id}`,
      imageIndices: [],
      confidence: "low",
    };

    assignments.push({
      productGroupId: createGroupId(assignments.length, fallbackGroup),
      primaryImageId: image.id,
      imageIds: [image.id],
      label: fallbackGroup.label,
    });
  }

  return assignments;
}

function uniqueImageIds(imageIds: number[]) {
  return Array.from(new Set(imageIds));
}

function createWorkspaceGroupId(groupIndex: number, group: AutoGroupResult) {
  const labelSlug = (group.label || "product")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "product";

  const uniqueSuffix =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  return `workspace-${groupIndex + 1}-${labelSlug}-${uniqueSuffix}`;
}
