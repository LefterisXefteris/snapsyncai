Status: done
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

- `tests/conftest.py`: `seller_app` (the app as `SELLER` on `db`) with `api` (POST any path) and `push_route` built on it. The generate missing-photo test uses `api` too, closing 01's shared-fixture follow-up.
- `tests/test_confirm_route.py`: confirm 200 / 400 / 404.
- `tests/test_listing_copy_refresh.py`: the two faked HTTP tests are replaced by propose 200 / 409 / 502 / 404 and accept 200 / 409 / 403 / 404. `overflow_confirm` shares 403 with `plan_blocked` and has no HTTP test; regenerate shares the propose mapping and has none either.
- Each non-200 test was checked to fail when its status in `routers/images.py` changes.
- The pure tests in `test_listing_copy_refresh.py` are not HTTP tests and stay.
- 429 passed (420 before); ruff 25 repo-wide, same before and after, none in these files.
