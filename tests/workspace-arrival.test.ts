import test from "node:test";
import assert from "node:assert/strict";

import { shopifyConnectNotice, workspaceArrival } from "../client/src/lib/workspace-arrival.ts";

const open = {
  search: "",
  chosenPath: null,
  connectFrom: null,
};

test("choosing Products with no Shopify Channel keeps the catalogue open", () => {
  const arrival = workspaceArrival({
    shopConnected: false,
    pathname: "/",
    search: "",
    chosenPath: "/conversation",
    connectFrom: null,
  });
  assert.equal(arrival.path, "/");
  assert.equal(arrival.chosenPath, "/");
});

test("opening the workspace with no Shopify Channel arrives in Conversation", () => {
  const arrival = workspaceArrival({
    shopConnected: false,
    pathname: "/",
    ...open,
  });
  assert.equal(arrival.path, "/conversation");
  assert.equal(arrival.chosenPath, "/conversation");
});

test("opening the workspace with a Shopify Channel lands on Products", () => {
  const arrival = workspaceArrival({
    shopConnected: true,
    pathname: "/",
    ...open,
  });
  assert.equal(arrival.path, "/");
  assert.equal(arrival.chosenPath, "/");
});

test("a new window with no Shopify Channel arrives in Conversation", () => {
  const arrival = workspaceArrival({
    shopConnected: false,
    pathname: "/",
    search: "",
    chosenPath: null,
    connectFrom: null,
  });
  assert.equal(arrival.path, "/conversation");
});

test("a product link stays on the product when there is no Shopify Channel", () => {
  const arrival = workspaceArrival({
    shopConnected: false,
    pathname: "/product/14",
    ...open,
  });
  assert.equal(arrival.path, "/product/14");
  assert.equal(arrival.chosenPath, "/product/14");
});

test("Inventory, Import, New listing, the website, Bulk SEO, and Settings stay open", () => {
  for (const pathname of ["/inventory", "/import", "/new", "/website", "/bulk-seo", "/settings"]) {
    const arrival = workspaceArrival({
      shopConnected: false,
      pathname,
      ...open,
    });
    assert.equal(arrival.path, pathname);
  }
});

test("a disconnect leaves the catalogue open", () => {
  const arrival = workspaceArrival({
    shopConnected: false,
    pathname: "/",
    search: "",
    chosenPath: "/",
    connectFrom: null,
  });
  assert.equal(arrival.path, "/");
});

test("a connect trip returns to the place they left", () => {
  const arrival = workspaceArrival({
    shopConnected: false,
    pathname: "/",
    search: "?shopify=error&reason=missing_inventory_scopes",
    chosenPath: "/inventory",
    connectFrom: "/inventory",
  });
  assert.equal(arrival.path, "/inventory?shopify=error&reason=missing_inventory_scopes");
  assert.equal(arrival.clearConnectFrom, false);
});

test("a connect return that has landed clears the trip and stays", () => {
  const arrival = workspaceArrival({
    shopConnected: false,
    pathname: "/inventory",
    search: "?shopify=error&reason=missing_inventory_scopes",
    chosenPath: "/inventory",
    connectFrom: "/inventory",
  });
  assert.equal(arrival.path, "/inventory");
  assert.equal(arrival.clearConnectFrom, true);
});

test("a shop that connected does not move them off Conversation", () => {
  const arrival = workspaceArrival({
    shopConnected: true,
    pathname: "/",
    search: "?shopify=connected",
    chosenPath: "/conversation",
    connectFrom: "/conversation",
  });
  assert.equal(arrival.path, "/conversation?shopify=connected");
  assert.equal(arrival.chosenPath, "/conversation");
});

test("a failed connect with no remembered place is told on the workspace home", () => {
  const arrival = workspaceArrival({
    shopConnected: false,
    pathname: "/",
    search: "?shopify=error&reason=missing_inventory_scopes",
    chosenPath: null,
    connectFrom: null,
  });
  assert.equal(arrival.path, "/");
});

test("a failed connect names the inventory permissions failure", () => {
  const notice = shopifyConnectNotice("?shopify=error&reason=missing_inventory_scopes");
  assert.equal(notice?.title, "Shopify Connection Failed");
  assert.equal(
    notice?.description,
    "Reconnect Shopify and approve product, inventory, and location access.",
  );
  assert.equal(notice?.variant, "destructive");
});

test("a connected shop is told it is ready", () => {
  const notice = shopifyConnectNotice("?shopify=connected");
  assert.equal(notice?.title, "Shopify Connected");
  assert.equal(notice?.description, "Your Shopify store is ready to receive products.");
});
