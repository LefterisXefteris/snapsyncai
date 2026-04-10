---
phase: 08-embeddings-variant-clustering
plan: 02
subsystem: auto-group-wiring
tags: [embeddings, cohere, routes, fallback, sse]
requires:
  - server/embedding-utils.ts (from 08-01) — embedImagesCohere, clusterByCosine
  - server/cohere-client.ts (from 08-01) — __setCohereClientForTests seam
  - server/auto-group-utils.ts — canonicalizeAutoGroup, mergeAutoGroupsByFamily
provides:
  - runAutoGrouping(inputImages, productContext?, mode?): RunAutoGroupingResult — now exported, embedding-first
  - RunAutoGroupingResult type ({ groups, fallbackUsed, fallbackReason? })
  - SSE fallback event: `data: { type: "fallback", reason: string }`
  - SSE done event now carries fallbackUsed: boolean
  - JSON /api/images/auto-group-existing response carries fallbackUsed + fallbackReason
  - getAutoGroupTimeoutMs / __setTimeoutMsForTests in embedding-utils.ts
affects:
  - server/routes.ts runAutoGrouping body fully replaced (lines ~124-249)
  - both /api/images/auto-group (SSE) and /api/images/auto-group-existing (JSON) handlers
  - no changes to AutoGroupInputImage / AutoGroupOutput shapes — downstream buildWorkspaceVariantAssignments keeps working untouched
tech-stack:
  added: []
  patterns:
    - Promise.race timeout with tracked setTimeout handle + finally clearTimeout (no event-loop pinning)
    - module-level test-overridable timeout constant via getter function
    - dynamic imports in integration test to set env vars before transitive module-graph side effects fire
decisions:
  - variant-family cosine threshold = 0.78, default cosine threshold = 0.88 (hardcoded const, 08-RESEARCH.md pitfalls 1 & 2)
  - MAX_ATTEMPTS = 2 (initial + 1 retry), BACKOFF_MS = 750 linear (attempt * BACKOFF_MS), TIMEOUT_MS = 60_000
  - on success path, embedding clusters are returned AS-IS — mergeAutoGroupsByFamily is ONLY called on the fallback path
  - fallback path seeds one group per image then hands to mergeAutoGroupsByFamily for apparel-token bucketing
  - exported runAutoGrouping (rather than wrapping via a helper module) — minimal visibility bump, keeps the function co-located with its two call sites
  - test file uses dynamic imports + pre-set dummy env vars (DATABASE_URL, OPENAI_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY) to load server/routes.ts without real infrastructure
key-files:
  created:
    - tests/auto-group-embedding.test.ts
  modified:
    - server/routes.ts
    - server/embedding-utils.ts
metrics:
  duration: ~10 min
  completed: 2026-04-10
  tasks: 2
  tests_added: 4
  files_created: 1
  files_modified: 2
---

# Phase 08 Plan 02: runAutoGrouping Cohere Rewrite Summary

**One-liner:** Replaced the GPT-5.2 vision loop in `runAutoGrouping` with a Cohere Embed v4 + cosine-cluster primary path and filename-only `mergeAutoGroupsByFamily` fallback, propagating a `fallbackUsed` signal through both SSE and JSON endpoints.

## What Was Built

Plan 08-02 is the one-seam refactor promised in 08-CONTEXT.md. A single function body (`runAutoGrouping`) is rewritten, two endpoint handlers gain one extra field/event each, and nothing else in the 3,000-line `server/routes.ts` file moves.

1. **`server/routes.ts` — `runAutoGrouping` rewrite (lines 124-249)**
   - New signature: `export async function runAutoGrouping(...): Promise<RunAutoGroupingResult>` where `RunAutoGroupingResult = { groups: AutoGroupOutput[]; fallbackUsed: boolean; fallbackReason?: string }`.
   - Primary path: calls `embedImagesCohere(inputs)` (from 08-01) wrapped in a `Promise.race` against a 60s timeout, then `clusterByCosine(vectors, threshold)`. Clusters are converted to `AutoGroupOutput` by reading the first image's filename as the label and joining descriptors for context.
   - **Threshold policy:** `mode === "variant-family"` → 0.78; `mode === "default"` → 0.88. Both hardcoded as `const threshold = ...` per 08-CONTEXT.md's "Cosine threshold as env knob = deferred".
   - Retry loop: `MAX_ATTEMPTS = 2`, `BACKOFF_MS = 750` (linear, `attempt * BACKOFF_MS` between attempts). On every failure `lastError` is captured and logged via `console.warn`.
   - Fallback: after both attempts fail, logs an `error`, seeds one singleton `AutoGroupOutput` per input image, then hands the array to `mergeAutoGroupsByFamily` from `server/auto-group-utils.ts`. Returns `{ groups, fallbackUsed: true, fallbackReason }`.
   - `productContext` is retained as a parameter (consumed by `void productContext`) to keep both call sites stable.
   - The old GPT-5.2 vision batch loop (including `buildAutoGroupSystemPrompt`, `buildAutoGroupMergePrompt`, `buildCandidateBucketKey`, both `openai.chat.completions.create` calls, and the merge second pass) is entirely gone from this function body.

2. **`server/routes.ts` — SSE handler (lines ~3445-3480)**
   - Destructures `{ groups, fallbackUsed, fallbackReason }` from the new return type.
   - Emits `data: { type: "fallback", reason }` as a new SSE event **before** any `group` events when `fallbackUsed` is true — so the upload-zone client in Plan 08-03 can render the banner synchronously with group rendering.
   - Echoes `fallbackUsed` on the terminal `done` event for clients that only listen for the final frame.

3. **`server/routes.ts` — JSON handler (lines ~3530-3540)**
   - Returns `{ groups, fallbackUsed, fallbackReason }` instead of `{ groups }`, giving `handleSortVariants` a single field to switch on.

4. **`server/embedding-utils.ts` — timeout knob additions**
   - Added module-level `autoGroupTimeoutMs = 60_000` with `getAutoGroupTimeoutMs()` and `__setTimeoutMsForTests(ms)` exports. Lives in `embedding-utils.ts` (not routes.ts) so tests can collapse it without touching `routes.ts`.

5. **`tests/auto-group-embedding.test.ts` — 4 integration tests**
   - **success**: single `ok` Cohere call → 2 clusters (indices [0,1] and [2]), `fallbackUsed: false`, one call made.
   - **retry**: first `throw`, second `ok` → 2 clusters, `fallbackUsed: false`, two calls made.
   - **fallback**: both calls `throw` → `fallbackUsed: true`, `fallbackReason` matches `/Cohere 500/`, every input index appears exactly once across fallback groups.
   - **timeout**: hanging client + `__setTimeoutMsForTests(50)` → `fallbackUsed: true`, `fallbackReason` matches `/timeout/i`.

## SSE Event Shape for Plan 08-03

Plan 08-03's client code must match these exact shapes:

```typescript
// New: emitted once, BEFORE any group events, only when fallbackUsed === true
{ type: "fallback", reason: string }

// Unchanged shape, emitted per cluster:
{ type: "group", group: AutoGroupOutput }

// Existing event, now carries fallbackUsed for defensive clients:
{ type: "done", totalGroups: number, fallbackUsed: boolean }
```

JSON endpoint `/api/images/auto-group-existing` response:
```typescript
{ groups: AutoGroupOutput[], fallbackUsed: boolean, fallbackReason?: string }
```

## Shipped Constants (for Future Tuning)

| Constant | Value | Location |
|---|---|---|
| `threshold` (variant-family) | `0.78` | runAutoGrouping local const |
| `threshold` (default) | `0.88` | runAutoGrouping local const |
| `MAX_ATTEMPTS` | `2` | runAutoGrouping local const |
| `BACKOFF_MS` | `750` | runAutoGrouping local const (linear: `attempt * BACKOFF_MS`) |
| `TIMEOUT_MS` | `60_000` | `embedding-utils.autoGroupTimeoutMs`, read via `getAutoGroupTimeoutMs()` |
| `COHERE_EMBED_DIMENSION` (inherited) | `512` | `embedding-utils.ts` (08-01) |

## Orphaned Imports Removed

Removed from the `server/auto-group-utils` import line at `server/routes.ts:15`:

- `buildAutoGroupSystemPrompt` — only used inside the old VLM body
- `buildAutoGroupMergePrompt` — only used inside the old VLM merge pass
- `buildCandidateBucketKey` — only used inside the old pre-bucketing loop

Kept: `canonicalizeAutoGroup`, `mergeAutoGroupsByFamily` (both still consumed — the former by the embedding success path for output normalization, the latter by the fallback path).

`openai` top-level import (line 6) was **not** removed — it is still consumed by other endpoints in routes.ts.

## Deviations from Plan

### [Rule 1 - Bug] Promise.race setTimeout leak

- **Found during:** Task 2 test run.
- **Issue:** The plan's `Promise.race([embedPromise, setTimeoutReject])` pattern does not cancel the setTimeout when the embed promise wins. On the success path the setTimeout continued to hold the event loop open for the full 60s, causing a single test run to take 62 seconds instead of ~3 seconds.
- **Fix:** Assigned the timeout handle to a variable inside the Promise executor, moved the Promise.race into a try/finally block, and called `clearTimeout(timeoutHandle)` in the finally. Now the test suite runs in ~3.7s and production calls no longer leak one pending timer per successful embed.
- **Files modified:** `server/routes.ts`
- **Commit:** `b3a567e`

### [Rule 3 - Blocking issue] Environment gates on routes.ts import

- **Found during:** Task 2 test import.
- **Issue:** `server/routes.ts` transitively imports `server/db.ts` (throws without `DATABASE_URL`), `server/replit_integrations/image/client.ts` (throws without `OPENAI_API_KEY`), and `server/supabaseClient.ts` (throws without `SUPABASE_URL` / `SUPABASE_ANON_KEY`). All four throw at module-load time, so the test file could not even import `runAutoGrouping` regardless of the Cohere stub.
- **Fix:** Set dummy values for all four env vars at the top of `tests/auto-group-embedding.test.ts` **before** dynamic-importing the three source modules. None of the dummy clients make real network calls on the code paths under test — the embed path stops at the injected `__setCohereClientForTests` stub, and the fallback path only touches `mergeAutoGroupsByFamily`, which is pure.
- **Rationale:** The alternative (extracting `runAutoGrouping` into its own module to break the transitive imports) was rejected because it would expand the diff beyond the "one-seam refactor" promise in 08-CONTEXT.md. The env-var stub pattern is contained to one test file.
- **Files modified:** `tests/auto-group-embedding.test.ts`
- **Commit:** `b3a567e`

### [Spec clarification] Test-file imports via dynamic imports

- **Found during:** Task 2.
- **Issue:** ES module imports are hoisted above top-level statements, so `process.env.DATABASE_URL = ...` must run before the `import` of `runAutoGrouping`. Static imports cannot satisfy this ordering.
- **Fix:** Used `await import(...)` inside a `before()` hook, with the env-var assignments at the module top. This is the same pattern other node:test integration suites use when module-graph side effects need env setup.

### [Scope boundary] Pre-existing TypeScript errors

`pnpm tsc --noEmit` continues to surface the ~20 pre-existing errors documented in 08-01's `deferred-items.md` (`server/replit_integrations/*`, `server/db.ts`, `server/routes.ts:1276,1407,2090`, `server/webhookHandlers.ts`). **Zero new TypeScript errors** introduced by this plan — confirmed by filtering tsc output for lines in the touched ranges (routes.ts 124-249 and 3445-3540). No routes.ts errors appear outside the pre-existing set.

## Handoff Notes for Plan 08-03

1. **Banner trigger:** the client should render the fallback banner when **either** the SSE `type: "fallback"` event fires **or** `done.fallbackUsed === true`. Both carry the same information; listen for whichever fits the client's event-handling style.

2. **Fallback reason copy:** `fallbackReason` is either a Cohere SDK error message ("Cohere 500 Internal Server Error"), a timeout string ("Cohere embed timeout after 60000ms"), or the literal "Cohere unavailable" fallback string. Plan 08-03 should not display these raw — wrap them in user-friendly copy ("Smart grouping is temporarily unavailable — we grouped by filename instead").

3. **Threshold visibility:** the shipped thresholds (0.78 / 0.88) are hardcoded `const` inside the function. If Plan 08-03's QA checks suggest retuning, the constants live at the top of `runAutoGrouping` — no env var plumbing needed until a future phase.

4. **No "graceful degrade" UI for timeouts:** the 60s timeout is longer than typical Vercel function budgets for the non-embedding path. If latency pressure shows up in production, reduce `TIMEOUT_MS` via the test override pattern or (better) lift it to an env var in a follow-up plan.

## Self-Check: PASSED

**Files verified:**
- FOUND: `tests/auto-group-embedding.test.ts`
- FOUND: `server/routes.ts` (modified — runAutoGrouping exported, embedding path live)
- FOUND: `server/embedding-utils.ts` (modified — timeout getter + test override)
- FOUND: `.planning/phases/08-embeddings-variant-clustering/08-02-SUMMARY.md` (this file)

**Commits verified:**
- FOUND: `613181e` — test(08-02): add failing integration test for runAutoGrouping embedding path
- FOUND: `b3a567e` — feat(08-02): rewrite runAutoGrouping to use Cohere embeddings + fallback

**Verification commands run:**
- `pnpm test` → **45/45 passed** (4 new integration tests + 41 pre-existing, zero regressions)
- `pnpm tsc --noEmit` → only pre-existing errors, zero in touched ranges (routes.ts 124-249 and 3445-3540)
- `sed -n '124,240p' server/routes.ts | grep -c "gpt-5.2"` → **0**
- `grep -n "fallbackUsed" server/routes.ts` → 7 hits (type definition, success return, fallback return, SSE destructure, SSE if-branch, SSE done event, JSON return)
