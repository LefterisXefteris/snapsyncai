# 02 — Replace the inspector with a light table and selection dock

**Parent:** `.scratch/new-listing-light-table/spec.md`

**What to build:** Replace the New listing inspector (rail + large photo + filmstrip) with prototype B: an equal photo grid (the dump) and a bottom dock that holds the selection and the verbs (Group, Add to…, Separate, thumbnail, Create N products). Choose photos still stages each file as its own draft product. Select photos in the grid; they collect in the dock; Group extracts them into one draft. Product details is out of scope.

**Blocked by:** None — grouping rules already live in `client/src/lib/draft-products.ts`.

**Status:** resolved

- [x] New listing is an equal photo grid plus a selection dock, not an inspector and not one card per 1-photo draft
- [x] Selected photos collect in the dock; Group / Add to… / Separate / Create N products live on the dock
- [x] Choose photos still stages files; each file is its own draft product; a 10-file pick is 10 drafts until Group
- [x] Multi-select + Group (2+ photos) extracts those photos into a new draft; leftovers stay; empty drafts go away
- [x] Add to… is a chooser of other drafts identified by photos
- [x] Separate peels the selection into its own draft, including a single photo
- [x] Thumbnail can be set without drag
- [x] Split, Delete photo, and Delete draft still work
- [x] Confirm is labeled Create N products; N is every draft on the canvas
- [x] Copy does not say drag-to-regroup as the only method, and does not call grouping variants
- [x] Product details gallery/library is unchanged
- [x] Existing draft-products tests still pass; add coverage only if dock/grid copy or confirm-count-after-delete is still missing

## Comments

Light-table prototype captured on branch `prototype/new-listing-light-table-dock` (`/new?variant=A|B|C`).

**Verdict:** B — Grid + selection dock. Question settled: New listing shows the whole roll as equal cells; selection collects in a dock; Group assigns those photos to one product. Rejected A (toolbar-only) and C (working-set tray). The earlier inspector (`prototype/new-listing-ui` C, shipped on this branch) is the wrong canvas for dump-then-assemble.

## Answer

New listing is a light table: every staged photo is an equal grid cell; the selection collects in a bottom dock with Group, Add to…, Separate, Thumbnail, and Create N products. Choose photos still stages each file as its own draft. Grouping still runs through `draft-products.ts` (extract / add / separate / thumbnail). Split, Delete photo, and Delete draft remain on the dock/cells. Product details is unchanged. The inspector canvas is gone.
