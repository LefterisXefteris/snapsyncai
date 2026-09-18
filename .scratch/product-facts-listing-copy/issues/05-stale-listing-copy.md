# 05 — Stale listing copy after facts change

**Parent:** `.scratch/product-facts-listing-copy/spec.md`

**What to build:** After listing copy has been generated, editing confirmed facts marks that copy stale. Product Details shows a banner to regenerate; the old title and description stay on screen; publish still works. Regenerating writes copy from the new facts (including updated description blocks) and clears stale.

**Blocked by:** 02 — Textile fibre composition in the listing; 03 — Shop GPSR identity on the listing

**Status:** done

- [x] Editing confirmed facts after Generate marks listing copy stale (composition, care, GPSR, or textile flag)
- [x] A banner tells the seller to regenerate; existing listing copy is not cleared
- [x] Publish still succeeds while copy is stale
- [x] Regenerating produces new listing copy from the updated facts and clears stale
- [x] Confirming facts for the first time (no prior Generate) is not stale
- [x] Tests hit the product-facts module: facts changed after generation → stale; regenerate with new facts → not stale; never-generated is not stale

## Comments

Closed to match git (`681fc2b` and the later one-product-facts-module tickets). Not a fresh implement.
