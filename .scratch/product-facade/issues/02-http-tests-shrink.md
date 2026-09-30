Status: ready-for-agent
Blocked by: 01

# 02 — Confirm and refresh HTTP tests test the mapping only

Spec: `.scratch/product-facade/spec.md`.

## What

- Rules already covered in `tests/test_product.py` and `test_listing_copy_propose.py` leave the HTTP tests.
- HTTP keeps one test per outcome: confirm 200 / 400 / 404; refresh propose and accept per status they map.
- HTTP tests run on `db` with `seed` rows. Model and search demand stay the only fakes.

## Done when

- `uv run pytest` green.
- No test in `test_listing_copy_refresh.py` or the confirm tests patches `store.get_image`, `store.get_image_group`, or `connections.get_shopify`.

## Comments
