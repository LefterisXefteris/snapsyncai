# 01 — Gate listing copy on confirmed facts (non-textile path)

**Parent:** `.scratch/product-facts-listing-copy/spec.md`

**What to build:** A seller can upload photos and get classification, price, variants, and suggested facts (textile? + likely fibre names, percentages blank) without any listing copy being written. On Product Details they confirm the product is not a textile; only then does Generate (and per-field regenerate) run. Several photos of one product share one facts record. Unlock cannot bypass the gate. Existing listing copy is left in place and can still be published; the next Generate is gated.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Upload does not persist title, description, tags, SEO, or AEO (unpaid preview included — no title teaser)
- [ ] Upload may persist classification, price, color/size variants, and suggested facts (textile yes/no, fibre names with blank %)
- [ ] Product Details lets the seller confirm “not a textile”; Generate and regenerate stay off until that confirmation
- [ ] After confirmation, Generate runs and must not invent fibre composition or GPSR identity
- [ ] Facts belong to the product (shared across grouped photos; a standalone photo is its own product)
- [ ] Unlock / paid full analysis does not write listing copy
- [ ] Grandfathered listing copy still publishes; Generate on that product stays gated until facts are confirmed
- [ ] Tests hit the product-facts module: unconfirmed cannot generate; non-textile confirm opens the gate; vision output with listing copy is persisted without those fields
