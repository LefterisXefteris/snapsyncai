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

test("overflow confirm names the extra Allowance use and the invoice", () => {
  assert.equal(
    overflowConfirmBody(70),
    "This write is an extra Allowance use. £0.70 on this month's Plan invoice.",
  );
  assert.doesNotMatch(overflowConfirmBody(70), /top-up|credit|overage/i);
});

test("overflow notice names this next write and the invoice", () => {
  assert.equal(
    overflowNoticeText(70),
    "The next write that lands is an extra Allowance use at £0.70 on this month's Plan invoice.",
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
  const website = readFileSync(path.join(root, "client/src/pages/Website.tsx"), "utf8");
  const bulk = readFileSync(path.join(root, "client/src/pages/BulkSeo.tsx"), "utf8");
  assert.match(editor, /overflow-copy/);
  assert.match(website, /overflow-copy|OverflowConfirmDialog|useOverflowConfirm/);
  assert.match(bulk, /overflow-copy|OverflowConfirmDialog|useOverflowConfirm/);
});
