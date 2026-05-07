import test from "node:test";
import assert from "node:assert/strict";

// Regression test for Sentry NODE-EXPRESS-4 (issue #11):
// The host doesn't always inject `__SNAPSYNC_CONFIG__` before client/src/main.tsx runs,
// so reading `version` must tolerate an undefined config object. Without the guard,
// `runtimeConfig.version` (minified `Yse.version`) threw and blocked the React boot.

type RuntimeConfigHost = { __SNAPSYNC_CONFIG__?: { version?: string } };

function readBootVersion(host: RuntimeConfigHost): string {
  const runtimeConfig = host.__SNAPSYNC_CONFIG__;
  return runtimeConfig?.version ?? "unknown";
}

test("readBootVersion returns 'unknown' when host has no __SNAPSYNC_CONFIG__", () => {
  assert.equal(readBootVersion({}), "unknown");
});

test("readBootVersion returns 'unknown' when config is present but version is missing", () => {
  assert.equal(readBootVersion({ __SNAPSYNC_CONFIG__: {} }), "unknown");
});

test("readBootVersion returns the injected version when host provides one", () => {
  assert.equal(readBootVersion({ __SNAPSYNC_CONFIG__: { version: "1.2.3" } }), "1.2.3");
});
