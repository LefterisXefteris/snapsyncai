---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 10-02-PLAN.md
last_updated: "2026-04-27T10:16:42.199Z"
last_activity: 2026-04-19
progress:
  total_phases: 10
  completed_phases: 2
  total_plans: 28
  completed_plans: 22
  percent: 84
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-31)

**Core value:** Users' data stays theirs, payments are credited exactly once, and no unauthenticated path reaches paid AI features.
**Current focus:** Phase 10 — Pricing Model Update

## Current Position

Phase: 10 of 10 (Pricing Model Update)
Plan: 1 of N in current phase (Completed)
Status: In progress
Last activity: 2026-04-19

Progress: [████████░░] 84%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 (Credit Idempotency) | 2 | ~25 min | ~13 min |

**Recent Trend:**

- Last 5 plans: 01-01 (~10 min), 01-02 (~15 min)
- Trend: stable

*Updated after each plan completion*
| Phase 10-pricing-model-update P01 | 12 min | 2 tasks | 3 files |
| Phase 05-drag-drop-ui P01 | 2 | 1 tasks | 3 files |
| Phase 05-drag-drop-ui P02 | 12 | 2 tasks | 1 files |
| Phase 05-drag-drop-ui P03 | 351 | 3 tasks | 1 files |
| Phase 05-drag-drop-ui P04 | 2 | 2 tasks | 1 files |
| Phase 06-product-detail-ai-content P01 | 10 | 2 tasks | 2 files |
| Phase 06-product-detail-ai-content P02 | 8 | 2 tasks | 1 files |
| Phase 06-product-detail-ai-content P03 | 15 | 2 tasks | 3 files |
| Phase 07-ai-auto-grouping-agent P01 | 2 | 2 tasks | 2 files |
| Phase 07-ai-auto-grouping-agent P02 | 2 | 2 tasks | 2 files |
| Phase 07-ai-auto-grouping-agent P03 | 1 | 1 tasks | 1 files |
| Phase 08-embeddings-variant-clustering P01 | 5 min | 3 tasks | 5 files |
| Phase 08-embeddings-variant-clustering P02 | ~10 min | 2 tasks | 3 files |
| Phase 09 P01 | 2 min | 2 tasks | 2 files |
| Phase 09 P02 | ~3 min | 2 tasks | 1 files |
| Phase 09 P03 | ~8 min | 2 tasks | 2 files |
| Phase 09 P04 | ~2 min | 1 tasks | 1 files |
| Phase 10-pricing-model-update P02 | 30 | 2 tasks | 4 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Idempotency: Use `paidSessions.used` column (already in schema) — no new table needed
- Token encryption: Application-layer encryption (env var key), not pgcrypto — avoids DB migration complexity
- Instagram OAuth nonce: Store in DB (not Redis) — Vercel serverless has no shared memory
- Ownership checks: Inline guard pattern — consistent with existing `getUserId(req)` style in routes
- [Phase 05-drag-drop-ui]: IDB singleton pattern: module-level dbPromise avoids repeated openDB calls per render cycle
- [Phase 05-drag-drop-ui]: Silent IDB fallback: wrap all IDB ops in try/catch, console.warn on failure — handles Safari private mode without UI crash
- [Phase 05-drag-drop-ui]: UUID droppable IDs: all dnd-kit droppables use stable group UUIDs, not positional group-${idx} strings
- [Phase 05-drag-drop-ui]: IDB write-through pattern: every Group[] mutation fires saveGroups as fire-and-forget side effect inside setGroups callback
- [Phase 05-drag-drop-ui]: Array.from(set) instead of spread for TypeScript ES5 target compatibility
- [Phase 05-drag-drop-ui]: SortableThumbnail replaces DraggableThumbnail — useSortable handles both within-group sort and between-group drag
- [Phase 05-drag-drop-ui]: Two-step overId resolution in handleDragEnd: direct group-ID match first, fallback to group containing hovered thumbnail
- [Phase 05-drag-drop-ui]: scale-[1.02] on DroppableGroup isOver className branch for smooth card scale feedback without structural changes
- [Phase 06-product-detail-ai-content]: Single image only for generate-content/regenerate-field: storage.getImagesByGroup unavailable, fallback to primary image
- [Phase 06-product-detail-ai-content]: SSE streaming with gpt-5.2: no response_format json_object in stream mode, JSON enforced via system prompt
- [Phase 06-product-detail-ai-content]: Feature flags VITE_FEATURE_AI_BG_REMOVAL and VITE_FEATURE_AI_PHOTOSHOOT: default false, buttons visible but disabled with SOON badge and Coming soon tooltip
- [Phase 06-product-detail-ai-content]: AiContentPanel is self-contained: hooks called inside panel, not wired through ProductDetails props
- [Phase 06-product-detail-ai-content]: SSE streaming hooks use Fetch ReadableStream with TextDecoder — not useMutation, which cannot stream
- [Phase 07-ai-auto-grouping-agent]: Batch size 15 images per GPT-5.2 vision call for accuracy vs cost balance
- [Phase 07-ai-auto-grouping-agent]: Non-streaming GPT calls with json_object response_format for structured group parsing
- [Phase 07-ai-auto-grouping-agent]: OffscreenCanvas + createImageBitmap for image resizing: avoids DOM canvas, works in Web Workers
- [Phase 07-ai-auto-grouping-agent]: allItemsRef stores flat FileItem[] snapshot at auto-group start for stable index mapping
- [Phase 07-ai-auto-grouping-agent]: GroupWithLabel extends Group locally for optional label/confidence without modifying shared interface
- [Phase 08-embeddings-variant-clustering]: Use CohereClientV2 (not legacy CohereClient) — only V2 exposes outputDimension and batched images in cohere-ai@8.x
- [Phase 08-embeddings-variant-clustering]: Default Matryoshka embedding dimension = 512 (bandwidth/quality sweet spot)
- [Phase 08-embeddings-variant-clustering]: getCohereClient checks cache before env var so tests can inject without COHERE_API_KEY
- [Phase 08-embeddings-variant-clustering]: runAutoGrouping embedding path: variant-family threshold 0.78, default 0.88, MAX_ATTEMPTS=2, BACKOFF_MS=750 linear, TIMEOUT_MS=60000
- [Phase 08-embeddings-variant-clustering]: fallbackUsed signal propagated via new SSE 'fallback' event + JSON response field; embedding success path does NOT run mergeAutoGroupsByFamily (fallback-only)
- [Phase 08-embeddings-variant-clustering]: Promise.race timeout handle is explicitly cleared in finally to prevent event-loop pinning on successful embed calls
- [Phase 09]: Phase 9 LARGE_GROUP_THRESHOLD locked at 20 images — soft warning only, no hard cap
- [Phase 09]: Phase 9 upload path reuses POST /api/images/upload?groupAsOne=true with CONCURRENCY=2 per-group failure isolation
- [Phase 09]: Phase 9 AI auto-sort stays as secondary toolbar button, not hidden
- [Phase 09]: Phase 9 upload-zone.tsx stripped of prompt/brand-tone/presets/mode-chooser; new drops append as one-item groups (no rechunking); Sort variants stays as secondary toolbar button
- [Phase 09]: Phase 9 useGroupSelection stays pure — Esc/Cmd+A listeners wired by component effect, not the hook
- [Phase 09]: Phase 9 handleDragEnd branched: Phase 5 intra-group arrayMove path preserved byte-for-byte, gated on selected.size <= 1; batch/cross-group path handles multi-select
- [Phase 09]: Phase 9 snap-back fix: explicit 250ms dropAnimation + queueMicrotask-deferred setActiveItem(null) on invalid drop; Cmd+A defers to browser default when focusedGroupId is null
- [Phase 09]: Phase 9 LARGE_GROUP_THRESHOLD = 20 constant is single source of truth; advisory badge pattern uses amber-100/amber-900 pill with data-testid per group and never blocks interaction
- [Phase 09]: Phase 9 DroppableNewGroup render gated on groups.length > 0 (not totalFiles > 0) so empty-state does not render a dangling drop target
- [Phase 10-pricing-model-update]: billingInterval defaults to 'monthly' in useCreateSubscriptionCheckout mutationFn — zero breaking change for existing callers
- [Phase 10-pricing-model-update]: Annual Stripe price uses same product (metadata.type = 'monthly_subscription') with interval: year — no new product needed
- [Phase 10-pricing-model-update]: migrate-to-new-price checks unit_amount === 1900 before updating — idempotent, safe to run multiple times
- [Phase 10-pricing-model-update]: subscriptionPricePence kept as backward-compat alias in /api/payments/config alongside new subscriptionMonthlyPricePence and subscriptionAnnualPricePence fields
- [Phase 10-pricing-model-update P02]: billingInterval state defaults to 'monthly' in sidebar — most common user choice, pre-selects monthly on dialog open
- [Phase 10-pricing-model-update P02]: monthlyPrice uses three-level ?? chain (subscriptionMonthlyPricePence ?? subscriptionPricePence ?? 900) for graceful backward compat
- [Phase 10-pricing-model-update P02]: Home.tsx fallback credit pack prices updated to halved values (450, 1750, 3950 pence)
- [Phase 10-pricing-model-update P01]: weekly_subscription product type used for both weekly and annual Stripe prices — annual lives on same product as weekly
- [Phase 10-pricing-model-update P01]: getWeeklyProductCount counts distinct coalesce(productGroupId, cast(id as text)) — product groups count as 1 slot
- [Phase 10-pricing-model-update P01]: paidSessions import kept in storage.ts — still used by createPaidSession/getPaidSession/markPaidSessionUsed for subscription verify flow
- [Phase 10-pricing-model-update]: billingInterval defaults to 'weekly' in useCreateSubscriptionCheckout — breaking from 'monthly' intentional, credits fully removed
- [Phase 10-pricing-model-update]: weeklyPrice uses simple (subscriptionWeeklyPricePence ?? 400) / 100 — three-level backward compat chain removed post-purge

### Roadmap Evolution

- Phase 8 added: Replace VLM variant sorter with embeddings-based clustering
- Phase 9 added: Manual Grouping-First UX — drag-drop becomes primary, AI sort optional; remove staging prompt; push grouped images to Supabase as products

### Pending Todos

None yet.

### Blockers/Concerns

- PAY-01 fix requires atomic read-modify-write on `paidSessions.used` — concurrent requests from verify + webhook must not both pass the check; implementation must use a single UPDATE WHERE or SELECT FOR UPDATE
- CRED-01–05 require a new `ENCRYPTION_KEY` env var to be provisioned in Vercel before Phase 3 deploys — deployment without it would break all platform connection writes
- Phase 8 requires `COHERE_API_KEY` env var provisioned in Vercel before deploy — deployment without it causes every auto-group call to fall back to filename-only grouping with a warning banner. Treat this identically to the Phase 3 `ENCRYPTION_KEY` deploy prerequisite.
- Phase 10 requires `MIGRATION_SECRET` env var provisioned in Vercel before running migrate-to-new-price or archive-old-price endpoints — without it both return 403.

## Session Continuity

Last session: 2026-04-27T10:16:42.197Z
Stopped at: Completed 10-02-PLAN.md
Resume file: None
