import { getCohereClient } from "./cohere-client";

// Pure embedding + clustering core. Zero wiring into routes — plan 08-02 owns
// the seam that feeds runAutoGrouping into these functions.

export interface EmbedImageInput {
  base64: string;
  mimeType: string;
}

export const COHERE_EMBED_MODEL = "embed-v4.0";
export const COHERE_EMBED_BATCH_SIZE = 96;
// Matryoshka dimension — 512 is the bandwidth/quality sweet spot per 08-RESEARCH.md.
// Plan 08-02 may revisit after live quality checks.
export const COHERE_EMBED_DIMENSION = 512;

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(
      `cosineSimilarity: vector length mismatch (${a.length} vs ${b.length})`,
    );
  }
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const av = a[i];
    const bv = b[i];
    dot += av * bv;
    na += av * av;
    nb += bv * bv;
  }
  if (na === 0 || nb === 0) {
    return 0;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * Group vectors into clusters such that every pair within a cluster has
 * cosine similarity ≥ threshold (transitive via union-find). Output is
 * deterministic: inner arrays sorted ascending by index, outer array
 * sorted ascending by each cluster's smallest index.
 *
 * For n ≤ 200 (the auto-group upload cap) the O(n²) pairwise scan is
 * trivially fast — no need for FAISS / ANN.
 */
export function clusterByCosine(
  vectors: number[][],
  threshold: number,
): number[][] {
  const n = vectors.length;
  if (n === 0) return [];
  if (n === 1) return [[0]];

  // Union-find with path compression.
  const parent = new Array<number>(n);
  for (let i = 0; i < n; i++) parent[i] = i;

  const find = (x: number): number => {
    let root = x;
    while (parent[root] !== root) root = parent[root];
    // Path compression.
    let cur = x;
    while (parent[cur] !== root) {
      const next = parent[cur];
      parent[cur] = root;
      cur = next;
    }
    return root;
  };

  const union = (a: number, b: number): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (cosineSimilarity(vectors[i], vectors[j]) >= threshold) {
        union(i, j);
      }
    }
  }

  // Bucket by root, then canonicalize ordering for determinism.
  const buckets = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    const bucket = buckets.get(root);
    if (bucket) {
      bucket.push(i);
    } else {
      buckets.set(root, [i]);
    }
  }

  const groups = Array.from(buckets.values());
  for (const group of groups) group.sort((a, b) => a - b);
  groups.sort((a, b) => a[0] - b[0]);
  return groups;
}

/**
 * Embed a batch of images via Cohere Embed v4. Splits input sequentially into
 * batches of COHERE_EMBED_BATCH_SIZE. Returns a flat array of vectors positionally
 * aligned with `images`. Propagates SDK errors; retry/backoff lives in plan 08-02.
 */
export async function embedImagesCohere(
  images: EmbedImageInput[],
  opts: { dimension?: 256 | 512 | 1024 | 1536 } = {},
): Promise<number[][]> {
  const dimension = opts.dimension ?? COHERE_EMBED_DIMENSION;
  const client = getCohereClient();
  const results: number[][] = [];

  for (let i = 0; i < images.length; i += COHERE_EMBED_BATCH_SIZE) {
    const slice = images.slice(i, i + COHERE_EMBED_BATCH_SIZE);
    const res = await client.embed({
      model: COHERE_EMBED_MODEL,
      inputType: "image",
      embeddingTypes: ["float"],
      outputDimension: dimension,
      images: slice.map((img) => `data:${img.mimeType};base64,${img.base64}`),
    });

    const vectors = res.embeddings?.float;
    if (!vectors || vectors.length !== slice.length) {
      throw new Error(
        `Cohere embed returned ${vectors?.length ?? 0} vectors for batch of ${slice.length}`,
      );
    }
    results.push(...vectors);
  }

  return results;
}
