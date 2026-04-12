---
status: awaiting_human_verify
trigger: "embedding-clustering-over-merge: Sort Variants collapses all images into one group after Phase 8"
created: 2026-04-11
updated: 2026-04-11
---

## Current Focus

hypothesis: H1/H2/H3 ELIMINATED on generic test data. Remaining: either (a) H1 manifests only on real apparel/product photos whose Cohere-embed distribution pushes many pairs above 0.78, or (b) H4 — transitive single-linkage chains a few borderline edges into one mega-cluster, or (c) mode mismatch — workspace Sort Variants sends mode="variant-family" (threshold 0.78) but should probably use default (0.88) for multi-product selections.
test: Add temporary diagnostic logging in runAutoGrouping to dump pairwise cosine matrix on every call, ask user to reproduce Sort Variants, inspect real-data matrix
expecting: Matrix will reveal if most pairs are genuinely ≥0.78 (→ threshold too loose) or if only a few transitive chains cause the over-merge (→ single-linkage problem)
next_action: Instrument runAutoGrouping with pairwise dump behind DEBUG_AUTOGROUP flag, commit, ask user to reproduce

## Symptoms

expected: Selected images should cluster into multiple groups, one per true product.
actual: Everything collapses into ONE big group.
errors: None — request succeeds, fallback banner does NOT show (so embedding path ran).
reproduction: Select 4+ distinct products in workspace, click "Sort Variants", observe over-merge.
started: Immediately after Phase 8 (08-01 → 08-03) shipped. Previously worked with GPT-5.2 vision batching.

## Eliminated

## Evidence

- timestamp: 2026-04-11
  checked: server/routes.ts runAutoGrouping + auto-group-existing handler
  found: /api/images/auto-group-existing defaults `mode = "variant-family"` → threshold = **0.78**. Sort Variants UI hits this endpoint.
  implication: Confirms Sort Variants runs at the loose 0.78 threshold, not the stricter 0.88.

- timestamp: 2026-04-11
  checked: server/embedding-utils.ts embedImagesCohere
  found: Uses v2 client with `images: [data URI, …]` shape. BUT node_modules/cohere-ai@8.0.0 V2EmbedRequest.d.ts docstring says "Maximum number of images per call is 1" for the `images` field and recommends `inputs` for batching. However live test proves the images array IS batched successfully and returns distinct vectors — the doc string is stale / server-side accepts it.
  implication: Cohere v2 call shape is functionally correct; H3 (same vector per image) is ELIMINATED.

- timestamp: 2026-04-11
  checked: Live diagnostic `scripts/diag-cohere-embed.ts` — 4 visually distinct images (attached_assets/IMG_3839, IMG_3841, Screenshot_20.00.39, Screenshot_21.20.23)
  found: 4 distinct 512-dim vectors. All norms = 1.0000 exactly (pre-normalized by Cohere). Pairwise cosine matrix:
    [0-1]=0.408  [0-2]=0.380  [0-3]=0.157
    [1-2]=0.335  [1-3]=0.121
    [2-3]=0.189
  All off-diagonals well below 0.78. For truly distinct inputs, clustering correctly produces 4 singletons.
  implication: ELIMINATES H2 (normalization — vectors are already unit) and H3 (same-vector bug — vectors are distinct).

- timestamp: 2026-04-11
  checked: Live diagnostic `scripts/diag-cohere-embed.ts homogeneous` — 6 app screenshots sharing UI chrome from same session
  found: Max off-diagonal cosine = 0.7582 (indices 4-5). Next highest = 0.5431, 0.5186, 0.3958. Still below threshold 0.78.
  implication: Even on visually-homogeneous inputs, the 0.78 threshold correctly keeps them as singletons. Suggests the user's real data has some pairs >0.78 that the generic test data does not reproduce — either because product photos really ARE that homogeneous (white-background apparel shot identically), OR because transitive single-linkage chains push the mega-cluster from a few genuine matches (H4), OR because the mode default for workspace is wrong (should probably be "default" 0.88 when user is selecting arbitrary multi-product groups for sorting).

- timestamp: 2026-04-11
  checked: tests/embedding-utils.test.ts and tests/auto-group-embedding.test.ts
  found: All tests use contrived [1,0,0]-style vectors from mocked clients. No real-world cosine distribution validation. This is why the bug shipped — the test suite cannot fail on bad thresholds because it never sees real Cohere output.
  implication: Unit tests are not useful evidence. Need real-data instrumentation to proceed.

## Resolution

root_cause:
fix:
files_changed: []
