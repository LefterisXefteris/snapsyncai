# 04: Created, skipped, failed counts; mixed failure; in-progress Start refused

**What to build:** When a run finishes, Import shows created, skipped, and failed counts from the server. One Shopify product that fails does not drop siblings, and a failed product does not leave a partial catalogue row. The same Channel id twice in one list persists once. A second Start while a run is in progress is refused. An interrupted run is safe to Start again (skip-on-id). The SPA does not invent a different skip or count than the module.

**Blocked by:** 01 — Start Import; missing Shopify products land with grandfathered listing copy

**Status:** done

- [x] Completed run shows created, skipped, and failed counts from the module
- [x] One Channel product failure creates the rest; that failed id writes no catalogue row
- [x] The same Channel product id twice in one list still persists once
- [x] Start while a run is in progress is refused with the module reason (page and forged HTTP)
- [x] A later Start after complete or interrupt only adds ids not already here
- [x] SPA in-progress, counts, and blocked reasons come from the server
