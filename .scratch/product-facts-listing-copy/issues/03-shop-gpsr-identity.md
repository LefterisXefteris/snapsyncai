# 03 — Shop GPSR identity on the listing

**Parent:** `.scratch/product-facts-listing-copy/spec.md`

**What to build:** A seller can save a shop-level GPSR identity (manufacturer name, postal address, email; manufacturer-in-EU flag; EU responsible person when the maker is not in the EU). Each product uses that default, overrides it, or explicitly skips. Skip omits the GPSR block from the description; a filled identity is included as English text. With no Shopify connection, the product still fills or skips. An empty field is not a skip.

**Blocked by:** 01 — Gate listing copy on confirmed facts (non-textile path)

**Status:** done

- [x] Shop GPSR identity can be saved once and is the default for products of that connected shop
- [x] Fields: manufacturer name, postal address, email; manufacturer-in-EU flag; if not in the EU, EU responsible person name, postal address, email
- [x] A product can use the shop default, override it, or explicitly skip GPSR identity
- [x] Explicit skip omits the GPSR block from generated description; filled identity appears as an English block (after composition when present)
- [x] Empty GPSR fields cannot be confirmed as a skip — seller must fill or skip
- [x] With no Shopify connection, the product can still fill GPSR identity or skip; there is no shop default
- [x] Non-textile products still get shop GPSR default, override, or skip (composition/care remain hidden)
- [x] Tests hit the product-facts module: effective GPSR is override, else shop default, else none; skip omits the block; empty is not skip
