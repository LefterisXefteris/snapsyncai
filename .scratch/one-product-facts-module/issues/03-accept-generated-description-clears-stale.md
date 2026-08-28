# 03 — Accept generated description clears stale

**Parent:** `.scratch/one-product-facts-module/spec.md`

**What to build:** Accepting generated description persists on a dedicated path: the server applies current description blocks, writes listing copy, and clears stale listing copy so the banner goes away. Accepting only a generated title, tags, or AEO does not clear stale. Ordinary product Save does not clear stale and does not re-assemble blocks. The generate stream still does not persist and does not clear stale. An Accept that has not been persisted yet leaves stale set.

**Blocked by:** 01 — Confirm marks listing copy stale; 02 — Generate follows the server gate

**Status:** resolved

- [x] Accept of generated description persists on a path distinct from ordinary product update
- [x] That persist applies current fact blocks, writes listing copy, and clears stale; the banner goes
- [x] Title-only, tags-only, or AEO-only Accept does not clear stale
- [x] Ordinary Save (typo, price, media order) does not clear stale and does not assemble blocks
- [x] Generate stream completion does not persist and does not clear stale
- [x] Tests hit the Product facts module: description Accept clears stale and stamps blocks; title-only does not clear

## Answer

Accept of generated listing copy is a Product facts module outcome: description Accept stamps current fact blocks and clears stale; title/tags/AEO-only Accept leave the mark. HTTP persists that on `POST /api/images/:id/listing-copy/accept` (listing copy first, then the stale mark) so ordinary Save cannot be mistaken for a regenerate. Generate still only fills the form; the banner stays until description Accept succeeds. Ordinary PUT Save still does not assemble blocks or clear stale.
