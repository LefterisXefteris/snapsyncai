import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  NEED_OVERFLOW_CONFIRM,
  isOverflowConfirmError,
  overflowConfirmBody,
  overflowNoticeText,
  showGenerateOverflowNotice,
} from "../client/src/lib/overflow-copy.ts";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

test("overflow confirm names the paid listing-copy write", () => {
  assert.equal(
    overflowConfirmBody(70),
    "This AI listing-copy write is £0.70. A card on file is charged when the write lands.",
  );
  assert.doesNotMatch(overflowConfirmBody(70), /top-up|credit|overage|Allowance|Plan invoice/i);
});

test("overflow notice names this next paid write", () => {
  assert.equal(
    overflowNoticeText(70),
    "The next AI listing-copy write that lands is £0.70.",
  );
});

test("stale listing copy does not show the generate overflow notice", () => {
  assert.equal(showGenerateOverflowNotice(true, false), true);
  assert.equal(showGenerateOverflowNotice(true, true), false);
  assert.equal(showGenerateOverflowNotice(false, false), false);
});

test("overflow confirm errors are the Plan module token", () => {
  assert.equal(isOverflowConfirmError(`403: {"detail":"${NEED_OVERFLOW_CONFIRM}"}`), true);
  assert.equal(isOverflowConfirmError("403: Subscribe to a Plan"), false);
});

test("overflow copy is used on the job surfaces", () => {
  const editor = readFileSync(path.join(root, "client/src/pages/ProductDetails.tsx"), "utf8");
  const bulk = readFileSync(path.join(root, "client/src/pages/BulkSeo.tsx"), "utf8");
  assert.match(editor, /overflow-copy/);
  assert.match(bulk, /overflow-copy|OverflowConfirmDialog|useOverflowConfirm/);
});
