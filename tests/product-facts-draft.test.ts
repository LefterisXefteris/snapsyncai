import assert from "node:assert/strict";
import test from "node:test";

import {
  draftsFromConfirmed,
  publicationsOnTheOpenPage,
  sellingOnTheOpenPage,
  shownOnProductPage,
} from "../client/src/lib/product-facts.ts";

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

test("undo of selling is a change the open product page shows", () => {
  assert.notEqual(
    sellingOnTheOpenPage({ id: 7, price: "19" }),
    sellingOnTheOpenPage({ id: 7, price: "12.50" }),
  );
  assert.equal(
    sellingOnTheOpenPage({ id: 7, price: "19" }),
    sellingOnTheOpenPage({ id: 7, price: "19", shopifyPublicationIds: ["gid://shopify/Publication/3"] } as {
      id: number;
      price: string;
    }),
  );
});

test("undo of publications is a change the open product page shows", () => {
  assert.notEqual(
    publicationsOnTheOpenPage({ id: 7, shopifyPublicationIds: ["gid://shopify/Publication/3"] }),
    publicationsOnTheOpenPage({ id: 7, shopifyPublicationIds: ["gid://shopify/Publication/1"] }),
  );
});

test("a typed description is a change the open product page shows", () => {
  const before = shownOnProductPage({ id: 7, description: "<p>Old.</p>" });
  const after = shownOnProductPage({ id: 7, description: "It is organic cotton." });
  assert.notEqual(before, after);
});
