# 03 — Bulk SEO Start refuses above 25 primaries

**Parent:** `.scratch/openai-spend-caps/spec.md`

**What to build:** Seller Start with more than 25 eligible primaries is refused entirely (no silent prefix, zero propose calls). ≤25 still behaves as today. Amends ADR 0016’s “no second product cap” for OpenAI fan-out only; listing-copy write unchanged.

**Blocked by:** None — can start immediately.

**Status:** resolved

- [x] Start with 26 eligible primaries is refused and performs zero propose calls
- [x] Start with 25 eligible primaries still runs
- [x] Refusal processes none of the pack
- [x] Listing-copy generate, refresh, Accept, and listing-copy write rules unchanged
