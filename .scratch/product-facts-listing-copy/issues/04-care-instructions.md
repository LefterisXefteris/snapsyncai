# 04 — Care instructions on the listing

**Parent:** `.scratch/product-facts-listing-copy/spec.md`

**What to build:** A seller of a textile product fills care instructions (one pick each for washing, bleaching, drying, ironing, professional textile care) or explicitly skips. Filled care is written as English text in the description after the composition block. Skip omits the block. Care is hidden for non-textiles. Pictograms are not used.

**Blocked by:** 02 — Textile fibre composition in the listing

**Status:** done

- [x] Textile Product Details: care is either a complete five-family set or an explicit skip
- [x] Picks are from the v1 lists (washing, bleaching, drying, ironing, professional textile care) and render as English text, not symbols
- [x] Empty care cannot be confirmed — fill all five or skip
- [x] Generated description includes the care block after composition when not skipped; skip omits it
- [x] Care is not shown for a confirmed non-textile product
- [x] Tests hit the product-facts module: skip omits the care block; partial care cannot confirm; rendered text matches the picks and contains no pictograms

## Comments

Closed to match git (`eaaee41` and later Product facts module work). Not a fresh implement.
