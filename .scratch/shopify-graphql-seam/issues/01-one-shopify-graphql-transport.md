Status: done

# 01 — One Shopify GraphQL transport

Spec: `.scratch/shopify-graphql-seam/spec.md`.

## What

- Add the `ShopifyGraphQL` transport type and a builder from connection + settings (the current `shopify.shopify_graphql` body, retries and all).
- Move every function in `app/services/shopify.py`, `app/services/inventory/shopify_ops.py` and `app/services/shopify_import.py` onto the transport. `create_shopify_product` takes granted scopes explicitly.
- Callers (routes, Inventory service, outbox, webhooks, Import) build the transport once. Routes get it from a FastAPI dependency.
- Existing tests switch from patching two modules to overriding that one dependency, or passing a fake transport to service functions.

## Done when

- No test patches `shopify_graphql` anywhere.
- `uv run pytest` green; no behaviour change.

## Comments

- `app/services/shopify.py`: `ShopifyGraphQL` (Protocol, `(query, variables=None) -> data`), `shopify_graphql_for(connection, settings)` holds the old `shopify_graphql` body, retries and all. The token is still decrypted per call, so a missing key fails exactly where it did before.
- Routes (push, `/api/shopify/publications`, Import start) take `ShopifyGraphQLForDep`, which gives them a `connection -> transport` builder, because the route still owns the connection lookup. Tests override `get_shopify_graphql_for`.
- Inventory service, outbox jobs and website handoff call `shopify_graphql_for` once per operation. `create_shopify_product` / `push_product_to_shopify` take `granted_scopes=`. `create_shopify_product` still takes `settings` for media sources (`media_original_source`), which is not a transport concern.
- Service tests pass a fake transport. `test_website_handoff` still patches `website_handoff.list_shopify_product_image_urls` (not `shopify_graphql`); only its arity changed.
- 400 passed; ruff 14 (baseline).
