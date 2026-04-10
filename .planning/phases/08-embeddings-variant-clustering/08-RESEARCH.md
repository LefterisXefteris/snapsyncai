# Phase 8: Replace VLM variant sorter with embeddings-based clustering — Research

**Researched:** 2026-04-10
**Domain:** Image embeddings + clustering for same-product grouping in a TypeScript/Node/Vercel-serverless app
**Confidence:** MEDIUM-HIGH (stack claims HIGH; cost/latency numbers MEDIUM — API pricing moves)

## Framing Check (read first)

The user framing is **substantially correct, with one important nuance**:

1. There **is** a VLM variant sorter shipped today. It is the `runAutoGrouping()` function in `server/routes.ts:124-280`, which calls `gpt-5.2` vision in batches of 15 and post-processes with `server/auto-group-utils.ts` (apparel token heuristics). Two endpoints use it: `/api/images/auto-group` (SSE, pre-upload workflow) and `/api/images/auto-group-existing` (JSON, post-upload workspace "Sort Variants" button).
2. **Nuance:** the current sorter is *not purely* a VLM. It is a **hybrid**: GPT-5.2 vision does the semantic grouping per batch, and a large hand-written token normalizer (`buildApparelIdentityProfile`, `mergeAutoGroupsByFamily` in `server/auto-group-utils.ts:192-287`) does post-hoc family-key merging across batches using filename and descriptor strings. That string-normalizer is doing a lot of the cross-batch work. An embeddings replacement must replace both responsibilities or delegate the cross-batch piece explicitly.
3. The phase goal statement ("Goal: [To be planned]") is blank in the ROADMAP. The inferred goal — *replace GPT vision calls in the variant sorter with an embedding + clustering pipeline that is faster, cheaper, and more consistent for same-product visual deduplication* — is consistent with the recent commit pressure ("Strengthen apparel variant grouping", "Move workspace variant grouping server-side", "Make variant sorting report real merges"). The user should confirm the goal before planning.

No existing embeddings infrastructure in the codebase — zero references to "embedding" in `server/`, `client/`, or `shared/`. No pgvector, no vector column on `images`. This is a greenfield slot-in.

## User Constraints (from CONTEXT.md)

**No CONTEXT.md exists for this phase.** Discovery/decisions have not been logged. This research is un-scoped by user choices, so it spans the reasonable option space. The planner should run `/gsd:discuss-phase 8` (or the user should answer the Open Questions at the end of this doc) before plans are written.

## Project Constraints (from PROJECT.md / STATE.md)

Copied verbatim from `.planning/PROJECT.md` and STATE.md — the planner MUST honor these:

- **Deployment:** Vercel serverless. No in-process Redis, no long-running workers. Every request is a cold-startable function invocation.
- **Function size:** Vercel serverless function unzipped size cap is **250 MB** (hard limit 300 MB). ONNX-on-server is feasible but marginal; a quantized CLIP image encoder is ~22–90 MB depending on quant level.
- **Architecture:** No file restructuring. `server/routes.ts` is a 3,000+ line monolith; new code is appended in place. Client `Home.tsx` is similarly monolithic — do NOT split it.
- **Database:** PostgreSQL via Drizzle ORM (`drizzle-orm ^0.39.3`). Schema changes require a Drizzle migration file (`drizzle-kit push`).
- **Auth:** Clerk. All grouping endpoints already call `requireAuth()` and `getUserId(req)` — preserve this pattern.
- **Storage:** Supabase Storage for image files. Images also have a legacy `imageData` base64 column; `storageUrl` is the CDN path. The auto-group-existing endpoint currently pulls buffers via `loadImageBuffer(image)` and base64-encodes them for GPT — expensive.
- **Feature flags:** Existing pattern is `VITE_FEATURE_*` env vars read via `import.meta.env.VITE_FEATURE_X === "true"` (see `client/src/pages/ProductDetails.tsx:23-24`). Server-side flags should follow a parallel `FEATURE_*` env var pattern.
- **Budget:** This is a live SaaS with real paying users. Cost regressions are unacceptable; the replacement must be cheaper OR meaningfully better at comparable cost.
- **Body-size:** Vercel serverless body limit is 4.5 MB per request. The current pre-upload path ships base64 images directly in the POST body and is already flirting with this limit for 200 images; an embeddings replacement should either (a) not worsen body size, or (b) move to a presigned-upload-then-embed flow.

## Phase Requirements

**No requirement IDs exist in REQUIREMENTS.md for Phase 8.** Phase 7 requirements (GROUP-01..04) are marked Complete. New requirements must be drafted during `/gsd:discuss-phase 8`. Candidate requirements (planner should propose to user):

| Candidate ID | Description |
|---|---|
| CLUSTER-01 | Sorting a batch of ≤200 images into same-product groups uses image embeddings + cosine-similarity clustering, not GPT vision |
| CLUSTER-02 | Latency for 50 images end-to-end ≤ current VLM path (measured baseline required) |
| CLUSTER-03 | Cost per 100 images strictly less than current GPT-5.2 vision cost |
| CLUSTER-04 | Existing "Sort Variants" button UX is preserved — user still sees label, confidence, and can review/merge/split |
| CLUSTER-05 | New path ships behind a `VITE_FEATURE_EMBEDDING_SORT` flag so VLM fallback can be re-enabled without deploy |
| CLUSTER-06 | On embedding-provider failure, fall back to the VLM sorter automatically (or return a clear error) |

## Summary

The Phase 7 "variant sorter" is a two-stage pipeline: (1) GPT-5.2 vision groups batches of 15 images at a time, (2) a hand-written apparel-token normalizer merges batches by family-key. The bottleneck is stage 1 — GPT-5.2 vision is **~$0.01–0.03 per image** (conservatively), **1.5–4s per batch** of 15, and **quality-inconsistent** (per recent commit messages). Stage 2 is free but fragile: it relies on filenames and GPT's own `label`/`familyKey` strings.

The embeddings replacement targets stage 1. Compute one vector per image with a multimodal image embedding model, cluster by cosine similarity, and keep a (much simplified) stage 2 for confidence labels and human-readable group names. This is the textbook 2026 approach for visual product clustering.

**Primary recommendation:** Use **Cohere Embed v4** as the image embeddings provider, **threshold-based cosine similarity with union-find** as the clusterer, and **do not persist embeddings** in v1 (compute per-sort, keep them in-memory for the request). Ship behind `VITE_FEATURE_EMBEDDING_SORT` with the existing VLM path as fallback. Reason for Cohere over alternatives: native multimodal endpoint with Matryoshka dimensions (256/512/1024/1536), 5 MB image limit fits our resized JPEGs, one API call batches multiple images, and ~$0.47 per million image tokens prices out at a small fraction of GPT vision cost. Second choice: **Voyage multimodal-3** (first 150B pixels free, strong if we stay under the free tier). Browser-side `transformers.js` + CLIP is viable for the pre-upload path but NOT for the post-upload "Sort Variants" button (images live in Supabase, not in the browser).

**Group label generation** (how we get "Eagle Graphic Tee" as a display label from a cluster of vectors) is the non-obvious gap. Vectors give you clusters but not names. Options: (a) keep existing filename/token heuristic from `auto-group-utils.ts`, (b) one cheap GPT-5.2 text-only call per cluster using filenames + existing image metadata, or (c) no labels, use "Product 1 / Product 2" and let users rename. Recommendation: (a) + fall back to (c).

## Standard Stack

### Core (recommended)

| Library / Service | Version | Purpose | Why Standard |
|---|---|---|---|
| **Cohere Embed v4** | `embed-v4.0` (API) | Multimodal image embedding | Native multimodal, 1536-d default (256/512/1024/1536 Matryoshka), 5 MB image cap, base64 data-URL input identical to GPT vision, no self-hosting |
| **`cohere-ai`** | `^7.x` (verify `npm view cohere-ai version` before install) | Cohere Node SDK | Official SDK |
| **Custom union-find clusterer** | in-repo | O(n² / 2) cosine + union-find | 50 lines of TypeScript, no dependency, deterministic, debuggable |
| **Drizzle migration** | uses existing `drizzle-kit` | Optional: add `imageEmbedding` jsonb column if caching | Schema change only if planner chooses persistence (see Open Question 4) |

### Supporting / already-installed

| Library | Version | Purpose | When to Use |
|---|---|---|---|
| `openai` | `^6.21.0` | Keep for fallback VLM path + optional cluster-labeling call | Phase 7 path stays behind feature flag |
| `p-limit` | `^7.3.0` | Throttle concurrent embedding calls | Already used in `server/routes.ts`; use for embedding batch throughput control |

### Alternatives considered

| Option | Tradeoff vs. Cohere Embed v4 | Verdict |
|---|---|---|
| **OpenAI image embeddings** | **Does not exist.** OpenAI has no image-embedding API endpoint as of April 2026. `text-embedding-3-*` are text-only. OpenAI's own cookbook recommends running CLIP yourself for image embeddings. | Eliminated |
| **Voyage multimodal-3** | Generous free tier (150B pixels free / account), per-image cost $0.00003–$0.0012. Dimensions ~1024. Strong if we stay under free tier; riskier pricing ceiling if we grow. | **Fallback choice** — use if Cohere quota or billing becomes a problem |
| **Jina CLIP v2** | 1024-d default (Matryoshka down to 64), 512×512 tiles at 4000 tokens/tile. Multilingual. Good option, smaller ecosystem than Cohere. | Viable — pick if we want Matryoshka down to 256-d aggressively to cut compute |
| **Replicate (hosted CLIP/DINOv2/SigLIP)** | Pay-per-call ~$0.0002–$0.002/image. Cold starts 5–40s are a **dealbreaker** on Vercel serverless. | Eliminated for production path; fine for one-off eval |
| **`@huggingface/transformers` (transformers.js) + CLIP in-browser** | CLIP image model is ~88 MB (float32) → ~22 MB quantized int8. Zero per-image cost. Runs in the worker that already resizes images (`OffscreenCanvas` — see `use-auto-group.ts:39`). **Only works for pre-upload flow** where image blobs are in the browser. **Does not work for `auto-group-existing`** where images live in Supabase and the user's browser would have to re-download them. | **Secondary option** for the pre-upload path only; adds 22 MB to first-load JS cost (acceptable if lazy-loaded behind the auto-group button click) |
| **`transformers.js` CLIP server-side in the serverless function** | ~88 MB ONNX model fits within Vercel's 250 MB unzipped cap; cold start is the problem — model load is 2–8s. Per-invocation cost is zero but every cold function invocation pays the model-load tax. | Eliminated — cold-start tax negates latency win |
| **HDBSCAN / DBSCAN** (density-based clustering) | No maintained TypeScript port; would need to run in Python microservice, violates the "single serverless invocation" constraint. | Eliminated |
| **Agglomerative clustering** | Equivalent to threshold-based union-find when using single-linkage and a distance cutoff. More complex to implement. | Equivalent — use union-find instead |

**Installation (primary path):**
```bash
pnpm add cohere-ai
```

**Version verification:** Before plans are written, run `npm view cohere-ai version` to confirm current stable. Cohere SDK was `^7.x` as of late 2025 — verify in April 2026.

**Version verification for keep-existing packages:**
- `openai` is `^6.21.0` in `package.json` — already supports GPT-5.2 vision calls used by fallback.
- `p-limit ^7.3.0` — fine, no change.

## Architecture Patterns

### Recommended project structure (in-place, no new directories)

```
server/
├── routes.ts                    # add new /api/images/auto-group-v2 endpoint (or
│                                #   feature-flag inside existing endpoint)
├── auto-group-utils.ts          # KEEP — still used for labels + family-key fallback
├── embedding-utils.ts           # NEW — single file: embedImages() + clusterByCosine()
└── cohere-client.ts             # NEW — lazy-init Cohere client (mirror getUncachableStripeClient)

client/src/
├── hooks/use-auto-group.ts      # add mode="embedding" branch, keep existing branches
└── pages/Home.tsx               # read VITE_FEATURE_EMBEDDING_SORT, choose mode

shared/
└── routes.ts                    # add autoGroupV2 / autoGroupExistingV2 path constants if separate endpoints
```

**Do NOT** split `routes.ts`, add a `services/` directory, or introduce a new `lib/` subtree on the server. The codebase is append-in-place per PROJECT.md constraints.

### Pattern 1: Single-pass embed-then-cluster

**What:** One request → one embedding batch (or a few concurrent-limited batches) → in-memory union-find over cosine similarities → labeled groups.

**When to use:** Any sort ≤200 images within a single serverless invocation (our exact use case — see the 200-image cap at `server/routes.ts:3469-3471`).

**Why:** Cosine-threshold + union-find is O(n²/2) in memory and time. For n=200 that's 20,000 pairs — trivial. For n=500 it's 125,000 pairs — still sub-second. The 200-image ceiling means we never need approximate methods (HNSW, FAISS, etc.).

**Pseudocode (target shape for `server/embedding-utils.ts`):**
```typescript
// Source: pattern from Cohere docs + standard ecommerce similarity pipelines
export async function clusterImagesByEmbedding(
  images: Array<{ index: number; base64: string; mimeType: string; filename: string; descriptor?: string }>,
  opts: { threshold?: number } = {},
): Promise<AutoGroupOutput[]> {
  const THRESHOLD = opts.threshold ?? 0.85; // tune empirically — see Pitfall 2

  // 1. Embed all images in one or more Cohere batches (Cohere accepts up to 96 items per call)
  const vectors: number[][] = await embedWithCohere(images);

  // 2. Union-find over pairwise cosine similarities above threshold
  const parent = images.map((_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const union = (a: number, b: number) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };

  for (let i = 0; i < vectors.length; i++) {
    for (let j = i + 1; j < vectors.length; j++) {
      if (cosine(vectors[i], vectors[j]) >= THRESHOLD) union(i, j);
    }
  }

  // 3. Bucket images by root
  const buckets = new Map<number, number[]>();
  for (let i = 0; i < images.length; i++) {
    const root = find(i);
    (buckets.get(root) ?? buckets.set(root, []).get(root)!).push(i);
  }

  // 4. Produce labels via existing auto-group-utils heuristics (filename/descriptor tokens)
  //    OR leave labels blank and let the user rename.
  return Array.from(buckets.values()).map((groupImages) => ({
    label: deriveLabelFromFilenames(groupImages.map(i => images[i].filename)),
    imageIndices: groupImages.map(i => images[i].index),
    confidence: groupImages.length > 1 ? "high" : "low",
  }));
}
```

**Seams for swap-in (where to integrate):**
- `server/routes.ts:3479` — `runAutoGrouping(inputImages, productContext, mode)` is the single replacement point for the pre-upload SSE endpoint. Either (a) branch on a new mode string like `"embedding"`, or (b) branch on `FEATURE_EMBEDDING_SORT` env flag at the top of `runAutoGrouping`.
- `server/routes.ts:3551` — same function is called from `auto-group-existing`. Same seam.
- `client/src/hooks/use-auto-group.ts:156` — `startGrouping` accepts a `mode` string. Extend the union type to include `"embedding"` and pass through.
- `client/src/pages/Home.tsx:487` — `handleSortVariants` hard-codes `mode: "variant-family"`. Read the feature flag and switch to `"embedding"` when enabled.

The fact that `runAutoGrouping` has a **single call site pattern and a clear `mode` enum already** is the most important finding of this research: the refactor surface area is tiny.

### Pattern 2: Cohere batch-embed call

```typescript
// Source: https://docs.cohere.com/reference/embed and AWS Bedrock Cohere Embed v4 docs
// Cohere Embed v4 accepts up to 96 interleaved items per call.
import { CohereClient } from "cohere-ai";

const cohere = new CohereClient({ token: process.env.COHERE_API_KEY! });

async function embedBatch(images: Array<{ base64: string; mimeType: string }>) {
  const res = await cohere.embed({
    model: "embed-v4.0",
    inputType: "image",
    embeddingTypes: ["float"],
    // Matryoshka: default 1536; we can request 512 or 256 to cut bandwidth with minimal quality hit
    outputDimension: 512,
    images: images.map(img => `data:${img.mimeType};base64,${img.base64}`),
  });
  return res.embeddings.float!; // number[][]
}
```

**Batching note:** Cohere caps at **96 items per multimodal call** and 5 MB per image. For 200 images that's 3 calls. `p-limit` at concurrency 2 keeps us inside rate limits.

### Anti-patterns to avoid

- **DO NOT** add a vector database (Pinecone, Qdrant, Weaviate, pgvector) in v1. For n ≤ 200 per request, pairwise in-memory is faster than any database round-trip. Add a vector store only if/when Phase 9 introduces cross-session "find similar products" search.
- **DO NOT** call GPT-5.2 to name clusters inside the hot path. If labels are needed, derive them from existing `auto-group-utils.ts` token heuristics. A per-cluster GPT label call costs more than a whole-batch embedding call.
- **DO NOT** stream embeddings results via SSE and pretend it's incremental — embeddings complete fast enough that batching is fine. Clustering is not streamable (you need all vectors before union-find).
- **DO NOT** delete `auto-group-utils.ts` or the VLM path during Phase 8. Leave them behind the feature flag as the fallback. Deletion is a separate later phase once embeddings are validated in production.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Image embedding model | Don't port CLIP to ONNX and bundle on server | Cohere Embed v4 (primary) or transformers.js client-side (secondary) | Cold-start tax + 250 MB Vercel function limit vs. 80 ms API call |
| Cosine similarity | Don't import a 2 MB math library | 10-line function — `sum(a[i]*b[i]) / (sqrt(sumSq(a)) * sqrt(sumSq(b)))` | Cohere returns normalized vectors; dot product == cosine |
| Union-find | Don't import `union-find-js` or similar | 15-line inline implementation (see pseudocode above) | Zero dependencies; trivially debuggable |
| HTTP retries to Cohere | Don't write a bespoke retry loop | Cohere SDK handles retries with exponential backoff by default — just pass `maxRetries: 3` | SDK feature |
| Clustering algorithm library | Don't add `density-clustering`, `hdbscan`, etc. | Threshold-based union-find | The image count per call (max 200) makes exotic clustering unnecessary |

**Key insight:** The ONLY non-trivial component in this phase is the **threshold** — what cosine similarity cutoff separates "same product" from "different product". Everything else is glue code. Budget 50% of implementation time for threshold tuning and eval.

## Common Pitfalls

### Pitfall 1: Over-merging same-category, different-product apparel

**What goes wrong:** Two different hoodies with similar silhouette and similar studio-flatlay photography get cosine similarity 0.92+ on CLIP-family embeddings — tripping a 0.85 threshold even though the graphics on the front are totally different.

**Why it happens:** General-purpose vision embeddings emphasize *global visual structure* (garment type, pose, lighting) over fine-grained details (a printed graphic on the chest). This is documented behavior of CLIP and its descendants.

**How to avoid:**
- Use a **higher threshold** (0.90+) as the default and tune down if under-merging.
- For apparel specifically, **combine** the embedding-similarity signal with the existing filename/token heuristic from `auto-group-utils.ts` — require BOTH high cosine AND same `garmentType` (from `buildApparelIdentityProfile`) before unioning.
- If budget permits, feed **concatenated filename + descriptor strings** into the same embedding call (Cohere Embed v4 is multimodal — it embeds mixed text+image in one vector). This implicitly adds the apparel-token signal back into the embedding.

**Warning signs in eval:** Any cluster with >8 images in an apparel dataset is suspicious. Phase 7 commit "Strengthen apparel variant grouping" shipped because this exact pitfall hit the VLM path.

### Pitfall 2: Under-merging variants of the same product

**What goes wrong:** Same hoodie, two different colors — cosine similarity drops to 0.78 because color is a dominant signal in CLIP embeddings. User expected "one product, two color variants" and got "two products".

**Why it happens:** Symmetric problem to Pitfall 1. The same embedding models that are too coarse for graphics are too sensitive to color.

**How to avoid:**
- The threshold has to be tuned against a labeled dataset (see Quality Evaluation below). There is no correct universal value.
- For the `mode: "variant-family"` UX (the "Sort Variants" button), **lower the threshold** to 0.75–0.80 because the user has explicitly said "these are variants of each other".
- For default mode (pre-upload auto-group), **higher threshold** to avoid false merges.

### Pitfall 3: Labels are gone

**What goes wrong:** Embeddings give you clusters but not human-readable labels. The existing UI (`client/src/components/review-queue-modal.tsx`, group cards in `upload-zone.tsx`) relies on the `label` field from `AutoGroupResult`. Ship without labels and the UX regresses.

**Why it happens:** The VLM path produced labels as a side effect of the grouping call. Embeddings don't.

**How to avoid:** Decide in discussion-phase which of these three strategies ships in v1:
1. **Token-derived labels** — feed group filenames through `buildApparelIdentityProfile` in `auto-group-utils.ts` and use the `familyKey`. Free, imperfect but acceptable for apparel.
2. **One GPT text call per cluster** — "Given these filenames, return a 2–4 word product name". Cost is `(number of clusters) × ~$0.0002`. For 20 clusters that's $0.004.
3. **No labels, user renames** — "Product 1", "Product 2". Cheapest, worst UX.

### Pitfall 4: Image download cost for the post-upload path

**What goes wrong:** The `/api/images/auto-group-existing` endpoint currently pulls buffers from Supabase via `loadImageBuffer(image)` (see `server/routes.ts:3531-3549`) and base64-encodes them. For 200 images at 1 MB each that's 200 MB of server-side I/O — the bottleneck is the download, not the embedding.

**Why it happens:** Images live in Supabase Storage; the server function has to fetch them. The current VLM path already pays this cost, so it's not a regression, but the phase should measure it and not make it worse.

**How to avoid:**
- Pass the Supabase public `storageUrl` strings directly to Cohere — Cohere Embed v4 accepts `image_url` inputs via URL (verify in the Cohere SDK docs during planning; if URL input is supported, **skip the buffer download entirely**). This is a dramatic simplification.
- If Cohere only accepts base64, at minimum download at `p-limit` concurrency 8 (current code is concurrency 6 at line 3531) and resize down to 512×512 before base64.

### Pitfall 5: Vercel request body limit

**What goes wrong:** The pre-upload path POSTs base64 images in the request body. Vercel serverless body limit is **4.5 MB**. 200 images at 30 KB each (after 1024px resize) = 6 MB — over the limit. This is **an existing bug the current Phase 7 path may already hit** — worth verifying during planning.

**How to avoid:**
- Continue aggressive resize (current code at `use-auto-group.ts:26-45` resizes to 1024px longest side at quality 0.8). Consider dropping to 512px since embeddings don't need high resolution.
- Consider presigning direct Supabase upload and passing URLs back to the server (larger refactor).

## Runtime State Inventory

This phase is not a rename/refactor — it is a net-new feature path replacing an existing one. Formal runtime state inventory is not required. Brief check for completeness:

| Category | Items Found | Action Required |
|---|---|---|
| Stored data | None — no embeddings persisted today | If planner chooses to persist vectors (Open Question 4), add a Drizzle migration for `images.image_embedding jsonb` or a new `image_embeddings` table |
| Live service config | None | Add `COHERE_API_KEY` to Vercel env vars before deploy |
| OS-registered state | None | None |
| Secrets/env vars | New: `COHERE_API_KEY`, `VITE_FEATURE_EMBEDDING_SORT` (client), optionally `EMBEDDING_SORT_THRESHOLD` (server tuning knob) | Document in deploy notes; env vars do not rotate existing keys |
| Build artifacts | None — no native binaries, no compiled models | None |

## Quality Evaluation

**Finding:** There is **no existing image-fixture test dataset** in the repo. Searches for "fixture", "sample image", "test image" inside `tests/` return only `tests/image-file-utils.test.ts` (which tests string/file-name helpers, not images) and `tests/workspace-variant-sort.test.ts` (pure function tests on stub data). `tests/auto-group-utils.test.ts` is entirely string-based assertions on label-normalization.

**What this means:** Phase 8 cannot be validated against a held-out labeled image set unless the user creates one. Options (planner should pick):

1. **Build a fixture set during Phase 8.** ~50–100 images covering: clear same-product variants, clear different products, hard same-category apparel cases, near-duplicate angles. Manually label the ground-truth groups. Store under `tests/fixtures/variant-clustering/` with a JSON manifest. Use for a one-shot eval script, not for CI (images are large). Estimated effort: half a day.
2. **A/B in production behind feature flag.** Compare embedding path vs VLM path side-by-side on real user uploads. Log both groupings, let users accept or reject, measure acceptance rate. Requires the feature flag and logging infra.
3. **Prompt-engineered regression test.** Use a small hand-labeled set inline in a test file (10–20 cases) that can run in CI. Narrow coverage but cheap.

**Recommendation:** Do (1) AND (2). The fixture set is a one-time cost that becomes reusable infrastructure for any future vision work; the prod A/B is how we actually know the replacement is better.

**Baseline to beat (measure during Wave 0 of Phase 8):**
- VLM sorter cost per 50 images (GPT-5.2 vision token usage).
- VLM sorter latency p50 and p95.
- Manual agreement rate on an ad-hoc 20-image eval set.

Without these numbers, "cheaper and faster" is unfalsifiable.

## Migration / Coexistence Strategy

**Recommendation: Soft cutover behind a feature flag.** The existing `VITE_FEATURE_*` pattern (`client/src/pages/ProductDetails.tsx:23-24`) is the precedent. Mirror it for server-side flags.

**Flags to introduce:**
- `VITE_FEATURE_EMBEDDING_SORT` (client) — when `"true"`, the client passes `mode: "embedding"` to the auto-group endpoints; when unset, falls back to `"variant-family"` / `"default"` as today.
- `FEATURE_EMBEDDING_SORT` (server) — guards whether `runAutoGrouping` accepts the new mode at all. Safety belt in case the client flag is tampered with.

**Cutover phases:**
1. **Dark launch:** Embedding path lives behind flag, VLM path is still the default. Developer-only testing.
2. **Dogfood:** Flag on for the dev's own account. Real product images, real feedback.
3. **A/B:** Server randomly routes 10% of requests through the embedding path, logs both responses (compute both or shadow one). Measure acceptance.
4. **Ramp:** 10% → 50% → 100% over a week if quality holds.
5. **Removal (separate phase):** After 2 weeks at 100%, delete the VLM path from `runAutoGrouping` and mark the GPT-5.2-vision code removable.

**Hard cutover is not recommended.** The recent commit history (`Strengthen apparel variant grouping`, `Make variant sorting report real merges`, `Highlight merged workspace products`) shows the VLM path has already burned user trust once and been re-tuned. Shipping a replacement without A/B risks burning trust a second time.

## Storage / Caching of Embeddings

**Recommendation for v1: do NOT persist.** Compute embeddings on every "Sort Variants" click; throw them away after the response. Justification:

- The images table has no embedding column today (`shared/schema.ts:5-50`). Adding one requires a Drizzle migration.
- 200 images × 512 dimensions × 4 bytes = 400 KB per sort — compute cost is tiny; caching buys little.
- Users rarely re-sort the same selection twice. The cache hit rate would be near zero.
- Persisting means schema migration, embedding versioning (what if we switch from Cohere to Voyage?), and a backfill story. All of this is Phase 8 scope creep.

**If the user decides caching is worth it** (Open Question 4), the minimal schema change is:
```sql
ALTER TABLE images ADD COLUMN image_embedding jsonb;
ALTER TABLE images ADD COLUMN embedding_model text; -- e.g. 'cohere-embed-v4-512d'
```
Drizzle migration via `drizzle-kit push` — no pgvector required for n ≤ 200.

## Code Examples

### Embedding a batch with Cohere Embed v4

```typescript
// Source: https://docs.cohere.com/reference/embed (v2)
// File target: server/embedding-utils.ts
import { CohereClient } from "cohere-ai";

const client = new CohereClient({ token: process.env.COHERE_API_KEY! });

export async function embedImagesCohere(
  images: Array<{ base64: string; mimeType: string }>,
  outputDimension: 256 | 512 | 1024 | 1536 = 512,
): Promise<number[][]> {
  const BATCH = 96; // Cohere Embed v4 hard cap
  const results: number[][] = [];
  for (let i = 0; i < images.length; i += BATCH) {
    const slice = images.slice(i, i + BATCH);
    const res = await client.embed({
      model: "embed-v4.0",
      inputType: "image",
      embeddingTypes: ["float"],
      outputDimension,
      images: slice.map(img => `data:${img.mimeType};base64,${img.base64}`),
    });
    results.push(...(res.embeddings.float ?? []));
  }
  return results;
}
```

### Cosine + union-find clusterer

```typescript
// Source: standard implementation, no library needed
// File target: server/embedding-utils.ts
export function clusterByCosine(vectors: number[][], threshold: number): number[][] {
  const n = vectors.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => parent[x] === x ? x : (parent[x] = find(parent[x]));
  const union = (a: number, b: number) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };

  // Precompute norms
  const norms = vectors.map(v => Math.sqrt(v.reduce((s, x) => s + x * x, 0)));

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      let dot = 0;
      for (let k = 0; k < vectors[i].length; k++) dot += vectors[i][k] * vectors[j][k];
      const cos = dot / (norms[i] * norms[j]);
      if (cos >= threshold) union(i, j);
    }
  }

  const buckets = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    const list = buckets.get(root) ?? [];
    list.push(i);
    buckets.set(root, list);
  }
  return Array.from(buckets.values());
}
```

### Wire-in at `runAutoGrouping` (seam)

```typescript
// File target: server/routes.ts near line 124
async function runAutoGrouping(
  inputImages: AutoGroupInputImage[],
  productContext?: string,
  mode: AutoGroupMode | "embedding" = "default",
): Promise<AutoGroupOutput[]> {
  if (mode === "embedding" && process.env.FEATURE_EMBEDDING_SORT === "true") {
    return runEmbeddingClustering(inputImages); // new function in embedding-utils.ts
  }
  // ... existing GPT-5.2 path untouched
}
```

## State of the Art

| Old Approach | Current Approach (2026) | When Changed | Impact |
|---|---|---|---|
| VLM-per-batch grouping (what we ship today) | Multimodal embeddings + clustering | CLIP 2021, Cohere Embed v3 2024, Embed v4 mid-2025 | ~10–50x cheaper, ~3–10x faster, more consistent |
| CLIP ViT-B/32 as the reference encoder | SigLIP, Jina CLIP v2, Cohere Embed v4 are the newer references | 2024–2025 | Better multilingual, better fine-grained detail |
| Self-hosted ONNX on GPU | Hosted multimodal embedding APIs | 2024+ | Cold-start elimination, simpler ops for serverless deployments |
| Text-only embedding + image caption bridge | Native multimodal (image + text in single vector) | 2024 (Voyage, Cohere v4) | No caption round-trip |

**Deprecated / outdated:**
- **CLIP ViT-B/32 original OpenAI checkpoint (2021):** Still works, but SigLIP and Jina CLIP v2 outperform it on fine-grained retrieval. Use only if self-hosting.
- **OpenAI multimodal embeddings API:** Does not exist. Do not plan for its existence.

## Open Questions (decisions the user should answer before planning)

These should drive `/gsd:discuss-phase 8`:

1. **Goal statement.** ROADMAP Phase 8 says `Goal: [To be planned]`. Is the goal "replace the VLM path for both `/auto-group` and `/auto-group-existing`" (both endpoints, all users), or just the post-upload "Sort Variants" button (only `/auto-group-existing`)? The former is 2–3x the work.
2. **Provider choice.** Cohere Embed v4 (recommended, paid) vs. Voyage multimodal-3 (recommended fallback, generous free tier) vs. transformers.js client-side CLIP (no API cost, pre-upload path only, +22 MB JS bundle). Any strong preference? Any existing vendor relationships the dev wants to reuse?
3. **Label strategy.** How should cluster labels ("Eagle Graphic Tee") be produced? (a) token heuristics from filenames, (b) one GPT text call per cluster, (c) no labels / user renames. Default recommendation: (a).
4. **Persistence.** Cache embeddings on the `images` table, or compute-and-discard per request? Default recommendation: compute-and-discard (v1 simplicity). Revisit if a future phase needs cross-session similarity search.
5. **Hybrid with existing apparel heuristics.** Should the new clusterer AND/OR combine cosine-threshold with the `buildApparelIdentityProfile` family-key signal, or replace it entirely? Default recommendation: AND — require both signals to agree for high confidence, which should reduce false merges.
6. **Fallback on provider failure.** If Cohere API errors, should we (a) automatically fall back to the VLM path, (b) show the user a clear error and let them retry, (c) silently use filename-only heuristic clustering? Default: (a) — use the existing VLM path as fallback, since it's already there.
7. **Eval fixture set.** Build a 50–100 image labeled fixture set during Phase 8? Default recommendation: yes (see Quality Evaluation).
8. **Threshold.** Start at what cosine similarity threshold? Research suggests 0.85 for default mode, 0.78 for variant-family mode, both highly eval-dependent. Should the threshold be an env var tuning knob (`EMBEDDING_SORT_THRESHOLD`)? Default recommendation: yes.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| `cohere-ai` npm package | Primary embedding path | ✗ (not installed) | — | Voyage or transformers.js |
| `COHERE_API_KEY` Vercel env var | Primary embedding path | ✗ (not set — check Vercel dashboard) | — | Must be provisioned before deploy |
| `openai` npm package | VLM fallback path | ✓ | `^6.21.0` (package.json) | — |
| `p-limit` | Concurrency throttling | ✓ | `^7.3.0` | — |
| `drizzle-orm` + `drizzle-kit` | Schema migration if persisting embeddings | ✓ | `^0.39.3` / latest | — |
| Vercel serverless function memory | Embedding batch in memory | ✓ (default 1024 MB) | — | n/a — 200 × 1536 × 4 bytes is sub-MB |
| Supabase public URLs for images | Server-side image fetch | ✓ | — | base64 from DB |

**Missing dependencies with no fallback:** `COHERE_API_KEY` — the user must obtain this from cohere.com and add it to Vercel env before any plan in Phase 8 is executable end-to-end. Planner should create an explicit task for this (or a Wave 0 human step).

**Missing dependencies with fallback:** `cohere-ai` npm package — if a different provider is chosen in discussion, this swaps for `voyageai` or `@huggingface/transformers`.

## Validation Architecture

**Nyquist validation note:** `.planning/config.json` does not set `workflow.nyquist_validation`. Per the research protocol, treat as enabled.

### Test Framework
| Property | Value |
|---|---|
| Framework | `node:test` built-in (via `tsx --test`) |
| Config file | none — `package.json` script `"test": "tsx --test tests/**/*.test.ts"` |
| Quick run command | `pnpm test -- tests/embedding-utils.test.ts` |
| Full suite command | `pnpm test` |

### Phase Requirements → Test Map
*(Requirements are candidates — real requirement IDs will be set in `/gsd:discuss-phase`.)*

| Req ID (candidate) | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| CLUSTER-01 | `clusterByCosine` unions vectors above threshold | unit | `pnpm test -- tests/embedding-utils.test.ts` | ❌ Wave 0 |
| CLUSTER-01 | `embedImagesCohere` batches at 96 and returns aligned vectors | unit (with fetch mock) | `pnpm test -- tests/embedding-utils.test.ts` | ❌ Wave 0 |
| CLUSTER-01 | `runAutoGrouping(mode="embedding")` produces groups for a fixture of 6 stub vectors | integration (stub Cohere) | `pnpm test -- tests/auto-group-embedding.test.ts` | ❌ Wave 0 |
| CLUSTER-04 | Existing `buildWorkspaceVariantAssignments` still works on the new group shape | unit | `pnpm test -- tests/workspace-variant-sort.test.ts` | ✅ (exists) |
| CLUSTER-05 | Feature flag off → `runAutoGrouping` still calls GPT path (mocked) | integration | `pnpm test -- tests/auto-group-feature-flag.test.ts` | ❌ Wave 0 |
| CLUSTER-02 | Latency ≤ VLM baseline on a fixture of 50 images | manual-only | n/a — run `scripts/eval-embedding-sort.ts` by hand | ❌ Wave 0 |
| CLUSTER-03 | Cost ≤ VLM baseline | manual-only | n/a — tracked from Cohere dashboard | — |

### Sampling Rate
- **Per task commit:** `pnpm test -- tests/embedding-utils.test.ts tests/auto-group-embedding.test.ts`
- **Per wave merge:** `pnpm test`
- **Phase gate:** Full suite green + manual fixture eval documented in `08-VERIFICATION.md` before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `tests/embedding-utils.test.ts` — unit tests for `clusterByCosine` and a mocked `embedImagesCohere`
- [ ] `tests/auto-group-embedding.test.ts` — integration test for `runAutoGrouping(mode="embedding")` with a stubbed Cohere client
- [ ] `tests/auto-group-feature-flag.test.ts` — feature-flag branch coverage
- [ ] `tests/fixtures/variant-clustering/` — optional image fixture directory if user confirms Open Question 7
- [ ] `scripts/eval-embedding-sort.ts` — standalone eval script, not run in CI
- [ ] No framework install needed — `node:test` is already used by existing tests.

## Sources

### Primary (HIGH confidence)
- `server/routes.ts` — existing `runAutoGrouping` implementation (`:124-280`), auto-group endpoints (`:3456-3557`), assign-group-batch (`:1982`), concurrency helper (`:103`)
- `server/auto-group-utils.ts` — apparel normalization and family-key merge logic (full file)
- `client/src/hooks/use-auto-group.ts` — client-side image resize + SSE parsing (`:26-203`)
- `client/src/lib/workspace-variant-sort.ts` — workspace assignment logic (full file)
- `client/src/pages/Home.tsx:461-536` — `handleSortVariants` seam
- `shared/schema.ts:5-50` — `images` table shape
- `shared/routes.ts:119-136` — autoGroup / autoGroupExisting path constants
- `.planning/PROJECT.md` — Vercel serverless constraint, file-restructure policy
- `.planning/STATE.md:87` — VITE_FEATURE_* precedent
- `tests/auto-group-utils.test.ts`, `tests/workspace-variant-sort.test.ts` — test framework (`node:test` via `tsx --test`)
- `package.json` — installed deps (`openai ^6.21.0`, `p-limit ^7.3.0`, `drizzle-orm ^0.39.3`)
- `vercel.json` — confirms minimal Vercel config, default serverless function limits apply

### Secondary (MEDIUM confidence — verify during planning)
- [Cohere Embed v4 on AWS Bedrock docs](https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-embed-v4.html) — confirms 1536-d default, 256/512/1024/1536 Matryoshka, 5 MB image cap, base64 data URL format
- [Cohere Embed Multimodal v4 announcement](https://docs.cohere.com/changelog/embed-multimodal-v4) — multimodal interleaved input
- [Cohere pricing](https://www.metacto.com/blogs/cohere-pricing-explained-a-deep-dive-into-integration-development-costs) — $0.12 / M text tokens, $0.47 / M image tokens
- [Voyage AI pricing](https://docs.voyageai.com/docs/pricing) — 150B pixels free / account for voyage-multimodal-3
- [Jina CLIP v2 docs](https://jina.ai/models/jina-clip-v2/) — 1024-d default, Matryoshka to 64, 512×512 tiles
- [Vercel function size limits](https://vercel.com/kb/guide/troubleshooting-function-250mb-limit) — 250 MB unzipped, 300 MB hard cap
- [transformers.js CLIP model size](https://github.com/xenova/transformers.js/issues/148) — ~88 MB image model, quantize for production
- [OpenAI cookbook CLIP image embedding](https://developers.openai.com/cookbook/examples/custom_image_embedding_search) — confirms OpenAI has no first-party image embeddings API; recommends self-hosted CLIP
- [Roboflow embeddings + clustering writeup](https://blog.roboflow.com/embeddings-clustering-computer-vision-clip-umap/) — standard CLIP + cosine-threshold pipeline

### Tertiary (LOW confidence — unverified)
- All cost-per-image estimates are back-of-envelope. Actual cost depends on image dimensions after resize and Cohere's token accounting. **Verify with a 10-image dry run before writing plans that promise cost reduction.**
- Specific cosine thresholds (0.85, 0.78) are starting points, not verified values. They MUST be tuned against real product images.
- Cohere SDK `outputDimension` parameter name — confirmed in AWS Bedrock docs but verify the `cohere-ai` npm SDK exposes it the same way during planning.
- Whether Cohere Embed v4 accepts URL inputs (vs. only base64 data URLs) — unverified, worth checking in the SDK during planning since it would eliminate the Supabase download step.

## Metadata

**Confidence breakdown:**
- Current code map (VLM sorter, seams, call sites): **HIGH** — directly read from source files with line numbers.
- Recommended stack (Cohere Embed v4 primary, Voyage fallback): **MEDIUM-HIGH** — verified via multiple vendor docs and pricing pages; not verified by a real end-to-end dry run.
- Clustering algorithm choice (threshold cosine + union-find for n ≤ 200): **HIGH** — standard in ecommerce similarity literature; math is well-understood.
- Labels strategy: **MEDIUM** — three viable options, real choice depends on user UX priority.
- Threshold values: **LOW** — hard-coded starting values; real values require a labeled eval set that doesn't exist yet.
- Vercel constraints (body limit, function size): **HIGH** — documented.

**What might I have missed:**
- I did not verify whether Phase 7 introduced any Mem0 / vector-store / embedding infrastructure that isn't grepped by "embedding" — verified with broader search; nothing found, but a planner should confirm by reading through Phase 7 PLAN summaries.
- I did not run `npm view cohere-ai version` to get a 2026-current version — the planner must do this before writing the install task.
- I did not exhaustively check every review-queue / group-card rendering path for the `label` field; there may be more places that consume it than I traced. Label-gap risk may be bigger than described.
- I did not benchmark the existing VLM sorter latency/cost — so the "cheaper and faster" claim is unproven until Wave 0 of Phase 8 measures it.

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (30 days — embedding API pricing changes frequently; re-verify if planning slips past this date)
