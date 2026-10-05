import test from "node:test";
import assert from "node:assert/strict";

import { storefrontHandleFromHost } from "../client/src/lib/storefront-host.ts";

test("a shop subdomain is the public storefront", () => {
  assert.equal(storefrontHandleFromHost("tees.sites.snapsyncai.co.uk"), "tees");
  assert.equal(storefrontHandleFromHost("TEES.sites.snapsyncai.co.uk."), "tees");
});

test("the workspace host is not a storefront", () => {
  assert.equal(storefrontHandleFromHost("www.snapsyncai.co.uk"), null);
  assert.equal(storefrontHandleFromHost("sites.snapsyncai.co.uk"), null);
  assert.equal(storefrontHandleFromHost("evil.sites.snapsyncai.co.uk.example"), null);
  assert.equal(storefrontHandleFromHost("a.b.sites.snapsyncai.co.uk"), null);
});
