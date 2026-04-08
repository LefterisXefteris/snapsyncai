import test from "node:test";
import assert from "node:assert/strict";

import {
  buildWorkspaceVariantAssignments,
  collectSelectedWorkspaceImages,
  summarizeWorkspaceVariantAssignments,
} from "../client/src/lib/workspace-variant-sort.ts";

test("collectSelectedWorkspaceImages includes grouped views when a product card is selected", () => {
  const images = collectSelectedWorkspaceImages(
    [
      {
        primary: { id: 1, originalName: "shirt-front.jpg" } as any,
        views: [
          { id: 2, originalName: "shirt-back.jpg" } as any,
          { id: 3, originalName: "shirt-detail.jpg" } as any,
        ],
      },
      {
        primary: { id: 4, originalName: "pants-front.jpg" } as any,
        views: [],
      },
    ],
    new Set([1]),
  );

  assert.deepEqual(images.map((image) => image.id), [1, 2, 3]);
});

test("buildWorkspaceVariantAssignments maps AI groups back to image ids and preserves fallbacks", () => {
  const assignments = buildWorkspaceVariantAssignments(
    [
      { id: 10, originalName: "shirt-cream-front.jpg" } as any,
      { id: 11, originalName: "shirt-cream-back.jpg" } as any,
      { id: 12, originalName: "shirt-black-front.jpg" } as any,
      { id: 13, originalName: "pants-front.jpg" } as any,
    ],
    [
      {
        label: "Graphic Tee",
        imageIndices: [0, 1, 2],
        confidence: "high",
      },
    ],
    (groupIndex, group) => `group-${groupIndex + 1}-${group.label.toLowerCase().replace(/\s+/g, "-")}`,
  );

  assert.equal(assignments.length, 2);
  assert.deepEqual(assignments[0], {
    productGroupId: "group-1-graphic-tee",
    primaryImageId: 10,
    imageIds: [10, 11, 12],
    label: "Graphic Tee",
  });
  assert.deepEqual(assignments[1], {
    productGroupId: "group-2-pants-front.jpg",
    primaryImageId: 13,
    imageIds: [13],
    label: "pants-front.jpg",
  });
});

test("summarizeWorkspaceVariantAssignments reports real merges separately from singles", () => {
  const summary = summarizeWorkspaceVariantAssignments(
    [
      {
        productGroupId: "group-1",
        primaryImageId: 10,
        imageIds: [10, 11, 12],
        label: "Graphic Tee",
      },
      {
        productGroupId: "group-2",
        primaryImageId: 13,
        imageIds: [13],
        label: "Pants",
      },
    ],
    4,
  );

  assert.deepEqual(summary, {
    totalGroups: 2,
    mergedGroups: 1,
    mergedImages: 3,
    unmergedImages: 1,
  });
});
