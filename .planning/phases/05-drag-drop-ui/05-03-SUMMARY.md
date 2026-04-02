---
phase: 05-drag-drop-ui
plan: "03"
subsystem: frontend/upload-zone
tags: [dnd-kit, multi-select, sortable, per-group-controls, react]
dependency_graph:
  requires: [05-02]
  provides: [multi-select-drag, per-group-max-controls, within-group-reorder]
  affects: [upload-zone.tsx]
tech_stack:
  added: ["@dnd-kit/sortable (SortableContext, useSortable, rectSortingStrategy, arrayMove)", "@dnd-kit/utilities (CSS.Transform)"]
  patterns: [SortableThumbnail-replaces-DraggableThumbnail, Array.from-for-Set-spread, arrayMove-for-within-group-reorder, draggedIds-batch-move-pattern]
key_files:
  modified:
    - client/src/components/upload-zone.tsx
decisions:
  - "Use Array.from(selectedIds) instead of spread operator ([...set]) to fix TypeScript downlevelIteration TS2802 errors"
  - "Replace DraggableThumbnail entirely with SortableThumbnail — useSortable internally calls useDraggable+useDroppable so no functionality is lost"
  - "Detect within-group reorder by checking activeGroup.id === overGroup.id before the between-group logic"
  - "Remove unused GripVertical icon import after switching to SortableThumbnail layout"
metrics:
  duration_seconds: 351
  completed_date: "2026-04-02"
  tasks_completed: 3
  files_modified: 1
---

# Phase 05 Plan 03: Multi-Select Drag, Per-Group Controls, and Within-Group Reordering Summary

One-liner: Multi-select batch drag with count overlay badge, per-group +/- max controls with IDB persistence, and within-group sortable reordering using @dnd-kit/sortable — completing all six phase SC criteria.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add multi-select drag with batch move | 145940e | client/src/components/upload-zone.tsx |
| 2 | Add per-group max +/- controls | bce7e5b | client/src/components/upload-zone.tsx |
| 3 | Within-group sortable image reordering (SC-5) | dec9d40 | client/src/components/upload-zone.tsx |

## What Was Built

**Task 1 — Multi-select drag:**
- `selectedIds: Set<string>` state added to UploadZone
- `toggleSelect` handler toggles items into/out of the set
- `DraggableThumbnail` updated with `isSelected`, `onSelect`, `selectedIds` props — shows `ring-2 ring-primary ring-offset-1` ring when selected
- `handleDragEnd` uses `draggedIds` pattern: if active item is in a multi-selection, all selected IDs move together
- `DragOverlay` shows stacked ghost images with count badge (`{selectedIds.size} images`) when dragging multiple selected items
- Selection clears after every drag completes
- `selectedIds` and `onSelect` threaded down through `DroppableGroup`

**Task 2 — Per-group +/- max controls:**
- `adjustGroupMax(groupId, delta)` handler patches only the targeted group's `maxImages` (minimum 1 enforced)
- `− [N] +` control rendered in each `DroppableGroup` header with `onPointerDown stopPropagation` to prevent drag activation
- `maxImages` and `onAdjustMax` added to `DroppableGroup` props
- `saveGroups` called after each adjustment for IDB write-through
- Global preset buttons still rechunk and reset all group `maxImages` to the preset value (unchanged)

**Task 3 — Within-group sortable reordering:**
- Imported `SortableContext`, `useSortable`, `rectSortingStrategy`, `arrayMove` from `@dnd-kit/sortable` and `CSS` from `@dnd-kit/utilities`
- `SortableThumbnail` component replaces `DraggableThumbnail` — uses `useSortable` with CSS transform/transition for smooth reorder animation
- Each `DroppableGroup` wraps thumbnails in `SortableContext` with `rectSortingStrategy`
- `handleDragEnd` detects within-group reorder by comparing `activeGroup.id === overGroup.id` before the between-group logic
- `arrayMove` reorders `items[]` — `items[0]` is always hero, so dragging second image to first position changes the hero
- Hero badge "1" renders on `idx === 0` thumbnail and moves automatically after reorder
- `saveGroups` called after each within-group reorder

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript TS2802 error: Set spread not allowed for target ES5**
- **Found during:** Task 3 verification
- **Issue:** `[...allSelectedIds]` and `[...selectedIds]` fail with TS2802 when TypeScript target is below ES2015
- **Fix:** Replaced both with `Array.from(selectedIds)` / `Array.from(allSelectedIds)`
- **Files modified:** client/src/components/upload-zone.tsx
- **Commit:** dec9d40 (included in Task 3 commit)

**2. [Rule 2 - Cleanup] Removed unused GripVertical import**
- **Found during:** Task 3 (when DraggableThumbnail was replaced by SortableThumbnail which uses different layout)
- **Fix:** Removed `GripVertical` from lucide-react import
- **Files modified:** client/src/components/upload-zone.tsx
- **Commit:** dec9d40 (included in Task 3 commit)

## Known Stubs

None — all features are fully wired with real state and IDB persistence.

## Verification

TypeScript: `npx tsc --noEmit` — zero new errors in upload-zone.tsx or use-staged-images.ts. Pre-existing errors in server/replit_integrations are out of scope and were present before this plan.

Manual verification checklist:
1. Click 2 thumbnails — both show blue ring (ring-2 ring-primary)
2. Drag one of the selected thumbnails — count badge appears on ghost, both images move to target group
3. Click `+` on one card — that card's maxImages increments; other cards unaffected
4. Click `-` on a card with maxImages=1 — value stays at 1 (minimum enforced)
5. Press global preset "3" — all groups rechunk, all maxImages reset to 3
6. Within a group with 3+ images, drag the second thumbnail onto the first — it becomes the hero (badge "1" moves to it)
