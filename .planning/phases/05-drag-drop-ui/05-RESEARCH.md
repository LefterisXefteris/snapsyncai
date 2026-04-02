# Phase 5: Drag-and-Drop UI Improvements - Research

**Researched:** 2026-04-02
**Domain:** React drag-and-drop (dnd-kit), IndexedDB persistence, client-side staging UI
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Persistence strategy**
- Staged images are saved to IndexedDB as file blobs — actual binary data, not just metadata
- Auto-restore silently on page load — no restore prompt, just pick up where they left off
- Staged images auto-expire after 24 hours if never uploaded
- Group arrangements are saved too — the full grouping (which images belong together and in what order) is persisted alongside the blobs, so the user's manual work is never lost

**Drag interaction UX**
- Whole group card is the drop target — dragging onto anywhere on the card drops the image there (not just a narrow strip)
- Multi-select drag — users can click/tap to select multiple thumbnails, then drag the whole selection to another group at once

**Group management**
- Splitting: Drag image out to the "New group" drop zone (current behavior, keep it)
- No manual naming — AI generates the product name on upload, no label field per group
- Hero image = first image — reordering images within a group changes which is hero; first slot is always primary
- Per-group max is adjustable — each group card has a +/- control so users can set how many images belong to that product (default stays at current auto-chunk value)

### Claude's Discretion
- Mobile/touch drag implementation (dnd-kit touch backend vs tap-to-move)
- Drag ghost overlay and drop highlight styling
- IndexedDB key schema and blob serialization approach
- Expiry cleanup mechanism (check on mount vs background worker)

### Deferred Ideas (OUT OF SCOPE)
- Upload trigger flow changes (auto-upload vs manual button) — keep current behavior
- Post-upload product card improvements — separate phase
</user_constraints>

---

## Summary

Phase 5 modifies a single component (`upload-zone.tsx`) plus adds a new persistence hook. The current component uses `@dnd-kit/core` (v6.3.1) with `useDraggable` and `useDroppable` — the drag-to-group plumbing already exists and works. What is missing: (1) IndexedDB persistence for the staged blobs and group structure, (2) making the whole card the drop target rather than just the image strip, (3) multi-select thumbnail selection + batch drag, and (4) per-group max override controls.

No new libraries need to be installed. `@dnd-kit/core`, `@dnd-kit/sortable`, and `@dnd-kit/utilities` are already present. IndexedDB will be accessed via the native browser API directly — a thin custom hook is sufficient for this scope. The `idb` library (jakearchibald/idb, v8) is the best option if a wrapper is preferred, but it is NOT yet in package.json and must be installed; raw IndexedDB with async/await wrappers is equally valid and avoids a dependency.

**Primary recommendation:** Extract IndexedDB logic into `client/src/hooks/use-staged-images.ts`. Keep drag logic in `upload-zone.tsx`. Add multi-select state alongside existing `groups` state. No backend changes needed.

---

## Current State Analysis

### Component Architecture (upload-zone.tsx)

**State shape (current):**
```typescript
const [groups, setGroups] = useState<FileItem[][]>([]);
const [activeItem, setActiveItem] = useState<FileItem | null>(null);
const [groupSize, setGroupSize] = useState(1); // global auto-chunk size
```

**FileItem shape:**
```typescript
interface FileItem {
  id: string;    // crypto.randomUUID()
  file: File;    // actual File object — not persisted
  url: string;   // URL.createObjectURL() — revoked on unmount
}
```

**Key observations:**
- `groups` is a flat `FileItem[][]` — each outer array is a product group
- Groups are identified positionally (`group-${idx}`) — this is fragile for persistence (re-renders can shift indices)
- `handleDragEnd` looks up `over.id === "new-group"` OR `group-${idx}` — tightly coupled to index-based IDs
- `DroppableGroup` receives `setNodeRef` from `useDroppable({ id: groupId })` and applies it to the outer card `div` — the WHOLE card IS already the droppable ref node. The visual `isOver` highlight is on the card, not a strip. **The drop target is already the full card at the DOM level.**
- `chunkArray` is called on `prev.flat()` whenever groupSize changes — this destroys manual grouping. The per-group max feature must NOT call `chunkArray` globally.
- Object URLs are tracked in `urlsRef` and revoked on unmount only — memory leaks if items are individually removed mid-session (partial leak, not critical).

**What is broken/missing:**
1. No persistence — `File` objects live only in React state; refresh = lost work
2. No selection state for multi-select drag
3. Per-group max needs a separate `perGroupMax: number` field per group (not a global override of `groupSize`)
4. The global auto-chunk toolbar (1/2/3/4/5 preset buttons) calls `chunkArray` on the flat array — this must preserve manual per-group overrides post-implementation

### Drag System (dnd-kit)

**Currently used:**
- `@dnd-kit/core` v6.3.1 — `DndContext`, `DragOverlay`, `useDraggable`, `useDroppable`
- `@dnd-kit/sortable` v10.0.0 — imported in package.json but NOT used in upload-zone.tsx
- `@dnd-kit/utilities` v3.2.2 — also in package.json but not used in this component

**Drag flow:**
1. `handleDragStart` — sets `activeItem` from `groups.flat()`
2. `handleDragEnd` — moves item between groups based on `over.id`
3. `DragOverlay` — renders floating thumbnail of `activeItem`

**No collision detection algorithm is explicitly set** — dnd-kit defaults to `rectIntersection`. This is the default and suitable for the current card layout.

---

## Implementation Approach

### 1. IndexedDB Persistence

**No library in package.json for IDB.** Two valid options:

| Option | Install | Code weight | Recommendation |
|--------|---------|-------------|----------------|
| Raw IndexedDB + promise wrappers | None | ~60 lines | Use for this phase — simple enough |
| `idb` library (jakearchibald/idb v8) | `npm install idb` | ~1.2kB | Use if more complex queries needed |

**Decision (Claude's discretion):** Use the `idb` library — it eliminates verbose boilerplate and the one-time install cost is minimal. Install: `npm install idb`.

**DB schema:**
```
Database: "staged-images-db"  version: 1
Store: "blobs"     keyPath: "id"    — stores { id, blob, filename, mimeType, savedAt }
Store: "groups"    keyPath: "id"    — stores { id: "groups-v1", groups: GroupRecord[][], savedAt }
```

**GroupRecord shape (for persistence):**
```typescript
interface GroupRecord {
  id: string;        // stable UUID for the group (NOT positional index)
  itemIds: string[]; // ordered list of FileItem ids — first = hero
  maxImages: number; // per-group max (default = global groupSize at creation time)
}
```

**File blob record:**
```typescript
interface BlobRecord {
  id: string;        // matches FileItem.id
  blob: Blob;        // the actual binary
  filename: string;
  mimeType: string;
  savedAt: number;   // Date.now() — used for 24h expiry check
}
```

**Read/write pattern (idb v8):**
```typescript
// Source: https://github.com/jakearchibald/idb
import { openDB } from 'idb';

const db = await openDB('staged-images-db', 1, {
  upgrade(db) {
    db.createObjectStore('blobs', { keyPath: 'id' });
    db.createObjectStore('groups', { keyPath: 'id' });
  },
});

// Save blob
await db.put('blobs', { id, blob: file, filename: file.name, mimeType: file.type, savedAt: Date.now() });

// Load all blobs (and filter expired)
const allBlobs = await db.getAll('blobs');
const fresh = allBlobs.filter(b => Date.now() - b.savedAt < 24 * 60 * 60 * 1000);

// Save group layout
await db.put('groups', { id: 'groups-v1', groups: groupRecords, savedAt: Date.now() });

// Delete a single blob
await db.delete('blobs', id);

// Clean up expired
for (const b of allBlobs) {
  if (Date.now() - b.savedAt >= 24 * 60 * 60 * 1000) await db.delete('blobs', b.id);
}
```

**Restore on mount pattern:**
```typescript
useEffect(() => {
  async function restore() {
    const { blobs, groups } = await loadFromIDB(); // purge expired, return fresh
    if (blobs.length === 0) return;
    // reconstruct FileItem[] from blobs: create object URLs from stored blobs
    // reconstruct groups[][] from GroupRecord[][]
    setGroups(reconstructedGroups);
  }
  restore();
}, []); // runs once on mount
```

**24h expiry cleanup:** Run on mount inside the restore function — check all blob `savedAt` timestamps, delete expired ones. No background worker needed for this scope. This is sufficient: the user who abandoned staged images will purge them on next visit.

**Object URL lifecycle for restored blobs:**
- On restore: call `URL.createObjectURL(blobRecord.blob)` for each blob
- Add restored URLs to `urlsRef.current` for proper cleanup on unmount
- On individual item removal: revoke the URL and delete from IDB

### 2. Stable Group IDs

Current code uses `group-${idx}` positional IDs. This breaks on reorder. For persistence AND correct dnd-kit behavior after reorder, each group needs a stable UUID.

**Change required:**
```typescript
// Before: groups are FileItem[][]
// After: groups are Group[] where
interface Group {
  id: string;          // stable UUID
  items: FileItem[];
  maxImages: number;   // per-group override (default = current groupSize)
}
```

`handleDragEnd` changes to use `over.id` matching `group.id` instead of `group-${idx}`.

The `DroppableGroup` `groupId` prop changes from `group-${idx}` to `group.id`.

### 3. Multi-Select Drag

**dnd-kit does NOT support multi-select natively.** The maintainer confirmed this on record (GitHub issue #120, March 2021). The prescribed pattern is:

1. Maintain a `selectedIds: Set<string>` state in the parent component
2. Click on a thumbnail toggles its ID in `selectedIds`
3. When drag starts (`handleDragStart`), if `activeItem.id` is in `selectedIds`, the drag "represents" the entire selection
4. Pass `selectedIds` to `useDraggable`'s `data` prop: `useDraggable({ id: item.id, data: { selectedIds: [...selectedIds] } })`
5. In `handleDragEnd`, if `active.data.current.selectedIds.length > 1`, move ALL selected items to the target group (not just the active item)
6. After drag completes, clear `selectedIds`

**DragOverlay adjustment for multi-select:**
- Show count badge on the ghost: "3 images" instead of single thumbnail
- Or stack 2-3 thumbnails with slight rotation offset

**Click-to-select interaction:**
- Click on thumbnail (not on the X remove button) = toggle selection
- The drag `listeners` from `useDraggable` use `onPointerDown` — need to distinguish a tap/click (no movement) from a drag start
- Pattern: use `activationConstraint: { distance: 5 }` (already set on MouseSensor) — if pointer moves less than 5px it is a click, handle as selection toggle in `onClick`

**Touch multi-select (Claude's discretion recommendation):** Use tap-to-select (same click-to-toggle pattern) because the TouchSensor already has a delay of 200ms. Tap selects, long-press+drag drags selection.

### 4. Per-Group Max Control

**Current:** Global `groupSize` + preset buttons (1–5) + `setGroupSizeAndRechunk` which flattens ALL groups.

**Required change:** Each `Group` gets its own `maxImages: number`. The `+/-` buttons on the card only affect that group's `maxImages`.

**Behavior:**
- Per-group `+/-` does NOT rechunk any other group
- If a group currently has more items than the new `maxImages`, do NOT auto-split — just record the limit, enforce on new drops (prevent dropping into a full group, or auto-overflow to new group)
- The global preset buttons (1–5) remain as "arrange all" shortcuts — they still call `chunkArray` but also set the default `maxImages` for each resulting group

**UI:** Add `+` and `-` buttons in the group card header, next to the existing Split and Trash buttons. Show current `maxImages` between the buttons: `- [3] +`

### 5. Drop Target Fix

Reading the current code carefully: `DroppableGroup` already applies `setNodeRef` to the outermost card `div`. The entire card IS the drop target at the DOM level. However, the `isOver` highlight only illuminates the outer border — the images area itself does not provide obvious visual feedback that the whole card is droppable.

**What actually needs fixing:**
- The narrow-strip perception likely comes from the fact that the images are packed at the top of the card and the card has minimal empty space — users may not realize the card extends below
- Fix: Ensure `min-height` on the card body so there is always whitespace to drag onto
- Add a stronger `isOver` state: a full-card overlay highlight (not just border change) when hovering

**Collision detection:** The current default (`rectIntersection`) requires the dragged item's bounding box to intersect with the card's box. For small thumbnails being dragged over large cards this works fine. No algorithm change needed.

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| IndexedDB wrapper | Install `idb` v8 | Eliminates ~50 lines of promise boilerplate; tiny at 1.2kB brotli |
| Group data structure | Move from `FileItem[][]` to `Group[]` with stable UUID | Required for persistence and correct dnd-kit IDs after reorder |
| Multi-select implementation | `selectedIds: Set<string>` state + move all in `handleDragEnd` | Prescribed dnd-kit community pattern; no additional library needed |
| Expiry cleanup | On-mount inside restore hook | Sufficient for this use case; no background worker complexity |
| Per-group max storage | `maxImages` field on `Group` object | Allows independent override per card; global preset still works by setting all |
| Object URL management | Create on add/restore, revoke on remove/unmount | Existing `urlsRef` pattern extended to cover restore path |
| Touch multi-select | Tap-to-select (same as click) | Consistent behavior; TouchSensor delay already prevents accidental selection |

---

## State Shape After Phase

```typescript
// New Group type (replaces FileItem[][])
interface Group {
  id: string;          // stable UUID — used as dnd-kit droppable id
  items: FileItem[];   // ordered; items[0] = hero
  maxImages: number;   // per-group override
}

// UploadZone component state
const [groups, setGroups] = useState<Group[]>([]);
const [activeItem, setActiveItem] = useState<FileItem | null>(null);
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
const [globalGroupSize, setGlobalGroupSize] = useState(1); // for preset buttons only
```

---

## Files to Modify

| File | Change |
|------|--------|
| `client/src/components/upload-zone.tsx` | Main implementation: Group type, stable IDs, multi-select state, per-group max controls, restore-on-mount call, IDB write on every state change |
| `client/src/hooks/use-staged-images.ts` | **NEW FILE** — IndexedDB read/write/purge logic as a custom hook; called from upload-zone.tsx |
| `package.json` | Add `idb` dependency |

**No server changes. No database schema changes. No other client files.**

---

## Risks and Gotchas

### Risk 1: File blobs are NOT serializable with JSON.stringify
**What goes wrong:** If you accidentally try to persist `File` objects via `localStorage` or JSON, they become `{}`.
**How to avoid:** Always store the `File`/`Blob` directly in IndexedDB. Do not JSON-stringify blobs. Use `idb`'s `db.put()` which handles structured clone (blobs are structured-cloneable).
**Warning signs:** Restored items have zero-byte blobs or empty image URLs.

### Risk 2: Object URL lifecycle on restore
**What goes wrong:** On restore, `URL.createObjectURL(blob)` is called for each blob. If the component unmounts before the user uploads, these URLs must be revoked — but they won't be in `urlsRef` unless explicitly added during restore.
**How to avoid:** Add all restored URLs to `urlsRef.current` immediately after creation. The existing unmount cleanup (`urlsRef.current.forEach(URL.revokeObjectURL)`) will then handle them.

### Risk 3: IDB write on every drag (performance)
**What goes wrong:** Calling `db.put('groups', ...)` on every `handleDragEnd` is fine. Calling it on every `handleDragOver` (position mid-drag) would be disastrous.
**How to avoid:** Only persist in `handleDragEnd` and when items are added/removed. Not during drag.

### Risk 4: IndexedDB storage quota
**What goes wrong:** IndexedDB has a per-origin storage quota (varies by browser, typically 50–80% of available disk). Large images (10MB+ RAW photos) staged in bulk could approach limits.
**How to avoid:** The existing 200-image cap helps. Add a quota check on restore: if `navigator.storage.estimate()` shows > 80% used, warn the user. This is a future improvement; not required for phase success.

### Risk 5: Multi-select drag and the DragOverlay
**What goes wrong:** `DragOverlay` currently renders based on `activeItem`. If 5 items are selected and one is dragged, the overlay shows only 1 thumbnail — misleading.
**How to avoid:** Check `selectedIds.size > 1` in the DragOverlay render; show a stacked/badge variant. This is a UX polish concern, not a functional blocker.

### Risk 6: Stable Group IDs vs existing group-idx pattern
**What goes wrong:** After switching to stable UUIDs for groups, the `handleDragEnd` check `next.findIndex((_, idx) => 'group-${idx}' === over.id)` breaks completely.
**How to avoid:** This is the exact line that needs rewriting. New logic: `next.findIndex(g => g.id === over.id)`. The `DroppableGroup` must pass `groupId={group.id}` not `group-${idx}`. This is a one-time coordinated change.

### Risk 7: IDB not available in private/incognito mode (some older browsers)
**What goes wrong:** `openDB` throws in Safari private mode (older versions). In Chrome incognito, IDB is available but quota is 0.
**How to avoid:** Wrap the entire IDB hook in try/catch. On failure, silently skip persistence (fall through to in-memory only). Log a console warning. Do not block the UI.

### Risk 8: chunkArray on flat() wipes per-group maxImages
**What goes wrong:** Current `setGroupSizeAndRechunk` calls `chunkArray(prev.flat(), clamped)` which creates new `FileItem[][]` arrays with no `maxImages` preserved.
**How to avoid:** After migrating to `Group[]`, the global preset buttons must create new `Group` objects with the new global size as `maxImages`, not blindly rechunk. Each new chunk group gets `maxImages = globalGroupSize` and a fresh UUID.

---

## Standard Stack

### Already in package.json (no install needed)
| Library | Version | Purpose |
|---------|---------|---------|
| `@dnd-kit/core` | ^6.3.1 | DndContext, useDraggable, useDroppable, DragOverlay |
| `@dnd-kit/sortable` | ^10.0.0 | Available but not needed for this phase |
| `@dnd-kit/utilities` | ^3.2.2 | CSS utilities for transforms (not needed for this phase) |
| `react-dropzone` | ^15.0.0 | File drop zone (keep as-is) |

### Must install
| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `idb` | ^8.0.0 | IndexedDB promise wrapper | Eliminates verbose IDBRequest boilerplate; jakearchibald's library, widely used |

```bash
npm install idb
```

---

## Architecture Patterns

### Recommended File Structure Addition
```
client/src/
├── components/
│   └── upload-zone.tsx     # Modify: Group type, multi-select, per-group max, restore call
└── hooks/
    └── use-staged-images.ts  # NEW: IDB read/write/purge hook
```

### Pattern: use-staged-images Hook Interface
```typescript
// client/src/hooks/use-staged-images.ts
interface StagingHook {
  loadStaged: () => Promise<{ groups: Group[]; blobMap: Map<string, string> }>;
  saveBlob: (id: string, blob: Blob, filename: string, mimeType: string) => Promise<void>;
  deleteBlob: (id: string) => Promise<void>;
  saveGroups: (groups: Group[]) => Promise<void>;
  clearAll: () => Promise<void>;
}
```

### Pattern: Multi-Select in DraggableThumbnail
```typescript
// Pass selectedIds and onSelect down to DraggableThumbnail
function DraggableThumbnail({ item, onRemove, isHero, isSelected, onSelect }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: { selectedIds: [...selectedIds] }, // passed from parent
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "...",
        isSelected && "ring-2 ring-primary ring-offset-1"
      )}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(item.id);
      }}
    >
      ...
    </div>
  );
}
```

### Pattern: handleDragEnd with multi-select
```typescript
const handleDragEnd = ({ active, over }: DragEndEvent) => {
  setActiveItem(null);
  if (!over) { setSelectedIds(new Set()); return; }

  // Collect IDs to move: if active is in selection, move all selected; else move just active
  const draggedIds: string[] = selectedIds.has(active.id as string) && selectedIds.size > 1
    ? [...selectedIds]
    : [active.id as string];

  setGroups(prev => {
    const next = prev.map(g => ({ ...g, items: [...g.items] }));

    if (over.id === "new-group") {
      const toMove: FileItem[] = [];
      for (const g of next) {
        const moved = g.items.filter(i => draggedIds.includes(i.id));
        g.items = g.items.filter(i => !draggedIds.includes(i.id));
        toMove.push(...moved);
      }
      next.push({ id: crypto.randomUUID(), items: toMove, maxImages: globalGroupSize });
    } else {
      const toGroup = next.find(g => g.id === over.id);
      if (!toGroup) return prev;
      const toMove: FileItem[] = [];
      for (const g of next) {
        if (g.id === over.id) continue;
        const moved = g.items.filter(i => draggedIds.includes(i.id));
        g.items = g.items.filter(i => !draggedIds.includes(i.id));
        toMove.push(...moved);
      }
      toGroup.items = [...toGroup.items, ...toMove];
    }

    return next.filter(g => g.items.length > 0);
  });

  setSelectedIds(new Set());
};
```

---

## Validation Architecture

Config does not set `workflow.nyquist_validation: false`, so this section is included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected — no test config files found in project |
| Config file | None |
| Quick run command | N/A — no test runner installed |
| Full suite command | N/A |

### Phase Requirements — Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SC-1 | Staged images survive page refresh | manual | Open app, add images, refresh, verify groups restored | N/A |
| SC-2 | Blobs stored in IndexedDB, expire after 24h | manual | Open DevTools > Application > IndexedDB, verify records + savedAt timestamps | N/A |
| SC-3 | Entire group card is drop target | manual | Drag thumbnail to empty space inside card — should accept | N/A |
| SC-4 | Multi-select thumbnails drag as batch | manual | Click 3 thumbnails, drag one — all 3 should move | N/A |
| SC-5 | First image in group is hero | manual | Drag image to first position, verify hero slot updates | N/A |
| SC-6 | Per-group +/- control adjusts max | manual | Click +/- on a card, verify maxImages label changes | N/A |

### Wave 0 Gaps
No test infrastructure exists. All phase verification is manual for this phase.

None — no automated test framework to set up. Verification is via browser DevTools and visual inspection.

---

## Environment Availability

Step 2.6: All dependencies are browser-native (IndexedDB) or npm packages. No external services required. SKIPPED beyond npm install.

| Dependency | Required By | Available | Notes |
|------------|------------|-----------|-------|
| `idb` npm package | IndexedDB persistence | Not installed | Add via `npm install idb` |
| IndexedDB browser API | Blob storage | Available in all target browsers | Safari private mode partial exception (handle with try/catch) |
| `@dnd-kit/core` | Drag and drop | Installed v6.3.1 | |

---

## Open Questions

1. **Should the global preset buttons (1–5) override per-group maxImages or preserve them?**
   - What we know: Current `setGroupSizeAndRechunk` flattens and rechunks everything
   - What's unclear: After per-group overrides exist, should pressing "3" reset all groups to max=3 or just rechunk without touching per-group overrides?
   - Recommendation: Pressing a global preset should rechunk AND set all group maxImages to the preset value — it is explicitly an "auto-arrange all" action. Document this in UI hint text.

2. **What happens if a user drops an image onto a group that is already at its maxImages limit?**
   - What we know: Currently there is no enforcement — you can add unlimited items to a group
   - Recommendation: Accept the drop but increment maxImages by 1 automatically (generous overflow), or cap the drop and show a toast. The generous approach reduces friction.

3. **idb version — confirm current**
   - Training data says v8. Could not run `npm view idb version` in this environment.
   - Recommendation: Planner should run `npm view idb version` and use the result. The idb@8 API shown above is current as of August 2025.

---

## Sources

### Primary (HIGH confidence)
- `client/src/components/upload-zone.tsx` — direct code read, line-by-line analysis
- `package.json` — direct read for installed versions
- `.planning/phases/05-drag-drop-ui/05-CONTEXT.md` — locked decisions
- https://dndkit.com/api-documentation/droppable — useDroppable API
- https://dndkit.com/api-documentation/context-provider/collision-detection-algorithms — collision detection
- https://github.com/jakearchibald/idb — idb library API (v8)

### Secondary (MEDIUM confidence)
- https://github.com/clauderic/dnd-kit/issues/120 — maintainer confirmation: no built-in multi-select
- https://github.com/clauderic/dnd-kit/discussions/1313 — community multi-drag patterns
- MDN Web Docs IndexedDB — blob storage fundamentals

### Tertiary (LOW confidence)
- WebSearch results for dnd-kit multi-select patterns — cross-referenced with primary sources

---

## Metadata

**Confidence breakdown:**
- Current state analysis: HIGH — direct code read
- IndexedDB approach: HIGH — verified against idb official docs + MDN
- dnd-kit multi-select pattern: HIGH — verified with maintainer's own statement (no built-in support, build on top)
- Drop target behavior: HIGH — useDroppable API confirmed, code confirms ref is already on outer div
- Per-group max design: MEDIUM — design decision, no external source needed, verified against current code logic

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (dnd-kit stable, idb stable)
