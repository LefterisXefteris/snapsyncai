import test from "node:test";
import assert from "node:assert/strict";

import {
  WORKSPACE_HOME_PATH,
  WORKSPACE_NAV,
  activeWorkspaceNavId,
  workspaceNavItem,
  workspaceStubCopy,
} from "../client/src/lib/workspace-nav.ts";

test("Products is the home path", () => {
  assert.equal(WORKSPACE_HOME_PATH, "/");
  assert.equal(workspaceNavItem("products").path, "/");
  assert.equal(workspaceNavItem("products").stub, false);
});

test("nav order is catalogue, then entry jobs, then Settings", () => {
  assert.deepEqual(
    WORKSPACE_NAV.map((item) => item.label),
    ["Products", "New listing", "Import", "Inventory", "Website", "Bulk SEO", "Settings"],
  );
});

test("New listing is a photo-entry destination, not a stub", () => {
  const item = workspaceNavItem("new-listing");
  assert.equal(item.path, "/new");
  assert.equal(item.stub, false);
});

test("Import, Inventory, Website, and Bulk SEO are live", () => {
  assert.equal(workspaceNavItem("import").stub, false);
  assert.equal(workspaceNavItem("inventory").stub, false);
  assert.equal(workspaceNavItem("website").stub, false);
  assert.equal(workspaceNavItem("website").path, "/website");
  assert.equal(workspaceNavItem("bulk-seo").stub, false);
  assert.equal(workspaceNavItem("import").path, "/import");
  assert.equal(workspaceNavItem("inventory").path, "/inventory");
  assert.equal(workspaceNavItem("bulk-seo").path, "/bulk-seo");
});

test("Settings is a live destination", () => {
  const item = workspaceNavItem("settings");
  assert.equal(item.path, "/settings");
  assert.equal(item.stub, false);
});

test("the catalogue and a product drill-in both activate Products", () => {
  assert.equal(activeWorkspaceNavId("/"), "products");
  assert.equal(activeWorkspaceNavId("/product/12"), "products");
});

test("each destination path activates its own nav item", () => {
  assert.equal(activeWorkspaceNavId("/new"), "new-listing");
  assert.equal(activeWorkspaceNavId("/import"), "import");
  assert.equal(activeWorkspaceNavId("/inventory"), "inventory");
  assert.equal(activeWorkspaceNavId("/website"), "website");
  assert.equal(activeWorkspaceNavId("/bulk-seo"), "bulk-seo");
  assert.equal(activeWorkspaceNavId("/settings"), "settings");
});

test("an unknown path activates nothing", () => {
  assert.equal(activeWorkspaceNavId("/not-a-page"), null);
});

test("Import is not a stub", () => {
  assert.equal(workspaceNavItem("import").stub, false);
  assert.equal(workspaceStubCopy("import").body, "");
});
