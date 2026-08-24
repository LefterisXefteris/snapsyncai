# 02 — Generate follows the server gate

**Parent:** `.scratch/one-product-facts-module/spec.md`

**What to build:** Generate and per-field regenerate follow `mayGenerateListingCopy` from the product payload, not a browser rulebook. Description-block HTML comes from the payload; Accept/generate in the workspace must not assemble fibre, care, or GPSR blocks. Confirm can still disable while GPSR or care picks are empty (form chrome, not a second gate). The server still refuses generate with a conflict when facts are not confirmed.

**Blocked by:** 01 — Confirm marks listing copy stale

**Status:** resolved

- [x] Generate and regenerate enable/disable from the payload outcome, not from a client generate gate
- [x] Workspace does not assemble description blocks on generate or Accept
- [x] Confirm stays chrome-disabled when GPSR or care picks are incomplete; that disable is not the generate gate
- [x] Unconfirmed facts still get a generate conflict from the server
- [x] Pick labels and unsaved drafts remain in the form
- [x] No client tests of the generate gate or block assembly; Product facts module tests still cover the gate

## Answer

Generate and per-field regenerate enable from `mayGenerateListingCopy` on the product payload. The catalogue list copies that outcome so Product Details can read it; description-block HTML stays off the list. The workspace no longer assembles fibre, care, or GPSR blocks on generate or Accept. Confirm remains chrome-disabled while GPSR or care picks are empty. Unconfirmed generate is still a server conflict. Pick labels and unsaved drafts stay in the form. Product facts module tests still cover the gate; there are no client tests of the gate or block assembly.
