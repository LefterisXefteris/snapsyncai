# SnapSync photos are private; Channel photos are not

A **Photo** the seller uploads lives in a private bucket. The seller views it through the signed-in `/api` file route, never a world-readable URL. **Push** mints a short-lived signed URL so Shopify can fetch once. A **Website** snapshot uses Channel (Shopify CDN) photo URLs — never SnapSync storage — matching ADR 0010 (already-pushed products only). We rejected keeping the bucket publicly readable, and Shopify staged uploads for this pass.
