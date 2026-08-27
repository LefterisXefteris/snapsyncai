**Status:** ready-for-agent

# New listing light table

## Problem Statement

When I dump a camera roll into New listing, every photo becomes its own draft product and the only way to put several photos on one product is drag-and-drop between cards. File intake already has Choose photos; regrouping does not. A 12-garment, 4-angle dump is 48 cards and a Tetris session. That is the New listing job, not Product details.

## Solution

New listing is a **product inspector**: a left rail of draft products, one large photo, and a filmstrip. Each file is already a draft product. I multi-select, then **Group** (extract those photos into a new draft), **Add to…** (chooser of other drafts, identified by photos), or **Separate** (selection becomes its own draft). I click to set the thumbnail. Confirm is labeled **Create N products** and creates every draft still on the canvas. Delete is how I exclude junk. Drag may remain as a shortcut; it is never the only path.

Visual source: prototype variant C on branch `prototype/new-listing-ui`.

Out of v1: vision auto-group, Product details reorder, camera, naming drafts, variants, a two-pane pool, click-to-order every gallery slot, an undo stack.

## User Stories

1. As a seller, I want to choose photos with a button, so that I can start New listing without dragging files in.
2. As a seller who dumps many photos, I want them on a light table rather than one card per photo, so that I can see the roll I just added.
3. As a seller, I want each photo to start as its own draft product, so that a one-shot garment is a product without an extra “make product” click.
4. As a seller, I want to multi-select photos and Group them as one product, so that several angles become one draft without dragging.
5. As a seller who Groups, I want only the selected photos to become the new draft, so that unselected photos on those drafts stay put.
6. As a seller who forgot a label shot, I want Add to… a chosen draft, so that I can put one stray onto an existing cluster without selecting every thumb in it.
7. As a seller picking Add to…, I want drafts identified by their photos, so that I am not naming products before listing copy.
8. As a seller who grouped the wrong photo, I want Separate, so that a selection becomes its own draft without deleting it or exploding the whole cluster.
9. As a seller, I want click → set as thumbnail, so that hero is not drag-only.
10. As a seller, I want Split, Delete photo, and Delete draft to keep working, so that explode-all and discard still exist.
11. As a seller, I want Confirm to say how many products it will create, so that I cannot silently create 187 listings.
12. As a seller, I want Confirm to create every draft still on the canvas, so that leftover one-photo drafts are products, not orphans.
13. As a seller, I want grouping to mean several photos of one product, so that a red dress and a blue dress stay two products.
14. As a seller, I want New listing copy not to say upload or variants, so that the canvas matches the glossary.
15. As a seller, I want Product details media reorder left alone, so that this change does not become a second-screen redesign.
16. As a seller, I want no vision auto-group, so that a wrong merge cannot silently join two garments.
17. As a seller who Groups by mistake, I want to fix it with Separate, Add, or Split, so that I do not need an undo history.
18. As a future agent, I want draft product and extract-grouping preserved, so that a later “photo pile” redesign cannot land as an obvious fix.

## Implementation Decisions

- Scope is New listing (`UploadZone` / `/new`) only. Product details gallery and library assign are out.
- Staging stays IndexedDB draft products (`useStagedImages`). Do not introduce a photo-pool model.
- Group (2+ photos) extracts into a new draft. Add to… moves selection onto a chosen existing draft. Separate peels selection into a new draft (including 1 photo). X still discards the photo.
- Thumbnail is click-to-set. Other gallery order is not a click UI on this screen; optional drag inside a cluster may remain.
- Confirm label is Create N products; N is the number of drafts on the canvas.
- Drag may stay as a shortcut for add/reorder. Every v1 verb above must work without it.
- Copy uses New listing, photo, draft product, product. Avoid upload, variants (for grouping), “drag to regroup” as the only instruction.
- ADR 0008. Glossary: Draft product, Variant, New listing.

## Testing Decisions

- Group extract leaves unselected photos on their original drafts; empty drafts disappear.
- Add to… moves selection onto the chosen draft and does not rename or replace it.
- Separate of one photo from a cluster yields a 1-photo draft; the source keeps the rest.
- Confirm copy includes the draft count; deleting a draft changes that count.
- One-photo drafts are included in Confirm without an extra gate.
- Grouping does not create variants or listing copy.
- File intake still works via Choose photos with drag as optional.
