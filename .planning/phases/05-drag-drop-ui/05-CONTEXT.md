# Phase 5: Drag-and-Drop UI Improvements - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Improve the pre-upload image staging UI in `upload-zone.tsx`. Staged images must persist across page reloads (stored in IndexedDB), and drag-and-drop grouping must be easier to use. This phase covers the staging screen only — the post-upload product cards (image-card.tsx) and the upload API are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Persistence strategy
- Staged images are saved to **IndexedDB as file blobs** — actual binary data, not just metadata
- **Auto-restore silently** on page load — no restore prompt, just pick up where they left off
- Staged images auto-expire after **24 hours** if never uploaded
- **Group arrangements are saved too** — the full grouping (which images belong together and in what order) is persisted alongside the blobs, so the user's manual work is never lost

### Drag interaction UX
- **Whole group card is the drop target** — dragging onto anywhere on the card drops the image there (not just a narrow strip)
- **Multi-select drag** — users can click/tap to select multiple thumbnails, then drag the whole selection to another group at once
- Mobile/touch drag: Claude's discretion (pick best pattern for dnd-kit)
- Drag visual feedback: Claude's discretion (ghost + highlight or similar — just make intent clear)

### Group management
- **Splitting**: Drag image out to the "New group" drop zone (current behavior, keep it)
- **No manual naming** — AI generates the product name on upload, no label field per group
- **Hero image = first image** — reordering images within a group changes which is hero; first slot is always primary
- **Per-group max is adjustable** — each group card has a +/- control so users can set how many images belong to that product (default stays at current auto-chunk value)

### Claude's Discretion
- Mobile/touch drag implementation (dnd-kit touch backend vs tap-to-move)
- Drag ghost overlay and drop highlight styling
- IndexedDB key schema and blob serialization approach
- Expiry cleanup mechanism (check on mount vs background worker)

</decisions>

<specifics>
## Specific Ideas

- User's core complaint: images are lost on refresh — this is the #1 priority
- "Easy for the user" — minimize friction on grouping; big drop targets, obvious interactions

</specifics>

<deferred>
## Deferred Ideas

- Upload trigger flow changes (auto-upload vs manual button) — not selected for discussion, keep current behavior
- Post-upload product card improvements — separate phase

</deferred>

---

*Phase: 05-drag-drop-ui*
*Context gathered: 2026-04-02*
