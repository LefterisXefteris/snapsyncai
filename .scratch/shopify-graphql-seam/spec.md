# Push behind one Shopify GraphQL transport

## Why

The Go live rules (ADR 0023) live inside the `push_to_shopify` route in `api-py/app/routers/images.py`, and the only way to test them is HTTP plus patching `shopify_graphql` in both `app.services.shopify` and `app.services.inventory.shopify_ops`. Behaviour does not change; ADR 0023 stands as written. This is a Shopify GraphQL transport, not a Channel interface, so ADR 0013 stands too.

## Decisions

- **Transport**: a callable `ShopifyGraphQL = (query, variables) -> data`, built once from the connection and settings. Every function in `shopify.py`, `inventory/shopify_ops.py` and `shopify_import.py` takes it instead of `(connection, settings)`. Granted scopes are passed explicitly, not carried by the transport.
- **Route wiring**: a FastAPI dependency turns connection + settings into the transport. HTTP tests override it with `app.dependency_overrides`; no test patches Shopify.
- **Push module** (`app/services/push.py`): owns the listing-copy gate, publications lookup and price gate, group and gallery order, and per product the read-before-write, write, first-landing stock, Inventory registration and sync fields. Returns either a refusal (missing copy with count, missing price, reconnect) or the results with `stock_not_set`. Never an HTTP response.
- **Route keeps**: body parsing, connection lookup, ownership filter, mapping outcomes to 400 / 402 / 503 / 500.
- **In-memory shop** (`tests/shopify_shop.py`): holds products (status, variants, publications), publications, locations and available stock; answers only the operations Push uses and raises on anything else. Tests assert on shop state, not query strings.
- **Database in tests**: the real `db` fixture with seeded rows. The in-memory shop is the only fake.
- **Tests**: ADR 0023 rules and the push tests in `test_shopify_publications.py` call the Push module directly. HTTP keeps one test per outcome mapping, ownership filtering, and the `/api/shopify/publications` endpoint tests. Pure helper tests stay.

## Out of scope

OAuth shop identity's own `shopify_graphql` and the two token decrypts: issue 04.

## Slices

01 transport → 02 in-memory shop → 03 Push module. Each ends with `uv run pytest` green. Live-path Go live check on a test shop before 03 ships.
