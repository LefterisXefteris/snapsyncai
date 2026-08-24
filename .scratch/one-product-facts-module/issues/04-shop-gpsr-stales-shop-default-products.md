# 04 — Shop GPSR identity stales shop-default products

**Parent:** `.scratch/one-product-facts-module/spec.md`

**What to build:** Saving Shop GPSR identity marks listing copy stale on products that use the shop default and already have listing copy. Those products show the same stale banner as after a facts edit. Products that override GPSR identity, explicitly skip it, or have no listing copy are not staled by that save. Regenerating description afterwards carries the updated GPSR block (via the Accept path from 03, when that ticket is done; this ticket only sets the mark).

**Blocked by:** 01 — Confirm marks listing copy stale

**Status:** ready-for-agent

- [ ] Saving Shop GPSR identity stales products whose GPSR choice is shop default and that already have listing copy
- [ ] Override, explicit skip, and products with no listing copy are not staled by that save
- [ ] Staled products show the Product Details banner from 01; Generate stays enabled; publish is not blocked
- [ ] Tests hit the Product facts module: shop-default + listing copy → stale; override / skip / empty copy → not stale
