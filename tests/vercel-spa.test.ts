import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("Vercel serves only the SPA — no /api serverless handler", () => {
  const vercel = JSON.parse(readFileSync(join(root, "vercel.json"), "utf8")) as {
    rewrites?: Array<{ source: string; destination: string }>;
    functions?: Record<string, unknown>;
  };
  const destinations = (vercel.rewrites ?? []).map((rule) => rule.destination);
  assert.equal(
    destinations.some((destination) => destination.includes("api/index.js")),
    false,
  );
  assert.equal(
    (vercel.rewrites ?? []).some((rule) => rule.source.includes("/api")),
    false,
  );
  assert.equal(vercel.functions, undefined);
});

test("production start script is not the Express bundle", () => {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
  };
  assert.ok(!(pkg.scripts?.start ?? "").includes("dist/index.cjs"));
  assert.equal(pkg.dependencies?.express, undefined);
  assert.equal(pkg.dependencies?.["stripe-replit-sync"], undefined);
});

test("Vercel install uses npm because the repo lockfile is package-lock.json", () => {
  const vercel = JSON.parse(readFileSync(join(root, "vercel.json"), "utf8")) as {
    installCommand?: string;
  };
  assert.match(vercel.installCommand ?? "", /^npm ci\b/);
  assert.equal(existsSync(join(root, "package-lock.json")), true);
  assert.equal(existsSync(join(root, "pnpm-lock.yaml")), false);
});
