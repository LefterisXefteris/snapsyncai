---
phase: 09-manual-grouping-first-ux
plan: 04
subsystem: ui
tags: [react, dnd-kit, drag-drop, staging, ux]

# Dependency graph
requires:
  - phase: 09-manual-grouping-first-ux
    provides: "DroppableGroup + DroppableNewGroup components (Plan 02), branched handleDragEnd with new-group sentinel (Plan 02/03)"
provides:
  - "LARGE_GROUP_THRESHOLD constant (20) gating a soft advisory badge in DroppableGroup headers"
  - "Amber 'Large group (N) — consider splitting' badge with data-testid=large-group-warning-{groupId}"
  - "DroppableNewGroup always rendered at end of grid when groups.length > 0, with data-testid=droppable-new-group"
affects: [09-05, promotion-rewrite]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Soft-warning badge pattern: advisory-only UI that never gates interaction"
    - "Conditional drop-target render gated on collection size"

key-files:
  created: []
  modified:
    - client/src/components/upload-zone.tsx

key-decisions:
  - "LARGE_GROUP_THRESHOLD = 20 defined once at module scope and referenced inside DroppableGroup — single source of truth for soft cap"
  - "Badge uses data-testid=large-group-warning-{groupId} to let UAT target a specific group without DOM traversal"
  - "DroppableNewGroup render gated on groups.length > 0 so the '+ New group' target never appears before the user has uploaded images"
  - "Badge rendered inline next to item count (not in ml-auto action cluster) so Split/Trash buttons stay right-aligned"

patterns-established:
  - "Advisory badges: use amber-100 bg / amber-900 text pill, include numeric context in the label, never pointer-events: none — they must remain selectable for screen readers"

requirements-completed: [GROUP-08, GROUP-12]

# Metrics
duration: ~2 min
completed: 2026-04-11
---

# Phase 9 Plan 4: Large-group soft warning + always-visible new-group drop target Summary

**Soft GROUP-08 cap at 20 items surfaced as an advisory amber badge in DroppableGroup headers, and DroppableNewGroup now renders unconditionally at the end of the grid whenever any group exists (GROUP-12)**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-11T08:40:50Z
- **Completed:** 2026-04-11T08:42:06Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Introduced module-scope `LARGE_GROUP_THRESHOLD = 20` constant as the single source of truth for the GROUP-08 soft cap
- Added conditional amber "Large group (N) — consider splitting" badge inline with the item-count in DroppableGroup headers; renders only when `items.length > LARGE_GROUP_THRESHOLD`
- Verified badge does not block drops: no `pointer-events: none`, no disabled drop target, no cap on `push` into large groups
- Added `data-testid="droppable-new-group"` to DroppableNewGroup root for UAT
- Gated DroppableNewGroup render on `groups.length > 0` so it appears at the end of the group grid exactly when the must-have spec requires

## Task Commits

Each task was committed atomically:

1. **Task 1: LARGE_GROUP_THRESHOLD badge + verify DroppableNewGroup always visible** - `b508992` (feat)

## Files Created/Modified
- `client/src/components/upload-zone.tsx` - Added LARGE_GROUP_THRESHOLD constant, inserted advisory badge in DroppableGroup header, added data-testid on DroppableNewGroup root, gated DroppableNewGroup render on `groups.length > 0`

## Decisions Made
- Placed the badge inline next to the item-count span (before the `ml-auto` action cluster) so existing Split/Trash buttons stay right-aligned without flex reshuffling
- Used `data-testid` template literals (`large-group-warning-${groupId}`) so UAT can target a specific group
- Gated DroppableNewGroup on `groups.length > 0` (not `totalFiles > 0`) to match the must-have spec exactly — empty-state should not render a dangling drop target

## Deviations from Plan

None - plan executed exactly as written. The new-group drop handler (handleDragEnd `overId === "new-group"` branch) was already wired correctly in Plan 02, so no additional handler code was needed.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- GROUP-08 and GROUP-12 (the final two pure-UX requirements) are closed — ready for Plan 05 (promotion rewrite)
- `npm run build` passes; no new TypeScript errors
- Pre-existing unrelated uncommitted changes (Phase 8 edits, server/routes.ts, .beads deletions) were NOT staged

## Self-Check: PASSED

- FOUND: client/src/components/upload-zone.tsx (modified)
- FOUND: commit b508992 (feat 09-04 LARGE_GROUP_THRESHOLD)
- FOUND: LARGE_GROUP_THRESHOLD / droppable-new-group / large-group-warning markers in upload-zone.tsx (grep count = 4, threshold ≥3)
- Build verification: npm run build succeeded (client + server built, no TS errors)

---
*Phase: 09-manual-grouping-first-ux*
*Completed: 2026-04-11*
