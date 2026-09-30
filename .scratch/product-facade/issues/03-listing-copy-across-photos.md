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
