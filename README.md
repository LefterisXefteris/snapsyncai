# snapsyncai

## Shopify OAuth

Set these environment variables in production before connecting Shopify stores:

```bash
SHOPIFY_API_KEY="your Shopify app client ID"
SHOPIFY_API_SECRET="your Shopify app client secret"
SHOPIFY_SCOPES="write_products"
APP_BASE_URL="https://snapsyncai.co.uk"
```

In the Shopify app dashboard, set the app URL to `https://snapsyncai.co.uk` and add this allowed redirection URL:

```text
https://snapsyncai.co.uk/api/shopify/oauth/callback
```
