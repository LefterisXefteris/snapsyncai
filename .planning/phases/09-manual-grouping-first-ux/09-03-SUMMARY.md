---
phase: 09-manual-grouping-first-ux
plan: 03
subsystem: ui

tags: [react, dnd-kit, keyboard-shortcuts, bulk-selection, drop-animation]

requires:
  - phase: 09-manual-grouping-first-ux-02
    provides: manual-first upload-zone with single-item-group drops and local selectedIds state
  - phase: 05-drag-drop-ui
    provides: SortableContext arrayMove intra-group reorder establishing hero as items[0]

provides:
  - useGroupSelection hook with Shift/Cmd click semantics and Esc-ready clear()
  - upload-zone.tsx wired to hook, focusedGroupId tracking, document-level Esc + Cmd/Ctrl+A
  - Explicit DragOverlay dropAnimation (~250ms) with defaultDropAnimationSideEffects
  - Snap-back-on-invalid-drop fix via queueMicrotask-deferred setActiveItem(null)
  - onDragCancel handler for Esc-cancel drag cleanup
  - Branching handleDragEnd preserving Phase 5 arrayMove hero-reorder for intra-group single drag

affects: [phase-09-plan-04, phase-09-plan-05, phase-09-UAT]

tech-stack:
  added: []
  patterns:
    - Pure selection hook: state + anchorRef inside; keyboard listeners wired by caller via useEffect
    - Document keydown effect gated on focusedGroupId for contextual Cmd/Ctrl+A
    - Branched handleDragEnd — intra-group single-item path untouched from Phase 5, batch/cross-group path rewritten
    - queueMicrotask to defer DragOverlay child unmount so dnd-kit built-in dropAnimation completes

key-files:
  created:
    - client/src/hooks/use-group-selection.ts
  modified:
    - client/src/components/upload-zone.tsx

key-decisions:
  - "useGroupSelection stays pure — Esc and Cmd+A listeners live in the component effect so the hook has no DOM dependencies and is trivially unit-testable"
  - "Cmd/Ctrl+A only fires when focusedGroupId is non-null — if the user has not clicked any thumbnail yet, the browser's default select-all runs, matching expected web UX"
  - "handleDragStart pre-selects the active id when it is not already part of a multi-selection, so a single un-selected grab does not accidentally carry stale range selection"
  - "handleDragEnd branches on (same source/target group AND selected.size <= 1) for the Phase 5 arrayMove reorder path — batch moves or any cross-group drag take the new cross-group path, preserving hero-reorder behavior exactly"
  - "Invalid drop leaves selection untouched (only defers activeItem clear) so the user can retry the same multi-drag without rebuilding the selection"
  - "SortableThumbnail onSelect signature changed to (id, groupId, MouseEvent) so the component can update focusedGroupId without threading separate props"

patterns-established:
  - "Pure-hook + component-effect split for keyboard-aware selection (hook owns state, component owns DOM listeners)"
  - "queueMicrotask defer pattern for dnd-kit DragOverlay snap-back"
  - "Branched handleDragEnd: preserve the Phase 5 intra-group path byte-for-byte; route batch/cross-group into a separate branch"

requirements-completed: [GROUP-07, GROUP-09]

duration: ~8 min
completed: 2026-04-11
---

# Phase 9 Plan 03: Bulk Selection + Snap-Back Summary

**Shift/Cmd/Ctrl selection hook wired into upload-zone with focused-group-aware Cmd+A, Esc clear, and an explicit dnd-kit dropAnimation that fixes invalid-drop snap-back via queueMicrotask-deferred DragOverlay teardown.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-11 (Plan 09-03 execution)
- **Completed:** 2026-04-11
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `useGroupSelection(itemIdsInOrder)` hook implementing plain/Shift/Cmd-click semantics across group boundaries
- Upload-zone uses the hook for `selectedIds`, tracks `focusedGroupId` on every thumbnail click
- Document-level `keydown` effect: Esc clears selection + focus, Cmd/Ctrl+A selects every item in the focused group (with `e.preventDefault()` to stop browser select-all)
- DragOverlay now carries an explicit `dropAnimation` (250ms cubic-bezier, dim-active side effect) so dnd-kit's built-in return-to-origin transition actually plays
- Invalid drops defer `setActiveItem(null)` via `queueMicrotask`, keeping the DragOverlay child mounted long enough for the animation to complete
- `onDragCancel` added to DndContext so Esc-cancel during drag cleans up without a state leak
- `handleDragEnd` split into two explicit branches: Phase 5 intra-group `arrayMove` hero-reorder path (preserved byte-for-byte, gated on `selected.size <= 1`) vs. batch/cross-group move (new, moves every selected id)

## Task Commits

1. **Task 1: Create useGroupSelection hook** — `a19fab6` (feat)
2. **Task 2: Wire hook + Cmd+A + snap-back dropAnimation** — `c05d0bf` (feat)

## Files Created/Modified

- `client/src/hooks/use-group-selection.ts` — 59-line hook: `useState<Set<string>>` + `useRef<string | null>` anchor, `handleClick` dispatching on shift/meta/ctrl, `clear()`, `setSelected` exposed for Cmd+A bulk-set
- `client/src/components/upload-zone.tsx` — Import hook + `defaultDropAnimationSideEffects` + `DropAnimation`, define module-scope `dropAnimation`, add `orderedItemIds` memo, replace local `selectedIds` state with hook, add `focusedGroupId` state, add `onThumbnailSelect` adapter, add document keydown effect, update `handleDragStart` to pre-select unselected grabs, branch `handleDragEnd` for intra-group vs cross-group/batch, wire `dropAnimation` on DragOverlay, add `onDragCancel` on DndContext, bump `SortableThumbnail`/`DroppableGroup` onSelect signature to `(id, groupId, MouseEvent)`

## Decisions Made

See frontmatter `key-decisions`. Summary: hook stays pure; Cmd+A defers to browser default when no group is focused; handleDragEnd branch is explicit to protect Phase 5 hero-reorder; invalid-drop does not clear selection so retries work.

## Deviations from Plan

None — plan executed exactly as written.

Minor adaptation: `onThumbnailSelect` was introduced as a small adapter callback (`useCallback`) in the component to co-locate `setFocusedGroupId(groupId)` with the `handleThumbnailClick(id, e)` call. The plan mentioned "either via a closure in the map or a new `groupId` prop on SortableThumbnail" and allowed either approach — the adapter + new `groupId` prop combination is the cleaner of the two and keeps `SortableThumbnail` re-renders stable (no new closures per render).

## Issues Encountered

- `npm run check` reports pre-existing TypeScript errors in `server/**`, `server/replit_integrations/**`, `client/src/components/review-queue-modal.tsx`, and `client/src/components/ui/shiny-button.tsx`. None are introduced by this plan — they exist on `main` before plan 09-03 and are out of scope per the execution rule. Verification instead relied on `npm run build`, which succeeds (`vite` build + `tsx` server bundle both exit 0).

## Verification

- `client/src/hooks/use-group-selection.ts` exists, exports `useGroupSelection`, uses `useState` + `useRef` + `useCallback`
- `grep -c "useGroupSelection\|dropAnimation\|queueMicrotask\|onDragCancel\|focusedGroupId\|arrayMove" client/src/components/upload-zone.tsx` → **13** (target ≥6)
- `npm run build` → exits 0 (vite client build + server bundle successful)
- Phase 5 intra-group `arrayMove` reorder path is textually preserved; gated on `activeGroup.id === overGroup.id && selectedIds.size <= 1`
- Manual smoke tests (drop-on-background snap-back, intra-group hero reorder, Cmd+A in focused group) deferred to Plan 05 UAT per plan verification checklist

## User Setup Required

None — no environment variables, no external service configuration. Pure client-side UX refactor.

## Next Phase Readiness

- Plan 09-04 (empty-group cleanup) can proceed; source-group emptying after cross-group batch move already happens via the existing `next.filter(g => g.items.length > 0)` step in the new branch
- Plan 09-05 (UAT) gets concrete smoke cases: (a) drop-on-background animates back; (b) click a thumbnail then Cmd+A selects all items in that group only; (c) Esc clears; (d) drag the first thumbnail within a group to a later index still re-elects the hero on next render

## Self-Check: PASSED

- FOUND: client/src/hooks/use-group-selection.ts
- FOUND: client/src/components/upload-zone.tsx (modified)
- FOUND: commit a19fab6 (Task 1)
- FOUND: commit c05d0bf (Task 2)
- Build: exits 0

---

*Phase: 09-manual-grouping-first-ux*
*Plan: 03*
*Completed: 2026-04-11*
