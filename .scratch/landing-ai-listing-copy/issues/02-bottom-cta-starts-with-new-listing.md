# 02 — The bottom CTA starts with a New listing

**Parent:** `.scratch/landing-ai-listing-copy/spec.md`

**What to build:** The closing section says "Start with a New listing." Its Start free button opens sign-in (or sign-up) and, once signed in, lands the seller on New listing instead of Products. The hero and nav Start free keep the default arrival on Products. User story 33.

**Blocked by:** 01

**Status:** done

- [x] Bottom Start free opens Clerk sign-in with sign-in and sign-up redirects to the New listing path
- [x] The New listing path comes from the workspace nav, not a hard-coded string
- [x] Hero, nav, and pricing Start free still open plain sign-in (arrival lands on Products)
- [x] Arriving at `/new` keeps New listing open (existing `workspace-arrival` contract)
- [x] Without Clerk mounted (preview at `/page`), the button stays a no-op

## Comments

`Landing.tsx` passes `forceRedirectUrl` / `signUpForceRedirectUrl` from `workspaceNavItem("new-listing").path`; `workspaceArrival` keeps `/new` (covered by `tests/workspace-arrival.test.ts`). No unit seam for the Clerk call itself. Not yet proven with a real Clerk sign-in / sign-up on the live path.
