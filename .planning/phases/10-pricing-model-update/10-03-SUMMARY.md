---
phase: 10-pricing-model-update
plan: "03"
subsystem: ui
tags: [react, toast, error-handling, landing-page, pricing, json-ld, faq]

# Dependency graph
requires:
  - phase: 10-01
    provides: weekly cap 403 response shape from /api/subscription/unlock-images (weeklyLimit, used, resetsAt fields)
  - phase: 10-02
    provides: credit pack content already removed from Home.tsx and Landing.tsx; CREDIT_PACKS array deleted
provides:
  - Weekly cap error toast in Home.tsx unlock flow (403 weeklyLimit detection with used/limit/resetsAt)
  - Subscription-only pricing section in Landing.tsx (weekly £4/wk, annual £173/yr cards)
  - Updated Landing.tsx FAQ reflecting 30-product weekly cap model
  - Updated JSON-LD SoftwareApplication offers (weekly + annual subscription prices)
affects: [10-04, landing-page-copy, pricing-model]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "403 error body parsed from error.message string ('statusCode: {json}') using indexOf+slice+JSON.parse before branching on weeklyLimit vs Subscription required"
    - "Landing pricing section uses two Card layout (weekly outline, annual highlighted with primary border + gradient top stripe)"

key-files:
  created: []
  modified:
    - client/src/pages/Home.tsx
    - client/src/pages/Landing.tsx

key-decisions:
  - "Weekly cap 403 parsing: error body is embedded in error.message as '403: {json}' string — parsed via colonIdx slice rather than a separate response.json() call, consistent with how errors arrive from the existing apiRequest utility"
  - "No weekly usage API call added to Home.tsx — cap feedback is unlock-time only (shown when user tries to unlock and is blocked); a /api/subscription/status extension for proactive count display is deferred to a future plan"
  - "Landing.tsx JSON-LD uses unitCode WEE and ANN per plan spec; both offers live on the SoftwareApplication schema object"

patterns-established:
  - "Cap-aware unlock error handler: parse JSON from error.message string, branch on weeklyLimit presence before Subscription required before generic fallback"

# Metrics
duration: ~15min
completed: 2026-04-27
---

# Phase 10 Plan 03: Cap Feedback and Landing.tsx Rewrite Summary

**Weekly cap 403 toast wired into Home.tsx unlock flow; Landing.tsx rewritten to subscription-only pricing (£4/wk weekly, £173/yr annual) with updated FAQ and JSON-LD — zero credit pack content remains**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-27
- **Completed:** 2026-04-27
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Home.tsx unlock `onError` handler now parses the 403 JSON body embedded in `error.message`, detects `weeklyLimit` presence, and shows a "Weekly limit reached" destructive toast with used/total/resetsAt human-readable date
- Landing.tsx pricing section replaced with a two-card layout: "Pro Weekly" (£4/wk) and "Pro Annual" (£173/yr) with feature lists, both routing to `openSignIn()` on click
- Landing.tsx FAQ updated — "How do credits work?" replaced with "How does the 30-product weekly limit work?", pricing FAQ updated to weekly/annual model, all credit pack references eliminated
- Landing.tsx JSON-LD `SoftwareApplication` offers array updated to £4.00 weekly (unitCode WEE) and £173.00 annual (unitCode ANN) subscription offers

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire weekly cap error handling into Home.tsx unlock flow** - `e4432aa` (feat)
2. **Task 2: Rewrite Landing.tsx pricing section to subscription-only model** - `1dab16b` (feat)

## Files Created/Modified

- `client/src/pages/Home.tsx` - Added cap-aware onError handler in `handleUnlockAll`: parses JSON from error.message string, detects weeklyLimit 403, shows toast with used/limit/resetsAt; subscription-required and generic fallback branches preserved
- `client/src/pages/Landing.tsx` - Pricing section rewritten to weekly + annual subscription cards; FAQ_DATA updated to remove credits question and add weekly limit FAQ; JSON-LD offers updated to new subscription prices

## Decisions Made

- **Error body parsing strategy:** The `apiRequest` utility surfaces 403 errors as `Error` objects with `message` formatted as `"403: {json-body}"`. Rather than adding a separate `response.json()` call, the handler uses `error.message.indexOf(":")` + slice + `JSON.parse` to extract the body. This is consistent with the error shape observed across existing handlers in Home.tsx.
- **No proactive weekly usage display:** Plan explicitly specified no new API calls. Cap feedback is shown at unlock time only. A usage counter visible before hitting the cap is deferred.
- **Landing pricing layout:** Kept the existing `bg-black/40 border-y` pricing section shell and replaced only the inner card grid, preserving the section's visual framing and scroll-to anchor (`id="pricing"`).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Cap feedback and landing page accurately reflect the weekly subscription model
- Ready for Plan 04 (if present) — any remaining pricing model cleanup or subscription checkout wiring
- No blockers

---
*Phase: 10-pricing-model-update*
*Completed: 2026-04-27*
