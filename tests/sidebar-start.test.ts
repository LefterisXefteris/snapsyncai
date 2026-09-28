import test from "node:test";
import assert from "node:assert/strict";

import { sidebarStartsOpen } from "../client/src/lib/sidebar-start.ts";

test("a wide desktop with no saved choice starts open", () => {
  assert.equal(sidebarStartsOpen({ saved: null, viewportWidth: 1440 }), true);
});

test("a narrow desktop with no saved choice starts collapsed", () => {
  assert.equal(sidebarStartsOpen({ saved: null, viewportWidth: 900 }), false);
});

test("a saved choice wins at either width", () => {
  assert.equal(sidebarStartsOpen({ saved: false, viewportWidth: 1440 }), false);
  assert.equal(sidebarStartsOpen({ saved: true, viewportWidth: 900 }), true);
});
