import test from "node:test";
import assert from "node:assert/strict";

import {
  clusterByCosine,
  cosineSimilarity,
  embedImagesCohere,
  COHERE_EMBED_BATCH_SIZE,
  COHERE_EMBED_MODEL,
} from "../server/embedding-utils.ts";
import {
  __resetCohereClientForTests,
  __setCohereClientForTests,
  getCohereClient,
} from "../server/cohere-client.ts";

type EmbedCall = {
  model?: string;
  inputType?: string;
  embeddingTypes?: string[];
  outputDimension?: number;
  images?: string[];
};

function makeFakeClient(
  respond: (call: EmbedCall) => { embeddings: { float: number[][] } },
) {
  const calls: EmbedCall[] = [];
  return {
    calls,
    client: {
      embed: async (call: EmbedCall) => {
        calls.push(call);
        return respond(call);
      },
    },
  };
}

test.beforeEach(() => {
  __resetCohereClientForTests();
});

// -----------------------------------------------------------------------------
// cosineSimilarity
// -----------------------------------------------------------------------------

test("cosineSimilarity: identical vectors return 1", () => {
  assert.equal(cosineSimilarity([1, 0, 0], [1, 0, 0]), 1);
  assert.ok(Math.abs(cosineSimilarity([3, 4, 0], [3, 4, 0]) - 1) < 1e-9);
});

test("cosineSimilarity: orthogonal vectors return 0", () => {
  assert.ok(Math.abs(cosineSimilarity([1, 0, 0], [0, 1, 0])) < 1e-9);
});

test("cosineSimilarity: opposite vectors return -1", () => {
  assert.equal(cosineSimilarity([1, 0, 0], [-1, 0, 0]), -1);
});

test("cosineSimilarity: zero vector returns 0 (no NaN)", () => {
  assert.equal(cosineSimilarity([0, 0, 0], [1, 2, 3]), 0);
});

// -----------------------------------------------------------------------------
// clusterByCosine
// -----------------------------------------------------------------------------

test("clusterByCosine: empty input returns empty output", () => {
  assert.deepEqual(clusterByCosine([], 0.9), []);
});

test("clusterByCosine: singleton input returns one group", () => {
  assert.deepEqual(clusterByCosine([[1, 2, 3]], 0.9), [[0]]);
});

test("clusterByCosine: unions vectors above threshold into two groups", () => {
  const vectors = [
    [1, 0, 0],
    [0.99, 0.01, 0],
    [0, 1, 0],
    [0, 0.99, 0.01],
  ];
  const result = clusterByCosine(vectors, 0.9);
  assert.deepEqual(result, [
    [0, 1],
    [2, 3],
  ]);
});

test("clusterByCosine: isolates orthogonal vectors below threshold", () => {
  const vectors = [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ];
  assert.deepEqual(clusterByCosine(vectors, 0.5), [[0], [1], [2], [3]]);
});

test("clusterByCosine: deterministic output across runs", () => {
  const vectors = [
    [0, 1, 0],
    [1, 0, 0],
    [0.99, 0.01, 0],
    [0, 0.99, 0.01],
    [0, 0, 1],
  ];
  const a = clusterByCosine(vectors, 0.9);
  const b = clusterByCosine(vectors, 0.9);
  assert.deepEqual(a, b);
  // Outer sort is by smallest inner index ascending.
  assert.deepEqual(a, [
    [0, 3],
    [1, 2],
    [4],
  ]);
});

test("clusterByCosine: transitive unions via union-find", () => {
  // A-B similar, B-C similar, A-C below threshold — still clustered.
  const vectors = [
    [1, 0, 0],
    [0.96, 0.28, 0], // sim(A) ≈ 0.96
    [0.87, 0.49, 0], // sim(B) ≈ 0.97, sim(A) ≈ 0.87
  ];
  const result = clusterByCosine(vectors, 0.95);
  assert.deepEqual(result, [[0, 1, 2]]);
});

// -----------------------------------------------------------------------------
// embedImagesCohere (with injected fake client)
// -----------------------------------------------------------------------------

test("embedImagesCohere: splits 200 inputs into batches of 96, 96, 8", async () => {
  const fake = makeFakeClient((call) => ({
    embeddings: {
      float: (call.images ?? []).map(() => [1, 2, 3]),
    },
  }));
  __setCohereClientForTests(fake.client);

  const inputs = Array.from({ length: 200 }, (_, i) => ({
    base64: `b64-${i}`,
    mimeType: "image/jpeg",
  }));

  const vectors = await embedImagesCohere(inputs);

  assert.equal(fake.calls.length, 3);
  assert.equal(fake.calls[0].images?.length, 96);
  assert.equal(fake.calls[1].images?.length, 96);
  assert.equal(fake.calls[2].images?.length, 8);
  assert.equal(vectors.length, 200);
  for (const v of vectors) {
    assert.deepEqual(v, [1, 2, 3]);
  }
});

test("embedImagesCohere: passes correct model, inputType, embeddingTypes, outputDimension", async () => {
  const fake = makeFakeClient((call) => ({
    embeddings: { float: (call.images ?? []).map(() => [0]) },
  }));
  __setCohereClientForTests(fake.client);

  await embedImagesCohere(
    [{ base64: "abc", mimeType: "image/png" }],
    { dimension: 1024 },
  );

  assert.equal(fake.calls.length, 1);
  const call = fake.calls[0];
  assert.equal(call.model, COHERE_EMBED_MODEL);
  assert.equal(call.inputType, "image");
  assert.deepEqual(call.embeddingTypes, ["float"]);
  assert.equal(call.outputDimension, 1024);
  assert.deepEqual(call.images, ["data:image/png;base64,abc"]);
});

test("embedImagesCohere: defaults outputDimension to 512 when not provided", async () => {
  const fake = makeFakeClient((call) => ({
    embeddings: { float: (call.images ?? []).map(() => [0]) },
  }));
  __setCohereClientForTests(fake.client);

  await embedImagesCohere([{ base64: "x", mimeType: "image/jpeg" }]);

  assert.equal(fake.calls[0].outputDimension, 512);
});

test("embedImagesCohere: preserves positional alignment", async () => {
  let callIndex = 0;
  const fake = makeFakeClient(() => {
    const base = callIndex++;
    return {
      embeddings: {
        // Each input gets a unique marker so we can verify order end-to-end.
        float: [
          [base * 100 + 1],
          [base * 100 + 2],
          [base * 100 + 3],
          [base * 100 + 4],
          [base * 100 + 5],
        ],
      },
    };
  });
  __setCohereClientForTests(fake.client);

  const inputs = Array.from({ length: 5 }, (_, i) => ({
    base64: `b${i}`,
    mimeType: "image/jpeg",
  }));
  const vectors = await embedImagesCohere(inputs);

  assert.deepEqual(vectors, [[1], [2], [3], [4], [5]]);
});

test("embedImagesCohere: throws if response length mismatches batch size", async () => {
  const fake = makeFakeClient(() => ({
    embeddings: { float: [[1]] }, // only 1 vector for batch of 2
  }));
  __setCohereClientForTests(fake.client);

  await assert.rejects(
    () =>
      embedImagesCohere([
        { base64: "a", mimeType: "image/jpeg" },
        { base64: "b", mimeType: "image/jpeg" },
      ]),
    /returned 1 vectors for batch of 2/,
  );
});

test("embedImagesCohere: propagates client errors", async () => {
  const fake = {
    embed: async () => {
      throw new Error("cohere network boom");
    },
  };
  __setCohereClientForTests(fake);

  await assert.rejects(
    () => embedImagesCohere([{ base64: "a", mimeType: "image/jpeg" }]),
    /cohere network boom/,
  );
});

// -----------------------------------------------------------------------------
// getCohereClient env var guard + singleton
// -----------------------------------------------------------------------------

test("getCohereClient: throws when COHERE_API_KEY is missing", () => {
  const prev = process.env.COHERE_API_KEY;
  delete process.env.COHERE_API_KEY;
  __resetCohereClientForTests();
  try {
    assert.throws(() => getCohereClient(), /COHERE_API_KEY is not set/);
  } finally {
    if (prev !== undefined) process.env.COHERE_API_KEY = prev;
  }
});

test("getCohereClient: returns the same instance across calls", () => {
  const prev = process.env.COHERE_API_KEY;
  process.env.COHERE_API_KEY = "test-key-abc";
  __resetCohereClientForTests();
  try {
    const a = getCohereClient();
    const b = getCohereClient();
    assert.equal(a, b);
    assert.equal(typeof a.embed, "function");
  } finally {
    if (prev !== undefined) {
      process.env.COHERE_API_KEY = prev;
    } else {
      delete process.env.COHERE_API_KEY;
    }
  }
});
