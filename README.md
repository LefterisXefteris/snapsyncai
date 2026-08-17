# snapsyncai

## Local development

```bash
npm run dev
```

Starts Postgres (Docker), FastAPI on `:8000`, and Vite on `:5001`. Every `/api`
request from the SPA is proxied to FastAPI. Express is gone; production `/api`
is FastAPI on Railway (`https://api.snapsyncai.co.uk`).

```bash
curl -s http://localhost:5001/api/health
# {"status":"ok","service":"snapsyncai-api"}
```

Copy `.env.example` to `.env.local` if you do not already have one. Schema is
applied with Alembic (`api-py`).

```bash
cd api-py && uv run alembic upgrade head
```

## Shopify OAuth

Set these environment variables in production before connecting Shopify stores:

```bash
SHOPIFY_API_KEY="your Shopify app client ID"
SHOPIFY_API_SECRET="your Shopify app client secret"
SHOPIFY_SCOPES="read_products,write_products,read_inventory,write_inventory,read_locations"
APP_BASE_URL="https://snapsyncai.co.uk"
CONNECTION_ENCRYPTION_KEY="a high-entropy secret used for AES-256-GCM token encryption"
```

`SHOPIFY_CLIENT_ID` and `SHOPIFY_CLIENT_SECRET` are also accepted for older deployments, but prefer the `SHOPIFY_API_*` names for new setup.

In the Shopify app dashboard, set the app URL to `https://api.snapsyncai.co.uk` and add this allowed redirection URL:

```text
https://api.snapsyncai.co.uk/api/shopify/oauth/callback
```
