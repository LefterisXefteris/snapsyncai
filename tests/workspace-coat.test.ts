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

test("the sidebar can collapse to an icon rail", () => {
  const sidebar = read("client/src/components/app-sidebar.tsx");
  assert.match(sidebar, /collapsible="icon"/);
  assert.match(sidebar, /<SidebarTrigger/);
});

test("chrome frost separates from products and the current Destination shows a gold edge", () => {
  const css = read("client/src/index.css");
  assert.match(css, /\.glass-chrome\s*\{[^}]*0\.6[^}]*blur\(24px\)[^}]*0\.1/s);
  assert.match(css, /\.glass-overlay\s*\{[^}]*0\.8[^}]*blur\(24px\)[^}]*0\.1/s);
  assert.equal(css.includes("hsl(var(--background) / 0.88)"), false);
  assert.equal(css.includes("blur(12px)"), false);

  const menu = read("client/src/components/ui/sidebar.tsx");
  assert.match(
    menu,
    /data-\[active=true\]:shadow-\[inset_0_0_0_2px_hsl\(var\(--sidebar-primary\)\)\]/,
  );
  assert.equal(menu.includes("data-[active=true]:bg-sidebar-accent"), false);
  assert.match(menu, /data-\[active=true\]:hover:bg-transparent/);

  const conversation = read("client/src/pages/Conversation.tsx");
  assert.match(conversation, /glass-chrome/);
  assert.equal(conversation.includes("bg-background border-b border-border"), false);
});
