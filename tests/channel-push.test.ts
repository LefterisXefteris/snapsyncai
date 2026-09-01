import test from "node:test";
import assert from "node:assert/strict";

import { channelPushDecision } from "../client/src/lib/channel-push.ts";

test("Channel push refuses products with no listing copy, even when they look paid", () => {
  assert.deepEqual(
    channelPushDecision([
      { listingCopyPresent: false, listingCopyStale: true, paymentStatus: "paid" },
      { listingCopyPresent: true, listingCopyStale: true, paymentStatus: "unpaid" },
    ]),
    { kind: "missing-copy", count: 1 },
  );
});

test("Channel push warns when listing copy is stale, then still allows the push", () => {
  assert.deepEqual(
    channelPushDecision([
      { listingCopyPresent: true, listingCopyStale: true },
      { listingCopyPresent: true, listingCopyStale: false },
    ]),
    { kind: "stale-warning", count: 1 },
  );
});

test("Channel push has no new warning when listing copy is present and not stale", () => {
  assert.deepEqual(
    channelPushDecision([
      { listingCopyPresent: true, paymentStatus: "unpaid" },
      { listingCopyPresent: true, listingCopyStale: false },
    ]),
    { kind: "push" },
  );
});
