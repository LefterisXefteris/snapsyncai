import test from "node:test";
import assert from "node:assert/strict";

import { apiFetch } from "../client/src/lib/api-fetch.ts";

type FetchCall = { url: string; init?: RequestInit };

async function withMockedFetch(
  clerk: { getToken: () => Promise<string | null> } | null,
  fn: (calls: FetchCall[]) => Promise<void>,
) {
  const calls: FetchCall[] = [];
  const origFetch = globalThis.fetch;
  const g = globalThis as typeof globalThis & { Clerk?: { session?: { getToken: () => Promise<string | null> } } };
  const origClerk = g.Clerk;
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  g.Clerk = clerk ? { session: { getToken: clerk.getToken } } : undefined;
  try {
    await fn(calls);
  } finally {
    globalThis.fetch = origFetch;
    g.Clerk = origClerk;
  }
}

test("apiFetch sends the Clerk session as a Bearer token", async () => {
  await withMockedFetch({ getToken: async () => "sess_test_token" }, async (calls) => {
    await apiFetch("/api/images/upload", { method: "POST" });
    assert.equal(calls.length, 1);
    const headers = new Headers(calls[0].init?.headers);
    assert.equal(headers.get("Authorization"), "Bearer sess_test_token");
    assert.equal(calls[0].init?.credentials, "include");
  });
});

test("apiFetch omits Authorization when there is no Clerk session", async () => {
  await withMockedFetch(null, async (calls) => {
    await apiFetch("/api/images");
    const headers = new Headers(calls[0].init?.headers);
    assert.equal(headers.get("Authorization"), null);
  });
});
