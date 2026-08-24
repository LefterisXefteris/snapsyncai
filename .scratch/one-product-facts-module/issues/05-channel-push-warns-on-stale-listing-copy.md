# 05 — Channel push warns on stale listing copy

**Parent:** `.scratch/one-product-facts-module/spec.md`

**What to build:** A seller who pushes selected products that include stale listing copy sees a warning, then can still push. Selection with no stale listing copy pushes as today. The unpaid / listing-copy-required check is unchanged. Stale is not a publish gate.

**Blocked by:** 01 — Confirm marks listing copy stale

**Status:** ready-for-agent

- [ ] Pushing a selection that includes stale listing copy warns, then still pushes
- [ ] Selection with no stale listing copy has no new warning
- [ ] Unpaid products are still refused as today; that check is not replaced by the stale warning
- [ ] Publish is not blocked on stale listing copy
