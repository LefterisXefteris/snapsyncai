import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  NEED_CREDITS,
  NEED_OVERFLOW_CONFIRM,
  creditsNeededNotice,
  isCreditsNeededError,
  isOverflowConfirmError,
  showGenerateOverflowNotice,
} from "../client/src/lib/overflow-copy.ts";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

test("credits needed notice sends the seller to buy a pack", () => {
  assert.match(creditsNeededNotice(), /three free Credits/i);
  assert.match(creditsNeededNotice(), /Settings/i);
});

test("stale listing copy does not show the generate overflow notice", () => {
  assert.equal(showGenerateOverflowNotice(true, false), true);
  assert.equal(showGenerateOverflowNotice(true, true), false);
  assert.equal(showGenerateOverflowNotice(false, false), false);
});

test("credits needed errors match the Plan module message", () => {
  assert.equal(isCreditsNeededError(NEED_CREDITS), true);
  assert.equal(isCreditsNeededError(`403: {"detail":"${NEED_CREDITS}"}`), true);
  assert.equal(isCreditsNeededError("403: Subscribe to a Plan"), false);
});

test("legacy overflow confirm token still detects", () => {
  assert.equal(isOverflowConfirmError(`403: {"detail":"${NEED_OVERFLOW_CONFIRM}"}`), true);
});

test("credits copy is used on the job surfaces", () => {
  const editor = readFileSync(path.join(root, "client/src/pages/ProductDetails.tsx"), "utf8");
  const bulk = readFileSync(path.join(root, "client/src/pages/BulkSeo.tsx"), "utf8");
  assert.match(editor, /creditsNeededNotice|overflow-copy/);
  assert.match(bulk, /Credits|creditsNeededNotice|useOverflowConfirm/);
});
