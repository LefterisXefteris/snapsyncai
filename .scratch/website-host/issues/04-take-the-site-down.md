# 04 — Take the site down

**What to build:** The seller unpublishes. The address stays reserved and shoppers no longer see the site. Publishing again does not spend another Allowance use.

**Blocked by:** 01 — Publish the storefront

**Status:** done

- [x] Unpublish keeps the address and shoppers no longer see the site
- [x] Publishing again does not spend another Allowance use

## Comments

- Done: `live` on `websites`, `POST /api/website/unpublish`, Take down on the Website page. Address row kept; shoppers hidden; republish does not spend.
