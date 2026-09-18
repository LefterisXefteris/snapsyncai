# 04 — Generate and listing copy refresh spend

**Parent:** `.scratch/plan-allowance/spec.md`

**What to build:** Free sellers cannot Generate or accept listing copy refresh; the blocked reason comes from the Plan module (facts and search-demand gates unchanged). A Plan seller is charged one Allowance use when listing copy from Generate actually persists, and when they accept a listing copy refresh. Failed, unaccepted, stale regenerate, typed edits, and refresh dismiss do not spend. Product Details follows the server.

**Blocked by:** 02 — Plan module, status, and Settings meter

**Status:** done

- [x] Free: Generate and refresh accept refused with the Plan reason; facts-blocked generate still facts, not Plan
- [x] Persist from Generate spends unless listing copy was stale
- [x] Failed or unaccepted Generate does not spend
- [x] Refresh start/dismiss/proposal regenerate do not spend; accept does
- [x] Typed listing copy save and per-field regenerate (copy present, not stale) do not spend
- [x] SPA disables those jobs from server outcomes
- [x] Tests call the Plan module for spend decisions; thin HTTP asserts the Plan reason
