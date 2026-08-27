# 01 — Click to assemble draft products in the New listing inspector

**Parent:** `.scratch/new-listing-light-table/spec.md`

**What to build:** Replace the New listing card-per-photo Tetris with a product inspector (left rail of drafts, large photo, filmstrip). Sellers dump photos (Choose photos; drop is a shortcut), multi-select, and assemble draft products with Group (extract), Add to… (chooser), and Separate. Click sets the thumbnail. Confirm is Create N products and creates every draft on the canvas. Drag may remain as a shortcut; it must not be the only path. Product details is out of scope.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [x] New listing is a product inspector (draft rail + large photo + filmstrip), not one card per 1-photo draft and not a light-table grid
- [x] Choose photos still stages files; each file is its own draft product; drag-in is optional
- [x] Multi-select + Group (2+ photos) extracts those photos into a new draft; leftovers stay; empty drafts go away
- [x] Add to… opens a chooser of other drafts identified by photos (no naming); selection moves onto the chosen draft
- [x] Separate turns the selection into its own draft, including a single photo (peel, not delete)
- [x] Click → set as thumbnail; no move-up/down slot UI
- [x] Split, Delete photo (discard), and Delete draft still work
- [x] Confirm is labeled Create N products; N is every draft on the canvas; 1-photo drafts are included
- [x] Copy does not tell the seller to “drag to regroup” as the only method, and does not call grouping “variants”
- [x] Product details gallery/library is unchanged
- [x] Tests cover Group extract leftovers, Add to… destination, Separate peel, and Confirm count

## Comments

Prototype (throwaway, in-memory stub) captured on branch `prototype/new-listing-ui` (`/new?variant=A|B|C`).

**Verdict:** C — Product inspector. Question settled: New listing should inspect one draft product at a time (rail + large photo + filmstrip), not a toolbar light table (A) or cluster islands + dock (B). Rewrite against real staging; do not merge that branch as production.
