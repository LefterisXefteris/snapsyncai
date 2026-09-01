# 01 — Push listing copy, not a paid unlock

**Parent:** `.scratch/plan-allowance/spec.md`

**What to build:** A seller can push products that already have listing copy they typed (or generated). Selection that still needs listing copy is refused with a missing-listing-copy reason, not “subscribe to unlock.” Stale listing copy still warns, then can push. `payment_status` is not the gate.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [x] Catalogue push refuses products with no listing copy and names that gap
- [x] Products with typed or generated listing copy can push regardless of unpaid unlock
- [x] Stale listing copy still warns, then allows push
- [x] SPA and HTTP use the same listing-copy-present rule the product-facts module already owns
- [x] Tests: channel-push decision + listing-copy-present on the payload; no unpaid unlock refusal
