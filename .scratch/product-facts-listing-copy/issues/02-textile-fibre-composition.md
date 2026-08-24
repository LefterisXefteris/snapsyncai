# 02 — Textile fibre composition in the listing

**Parent:** `.scratch/product-facts-listing-copy/spec.md`

**What to build:** A seller who confirms the product is a textile must enter fibre composition (EU fibre names + percentages that sum to 100) before Generate will run. Suggested fibre names from upload pre-fill the rows; the seller types the percentages. Generated description includes an English composition block. Tags and AEO may use confirmed fibre names, not guesses.

**Blocked by:** 01 — Gate listing copy on confirmed facts (non-textile path)

**Status:** ready-for-agent

- [ ] Confirming a textile without composition does not open the gate
- [ ] Composition is structured rows: common EU fibre names plus Other; integer percentages must sum to 100
- [ ] Suggested fibre names pre-fill rows with blank percentages; vision must not fill percentages
- [ ] Incomplete rows (name without %, or % that do not sum to 100) cannot be confirmed
- [ ] After composition is confirmed, Generate writes listing copy whose description includes the English composition block
- [ ] Tags and AEO use confirmed fibre names, not suggested-only names
- [ ] Composition and care UI stay hidden when the product is confirmed not a textile
- [ ] Tests hit the product-facts module: missing composition blocks generate; 80% cotton alone cannot confirm; description HTML contains the confirmed composition and not a skipped/absent GPSR block
