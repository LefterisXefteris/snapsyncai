Status: done

# 04 — OAuth shop identity on the same Shopify GraphQL transport, and one token decrypt

## What

- `app/services/shopify_admin.py` has its own `shopify_graphql` (raw shop domain + stored token), used only by `get_shopify_shop_identity` at connect time, before a connection row exists.
- Two AES-GCM decrypts of the Node-written `enc:v1:` tokens: `app/services/shopify_crypto.py` and `app/services/crypto.py`.
- Out of scope for the Push deepening; kept separate because merging the decrypts touches stored credentials.

## Done when

- Shop identity goes through the one Shopify GraphQL transport.
- One `decrypt_shopify_token`, with a test that it decrypts a Node-produced `enc:v1:` value.

## Comments

- One decrypt done: `shopify_crypto.py` deleted, `crypto.py` holds the strict version (refuses an empty key); the Node `enc:v1:` tests in `test_oauth.py` now import it. Shop identity on the one transport is still open.
- Shop identity on the one transport done: `shopify.py` builds the transport from `shopify_graphql_at(shop_domain, access_token, settings)` (stored `enc:v1:` or plain token); `shopify_graphql_for(connection, settings)` delegates to it. `get_shopify_shop_identity(graphql)` moved into `shopify.py`; `shopify_admin.py` and its clone transport are deleted. The OAuth callback and `/api/shopify/connect` take `ShopifyGraphQLAtDep` (`(shop_domain, access_token) -> transport`), because no connection row exists yet. Same API version and error messages; the identity call now uses the main transport's 60s timeout instead of the clone's 30s.
- `test_oauth.py` covers `/api/shopify/connect` on the real `db` by overriding `get_shopify_graphql_at` with a fake transport: the shop name and scopes are stored, and the token is stored encrypted. 410 passed; ruff 14 (baseline).
- Live path for the human: connect a real Shopify shop through OAuth and check that the shop name and scopes show up.
