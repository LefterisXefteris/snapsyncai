# snapsyncai

## Shopify OAuth

Set these environment variables in production before connecting Shopify stores:

```bash
SHOPIFY_API_KEY="your Shopify app client ID"
SHOPIFY_API_SECRET="your Shopify app client secret"
SHOPIFY_SCOPES="read_products,write_products,read_inventory,write_inventory,read_locations"
APP_BASE_URL="https://snapsyncai.co.uk"
CONNECTION_ENCRYPTION_KEY="a high-entropy secret used for AES-256-GCM token encryption"
INVENTORY_AUTOPILOT_ENABLED="true"
CRON_SECRET="a high-entropy secret sent by the daily Vercel cron"
RESEND_API_KEY="re_..."
INVENTORY_ALERT_FROM_EMAIL="SnapSync Inventory <inventory@example.com>"
```

`SHOPIFY_CLIENT_ID` and `SHOPIFY_CLIENT_SECRET` are also accepted for older deployments, but prefer the `SHOPIFY_API_*` names for new setup.

In the Shopify app dashboard, set the app URL to `https://snapsyncai.co.uk` and add this allowed redirection URL:

```text
https://snapsyncai.co.uk/api/shopify/oauth/callback
```

## Database migrations

Apply versioned migrations before enabling Inventory Autopilot:

```bash
npm run db:migrate
```

Existing Shopify sellers must reconnect once to approve the expanded inventory
and location scopes. The inventory webhook endpoint is
`https://snapsyncai.co.uk/api/shopify/webhooks`.
