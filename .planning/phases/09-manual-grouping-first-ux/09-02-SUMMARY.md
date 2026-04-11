---
phase: 09-manual-grouping-first-ux
plan: 02
subsystem: ui

tags: [react, dnd-kit, upload, staging, refactor]

requires:
  - phase: 09-manual-grouping-first-ux
    provides: 09-01 context scaffold and research identifying deletion targets in upload-zone.tsx
  - phase: 05-drag-drop-ui
    provides: DnD grid, SortableContext, DroppableGroup, DroppableNewGroup primitives
  - phase: 07-ai-auto-grouping-agent
    provides: useAutoGroup hook and variant-family sort pipeline
  - phase: 08-embeddings-variant-clustering
    provides: fallback banner + fallbackInfo on useAutoGroup
provides:
  - Manual-first UploadZone with three-card chooser, prompt, brand tone, presets, and per-group maxImages removed
  - Single-item group append semantics on file drop (no rechunking)
  - Sort variants preserved as secondary toolbar button
affects:
  - 09-03 (grid rework will layer on this smaller surface)
  - 09-04 (selection / shortcuts)
  - 09-05 (upload confirm / promotion flow)

tech-stack:
  added: []
  patterns:
    - "Manual-first: grid renders unconditionally when totalFiles > 0; no mode state"
    - "New files append as one-item groups, never rechunk existing state"
    - "AI sort is a secondary toolbar action (Sort variants button), not a primary card"

key-files:
  created: []
  modified:
    - client/src/components/upload-zone.tsx

key-decisions:
  - "maxImages kept in state as Number.MAX_SAFE_INTEGER for IDB back-compat — never read by UI"
  - "isAutoSorting replaces GroupingMode tri-state — single boolean gates auto-sort progress UI"
  - "Full rewrite of upload-zone.tsx via Write tool instead of incremental Edit — scope was ~80% deletion touching all major sections"

patterns-established:
  - "Dropped files become one-item groups appended to end (never rechunked)"
  - "Secondary AI toolbar button pattern for auto-sort as fallback"

requirements-completed: [GROUP-05, GROUP-06, GROUP-08, GROUP-11]

duration: ~3 min
completed: 2026-04-11
---

# Phase 09 Plan 02: Manual-first upload-zone deletion pass Summary

**Stripped staging-level AI prompt, brand-tone selector, preset toolbar, per-group maxImages controls, chunkArray rechunking, and three-card mode chooser from upload-zone.tsx while preserving the DnD grid, auto-sort hook, and Phase 8 fallback banner.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-11T08:31:09Z
- **Completed:** 2026-04-11T08:34:12Z
- **Tasks:** 2 (1 rewrite + 1 positive-assertion guard)
- **Files modified:** 1

## Accomplishments

- Deleted PRESETS, TONES, chunkArray, GroupingMode, globalGroupSize, onAdjustMax, productContext, brandTone, the three-card mode chooser, and the Custom AI Prompt panel
- Rewired onDrop so each new file becomes its own one-item group appended to existing groups (no rechunking)
- Dropped productContext/brandTone from uploadMutation.mutateAsync payload
- Preserved useAutoGroup, DroppableNewGroup, SortableContext, DragOverlay, CONCURRENCY=2, and Phase 8 fallback banner verbatim
- Moved AI auto-sort to a secondary toolbar button ("Sort variants") per GROUP-11
- Net LOC: 995 → 791 (−204)

## Task Commits

1. **Task 1: Delete prompt UI + brand tone + presets + maxImages + mode chooser** — `77f95a2` (refactor)
2. **Task 2: Positive-assertion check for preserved wiring** — no commit (guard task; verified via ripgrep)

**Plan metadata commit:** pending (this SUMMARY + STATE + ROADMAP + REQUIREMENTS)

## Files Created/Modified

- `client/src/components/upload-zone.tsx` — Manual-first deletion pass; prompt/brand-tone/presets/mode-chooser removed, onDrop rewired to append one-item groups, uploadMutation no longer passes productContext/brandTone, Sort variants remains as secondary toolbar button

## Decisions Made

- **Full rewrite via Write tool:** The deletion set touched imports, constants, DroppableGroup props, main component state, onDrop, uploadMutation call site, and most of the JSX tree. Incremental Edit calls would have been slower and more error-prone than one consistent rewrite. All preserved constructs (SortableThumbnail, DroppableGroup shell, DroppableNewGroup, DragOverlay, fallback banner, DnD handlers, IDB hooks) were copied verbatim.
- **isAutoSorting replaces GroupingMode:** The plan required removing `GroupingMode`, but auto-sort progress UI still needs to know when a sort run is active. A single boolean `isAutoSorting` (true only while Sort variants is running) preserves the progress/completion banners without reintroducing a tri-state.
- **maxImages left in state as Number.MAX_SAFE_INTEGER:** Plan interfaces flagged maxImages as vestigial-but-kept for IDB back-compat. New groups created after this plan use MAX_SAFE_INTEGER; loaded groups preserve whatever value was persisted.

## Deviations from Plan

None functional. Minor cosmetic deltas:

- Plan estimated ~650 LOC final; actual is 791. The delta is mostly the preserved fallback banner JSX, DragOverlay multi-select ghost, and header card structure — all explicitly preserved by the plan.
- Plan 02 Task 2 is a verification guard with no code change; I ran the ripgrep assertions in-session and did not create a second commit for it (a guard-only task has nothing to commit).

## Issues Encountered

- `npm run check` reports pre-existing TypeScript errors in unrelated files: `review-queue-modal.tsx`, `ui/shiny-button.tsx`, `server/db.ts`, `server/routes.ts`, `server/webhookHandlers.ts`, `server/replit_integrations/**`. None reference `upload-zone.tsx`. Per scope-boundary rules these are out-of-scope for Plan 02 and are logged here for visibility; they existed before this plan and remain.
- The `FileItem` shape in the plan's `<interfaces>` block used `previewUrl`, but the actual `use-staged-images.ts` exports `url`. I followed the real interface (the existing file already used `url`), so no migration was needed.

## Self-Check

- `rg 'productContext|brandTone|PRESETS|TONES|chunkArray|GroupingMode|globalGroupSize|onAdjustMax' client/src/components/upload-zone.tsx` → 0 matches (exit 1) OK
- `rg 'Textarea|MessageSquare|Mic' client/src/components/upload-zone.tsx` → 0 matches (exit 1) OK
- `rg -c useAutoGroup client/src/components/upload-zone.tsx` → 2 OK
- `rg -c DroppableNewGroup client/src/components/upload-zone.tsx` → 2 OK
- `rg -c CONCURRENCY client/src/components/upload-zone.tsx` → 3 OK
- `rg -c SortableContext client/src/components/upload-zone.tsx` → 4 OK
- `rg -c DragOverlay client/src/components/upload-zone.tsx` → 3 OK
- `rg -c 'fallbackInfo|Grouped by filename|fallback-banner' client/src/components/upload-zone.tsx` → 3 OK
- `git log --oneline | grep 77f95a2` → FOUND OK
- `client/src/components/upload-zone.tsx` exists → FOUND OK

## Self-Check: PASSED

## Next Phase Readiness

- Plan 03 can now layer grid rework (snap-back, selection polish, hero reorder) onto a smaller upload-zone surface
- The Sort variants toolbar button is the single AI entry point — Plan 04/05 can reshape it without wrestling the three-card chooser
- Pre-existing TypeScript errors in unrelated files are tracked separately; they do not block Phase 9

---
*Phase: 09-manual-grouping-first-ux*
*Completed: 2026-04-11*
