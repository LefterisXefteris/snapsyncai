# 04 — Shop GPSR identity stales shop-default products

**Parent:** `.scratch/one-product-facts-module/spec.md`

**What to build:** Saving Shop GPSR identity marks listing copy stale on products that use the shop default and already have listing copy. Those products show the same stale banner as after a facts edit. Products that override GPSR identity, explicitly skip it, or have no listing copy are not staled by that save. Regenerating description afterwards carries the updated GPSR block (via the Accept path from 03, when that ticket is done; this ticket only sets the mark).

**Blocked by:** 01 — Confirm marks listing copy stale

**Status:** resolved

- [x] Saving Shop GPSR identity stales products whose GPSR choice is shop default and that already have listing copy
- [x] Override, explicit skip, and products with no listing copy are not staled by that save
- [x] Staled products show the Product Details banner from 01; Generate stays enabled; publish is not blocked
- [x] Tests hit the Product facts module: shop-default + listing copy → stale; override / skip / empty copy → not stale

## Answer

Shop GPSR save decides stale in the Product facts module: shop-default GPSR plus existing listing copy sets the mark; override, explicit skip, and empty copy do not. HTTP copies that outcome onto matching products after `PUT /api/shopify/gpsr-identity`; Product Details still reads the 01 banner from `listingCopyStale`. Generate and publish stay ungated. This ticket only sets the mark; Accept from 03 already stamps the updated GPSR block.
