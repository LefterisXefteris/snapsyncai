# Phase 9: Manual Grouping-First UX - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Transform the pre-upload staging flow from group-centric to product-centric. Users drag-drop images in IndexedDB (as today), organize them under "products", then promote those products to Supabase Postgres as product records (each product owns its selected images). The free-text prompt in the staging UI is removed — AI content generation (title, description, SEO, AEO) moves entirely to the existing per-product endpoint from Phase 6, because every product needs its own tailored generation.

Scope anchor: this phase is about making manual drag-and-drop so fast and frictionless that AI auto-sort becomes an optional fallback, not the default. AI auto-grouping (Phase 7/8) stays available but is no longer the primary path.

</domain>

<decisions>
## Implementation Decisions

### Locked upfront (from user framing)
- Remove the free-text prompt from the drag-and-drop staging UI — it is no longer needed at the staging level
- AI content generation (title, description, SEO tags, AEO tags) runs only inside the existing per-product endpoint (Phase 6), because every product needs different generation
- Staged groups get promoted to Supabase Postgres as product records; the product owns its selected images
- IndexedDB remains the staging layer for drag-and-drop before promotion

### Drag-drop friction cuts

**Bulk selection**
- Click + Shift/Cmd desktop pattern: click to select, Shift-click for range, Cmd/Ctrl-click to toggle individual thumbnails
- Selection persists across drag — a batch move carries everything selected

**Group sizing**
- Soft warning, no hard cap: show a visual hint when a group gets large (e.g., > ~20 images) but never block adds
- Remove the hard cap that the Phase 5 +/- controls enforced — users decide visually when to split

**Drag feedback**
- Snap-back animation on invalid drop: if thumbnails are dropped somewhere invalid, they animate back to their origin so the user isn't left wondering what happened

### Claude's Discretion
- **Creating new empty groups** — pick the smoothest pattern (e.g., always-visible "+ New group" card vs. drop-on-empty-canvas auto-create vs. explicit button). Choose based on what integrates cleanly with the existing Phase 5 grid.
- **Where ungrouped / newly uploaded images live** — dedicated tray, auto "Uncategorized" group, or loose one-image groups. Pick whichever makes the drag-to-product flow feel most natural.
- **Keyboard shortcuts** — user deferred to my judgment. Pair shortcuts with the drag-drop flow; at minimum Esc to clear selection and Cmd+A to select-all inside the focused group, more only if they clearly help.
- **Hero image selection** — user deferred. Simplest is "first thumbnail is hero, drag to reorder", which matches the Phase 5 convention; alternatives (star-on-hover, right-click menu) are allowed if they feel cleaner.
- In-card quick actions: only "Set hero image" was prioritized — do not invest in split/merge/remove quick actions unless trivially cheap.
- Visual drop-target highlighting and dim-non-targets were not requested — keep Phase 5's existing hover feedback, don't add more.

</decisions>

<specifics>
## Specific Ideas

- North-star goal stated by user: "make it so easy and efficient for the user that they would almost never use the AI sort." Every UX decision in this phase should be measured against that bar.
- The free-text prompt UI in the drag-drop zone gets deleted, not hidden — this is a permanent removal, not a feature flag.
- Per-product AI generation already exists from Phase 6 (`generate-content` / `regenerate-field` SSE endpoints) and should be reused as-is by the promoted products.

</specifics>

<deferred>
## Deferred Ideas

- **Staging → Supabase product promotion mechanics** — when promotion happens, per-group vs. batch, what happens to IndexedDB entries after, failure/retry UX. User opted not to discuss; downstream research/planning will need to surface the options and pick a default.
- **AI sort visibility as optional fallback** — whether AI auto-sort stays as a visible button, lives in a menu, or is hidden entirely. Roadmap says "optional fallback", but the exact surface was not discussed.
- **Product identity at creation time** — how a product gets an initial name/title before the detail endpoint fills it in (placeholder, filename-derived, user input). Not discussed.
- Split-group, merge-neighbor, and per-thumbnail remove quick actions — explicitly deprioritized in favor of "Set hero image" only.
- Richer drag visual feedback (cursor badge, dim non-targets, target highlight upgrades) — not requested.

</deferred>

---

*Phase: 09-manual-grouping-first-ux*
*Context gathered: 2026-04-11*
