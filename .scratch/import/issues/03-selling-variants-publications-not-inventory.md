# 03: Selling, visible variants, Draft/Active, and publications — not Inventory

**What to build:** An imported product’s Selling is filled from the Channel’s first/default variant (price, compare-at, cost, SKU, barcode, track-quantity). Color/size options are visible on the product. Draft/Active and publications match the live Shopify product so a later Sync sends that set, not Draft with none. Available quantity is not copied as SnapSync Inventory. One Shopify product with many variants is still one catalogue product. The seller cannot create or edit variants on Import; collections, vendor, shipping/weight, and theme template stay in Shopify admin.

**Blocked by:** 01 — Start Import; missing Shopify products land with grandfathered listing copy

**Status:** done

- [x] Selling copies price, compare-at, cost, SKU, barcode, and track-quantity from the first/default Channel variant
- [x] Available quantity is not persisted as Inventory; Autopilot stock setup is unchanged
- [x] Channel option names and values are visible; one Shopify product with many variants is one catalogue row
- [x] Import does not create or edit variants; grouping photos still does not create variants
- [x] Draft/Active and the product’s current publications are copied; later Sync uses that set
- [x] Collections, vendor, shipping/weight, and theme template are not stored on the product page
