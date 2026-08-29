import test from "node:test";
import assert from "node:assert/strict";

import { channelPushDecision } from "../client/src/lib/channel-push.ts";

test("Channel push refuses unpaid products even when listing copy is also stale", () => {
  assert.deepEqual(
    channelPushDecision([
      { paymentStatus: "unpaid", listingCopyStale: true },
      { paymentStatus: "paid", listingCopyStale: true },
    ]),
    { kind: "unpaid", count: 1 },
  );
});

test("Channel push warns when listing copy is stale, then still allows the push", () => {
  assert.deepEqual(
    channelPushDecision([
      { paymentStatus: "paid", listingCopyStale: true },
      { paymentStatus: "paid", listingCopyStale: false },
    ]),
    { kind: "stale-warning", count: 1 },
  );
});

test("Channel push has no new warning when listing copy is not stale", () => {
  assert.deepEqual(
    channelPushDecision([
      { paymentStatus: "paid" },
      { paymentStatus: "paid", listingCopyStale: false },
    ]),
    { kind: "push" },
  );
});
