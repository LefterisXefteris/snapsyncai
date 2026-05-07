import test from "node:test";
import assert from "node:assert/strict";

import { resolveUploadProcessingMode } from "../server/uploadLanggraph.ts";

test("routes grouped paid uploads through the groupedPaid branch", async () => {
  const mode = await resolveUploadProcessingMode({
    fileCount: 3,
    groupAsOne: true,
    hasActiveSubscription: true,
  });

  assert.equal(mode, "groupedPaid");
});

test("routes grouped preview uploads through the groupedPreview branch", async () => {
  const mode = await resolveUploadProcessingMode({
    fileCount: 3,
    groupAsOne: true,
    hasActiveSubscription: false,
  });

  assert.equal(mode, "groupedPreview");
});

test("routes single-file paid uploads through the singlePaid branch", async () => {
  const mode = await resolveUploadProcessingMode({
    fileCount: 1,
    groupAsOne: false,
    hasActiveSubscription: true,
  });

  assert.equal(mode, "singlePaid");
});

test("routes non-grouped preview uploads through the singlePreview branch", async () => {
  const mode = await resolveUploadProcessingMode({
    fileCount: 1,
    groupAsOne: false,
    hasActiveSubscription: false,
  });

  assert.equal(mode, "singlePreview");
});

test("rejects empty uploads before routing", async () => {
  assert.throws(
    () =>
      resolveUploadProcessingMode({
        fileCount: 0,
        groupAsOne: false,
        hasActiveSubscription: false,
      }),
    /No files uploaded/,
  );
});
