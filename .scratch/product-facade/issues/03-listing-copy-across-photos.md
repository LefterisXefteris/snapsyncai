Status: ready-for-human
Blocked by: 01

# 03 — Listing copy belongs to the product, not the photo

Spec: `.scratch/product-facade/spec.md`.

Behaviour change: listing copy accepted from one photo of a grouped product is visible when the seller opens another photo of it.

## What

- First, a failing test: group photos A and B, accept listing copy on A, propose a listing copy refresh from B — today it refuses as missing listing copy.
- `Product.listing_copy` reads the first non-empty field across the product's photos for every caller of `load`.
- The payload outcomes in `schemas/image.py` (`mayRefreshListingCopy`, refresh blocked reason) read the same way, so the product page agrees with the gate.
- Push and Bulk SEO keep their per-photo reader (out of scope; note it here if they disagree in the live check).

## Done when

- The failing test passes; `uv run pytest` green.
- Live path: on a grouped product, accept listing copy from one photo, open the product from the other photo, and listing copy refresh starts. Human to run.

## Comments

- `listing_copy_propose.propose_refresh` reads `loaded.listing_copy` (across photos, addressed photo first). Accept and generate read no existing listing copy, so `propose_refresh` was the only caller left on the per-photo reader.
- `with_facts_outcomes` takes the product's `photos`; `GET /api/images` (grouped in memory from the rows it already has) and `GET /api/images/{id}/group` pass them. The product page reads the catalogue list and refetches it after every mutation.
- Kept per photo, on purpose: `listingCopyPresent` (Push and the Go live check read it; Push is out of scope), and the refresh outcomes on single-photo mutation responses (confirm, accept, PUT, ai). A grouped photo without its own copy can now show refresh allowed and "no listing copy" together; the live check should say whether that reads wrong.
- Payload facts stay the photo's own; confirm and grouping write one facts record to every photo of the product, so they match the merged facts the gate reads.
- Tests: `test_listing_copy_propose.py` accepts on one photo and proposes from the other (red first: "Generate listing copy before refreshing"); `test_listing_copy_refresh.py` checks the catalogue payload on a grouped product and a standalone one.
- 431 passed (429 before); ruff 25 repo-wide (baseline), none in these files.
- Live path not run: human to run.
