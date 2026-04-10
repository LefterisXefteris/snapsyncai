---
phase: 08-embeddings-variant-clustering
plan: 01
subsystem: embeddings-core
tags: [embeddings, clustering, cohere, pure-core]
requires:
  - COHERE_API_KEY env var (for runtime; tests stub client without it)
provides:
  - embedImagesCohere(images, opts) — batched Cohere Embed v4 image embedding
  - clusterByCosine(vectors, threshold) — deterministic union-find clustering
  - cosineSimilarity(a, b) — pure cosine with norm-division guard
  - getCohereClient() — lazy-init singleton, test-injectable
affects:
  - server/ module graph gains two new files; server/routes.ts untouched
tech-stack:
  added:
    - cohere-ai@8.0.0
  patterns:
    - lazy-init singleton with test-injection seam
    - cache-first env-var check (honors injected clients before reading env)
    - union-find with path compression for small-n clustering
key-files:
  created:
    - server/cohere-client.ts
    - server/embedding-utils.ts
    - tests/embedding-utils.test.ts
  modified:
    - package.json (cohere-ai dependency)
    - pnpm-lock.yaml
decisions:
  - Use CohereClientV2 instead of legacy CohereClient — only V2 supports outputDimension and batched images in cohere-ai@8.x
  - Default Matryoshka dimension = 512 (bandwidth/quality sweet spot per 08-RESEARCH.md)
  - Sequential batching only — no p-limit; preserves ordering trivially
  - Retry/backoff intentionally deferred to plan 08-02 wiring layer
metrics:
  duration: ~5 min
  completed: 2026-04-10
  tasks: 3
  tests_added: 20
  files_created: 3
  files_modified: 2
---

# Phase 08 Plan 01: Embedding + Clustering Core Summary

**One-liner:** Pure Cohere Embed v4 + cosine union-find clustering module with 20 unit tests, zero wiring into routes — drop-in seam for plan 08-02.

## What Was Built

Plan 08-01 delivers the algorithmically non-trivial core of the embeddings-based variant clustering system as a fully tested, self-contained module. The three artifacts are:

1. **`server/cohere-client.ts`** — Lazy-init singleton wrapping `CohereClientV2`. Mirrors the existing `getUncachable*Client` pattern in `server/stripeClient.ts` but adds test-injection seams (`__setCohereClientForTests`, `__resetCohereClientForTests`) so downstream integration tests in plan 08-02 can stub the SDK without network access or env vars.

2. **`server/embedding-utils.ts`** — Pure functions:
   - `cosineSimilarity(a, b)` with norm division (defensive even though Cohere returns L2-normalized floats).
   - `clusterByCosine(vectors, threshold)` — union-find with path compression, deterministic output (inner arrays sorted by index, outer sorted by smallest index). Transitive clustering confirmed via dedicated test case.
   - `embedImagesCohere(images, opts?)` — sequential batching of ≤96 per call, positional alignment preserved, data URI formatting (`data:<mime>;base64,<b64>`), `outputDimension` defaulting to 512.
   - Exported constants: `COHERE_EMBED_MODEL = "embed-v4.0"`, `COHERE_EMBED_BATCH_SIZE = 96`, `COHERE_EMBED_DIMENSION = 512`.

3. **`tests/embedding-utils.test.ts`** — 20 `node:test` cases covering cosine edge cases, clustering edge cases (empty, singleton, bi-group, orthogonal, determinism, transitive union-find), and embed batching (200 → 96+96+8, param shape, default dimension, positional alignment, error propagation, length mismatch guard). Also exercises the env-var guard and singleton caching.

## SDK Verification

- **Package installed:** `cohere-ai@8.0.0` (latest stable as of 2026-04-10).
- **Dimension field name:** `outputDimension` (confirmed in `node_modules/cohere-ai/api/resources/v2/client/requests/V2EmbedRequest.d.ts:41`). Name matches plan expectation.
- **Client class used:** `CohereClientV2` (NOT legacy `CohereClient`). See "Deviations" below — this is critical for plan 08-02.
- **Response shape:** `EmbedByTypeResponse` with `embeddings.float: number[][]` when `embeddingTypes: ["float"]` is passed.
- **`HttpResponsePromise<T> extends Promise<T>`** — `await client.embed(...)` yields the parsed response directly; no `.data` unwrap needed.

## Deviations from Plan

### [Rule 1 - Bug] Fixed env-var check ordering in getCohereClient

- **Found during:** Task 3 test run.
- **Issue:** The plan-specified implementation read `process.env.COHERE_API_KEY` **before** checking the cached client. This made test injection via `__setCohereClientForTests` fail unless tests also set the env var — defeating the purpose of the injection seam.
- **Fix:** Swapped the order so a cached client (including one injected by tests) short-circuits the env-var check. The guard still runs on the cold path when no client is cached.
- **Files modified:** `server/cohere-client.ts`
- **Commit:** `9e55c22` (bundled with the test commit that surfaced the bug).

### [Rule 1 - Spec drift] Switched from CohereClient (v1) to CohereClientV2

- **Found during:** Task 1, SDK inspection.
- **Issue:** The plan text specified `CohereClient` (the legacy v1 client). In `cohere-ai@8.x`, `CohereClient.embed()` accepts **at most 1 image per call** (see `node_modules/cohere-ai/api/client/requests/EmbedRequest.d.ts:28`) and has **no `outputDimension` field**. Both constraints make it impossible to implement the plan's required behavior (batches of 96, Matryoshka dimension 512) using v1.
- **Fix:** Use `CohereClientV2` from `cohere-ai`. The V2 embed request interface (`V2EmbedRequest`) exposes both `outputDimension: number` and batched `images: string[]`, plus the same `inputType`, `embeddingTypes`, and `model` fields the plan requires. The exported function name (`getCohereClient`) is unchanged, and the minimal return type only exposes `.embed(...)` so downstream callers aren't coupled to V2 specifics.
- **Impact on plan 08-02:** When plan 08-02 integration tests stub the client via `__setCohereClientForTests`, the fake needs to match the V2 embed shape (which is identical to the plan's documented call: `{ model, inputType, embeddingTypes, outputDimension, images }`).
- **Files modified:** `server/cohere-client.ts`
- **Commit:** `9470a63`

### [Scope boundary] Pre-existing TypeScript errors out of scope

`pnpm tsc --noEmit` on a cold repo surfaces ~20 pre-existing errors in `server/replit_integrations/*`, `server/routes.ts` (Stripe `current_period_end`), and `server/webhookHandlers.ts`. None are caused by plan 08-01. Logged to `.planning/phases/08-embeddings-variant-clustering/deferred-items.md`. The new files (`cohere-client.ts`, `embedding-utils.ts`, `embedding-utils.test.ts`) introduce **zero** new TS errors — confirmed by grepping the tsc output for those filenames.

## Handoff Notes for Plan 08-02

1. **Integration test stub pattern:**
   ```typescript
   import { __setCohereClientForTests, __resetCohereClientForTests } from "../server/cohere-client.ts";

   test.beforeEach(() => __resetCohereClientForTests());

   // In test body:
   const fakeClient = {
     embed: async (call) => ({
       embeddings: { float: call.images.map(() => mockVector) },
     }),
   };
   __setCohereClientForTests(fakeClient);
   ```
   This pattern is exercised in 7 of the 20 tests in `tests/embedding-utils.test.ts` and works reliably without setting `COHERE_API_KEY` (thanks to the Rule 1 fix above).

2. **Matryoshka dimension:** Plan 08-01 chose 512 as the default. Plan 08-02 can override per call via `embedImagesCohere(images, { dimension: 256 | 512 | 1024 | 1536 })`. Recommend benchmarking 256 vs 512 on the real apparel dataset — 256 halves bandwidth with modest quality loss on L2-normalized embeddings.

3. **Retry/backoff:** `embedImagesCohere` intentionally propagates SDK errors unchanged. Plan 08-02 should wrap calls in `pRetry` (or similar) at the wiring layer — the Cohere SDK throws `CohereError`/`CohereTimeoutError` subclasses that can be classified for retry eligibility.

4. **Batch size constant:** `COHERE_EMBED_BATCH_SIZE = 96` is exported. If Cohere raises the per-request image cap, update this constant — no call-site changes needed.

5. **Determinism contract:** `clusterByCosine` output ordering is part of the public contract (tested). Downstream label derivation in plan 08-02 can rely on "group[0] = first-seen image index" without an additional sort.

## Self-Check: PASSED

**Files verified:**
- FOUND: `server/cohere-client.ts`
- FOUND: `server/embedding-utils.ts`
- FOUND: `tests/embedding-utils.test.ts`
- FOUND: `.planning/phases/08-embeddings-variant-clustering/deferred-items.md`

**Commits verified:**
- FOUND: `9470a63` — feat(08-01): install cohere-ai and add lazy Cohere client
- FOUND: `0bf123b` — feat(08-01): implement clusterByCosine and embedImagesCohere
- FOUND: `9e55c22` — test(08-01): add unit tests for embedding utils and Cohere client

**Verification commands run:**
- `pnpm test` → 41 passed, 0 failed (20 new + 21 pre-existing, zero regressions)
- `pnpm tsc --noEmit 2>&1 | grep -E "cohere-client|embedding-utils"` → zero matches
- `git diff --stat server/routes.ts` → no changes
