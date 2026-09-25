import test from "node:test";
import assert from "node:assert/strict";

import { displaySize, photoFromRecord } from "../client/src/lib/staged-photo.ts";

test("a wide camera photo is shown at a 480 long edge", () => {
  assert.deepEqual(displaySize(4000, 3000), { width: 480, height: 360 });
});

test("a tall camera photo is shown at a 480 long edge", () => {
  assert.deepEqual(displaySize(3000, 4000), { width: 360, height: 480 });
});

test("a photo already within the long edge stays its own size", () => {
  assert.deepEqual(displaySize(200, 100), { width: 200, height: 100 });
});

test("a staged photo keeps the original file and shows the smaller picture", async () => {
  const original = new Uint8Array([1, 2, 3, 4, 5]);
  const smaller = new Uint8Array([9, 9]);
  const photo = photoFromRecord({
    blob: new Blob([original], { type: "image/jpeg" }),
    displayBlob: new Blob([smaller], { type: "image/jpeg" }),
    filename: "coat.jpg",
    mimeType: "image/jpeg",
  });

  assert.deepEqual(new Uint8Array(await photo.file.arrayBuffer()), original);
  assert.equal(photo.file.name, "coat.jpg");
  assert.deepEqual(new Uint8Array(await photo.display.arrayBuffer()), smaller);
});

test("a photo that cannot be shrunk shows the original file", async () => {
  const original = new Uint8Array([7, 7, 7]);
  const photo = photoFromRecord({
    blob: new Blob([original], { type: "image/heic" }),
    filename: "label.heic",
    mimeType: "image/heic",
  });

  assert.deepEqual(new Uint8Array(await photo.file.arrayBuffer()), original);
  assert.equal(photo.display, photo.file);
});
