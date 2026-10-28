import assert from "node:assert/strict";
import test from "node:test";

import { draftsFromConfirmed, shownOnProductPage } from "../client/src/lib/product-facts.ts";

test("the product page shows confirmed facts, including an explicit skip", () => {
  const drafts = draftsFromConfirmed({
    confirmed: {
      productKind: "textile",
      composition: [
        { name: "cotton", percent: 80 },
        { name: "polyester", percent: 20 },
      ],
      gpsrChoice: "skip",
      careChoice: "skip",
    },
  });

  assert.deepEqual(drafts.composition, [
    { name: "cotton", percent: "80", otherName: "" },
    { name: "polyester", percent: "20", otherName: "" },
  ]);
  assert.equal(drafts.gpsrChoice, "skip");
  assert.equal(drafts.careChoice, "skip");
});

test("a typed description is a change the open product page shows", () => {
  const before = shownOnProductPage({ id: 7, description: "<p>Old.</p>" });
  const after = shownOnProductPage({ id: 7, description: "It is organic cotton." });
  assert.notEqual(before, after);
});
