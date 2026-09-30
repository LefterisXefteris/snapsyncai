# One Product module: load, confirm, and the Shop GPSR sweep

## Why

"This product's facts across its photos, its Shop GPSR identity, and its listing copy" is loaded in five places, and they disagree. `listing_copy_accept.product_facts_for` falls back to the photo's own facts when the group is empty and keeps Shop GPSR only when it is a dict; `ai._facts_for_product` / `ai._shop_gpsr`, the confirm route in `routers/images.py`, `_sync_product_facts` in the same router, `listing_copy_propose._shop_gpsr`, and `_stale_shop_default_products` in `routers/connections.py` each skip one or both. Confirm's IO lives in the router and has no HTTP test. Refresh HTTP tests patch `store.get_image`, `store.get_image_group` and `connections.get_shopify` because there is no single load.

Listing copy is also read two ways: confirm reads the first non-empty field across the product's photos (`images.listing_copy_from_images`); refresh, propose, Push and the payload read the addressed photo only (`listing_copy_refresh.listing_copy_from_image`). Accept writes to the addressed photo only. On a grouped product, copy accepted from photo A is invisible to a refresh opened from photo B.

ADR 0007 stands: the rules stay in `product_facts.py`. This adds the IO around them.

## Decisions

- **Module**: `app/services/product.py`, a Facade over the product's photos. `product_facts.py` stays pure and keeps its tests.
- **`Product`** (frozen): `photo` (the addressed photo), `photos`, `facts`, `shop_gpsr`, `listing_copy`. Named after the glossary term; no new term in `CONTEXT.md`. `shop_gpsr(session, user_id)` is also public for Bulk SEO, which has no single product.
- **Interface**:
  - `load(session, user_id, product_id) -> Product | None`. Group fallback to the photo's own facts; Shop GPSR kept only when it is a dict (Accept's behaviour, adopted everywhere).
  - `confirm(session, user_id, product_id, **confirmation) -> Confirmed`. `Confirmed` is frozen: `product`, `shop_gpsr`, or `refused` in `not_found` / `invalid` plus `message`. Never an HTTP response.
  - `sync_facts_after_grouping(session, user_id, product_id)`, replacing `_sync_product_facts`.
  - `stale_shop_default_products(session, user_id)`, moved out of the `connections` router.
- **Callers**: first generate and regenerate (`routers/ai.py`), confirm and group assign (`routers/images.py`), accept (`listing_copy_accept.py`), propose (`listing_copy_propose.py`), Shop GPSR save (`routers/connections.py`).
- **Deleted**: `listing_copy_accept.product_facts_for`, `ai._facts_for_product`, `ai._shop_gpsr`, `listing_copy_propose._shop_gpsr`, `images._sync_product_facts`, `connections._stale_shop_default_products`.
- **Listing copy across photos**: `Product.listing_copy` is the first non-empty field across the product's photos. Changed in its own slice (03), not inside the move.
- **Tests**: the real `db` fixture with `tests/seed.py` rows. No test patches `store` or `connections.get_shopify` for these paths.

## Out of scope

Push and Bulk SEO reading listing copy per photo (Push is `.scratch/shopify-graphql-seam`; Bulk SEO is a later refresh-job deepening). First generate as its own module. The SPA.

## Slices

01 module and callers → 02 HTTP tests shrink → 03 listing copy across photos. Each ends with `uv run pytest` green. Starts after `.scratch/shopify-graphql-seam` is committed; slice 01 touches the same files. Live path on a grouped product before 03 ships.
