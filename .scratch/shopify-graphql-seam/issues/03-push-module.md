Status: done
Blocked by: 02

# 03 — Push module owns the Go live sequence

Spec: `.scratch/shopify-graphql-seam/spec.md`.

## What

- `app/services/push.py`: listing-copy gate, publications and price gate, group and gallery order, read-before-write, write, first-landing stock, Inventory registration, sync fields. Returns a refusal or the results with `stock_not_set`.
- `push_to_shopify` route shrinks to parsing, connection lookup, ownership, and mapping outcomes to 400 / 402 / 503 / 500.
- ADR 0023 rule tests call the Push module directly. HTTP keeps one test per outcome mapping and ownership filtering.

## Done when

- `uv run pytest` green; no behaviour change.
- Live path: Go live on a test shop lands Active on the Online Store with the page stock, and a later Sync leaves stock alone.

## Comments

- `app/services/push.py`: `push_products(session, settings, graphql, user_id, images, *, granted_scopes, product_status=None, publication_ids=None) -> Pushed`. `images` are the seller's own products; `product_status` / `publication_ids` are the body's, and default per product to the stored ones. `Pushed` is frozen: `success`, `failed`, `results`, `stock_not_set`, or `refused` in `missing_copy` (with `missing_copy_count`) / `missing_price` / `reconnect` plus `message`. The Go live helpers moved here unchanged, except the price gate now returns a bool instead of a `JSONResponse`. Database errors still raise.
- `push_to_shopify` keeps the empty-ids 400, the connection lookup (not connected 400), building the transport, the ownership filter (no images 400), and maps `missing_copy` to 402 `{message, missingCopyCount}`, `missing_price` and `reconnect` to 400 `{message}`, and exceptions to 503 / 500 as before. Bodies are the same strings and keys.
- Tests: the `push` fixture now calls the Push module on `db`. The old HTTP fixture is `push_route`. `test_go_live.py` (21) and the four push tests in `test_shopify_publications.py` call the module. `test_push_route.py` (9) has one HTTP test per outcome: 200 body, 402, price 400, reconnect 400, empty ids 400, not connected 400, 503, 500, plus ownership filtering. The 503 and 500 cases make `store.list_images` raise, because the Push module turns every Shopify error into a per-product result.
- The three Go live log lines now log under `app.services.push`, not `app.routers.images`.
- 409 passed; ruff 14 (baseline). `app.main` imports.
- Live path still pending, and it's the human's to run: Go live on a test shop should land Active on the Online Store with the page stock, and a later Sync should leave stock alone.
