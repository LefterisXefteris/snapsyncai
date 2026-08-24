# 03 — Accept generated description clears stale

**Parent:** `.scratch/one-product-facts-module/spec.md`

**What to build:** Accepting generated description persists on a dedicated path: the server applies current description blocks, writes listing copy, and clears stale listing copy so the banner goes away. Accepting only a generated title, tags, or AEO does not clear stale. Ordinary product Save does not clear stale and does not re-assemble blocks. The generate stream still does not persist and does not clear stale. An Accept that has not been persisted yet leaves stale set.

**Blocked by:** 01 — Confirm marks listing copy stale; 02 — Generate follows the server gate

**Status:** ready-for-agent

- [ ] Accept of generated description persists on a path distinct from ordinary product update
- [ ] That persist applies current fact blocks, writes listing copy, and clears stale; the banner goes
- [ ] Title-only, tags-only, or AEO-only Accept does not clear stale
- [ ] Ordinary Save (typo, price, media order) does not clear stale and does not assemble blocks
- [ ] Generate stream completion does not persist and does not clear stale
- [ ] Tests hit the Product facts module: description Accept clears stale and stamps blocks; title-only does not clear
