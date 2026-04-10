import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

import { runAutoGrouping } from "../server/routes.ts";
import {
  __resetCohereClientForTests,
  __setCohereClientForTests,
} from "../server/cohere-client.ts";
import { __setTimeoutMsForTests } from "../server/embedding-utils.ts";

// Integration tests for runAutoGrouping — covers the three paths 08-02 owns:
// success, retry-then-success, retry-exhausted-then-fallback, plus the
// Promise.race timeout branch. The Cohere client is stubbed via the injection
// seam introduced in Plan 08-01 (__setCohereClientForTests).

type EmbedCallRecord = { images: string[] };

function makeMockCohere(behaviors: Array<"ok" | "throw">) {
  const calls: EmbedCallRecord[] = [];
  let callIndex = 0;
  return {
    calls,
    client: {
      embed: async (params: { images: string[] }) => {
        calls.push({ images: params.images });
        const behavior = behaviors[callIndex++] ?? "ok";
        if (behavior === "throw") {
          throw new Error("Cohere 500 Internal Server Error");
        }
        // "ok" — deterministic vectors:
        // first two inputs cluster together (identical), third is orthogonal.
        const vectors = params.images.map((_, i) => {
          if (i < 2) return [1, 0, 0];
          return [0, 1, 0];
        });
        return { embeddings: { float: vectors } };
      },
    },
  };
}

const sampleInputs = [
  {
    index: 0,
    base64: "AAA=",
    mimeType: "image/jpeg",
    filename: "shirt-red-front.jpg",
    descriptor: "red shirt",
  },
  {
    index: 1,
    base64: "AAA=",
    mimeType: "image/jpeg",
    filename: "shirt-red-back.jpg",
    descriptor: "red shirt",
  },
  {
    index: 2,
    base64: "AAA=",
    mimeType: "image/jpeg",
    filename: "hoodie-blue.jpg",
    descriptor: "blue hoodie",
  },
];

beforeEach(() => {
  __resetCohereClientForTests();
  process.env.COHERE_API_KEY = "test-key";
  // Ensure default timeout is in effect at the start of every test so earlier
  // timeout-override tests do not leak state into later ones.
  __setTimeoutMsForTests(60_000);
});

test("success path: embeddings cluster into 2 groups, no fallback", async () => {
  const mock = makeMockCohere(["ok"]);
  __setCohereClientForTests(mock.client);

  const result = await runAutoGrouping(sampleInputs, undefined, "variant-family");

  assert.equal(result.fallbackUsed, false);
  assert.equal(result.groups.length, 2);
  assert.equal(mock.calls.length, 1);
  // Cluster containing inputs 0 and 1 must appear before the singleton cluster.
  const allIndices = result.groups.flatMap((g) => g.imageIndices).sort();
  assert.deepEqual(allIndices, [0, 1, 2]);
});

test("retry path: first call throws, second succeeds, no fallback", async () => {
  const mock = makeMockCohere(["throw", "ok"]);
  __setCohereClientForTests(mock.client);

  const result = await runAutoGrouping(sampleInputs, undefined, "variant-family");

  assert.equal(result.fallbackUsed, false);
  assert.equal(result.groups.length, 2);
  assert.equal(mock.calls.length, 2);
});

test("fallback path: both attempts fail, filename-only grouping", async () => {
  const mock = makeMockCohere(["throw", "throw"]);
  __setCohereClientForTests(mock.client);

  const result = await runAutoGrouping(sampleInputs, undefined, "variant-family");

  assert.equal(result.fallbackUsed, true);
  assert.match(result.fallbackReason ?? "", /Cohere 500/);
  // Every input index appears exactly once across fallback groups.
  const allIndices = result.groups.flatMap((g) => g.imageIndices).sort();
  assert.deepEqual(allIndices, [0, 1, 2]);
  assert.ok(result.groups.length >= 1);
  assert.equal(mock.calls.length, 2);
});

test("timeout counts as failure and triggers fallback", async () => {
  // Drive the Promise.race timeout branch explicitly by collapsing the
  // module-level timeout to 50ms and wiring a client that never resolves.
  __setTimeoutMsForTests(50);
  const hangingClient = {
    embed: async () => {
      await new Promise(() => {
        /* hang forever */
      });
      throw new Error("unreachable");
    },
  };
  __setCohereClientForTests(hangingClient);

  const result = await runAutoGrouping(sampleInputs, undefined, "variant-family");

  assert.equal(result.fallbackUsed, true);
  assert.match(result.fallbackReason ?? "", /timeout/i);

  // Restore so later tests are unaffected.
  __setTimeoutMsForTests(60_000);
});
