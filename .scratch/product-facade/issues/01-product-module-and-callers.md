Status: done
Blocked by: `.scratch/shopify-graphql-seam` committed

# 01 — Product module, and every caller loads through it

Spec: `.scratch/product-facade/spec.md`.

## What

- `app/services/product.py` with `Product`, `load`, `confirm` / `Confirmed`, `sync_facts_after_grouping`, `stale_shop_default_products`.
- `load` takes group fallback and dict-only Shop GPSR from `listing_copy_accept.product_facts_for`. `Product.listing_copy` keeps each caller's current reader for now (confirm and the sweep: across photos; accept, propose, generate: the addressed photo) — the switch is 03.
- Callers move: `routers/ai.py` generate and regenerate, `routers/images.py` confirm and both group-assign routes, `listing_copy_accept.py`, `listing_copy_propose.py`, `routers/connections.py` Shop GPSR save.
- Confirm route shrinks to body mapping and `not_found` → 404, `invalid` → 400 with the same `detail` strings.
- Delete the helpers listed in the spec.
- New `tests/test_product.py` on `db`: `load` for a standalone photo, a group, an empty group, no connection, a non-dict Shop GPSR; `confirm` ok / invalid / not found / other seller's product; the sweep stales only shop-default products.

## Done when

- `uv run pytest` green; HTTP bodies and status codes unchanged.
- No `merge_product_facts(` call outside `product_facts.py` and `product.py`.

## Comments

- `app/services/product.py`: `load(session, user_id, product_id) -> Product | None`, `confirm(session, user_id, product_id, *, is_textile, composition, gpsr_choice, gpsr_identity, care_choice, care) -> Confirmed`, `sync_facts_after_grouping`, `stale_shop_default_products`, and `shop_gpsr(session, user_id)`. `Product` also carries `photo` (the addressed photo: generate needs its bytes, mime, title, category). `shop_gpsr` is public because Bulk SEO propose and regenerate need it without one product.
- `Product.listing_copy` reads across photos (confirm's reader). Accept, propose and generate still read `loaded.photo` themselves; don't use `Product.listing_copy` in a new caller until 03.
- `Confirmed.product` is the updated photo row, mirroring `Accepted.product`. Not found keeps the detail `"Image not found"` (`PHOTO_NOT_FOUND`); invalid keeps `confirm_facts`' error.
- Deleted: `listing_copy_accept.product_facts_for`, `ai._facts_for_product`, `ai._shop_gpsr`, `ai._owned` (orphaned), `listing_copy_propose._shop_gpsr`, `images._sync_product_facts`, `connections._stale_shop_default_products`.
- Behaviour: generate, regenerate and confirm now drop a Shop GPSR identity that is not a dict (agreed). Generate reads the Shopify connection before the photo-bytes check; only visible if the database fails.
- Tests: `tests/test_product.py` (10) on `db`. No empty-group test: `get_image_group` only returns `[]` when `get_image` already returned None, so the fallback is unreachable through the database. The generate missing-photo test moved onto `db` because it ran on a `None` session and the module now reads the connection first; it still fakes `load_image_bytes`.
- 420 passed (410 before); ruff 14 (baseline).
- Review follow-ups, not done: a shared `db`-backed app fixture (third copy of the setup now in `test_generate_content.py`); the sweep regroups photos itself instead of calling `load` (saves one query per product).
