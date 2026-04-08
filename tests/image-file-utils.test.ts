import test from "node:test";
import assert from "node:assert/strict";

import { filterImageLikeFiles, isImageLikeFile } from "../client/src/lib/image-file-utils.ts";

test("accepts files with an image mime type", () => {
  assert.equal(isImageLikeFile({ name: "product.bin", type: "image/png" }), true);
});

test("accepts files with an image extension even when mime type is empty", () => {
  assert.equal(isImageLikeFile({ name: "product-shot.HEIC", type: "" }), true);
});

test("rejects non-image files", () => {
  assert.equal(isImageLikeFile({ name: "notes.pdf", type: "application/pdf" }), false);
});

test("filters a mixed file list down to image-like files", () => {
  const files = [
    { name: "hero.jpg", type: "" },
    { name: "notes.txt", type: "text/plain" },
    { name: "detail.webp", type: "image/webp" },
  ];

  assert.deepEqual(filterImageLikeFiles(files), [
    { name: "hero.jpg", type: "" },
    { name: "detail.webp", type: "image/webp" },
  ]);
});
