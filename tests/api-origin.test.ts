import test from "node:test";
import assert from "node:assert/strict";

import { apiUrl } from "../client/src/lib/api-origin.ts";

test("unset origin returns the relative path", () => {
  assert.equal(apiUrl("/api/health"), "/api/health");
});

test("set origin prefixes the Railway API host", () => {
  assert.equal(
    apiUrl("/api/health", "https://api.snapsyncai.co.uk"),
    "https://api.snapsyncai.co.uk/api/health",
  );
});

test("set origin leaves the existing /api path and query string unchanged", () => {
  assert.equal(
    apiUrl("/api/images/1/file?sz=10", "https://api.snapsyncai.co.uk"),
    "https://api.snapsyncai.co.uk/api/images/1/file?sz=10",
  );
});

test("trailing slash on the origin is not doubled", () => {
  assert.equal(
    apiUrl("/api/health", "https://api.snapsyncai.co.uk/"),
    "https://api.snapsyncai.co.uk/api/health",
  );
});
