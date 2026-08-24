# 05 — Stale listing copy after facts change

**Parent:** `.scratch/product-facts-listing-copy/spec.md`

**What to build:** After listing copy has been generated, editing confirmed facts marks that copy stale. Product Details shows a banner to regenerate; the old title and description stay on screen; publish still works. Regenerating writes copy from the new facts (including updated description blocks) and clears stale.

**Blocked by:** 02 — Textile fibre composition in the listing; 03 — Shop GPSR identity on the listing

**Status:** ready-for-agent

- [ ] Editing confirmed facts after Generate marks listing copy stale (composition, care, GPSR, or textile flag)
- [ ] A banner tells the seller to regenerate; existing listing copy is not cleared
- [ ] Publish still succeeds while copy is stale
- [ ] Regenerating produces new listing copy from the updated facts and clears stale
- [ ] Confirming facts for the first time (no prior Generate) is not stale
- [ ] Tests hit the product-facts module: facts changed after generation → stale; regenerate with new facts → not stale; never-generated is not stale
