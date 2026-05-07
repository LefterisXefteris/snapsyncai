import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const mainEntry = join(__dirname, "..", "client", "src", "main.tsx");

// Regression test for Sentry NODE-EXPRESS-3 (issue #19):
// A `throw new Error("SENTRY_TEST_CRASH: intentional frontend boot failure")`
// was added at module scope of client/src/main.tsx to verify Sentry capture,
// then forgotten. It blocked React from mounting in production. The throw was
// removed in commit e5e7a3a; this test guards against reintroduction.
test("client/src/main.tsx does not contain the SENTRY_TEST_CRASH boot throw", () => {
  const source = readFileSync(mainEntry, "utf8");
  assert.equal(
    source.includes("SENTRY_TEST_CRASH"),
    false,
    "SENTRY_TEST_CRASH marker reintroduced in client/src/main.tsx",
  );
});
