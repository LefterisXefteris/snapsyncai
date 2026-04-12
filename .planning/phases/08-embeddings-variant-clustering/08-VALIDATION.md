# Phase 8: Embeddings Variant Clustering — Validation Architecture

**Derived from:** 08-RESEARCH.md "Validation Architecture" section
**Date:** 2026-04-10

## Nyquist Validation

`.planning/config.json` does not set `workflow.nyquist_validation`. Per the research protocol, treat as **enabled**. Every task that produces or modifies production code must have an automated `<verify>` command, and any missing test file is a Wave 0 gap that must be closed before the producing task runs.

## Test Framework

| Property | Value |
|---|---|
| Framework | `node:test` built-in (via `tsx --test`) |
| Config file | none — `package.json` script `"test": "tsx --test tests/**/*.test.ts"` |
| Quick run command | `pnpm test -- tests/embedding-utils.test.ts` |
| Full suite command | `pnpm test` |
| TypeScript check | `pnpm tsc --noEmit` |

No new framework install needed — sibling tests (`tests/auto-group-utils.test.ts`, `tests/workspace-variant-sort.test.ts`) already use this stack.

## Phase Requirements → Test Map

Requirement IDs were finalized in `/gsd:discuss-phase` as CLUSTER-01 through CLUSTER-04. CLUSTER-05 (feature flag) was dropped during discussion because the embeddings path is a hard replacement, not a flagged rollout.

| Req ID | Behavior | Test Type | Automated Command | File Origin |
|---|---|---|---|---|
| CLUSTER-01 | `clusterByCosine` unions vectors above threshold, isolates below | unit | `pnpm test -- tests/embedding-utils.test.ts` | Plan 08-01 Task 3 creates |
| CLUSTER-01 | `embedImagesCohere` batches at 96 and returns positionally aligned vectors | unit (mocked client) | `pnpm test -- tests/embedding-utils.test.ts` | Plan 08-01 Task 3 creates |
| CLUSTER-01 | `runAutoGrouping` success + retry + fallback paths against a stubbed Cohere client | integration | `pnpm test -- tests/auto-group-embedding.test.ts` | Plan 08-02 Task 2 creates |
| CLUSTER-02 | Wall-clock latency of a 6-image grouping is noticeably better than VLM baseline | manual checkpoint | recorded in 08-03-SUMMARY.md | Plan 08-03 Task 3 (human verify) |
| CLUSTER-03 | Cohere usage cost for 6-image grouping is fractions of a cent | manual checkpoint | Cohere dashboard read, recorded in 08-03-SUMMARY.md | Plan 08-03 Task 3 (human verify) |
| CLUSTER-04 | Existing `buildWorkspaceVariantAssignments` still consumes the new `AutoGroupOutput` shape unchanged | regression unit | `pnpm test -- tests/workspace-variant-sort.test.ts` | existing file, no changes |

CLUSTER-02 and CLUSTER-03 are intentionally manual-only. The automation cost of building a fixture-set harness + cost parser is not justified at v1 scale — the human checkpoint in Plan 08-03 captures both numbers directly from the Cohere dashboard and subjective wall-clock feel, and records them in the plan summary for future reference.

## Sampling Rate

- **Per task commit:** `pnpm test -- tests/embedding-utils.test.ts tests/auto-group-embedding.test.ts`
- **Per wave merge:** `pnpm test` (full suite, including pre-existing `tests/auto-group-utils.test.ts` and `tests/workspace-variant-sort.test.ts` as regression gates)
- **Phase gate:** Full suite green + `pnpm tsc --noEmit` green + human checkpoint in Plan 08-03 approved, before `/gsd:verify-work` runs.

## Wave 0 Gaps

Files that must be created by Wave 0 tasks so the `<verify>` commands in later tasks actually work:

- [ ] `tests/embedding-utils.test.ts` — Plan 08-01 Task 3 creates. Wave 1 of execution.
- [ ] `tests/auto-group-embedding.test.ts` — Plan 08-02 Task 2 creates. Wave 2 of execution.

No fixture directories, no eval scripts, no feature-flag test file (CLUSTER-05 was dropped). The phase deliberately ships without automated fixture-based quality eval — that is deferred to a future eval milestone per 08-CONTEXT.md "Labeled fixture set for quality evaluation" deferred item.

## Nyquist Compliance Check

Every production-code-producing task in plans 08-01 and 08-02 has an automated `<verify>` that runs against a real test file:

| Plan-Task | Produces | Verify Command | Test File |
|---|---|---|---|
| 08-01 Task 1 | `server/cohere-client.ts` | `pnpm tsc --noEmit` (Task 3 creates the actual tests) | scaffolded in Task 3 |
| 08-01 Task 2 | `server/embedding-utils.ts` | `pnpm tsc --noEmit` (Task 3 creates the actual tests) | scaffolded in Task 3 |
| 08-01 Task 3 | `tests/embedding-utils.test.ts` | `pnpm test -- tests/embedding-utils.test.ts` | self |
| 08-02 Task 1 | modified `server/routes.ts` | `pnpm test -- tests/auto-group-embedding.test.ts && pnpm tsc --noEmit` | created by Task 2 |
| 08-02 Task 2 | `tests/auto-group-embedding.test.ts` | `pnpm test` | self |
| 08-03 Task 1 | client hook + banner | `pnpm tsc --noEmit && pnpm test` | existing suite (no new client tests — UI verified in checkpoint) |
| 08-03 Task 2 | Home.tsx toast + STATE.md | `pnpm tsc --noEmit` | existing suite |
| 08-03 Task 3 | n/a (human checkpoint) | `echo` placeholder | manual |

Plan 08-01 Tasks 1 and 2 intentionally use `pnpm tsc --noEmit` as their automated verify because the test file they will eventually run against is created by Task 3 in the same plan. Running the test command before Task 3 exists would fail on "file not found" rather than giving useful feedback. Task 3 runs the full `pnpm test -- tests/embedding-utils.test.ts` which validates all three tasks together.

Plan 08-03 UI tasks do not add client unit tests — the UX changes (banner visibility, toast copy, dismiss behavior) are verified in the Task 3 human checkpoint rather than through brittle DOM-snapshot tests. This is consistent with the rest of the codebase, which has no React Testing Library / jsdom setup.
