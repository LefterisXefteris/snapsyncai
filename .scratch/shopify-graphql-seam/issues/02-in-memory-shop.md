Status: done
Blocked by: 01

# 02 — In-memory shop pins Push behaviour

Spec: `.scratch/shopify-graphql-seam/spec.md`.

## What

- `tests/shopify_shop.py`: a stateful shop answering the operations Push uses (publications list, product publishing, product set, product media, publish, unpublish, locations, set available stock). Unknown operations raise.
- Rewrite `test_go_live.py` and the push tests in `test_shopify_publications.py` against it, still through HTTP, on the `db` fixture with seeded rows instead of `store.*` patches and the hand-built session.
- Assertions read shop state (status, publications, stock per item and location), not query strings.

## Done when

- Every ADR 0023 case still has a test, and they pass unchanged against the current route.
- `uv run pytest` green.

## Comments

- `tests/shopify_shop.py`: `ShopifyShop` is the transport. It picks the operation by GraphQL operation name and answers `SnapSyncPublications`, `SnapSyncProductPublishing`, `CreateSnapSyncProduct` (productSet create/update; an unknown `id` is a userError), `AddSnapSyncProductMedia`, `SnapSyncPublish`, `SnapSyncUnpublish`, `InventoryLocations` and `SetStorefrontAvailable` (an unknown location is a userError). Any other operation raises. State: `products` (status, variants, publications, media), `publications`, `locations` (active only), and `available[(inventory item, location)]`. `new_products_published_on` stands in for a shop that publishes new products somewhere by default.
- `conftest.py` `push` fixture: POSTs `/api/images/push-to-shopify` through `httpx.ASGITransport` on the `db` session, as `seed.SELLER`, with `get_settings`, `current_user_id` and `get_shopify_graphql_for` overridden. It uses ASGITransport instead of TestClient so the request runs on the `db` fixture's event loop. `seed.shop` now passes `**values` through, e.g. `granted_scopes`.
- `test_go_live.py` (all 21 ADR 0023 cases) and the four push tests in `test_shopify_publications.py` go through HTTP and assert on shop state and the stored row. The failure cases come from the shop's state, not flags: a failed write is a stored product id the shop no longer has, and a failed stock write is an Inventory location the shop no longer has. The Inventory location and ledger tests seed `InventorySettings`. No app code changed.
- `test_website_handoff` still patches `list_shopify_product_image_urls`, because `website_handoff` builds its transport with `shopify_graphql_for` directly and there is no dependency to override.
- 400 passed; ruff 14 (baseline).
