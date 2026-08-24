# 01 — Confirm marks listing copy stale

**Parent:** `.scratch/one-product-facts-module/spec.md`

**What to build:** A seller who confirms *changed* product facts on a product that already has listing copy sees a stale listing copy banner on Product Details. Same-values confirm and first confirm with empty copy do not mark stale. A grandfathered title counts as listing copy, so first confirm stales it. Existing title and description stay on screen. Generate stays enabled. Copy is not rewritten. Product payloads expose whether listing copy is stale, whether the seller may generate, and the description-block HTML; the catalogue list includes the stale mark so later tickets can use it. No backfill on already-mismatched rows.

**Blocked by:** None — can start immediately.

**Status:** resolved

- [x] Confirming changed facts while title, description, tags, SEO, or AEO already exists marks listing copy stale on the product (including grouped photos)
- [x] Same-values confirm does not mark stale; first confirm with no listing copy does not mark stale
- [x] Grandfathered title (or any existing listing copy) plus first confirm does mark stale
- [x] Product Details shows a stale banner and does not wipe title or description; Generate stays enabled
- [x] Product payloads include `listingCopyStale`, `mayGenerateListingCopy`, and `descriptionBlocks`; the catalogue list includes `listingCopyStale`
- [x] Existing mismatched rows are not marked stale until this confirm (forward only)
- [x] Tests hit the Product facts module: the set/no-set cases above, existing generate-gate / GPSR / care / vision-strip tests still pass

## Answer

Confirm decides stale in the Product facts module: changed confirmed facts plus existing listing copy (title, description, tags, SEO, or AEO) sets the mark; same-values and empty first confirm do not; a grandfathered title on first confirm does. The mark is stored on the facts record (grouped photos share it) and is not backfilled on read. HTTP copies `listingCopyStale`, `mayGenerateListingCopy`, and `descriptionBlocks` onto product payloads; the catalogue list includes `listingCopyStale`. Product Details shows a regenerate banner from that flag, keeps title/description, and leaves Generate enabled. The facts form stays visible after confirm so changed facts can be re-confirmed.
