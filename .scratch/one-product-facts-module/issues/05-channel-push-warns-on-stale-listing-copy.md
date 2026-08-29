# 05 — Channel push warns on stale listing copy

**Parent:** `.scratch/one-product-facts-module/spec.md`

**What to build:** A seller who pushes selected products that include stale listing copy sees a warning, then can still push. Selection with no stale listing copy pushes as today. The unpaid / listing-copy-required check is unchanged. Stale is not a publish gate.

**Blocked by:** 01 — Confirm marks listing copy stale

**Status:** resolved

- [x] Pushing a selection that includes stale listing copy warns, then still pushes
- [x] Selection with no stale listing copy has no new warning
- [x] Unpaid products are still refused as today; that check is not replaced by the stale warning
- [x] Publish is not blocked on stale listing copy

## Answer

Channel push reads `listingCopyStale` from the catalogue selection. Unpaid still refuses first with the existing listing-copy-required toast. Paid selections with stale listing copy get a confirm warning, then still push. Paid selections with no stale mark push as before. HTTP push is unchanged: it still refuses unpaid and does not refuse stale.
