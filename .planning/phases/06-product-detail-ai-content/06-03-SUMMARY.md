---
phase: 06-product-detail-ai-content
plan: 03
subsystem: ui
tags: [react, sse, streaming, ai, content-generation, hooks]

# Dependency graph
requires:
  - phase: 06-product-detail-ai-content/06-01
    provides: SSE endpoints /api/images/:id/generate-content and /api/images/:id/regenerate-field

provides:
  - AiContentPanel component with guided inputs, streaming, and per-field accept/regenerate
  - useGenerateContent hook consuming generate-content SSE endpoint
  - useRegenerateField hook consuming regenerate-field SSE endpoint
  - tags and aeoFaqs state in ProductDetails wired to handleSave

affects: [06-product-detail-ai-content]

# Tech tracking
tech-stack:
  added: []
  patterns: [SSE ReadableStream reader in custom hook (not useMutation), pending-override pattern for per-field regeneration]

key-files:
  created:
    - client/src/components/ai-content-panel.tsx
  modified:
    - client/src/hooks/use-images.ts
    - client/src/pages/ProductDetails.tsx

key-decisions:
  - "AiContentPanel is self-contained: hooks called inside panel, not wired through ProductDetails props"
  - "Pending state overrides generated state per-field so regenerated values stage before accept"
  - "SSE hooks use Fetch ReadableStream with TextDecoder — not useMutation, which cannot stream"

patterns-established:
  - "SSE streaming hook pattern: custom hook with fetch + reader.read() loop, onChunk/onDone callbacks"
  - "Pending-override display pattern: pendingValue ?? generated?.field ?? null for field staging"

requirements-completed: [PROD-01]

# Metrics
duration: 15min
completed: 2026-04-02
---

# Phase 06 Plan 03: AI Content Panel Summary

**AiContentPanel component with SSE streaming for all four fields (title, description, SEO keywords, AEO FAQs), per-field accept/regenerate, and wired into ProductDetails with tags/aeoFaqs state persisted on save**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-02T22:35:00Z
- **Completed:** 2026-04-02T22:50:00Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- Created `useGenerateContent` and `useRegenerateField` hooks that consume SSE streams via `ReadableStream` reader, accumulating text chunks and parsing JSON on `done` signal
- Built `AiContentPanel` component with Category/Style/Tone/Audience guided inputs, streaming indicator, and four `FieldPreview` sub-components each with Accept and Regenerate buttons
- Wired `AiContentPanel` into `ProductDetails.tsx` for paid users; added `tags` and `aeoFaqs` state initialized from image, accepted via panel callbacks, and saved in `handleSave()`
- Added SEO keyword badges display in "Search engine listing" card showing accepted keywords immediately

## Task Commits

Each task was committed atomically:

1. **Task 1: Add useGenerateContent and useRegenerateField hooks** - `f0de305` (feat)
2. **Task 2: Create AiContentPanel and wire into ProductDetails** - `db9c656` (feat)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified
- `client/src/components/ai-content-panel.tsx` - New component: guided inputs, streaming preview, per-field accept/regenerate
- `client/src/hooks/use-images.ts` - Added `GeneratedContent` interface, `useGenerateContent`, `useRegenerateField` hooks
- `client/src/pages/ProductDetails.tsx` - Import + render `AiContentPanel`; add `tags`/`aeoFaqs` state; include in handleSave

## Decisions Made
- AiContentPanel is self-contained — `useGenerateContent` and `useRegenerateField` are called inside the panel component, keeping ProductDetails clean
- Per-field pending state pattern: `pendingTitle ?? generated?.title ?? null` — a regenerated value stages in `pending*` state until accepted, then promotes into `generated`
- SSE hooks do not use `useMutation` — streaming requires custom hooks with `useState` + `fetch` + `ReadableStream`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript errors exist in server and third-party integration files (`review-queue-modal.tsx`, `shiny-button.tsx`, Replit integrations). These are out of scope and were not introduced by this plan. No errors in the files created or modified here.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- AI content generation UX is complete — users can generate, preview, and accept title/description/SEO keywords/AEO FAQs for any paid product
- Phase 06 core deliverable is done; plan 05 (verification) can proceed
- No blockers

## Self-Check: PASSED

- client/src/components/ai-content-panel.tsx: FOUND
- client/src/hooks/use-images.ts: FOUND
- client/src/pages/ProductDetails.tsx: FOUND
- .planning/phases/06-product-detail-ai-content/06-03-SUMMARY.md: FOUND
- Commit f0de305 (hooks): FOUND
- Commit db9c656 (panel + wiring): FOUND

---
*Phase: 06-product-detail-ai-content*
*Completed: 2026-04-02*
