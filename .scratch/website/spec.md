# Website prototype → Lovable handoff

The seller, signed into SnapSync, with Shopify connected, sharpens a website prototype (look + which products). Those products are already pushed to that shop and already have listing copy. SnapSync packs a snapshot (listing copy, confirmed facts, photos, shop domain, Shopify ids). Lovable builds the website. The seller Installs the Lovable app on that shop. Cart and checkout are Shopify. Words are the snapshot. No tokens, no MCP, no live SnapSync read, no brand-tone field.

## Behaviour

- Website is a workspace job at `/website`, not a Channel.
- Eligible products: Shopify connected, `shopifyProductId` present, listing copy present.
- Handoff URL is Lovable Build with URL. It must not contain Shopify access tokens or `shpat_` secrets.
- Prompt tells Lovable to connect the existing shop, match listing-copy voice, and not invent fibre %, care, or GPSR.
- Unauthenticated callers get 401.
- No Shopify connection → cannot hand off.
- No eligible selected products → cannot hand off.
