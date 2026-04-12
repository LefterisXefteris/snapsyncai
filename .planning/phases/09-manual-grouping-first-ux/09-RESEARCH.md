# Phase 9: Manual Grouping-First UX - Research

**Researched:** 2026-04-11
**Domain:** Drag-and-drop UX (dnd-kit), IndexedDB staging, Supabase image-upload pipeline, React state choreography
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Free-text prompt removal:** The "Custom AI Prompt" textarea in the drag-and-drop staging UI is permanently deleted (not feature-flagged). AI content generation runs only inside the per-product endpoint from Phase 6 (`generate-content` / `regenerate-field` SSE endpoints).
- **Staged groups become Supabase product records:** IndexedDB remains the staging layer; when the user confirms, each group is pushed to Supabase and the product owns its selected images.
- **Bulk selection:** click to select, Shift-click for range, Cmd/Ctrl-click to toggle. Selection persists across a drag so a batch move carries everything selected.
- **Group sizing:** soft warning on large groups (~20 images), no hard cap. The Phase 5 `+ / −` per-group max controls and the `PRESETS = [1,2,3,4,5]` toolbar must be removed because they enforce the cap.
- **Snap-back on invalid drop:** if thumbnails are dropped somewhere invalid, they animate back to origin.
- **In-card quick actions:** only "Set hero image" is prioritized. Split / merge / remove-thumbnail quick actions are explicitly deprioritized.
- **Visual hover feedback:** do NOT add richer cursor badges, dim-non-targets, or target-highlight upgrades — keep Phase 5's existing feedback.

### Claude's Discretion
- New-empty-group pattern (always-visible `+ New group` card vs. drop-on-canvas vs. toolbar button).
- Where ungrouped / newly uploaded images live (tray, auto "Uncategorized" group, or loose one-image groups).
- Keyboard shortcuts (minimum: Esc to clear selection, Cmd+A to select-all in focused group).
- Hero image selection mechanic (simplest default: "first thumbnail is hero, drag-to-reorder sets hero").

### Deferred Ideas (OUT OF SCOPE — but this phase must pick a default)
- **Staging → Supabase promotion mechanics:** per-group vs. batch, IDB cleanup on success/failure, retry UX.
- **AI sort visibility as optional fallback:** exact surface (button, menu item, hidden).
- **Product identity at creation time:** how a promoted product gets its initial title before the detail endpoint fills it in.

### Explicitly Out of Scope
- Split-group, merge-neighbor, per-thumbnail remove quick actions.
- Richer drag visual feedback (cursor badges, dim-non-targets).
</user_constraints>

## Summary

Phase 9 is a **pure client-side refactor of `client/src/components/upload-zone.tsx`** plus a set of small UX reshapes. The backend already supports everything the phase needs: `POST /api/images/upload` with `groupAsOne=true` takes a file batch, assigns a shared `productGroupId`, runs full AI analysis per group, and writes the group to Supabase via `storage.createImage` (server/routes.ts:1744–1854). **There is no `products` table** — products are an emergent client-side consolidation of `images.productGroupId` (Home.tsx:385–395, schema.ts:47). That means the CONTEXT.md phrase "push to Supabase as product records" must be read as "upload one group at a time with `groupAsOne=true`"; no schema migration is required.

The real work is (a) deleting the prompt UI, presets, per-group `maxImages` controls, and the three-way mode chooser, (b) reshaping the group grid so drag-to-group feels like the primary action, (c) wiring bulk selection (Shift / Cmd clicks — currently only toggle-on-click exists at upload-zone.tsx:369–375), and (d) implementing a proper snap-back on invalid drop. Auto-group stays wired (useAutoGroup from Phase 7/8) but demotes to a secondary toolbar button.

**Primary recommendation:** Rebuild `upload-zone.tsx` around a **single "manual" mode** — no mode chooser, no AI prompt textarea, no per-group max controls. Keep `DndContext` / `SortableContext` / `DragOverlay` architecture exactly as-is (it works), add Shift/Cmd selection on top of the existing `toggleSelect`, fix snap-back by deferring `setActiveItem(null)` to `onDragEnd` after `dropAnimation` settles (or by keying off `over===null`), and reuse `useUploadImages` + `groupAsOne=true` as-is for promotion — one HTTP call per group, called in parallel batches of 2 (the existing `CONCURRENCY=2` at upload-zone.tsx:586 already does this).

## Phase Requirements

Requirements for this phase are not yet defined in REQUIREMENTS.md. **Proposed new IDs (GROUP-05 through GROUP-12)** to be added by the planner:

| ID | Description | Research Support |
|----|-------------|------------------|
| GROUP-05 | Drag-and-drop staging is the primary grouping UX; the mode chooser ("Auto-group / Sort Variants / Group manually") is removed, manual mode starts immediately on file drop | upload-zone.tsx:268–269 `GroupingMode` + 663–711 `mode === "choosing"` block to remove |
| GROUP-06 | The "Custom AI Prompt" textarea, brand-tone selector, and `productContext` / `brandTone` state are permanently deleted from `upload-zone.tsx`; the upload call stops sending them | upload-zone.tsx:943–973 (textarea), 274–275 (state), 591–594 (mutation call); per-product AI already uses `aiContentPanel` which re-reads from `generate-content` SSE endpoint |
| GROUP-07 | Shift-click selects a range within a group, Cmd/Ctrl-click toggles a single thumbnail, plain click selects and clears others; multi-select persists across a drag | upload-zone.tsx:369–375 currently only toggles — needs range anchor ref and event-modifier branching |
| GROUP-08 | The per-group `maxImages` counter, the `+ / −` controls, and the `PRESETS = [1..5]` toolbar are removed; large groups (> 20 images) show a soft warning badge but no hard cap | upload-zone.tsx:39 `PRESETS`, 180–199 per-group adjust, 509–519 `setGlobalGroupSizeAndRechunk`, 462 `if (allItems.length > 200) return prev` server-side cap stays |
| GROUP-09 | An invalid drop (drop target is null, the page background, or outside any droppable) animates the dragged thumbnail back to its origin instead of vanishing | upload-zone.tsx:378 `setActiveItem(null)` fires synchronously — kills the snap-back because `DragOverlay` child unmounts before `dropAnimation` runs |
| GROUP-10 | Confirming the staged layout pushes each group to Supabase by calling `POST /api/images/upload` with `groupAsOne=true` once per group; on success, the IDB blobs and groups record are cleared; on per-group failure, the failed group remains in IDB and the user sees a retry affordance | upload-zone.tsx:571–618 already does this — needs per-group error isolation (currently swallows with `console.error`) |
| GROUP-11 | The AI auto-group / "Sort variants" flow remains accessible as a secondary toolbar action but is no longer the landing UX; `useAutoGroup` and the fallback banner (Phase 8) continue to work unchanged when invoked | upload-zone.tsx:282, 837–844, 742–767 fallback banner |
| GROUP-12 | A "+ New group" drop target is always visible at the end of the group grid so users can create an empty group by dropping onto it; dropping onto empty canvas outside any group also creates a new group | upload-zone.tsx:247–264 `DroppableNewGroup` already implements this — verify it is always visible and recommended pattern confirmed below |

These IDs should be added to REQUIREMENTS.md under a new "Manual Grouping-First UX (Phase 9)" section following the GROUP-01..04 / CLUSTER-01..04 style.

## Standard Stack

All libraries are **already in the project** — no new dependencies are needed for Phase 9.

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@dnd-kit/core` | ^6.3.1 (package.json:18) | DndContext, DragOverlay, useDroppable, sensors | Accessible, supports multi-backend (mouse/touch), active maintenance |
| `@dnd-kit/sortable` | ^10.0.0 (package.json:19) | SortableContext, useSortable, arrayMove | Canonical dnd-kit pattern for reorderable grids; already used in upload-zone |
| `@dnd-kit/utilities` | ^3.2.2 (package.json:20) | CSS.Transform.toString for style wiring | Required companion to core |
| `idb` | (in use by use-staged-images.ts) | IndexedDB typed wrapper for staging blobs | Already the project's IDB layer; do not replace |
| `react-dropzone` | (in use by upload-zone.tsx:2) | File picker + drag-onto-page | Already integrated |

### Supporting (already installed)
| Library | Purpose | Phase 9 use |
|---------|---------|-------------|
| `lucide-react` | Icon set | New/changed icons: keep Package, Images, Plus, Trash2; drop MessageSquare, Mic, Sparkles (from removed prompt UI) |
| `@/components/ui/textarea`, `@/components/ui/select` | Shadcn primitives | **Remove imports** — prompt UI is deleted |
| `useToast` | Error toasts | Keep; use for per-group promotion failures |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| dnd-kit | react-dnd, @hello-pangea/dnd | Would be a rewrite; no benefit; dnd-kit already does everything Phase 9 needs |
| Custom Shift/Cmd selection | `@react-aria/selection` | Overkill for a single grid; 30 lines of vanilla React suffices |

**No installs needed.** Verification: `grep -E "dnd-kit|idb|react-dropzone" package.json` all present.

## Architecture Patterns

### Recommended File Layout (delta from Phase 5)

```
client/src/components/
├── upload-zone.tsx              # rebuilt: manual-first, no prompt, no mode chooser
├── upload-zone/                 # NEW optional subfolder if upload-zone.tsx grows past ~600 lines
│   ├── SortableThumbnail.tsx    # extract if split helps readability
│   ├── DroppableGroup.tsx       # extract if split helps readability
│   └── useGroupSelection.ts     # NEW hook: Shift/Cmd selection logic
client/src/hooks/
├── use-staged-images.ts         # unchanged — IDB contract stays stable
├── use-auto-group.ts            # unchanged — still used by secondary AI button
└── use-group-selection.ts       # NEW (or inside upload-zone/) — Shift-click range, Cmd-click toggle, Esc clear
```

**Recommendation:** do **not** split `upload-zone.tsx` unless it exceeds ~800 lines after rewrite. The current file is ~995 lines but ~30% is prompt UI, mode chooser, and preset logic that is being deleted — the net result will likely be ~650 lines and is easier to review as a single diff.

### Pattern 1: Bulk Selection (Click / Shift-click / Cmd-click)

Current code (upload-zone.tsx:369–375) only toggles on click. The canonical React pattern for the three-modifier selection model:

```typescript
// hooks/use-group-selection.ts  (NEW)
import { useCallback, useRef, useState } from "react";

export function useGroupSelection(itemIdsInOrder: string[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const anchorRef = useRef<string | null>(null);

  const handleClick = useCallback(
    (id: string, e: React.MouseEvent) => {
      const order = itemIdsInOrder;
      if (e.shiftKey && anchorRef.current) {
        // Range select from anchor to id
        const a = order.indexOf(anchorRef.current);
        const b = order.indexOf(id);
        if (a < 0 || b < 0) return;
        const [lo, hi] = a < b ? [a, b] : [b, a];
        setSelected(new Set(order.slice(lo, hi + 1)));
        return;
      }
      if (e.metaKey || e.ctrlKey) {
        // Toggle this id only
        setSelected((prev) => {
          const next = new Set(prev);
          next.has(id) ? next.delete(id) : next.add(id);
          return next;
        });
        anchorRef.current = id;
        return;
      }
      // Plain click: select only this item, set anchor
      setSelected(new Set([id]));
      anchorRef.current = id;
    },
    [itemIdsInOrder]
  );

  const clear = useCallback(() => {
    setSelected(new Set());
    anchorRef.current = null;
  }, []);

  return { selected, handleClick, clear, setSelected };
}
```

**Notes:**
- `itemIdsInOrder` should be a flat list of all thumbnail IDs **in visual order** (flatMap over groups). Range selection across groups matches user expectations.
- The anchor persists across clicks until a plain click or clear, which matches macOS Finder and Gmail.
- Wire `clear()` to Esc in a `useEffect` keydown listener on `document`, active while the DndContext is mounted.

### Pattern 2: Snap-Back on Invalid Drop (dnd-kit)

**The current bug:** `handleDragEnd` (upload-zone.tsx:378) calls `setActiveItem(null)` synchronously, which unmounts the `DragOverlay` child and aborts the built-in drop animation. dnd-kit's default `dropAnimation` DOES animate back to origin when `over === null` — but only if the DragOverlay child remains mounted long enough for the CSS transition to finish.

**The fix (two options, pick one):**

**Option A — delay setActiveItem(null) until `onDragCancel` and `onDragEnd` *after* dropAnimation:**

```typescript
import { DndContext, defaultDropAnimationSideEffects, type DropAnimation } from "@dnd-kit/core";

const dropAnimation: DropAnimation = {
  duration: 250,
  easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)",
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: "0.4" } },
  }),
};

// In the DndContext:
<DndContext
  sensors={sensors}
  onDragStart={handleDragStart}
  onDragEnd={handleDragEnd}
  onDragCancel={() => setActiveItem(null)}  // cancelled = Esc or programmatic cancel
>
  ...
  <DragOverlay dropAnimation={dropAnimation}>
    {activeItem ? <GhostThumbnail item={activeItem} /> : null}
  </DragOverlay>
</DndContext>
```

And in `handleDragEnd`, do NOT call `setActiveItem(null)` when `!over`. Instead, let the natural re-render on the next drag-start replace it, OR schedule it on the next tick:

```typescript
const handleDragEnd = ({ active, over }: DragEndEvent) => {
  if (!over) {
    // Invalid drop: keep overlay mounted so dropAnimation can play,
    // then clear on the next microtask.
    queueMicrotask(() => setActiveItem(null));
    setSelectedIds(new Set());
    return;
  }
  // ...rest of existing logic, then at the end:
  setActiveItem(null);
};
```

**Option B — keep `activeItem` state but conditionally render overlay children based on `dragEndPhase`:**
More code; Option A is simpler and matches dnd-kit docs guidance.

**Key dnd-kit docs note:** "If you conditionally render the DragOverlay component, drop animations will not work. Instead, conditionally render the children of DragOverlay." The current code already does this correctly (upload-zone.tsx:886 `<DragOverlay>{activeItem ? ... : null}</DragOverlay>`) — the only fix needed is **timing of when `activeItem` becomes null.**

### Pattern 3: Hero Image via First-Position Convention

Phase 5 already encodes hero = `items[0]` (upload-zone.tsx:230 `isHero={idx === 0}`, schema comment in use-staged-images.ts:12 `items[0] = hero image`). Drag-to-reorder-within-group is already wired via `SortableContext` + `arrayMove` (upload-zone.tsx:223, 390–401). **Recommendation: do nothing new.** Within-group reorder already sets the hero because reordering to position 0 makes that image the hero on next render. The user can simply drag a thumbnail to the front of its group.

If a more discoverable affordance is wanted, the **cheapest addition** is a hover-revealed "Set as hero" star in `SortableThumbnail` that calls a new `promoteToHero(groupId, itemId)` function doing `arrayMove(items, idx, 0)`. This is ~15 lines. Recommend adding it as a GROUP-13 nice-to-have, not blocking.

### Anti-Patterns to Avoid
- **Do not conditionally render `<DragOverlay>` itself** — only its children. Already correct; don't regress.
- **Do not store `Set<string>` selection in context** — prop-drill or custom hook. Context causes all thumbnails to re-render on every selection change.
- **Do not invent a new upload endpoint for promotion.** Reuse `POST /api/images/upload` with `groupAsOne=true`; the server already creates the `productGroupId`, stores blobs, runs full AI analysis, and writes to Supabase storage (server/routes.ts:1756–1854).
- **Do not re-chunk groups on file drop** (upload-zone.tsx:463 `chunkArray(allItems, globalGroupSize)`). The new behavior on file drop should be: **each new file lands as its own single-item group** at the end of the grid (aligns with "ungrouped images home" recommendation below) OR dropped into a dedicated "Ungrouped" tray.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drop animation / snap-back | Custom CSS transitions synced to drag state | dnd-kit's built-in `dropAnimation` prop on `DragOverlay` | Handles measurement, will-change, opacity fade, and race conditions with state updates |
| Within-group reorder | Manual index swap on drag | `arrayMove` from `@dnd-kit/sortable` (already used at line 396) | Handles edge cases at boundaries |
| IndexedDB persistence | Raw `indexedDB` API calls | Existing `useStagedImages` hook | Already handles 24h expiry, structured clone of Blob, Safari private-mode fallback |
| Supabase upload + AI analysis of a group | Per-image upload then manual group linking | Existing `POST /api/images/upload` with `groupAsOne=true` | Server already does analyze-once-per-group, assigns `productGroupId`, and creates `paymentStatus: "paid"` records |
| Product consolidation after upload | New `products` table + join table | Existing client-side consolidation via `productGroupId` (Home.tsx:385–395) | There is no `products` table and one is not needed; images are the product in the current model |
| File picker + drag-onto-page | Native input + drag events | `react-dropzone` (already wired at upload-zone.tsx:481–506) | Already integrated; keep as-is |

**Key insight:** Phase 9 is 80% deletion and re-wiring, 20% new UX logic. The server-side pipeline is already correct for the end goal. The temptation to add a `products` table should be resisted — that's a separate refactor milestone and would block Phase 9 on schema migration work that delivers no new user-visible value.

## Runtime State Inventory

Phase 9 is primarily a UI rewrite; it does interact with stored state, so the inventory is non-trivial.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | **IndexedDB `staged-images-db` (v1)**: stores `blobs` and `groups` records (use-staged-images.ts:58–70). Schema is not changing — `Group` still has `id`, `items`, `maxImages`. The `maxImages` field becomes vestigial (hard cap removed) but the column stays to preserve IDB compatibility for users with existing staged data. **Supabase `images` table**: no schema change. `productGroupId` keeps its current meaning. | **No migration.** Leave `maxImages` in the IDB record; default all new groups to `maxImages: Number.MAX_SAFE_INTEGER` or simply stop reading it in UI. |
| Live service config | **None.** Phase 9 does not touch Vercel env vars, SOPS, Stripe, Cohere, OpenAI, or any external service config. | None. |
| OS-registered state | **None.** No scheduled jobs, no OS-level hooks. | None. |
| Secrets/env vars | **None changed.** `COHERE_API_KEY` and `OPENAI_API_KEY` are still read by the secondary AI auto-group path — do not touch. | None. |
| Build artifacts | **None.** Vite will rebuild; no `egg-info`-style stale artifacts. | None. |

**Verified nothing found in live/OS/secret/build categories** — Phase 9 is a client-only refactor with read/write against the pre-existing IDB schema and the pre-existing `/api/images/upload` endpoint.

## Environment Availability

Skipped — Phase 9 is a pure code/config refactor of client and has no new external dependencies. All required tools (dnd-kit, idb, react-dropzone, useToast, existing server upload endpoint) are already available in the project.

## Common Pitfalls

### Pitfall 1: Snap-back fails because `setActiveItem(null)` fires too early
**What goes wrong:** Dragged thumbnail vanishes instantly when dropped on invalid target instead of animating back to origin.
**Why it happens:** Unmounting `DragOverlay` children before `dropAnimation` can play aborts the CSS transition.
**How to avoid:** Use `queueMicrotask` or `onDragCancel` to defer clearing `activeItem`, and set an explicit `dropAnimation` prop with `defaultDropAnimationSideEffects`. See Pattern 2.
**Warning sign:** Test by dragging a thumbnail to the page background — if it disappears without animating, the fix is not applied.

### Pitfall 2: Multi-select drag mutates the wrong group when IDs collide
**What goes wrong:** Cross-group batch move drops thumbnails into the wrong group when hovering over a single thumbnail inside a group.
**Why it happens:** `over.id` can be either a group UUID or an item UUID; existing code (upload-zone.tsx:424–428) handles this correctly with two-step resolution. A rewrite must preserve that fallback.
**How to avoid:** Keep the two-step `find(g => g.id === overId) ?? find(g => g.items.some(i => i.id === overId))` pattern.

### Pitfall 3: Upload concurrency too high → server overload
**What goes wrong:** If confirming 20 groups in parallel, the server tries to run 20 vision-model calls simultaneously and may time out.
**Why it happens:** The current `CONCURRENCY = 2` cap (upload-zone.tsx:586) is load-bearing. A rewrite that accidentally raises it will break.
**How to avoid:** Preserve the `CONCURRENCY = 2` batch loop. Consider making it a named constant at the top of the file.

### Pitfall 4: IDB cleanup on partial failure loses user work
**What goes wrong:** Current code calls `clearAll()` synchronously before the upload loop completes (upload-zone.tsx:580). If any group fails, its blobs are gone and the user cannot retry.
**Why it happens:** Current flow assumes all-or-nothing success; it predates the "soft warning, retry allowed" framing.
**How to avoid:** Change to per-group `deleteBlob` on success. Only clear the `groups` record after all uploads settle. Preserve failed groups in state for a retry affordance.

### Pitfall 5: Removing `productContext` breaks the backend contract
**What goes wrong:** Server still reads `req.body.productContext` (routes.ts:1742). If the client stops sending it, the server receives `""` which is handled, but any tests that assert on it may break.
**How to avoid:** Confirm with `grep -r "productContext" client/ server/` that dropping the field from the client FormData is safe. Server default is `""` — safe. No server change required.

### Pitfall 6: Large-group soft warning fires for auto-grouped results
**What goes wrong:** The auto-group path can produce groups with 30+ images (a 50-image shirt with 30 color variants). A warning would fire incorrectly.
**How to avoid:** Threshold check should consider whether group was user-created via drag; auto-grouped groups suppress the warning OR the threshold is lenient (recommended: 20 for manual, 40 for auto-groups — or simply show it universally as a non-dismissable badge, not a toast).

### Pitfall 7: Shift-click range across groups is ambiguous
**What goes wrong:** User Shift-clicks from a thumbnail in group A to one in group B — what gets selected?
**Recommendation:** Range = "all thumbnails in visual DOM order between anchor and target, across group boundaries". This matches Finder. Implement by flat-mapping groups to a single ordered array of IDs (see Pattern 1).

## Recommendations on Deferred Items

### 1. Staging → Supabase promotion mechanics
**Recommendation: batch confirm (single button), per-group server call in parallel pairs, per-group failure isolation.**

- UI: one "Confirm & Create N Products" button at the bottom (already exists as `ShinyButton` at upload-zone.tsx:977–991). Keep it.
- Server calls: one `POST /api/images/upload` per group with `groupAsOne=true`, parallelism capped at `CONCURRENCY = 2` (already implemented at upload-zone.tsx:586).
- IDB cleanup: on per-group success, call `deleteBlob` for each thumbnail in that group AND update the persisted groups record to drop the successful group. Only call `clearAll()` if ALL groups succeed.
- Failure UX: failed groups remain in `groups` state + IDB, move to the top of the grid with a red "Retry" badge. Retry clicks re-fire the same upload call.
- Rationale: matches the user's "fast and frictionless" north star — one button confirms everything, but a single failure doesn't nuke an hour of manual grouping work.

### 2. AI sort visibility as optional fallback
**Recommendation: secondary toolbar button, always visible, labeled "AI auto-sort" with a Sparkles icon.**

- Location: in the group-grid toolbar next to "Add more" (upload-zone.tsx:845–851), not a landing-page choice.
- Behavior: when clicked, runs `useAutoGroup.startGrouping(allItems, undefined, "variant-family")` — same as the existing "Sort variants" button (upload-zone.tsx:837). If it succeeds, groups are replaced in-place. If it fails, the existing Phase 8 fallback banner shows.
- Why not a menu: discoverability matters. A visible secondary button costs nothing and keeps AI sort usable without making it the first thing the user sees.
- Delete: the three-card mode chooser (upload-zone.tsx:663–711) and the `mode === "choosing"` state entirely. Files drop → immediately manual mode.

### 3. Product identity at creation time
**Recommendation: filename-derived placeholder title from the hero image, no user input at staging time.**

- The server's existing grouped-paid path already synthesizes titles via the vision model (`fullAnalyzeMultipleImages` at routes.ts:1764). A promoted group gets a real AI title automatically.
- The preview-mode path (unpaid users) already uses `quickPreviewMultipleImages` which also produces a title.
- Neither path needs a user-provided title. The hero filename (`file.originalname.replace(/\.[^/.]+$/, "")`) is already the fallback (routes.ts:1837).
- No new UI. Users who want to edit the title do so on the product detail page using the existing regenerate-field endpoint from Phase 6.

### 4. New-empty-group pattern
**Recommendation: always-visible "+ New group" drop target at the bottom of the grid (already implemented).**

- `DroppableNewGroup` exists (upload-zone.tsx:247–264, rendered at line 881). Keep it. It is the cleanest pattern: discoverable, accessible (has a visible label), works on touch and mouse, and is already consistent with the Phase 5 grid.
- Rejected alternative — "drop on empty canvas auto-creates": harder to discover, ambiguous drop-target semantics, and violates the user's "keep Phase 5's existing hover feedback, don't add more" constraint.
- Rejected alternative — "explicit toolbar button": requires a second step (click button → drag to new empty group). The drop target merges both actions.

### 5. Ungrouped images home
**Recommendation: loose one-image groups at the end of the grid when files are dropped.**

- Current behavior (upload-zone.tsx:460–469): new files are rechunked via `globalGroupSize` into multi-image groups. This is wrong for the manual-first flow — the user wants to decide how things group.
- New behavior: each dropped file becomes its own `Group` with one item, appended to the end of `groups`. The user drags them into existing groups or onto the "+ New group" target.
- Rejected alternative — "dedicated Ungrouped tray": introduces a second container type and splits the DnD topology, increasing complexity for no payoff.
- Rejected alternative — "auto Uncategorized group": dumps everything into a single giant group the user has to pull apart. Worse than one-per-file.

### 6. Keyboard shortcuts
**Recommendation: minimum viable set, implement via a single `useEffect` keydown listener on `document`.**

- **Esc**: clear selection (already works if wired to `clear()` from Pattern 1).
- **Cmd/Ctrl+A**: select all thumbnails in the *focused* group (track focused group via `onMouseEnter` or click — minimal state).
- **Delete / Backspace**: remove selected thumbnails (calls `deleteBlob` + state update). This is the one non-obvious add that meaningfully accelerates power users.
- Everything else deferred to a future phase.

**Reject:** arrow-key thumbnail navigation, Tab-based group focus, shortcut help modal. None of this clears the "clearly helps" bar stated in CONTEXT.md.

### 7. Hero selection mechanic
**Recommendation: no new UI. Drag-to-reorder-within-group already sets the hero (first item = hero).**

- The existing `SortableContext` already lets users drag a thumbnail to position 0 within a group. The hero badge (upload-zone.tsx:103–107) updates automatically.
- CONTEXT.md states "Set hero image is the only prioritized in-card quick action" — this is satisfied by the existing drag-to-front behavior. If the planner wants a more discoverable affordance, add a hover-revealed star button as a trailing task, not a blocker.

### 8. Soft warning threshold
**Recommendation: 20 images. Non-dismissable amber badge in the group header, no toast.**

- Matches user's stated number.
- No downstream conflict: the server caps uploads at 200 total images per request (routes.ts:1737–1739), not per group. A 50-image group is fine server-side.
- The Phase 6 AI-content path handles groups of any size (it currently uses only the primary image per routes.ts:1976+ path documented in STATE.md Phase 6 decisions).
- Badge text: `"Large group (${count}) — consider splitting"`. No action required from the user; purely advisory.

## Code Examples

### Example 1: Flat-ordered item IDs for range selection
```typescript
// Source: adapted from dnd-kit sortable docs + React selection patterns
const orderedItemIds = useMemo(
  () => groups.flatMap(g => g.items.map(i => i.id)),
  [groups]
);
const { selected, handleClick, clear } = useGroupSelection(orderedItemIds);

// In SortableThumbnail onClick:
onClick={(e) => {
  e.stopPropagation();
  handleClick(item.id, e);
}}
```

### Example 2: Deferred setActiveItem(null) for snap-back
```typescript
// Source: https://docs.dndkit.com/api-documentation/draggable/drag-overlay
const handleDragEnd = ({ active, over }: DragEndEvent) => {
  if (!over) {
    // Let the default dropAnimation play; clear overlay on next microtask
    queueMicrotask(() => setActiveItem(null));
    return;
  }
  // ...existing group-move logic...
  setActiveItem(null);  // valid drop — clear synchronously
};

const dropAnimation: DropAnimation = {
  duration: 250,
  easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)",
};

<DragOverlay dropAnimation={dropAnimation}>
  {activeItem ? <GhostThumbnail item={activeItem} /> : null}
</DragOverlay>
```

### Example 3: Per-group promotion with isolated failure
```typescript
// Source: refactor of upload-zone.tsx:571–618
const handleConfirm = async () => {
  if (groups.length === 0) return;
  setIsUploading(true);
  setUploadProgress({ current: 0, total: groups.length });

  const failed: GroupWithLabel[] = [];
  const CONCURRENCY = 2;

  for (let i = 0; i < groups.length; i += CONCURRENCY) {
    const batch = groups.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (group) => {
        try {
          await uploadMutation.mutateAsync({
            files: group.items.map(it => it.file),
            groupAsOne: group.items.length > 1,
            hideToast: true,
          });
          // Success: clean up this group's IDB blobs
          await Promise.all(group.items.map(it => deleteBlob(it.id)));
        } catch (err) {
          console.error("[upload-zone] group upload failed:", err);
          failed.push(group);
        } finally {
          setUploadProgress(prev => ({ ...prev, current: prev.current + 1 }));
        }
      })
    );
  }

  // Persist only the failed groups back to IDB; successful ones are gone
  setGroups(failed);
  await saveGroups(failed);
  setIsUploading(false);

  if (failed.length === 0) {
    await clearAll();  // nothing left in staging
    toast({ title: "Products Created", description: `${groups.length} products ready.` });
  } else {
    toast({
      title: "Some uploads failed",
      description: `${failed.length} of ${groups.length} groups failed. Retry from the grid.`,
      variant: "destructive",
    });
  }
};
```

## State of the Art

| Old Approach (Phase 5 / 7) | New Approach (Phase 9) | Why Changed |
|----------------------------|------------------------|-------------|
| Three-card mode chooser on file drop | Immediate manual mode with AI as secondary button | User's north-star: "almost never use AI sort" |
| Global `PRESETS = [1..5]` + per-group `maxImages` +/- | No hard cap, soft warning badge at 20 | Users decide visually when to split |
| Staging-level `productContext` textarea | Per-product AI generation only, via Phase 6 SSE endpoints | Every product needs different generation |
| `clearAll()` before upload loop | Per-group `deleteBlob` on success only | Preserves user work on partial failure |
| Click toggles selection | Click / Shift-click / Cmd-click three-modifier model | Matches Finder / Gmail / industry standard |

**Deprecated code blocks (will be deleted):**
- `GroupingMode` type and `mode` state (upload-zone.tsx:268–269)
- `"choosing"` mode UI block (upload-zone.tsx:663–711)
- `PRESETS` constant and preset buttons toolbar (upload-zone.tsx:39, 791–808)
- `globalGroupSize` state and `setGlobalGroupSizeAndRechunk` (upload-zone.tsx:272, 509–519)
- Per-group `onAdjustMax` and `adjustGroupMax` (upload-zone.tsx:122, 132, 547–557, 180–199 UI)
- `productContext` / `brandTone` state + "Custom AI Prompt" panel (upload-zone.tsx:274–275, 943–973)
- `TONES` constant (upload-zone.tsx:31–37)
- `chunkArray` function (upload-zone.tsx:41–46) — only used by rechunking paths being removed
- Imports no longer needed: `MessageSquare`, `Mic`, `Textarea`, `Select*` components

## Open Questions

1. **What does "focused group" mean for Cmd+A select-all?**
   - What we know: there is currently no focus state per group.
   - What's unclear: hover vs. last-clicked vs. aria-focused.
   - Recommendation: last-clicked group (tracked via a `focusedGroupId` state set in `handleClick`). Cmd+A with no focused group falls back to select-all across all groups.

2. **Should the soft-warning threshold be configurable?**
   - Recommendation: start with a hardcoded `LARGE_GROUP_THRESHOLD = 20` constant at the top of upload-zone.tsx. Move to config only if a user complains.

3. **Retry UX for failed uploads — inline button vs. toast action?**
   - Recommendation: inline red "Retry" button in the group header of failed groups. Toasts are dismissible and get lost; persistent UI matches the "failed groups remain in grid" decision.

4. **Does removing `productContext` from staging break any existing functionality?**
   - What we know: the server reads it at routes.ts:1742 but defaults to `""`. The per-product AI endpoint (Phase 6) re-accepts its own context at generate time.
   - Verified safe to delete from staging UI.

## Sources

### Primary (HIGH confidence)
- `/Users/lefterisgilmaz/Desktop/lisai-app/client/src/components/upload-zone.tsx` — full read; line references throughout research
- `/Users/lefterisgilmaz/Desktop/lisai-app/client/src/hooks/use-staged-images.ts` — full read; IDB contract confirmed
- `/Users/lefterisgilmaz/Desktop/lisai-app/client/src/hooks/use-images.ts:149–196` — upload mutation signature verified
- `/Users/lefterisgilmaz/Desktop/lisai-app/shared/schema.ts` — full read; **no products table** confirmed
- `/Users/lefterisgilmaz/Desktop/lisai-app/server/routes.ts:1720–1855` — grouped-paid upload path confirmed
- `/Users/lefterisgilmaz/Desktop/lisai-app/client/src/pages/Home.tsx:385–395` — client-side `productGroupId` consolidation confirmed
- `/Users/lefterisgilmaz/Desktop/lisai-app/package.json:18–20` — dnd-kit versions confirmed
- `.planning/phases/09-manual-grouping-first-ux/09-CONTEXT.md` — all decisions read
- `.planning/STATE.md` — Phase 5/6/7/8 decisions list

### Secondary (MEDIUM confidence)
- [dnd-kit DragOverlay docs](https://docs.dndkit.com/api-documentation/draggable/drag-overlay) — dropAnimation behavior, conditional-rendering caveat (cross-verified with GitHub issues)
- [dnd-kit GitHub issues #317, #743](https://github.com/clauderic/dnd-kit/issues/317) — known gotchas with DragOverlay conditional rendering affecting dropAnimation

### Tertiary (LOW confidence)
- None. All claims are grounded in direct source-file reads or official dnd-kit docs.

## Project Constraints (from CLAUDE.md)

**None — `./CLAUDE.md` does not exist** in this repository, and no `.claude/skills/` or `.agents/skills/` directory was found. No project-specific directives override the research recommendations above.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified from package.json, used in existing code
- Architecture: HIGH — all patterns verified against existing upload-zone.tsx, dnd-kit docs, and proposed via code references
- Pitfalls: HIGH — pitfalls 1–5 identified from direct code read; pitfalls 6–7 are UX judgment calls, MEDIUM
- Promotion mechanics: HIGH — server endpoint already supports the full flow
- Schema decision (no products table): HIGH — verified by reading shared/schema.ts in full and grepping server/client for productGroupId usage

**Research date:** 2026-04-11
**Valid until:** 2026-05-11 (30 days — dnd-kit and project code are stable)
