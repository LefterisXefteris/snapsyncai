import test from "node:test";
import assert from "node:assert/strict";

import { fetchImageObjectUrl } from "../client/src/lib/authenticated-image.ts";

test("fetchImageObjectUrl returns a blob URL when the file request succeeds", async () => {
  const origFetch = globalThis.fetch;
  const origCreate = URL.createObjectURL;
  const g = globalThis as typeof globalThis & {
    Clerk?: { session?: { getToken: () => Promise<string | null> } };
  };
  const origClerk = g.Clerk;
  globalThis.fetch = (async () =>
    new Response(new Uint8Array([1, 2, 3]), { status: 200 })) as typeof fetch;
  g.Clerk = { session: { getToken: async () => "sess_test_token" } };
  URL.createObjectURL = () => "blob:test-photo";
  try {
    const url = await fetchImageObjectUrl("/api/images/1/file");
    assert.equal(url, "blob:test-photo");
  } finally {
    globalThis.fetch = origFetch;
    g.Clerk = origClerk;
    URL.createObjectURL = origCreate;
  }
});

test("fetchImageObjectUrl returns null when the file request fails", async () => {
  const origFetch = globalThis.fetch;
  const g = globalThis as typeof globalThis & {
    Clerk?: { session?: { getToken: () => Promise<string | null> } };
  };
  const origClerk = g.Clerk;
  globalThis.fetch = (async () => new Response("", { status: 404 })) as typeof fetch;
  g.Clerk = { session: { getToken: async () => "sess_test_token" } };
  try {
    const url = await fetchImageObjectUrl("/api/images/1/file");
    assert.equal(url, null);
  } finally {
    globalThis.fetch = origFetch;
    g.Clerk = origClerk;
  }
});
