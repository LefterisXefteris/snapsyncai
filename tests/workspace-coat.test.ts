import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

test("the workspace coat has no aurora and no second display face", () => {
  const css = read("client/src/index.css");
  assert.equal(css.includes("Sora"), false);
  assert.equal(css.includes("aurora"), false);
  assert.equal(css.includes("Instrument Sans"), true);
  assert.equal(existsSync(path.join(root, "client/src/components/ambient/AuroraBackground.tsx")), false);
  const button = read("client/src/components/ui/button.tsx");
  assert.equal(button.includes("0_0_20px"), false);
});

test("the sidebar is an icon rail that can pin open", () => {
  const app = read("client/src/App.tsx");
  const sidebar = read("client/src/components/app-sidebar.tsx");
  assert.match(app, /defaultOpen=\{false\}/);
  assert.match(sidebar, /collapsible="icon"/);
  assert.match(sidebar, /<SidebarTrigger/);
});
