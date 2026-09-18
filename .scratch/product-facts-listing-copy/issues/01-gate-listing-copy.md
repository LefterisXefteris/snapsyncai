# 01 — Gate listing copy on confirmed facts (non-textile path)

**Parent:** `.scratch/product-facts-listing-copy/spec.md`

**What to build:** A seller can upload photos and get classification, price, variants, and suggested facts (textile? + likely fibre names, percentages blank) without any listing copy being written. On Product Details they confirm the product is not a textile; only then does Generate (and per-field regenerate) run. Several photos of one product share one facts record. Unlock cannot bypass the gate. Existing listing copy is left in place and can still be published; the next Generate is gated.

**Blocked by:** None — can start immediately.

**Status:** done

- [x] Upload does not persist title, description, tags, SEO, or AEO (unpaid preview included — no title teaser)
- [x] Upload may persist classification, price, color/size variants, and suggested facts (textile yes/no, fibre names with blank %)
- [x] Product Details lets the seller confirm “not a textile”; Generate and regenerate stay off until that confirmation
- [x] After confirmation, Generate runs and must not invent fibre composition or GPSR identity
- [x] Facts belong to the product (shared across grouped photos; a standalone photo is its own product)
- [x] Unlock / paid full analysis does not write listing copy
- [x] Grandfathered listing copy still publishes; Generate on that product stays gated until facts are confirmed
- [x] Tests hit the product-facts module: unconfirmed cannot generate; non-textile confirm opens the gate; vision output with listing copy is persisted without those fields

## Comments

Closed to match git (`2ef06d8` and later Product facts module work). Not a fresh implement.
