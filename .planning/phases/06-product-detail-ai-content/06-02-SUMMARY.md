---
phase: 06-product-detail-ai-content
plan: 02
subsystem: ui
tags: [react, vite, feature-flags, shadcn, tooltip]

# Dependency graph
requires:
  - phase: 06-product-detail-ai-content
    provides: ProductDetails.tsx component with AI feature buttons
provides:
  - Feature-flagged disabled state on AI Background button (VITE_FEATURE_AI_BG_REMOVAL)
  - Feature-flagged disabled state on AI Photoshoot button (VITE_FEATURE_AI_PHOTOSHOOT)
  - Tooltip "Coming soon" UX on both disabled AI buttons
  - SOON badge inline on disabled buttons
affects: [06-product-detail-ai-content]

# Tech tracking
tech-stack:
  added: []
  patterns: [VITE_FEATURE_* env var pattern for client-side feature flags, shadcn Tooltip wrapping disabled buttons]

key-files:
  created: []
  modified:
    - client/src/pages/ProductDetails.tsx

key-decisions:
  - "Feature flags read from VITE_FEATURE_AI_BG_REMOVAL and VITE_FEATURE_AI_PHOTOSHOOT env vars — default false (disabled)"
  - "Buttons remain visible with opacity-50/cursor-not-allowed + SOON badge + Coming soon tooltip — not hidden"
  - "showBgPicker overlay guarded with AI_BG_REMOVAL_ENABLED to prevent phantom overlay when flag is off"

patterns-established:
  - "Client-side feature flag pattern: const FLAG = import.meta.env.VITE_FEATURE_X === 'true'"
  - "Disabled button pattern: TooltipProvider wrapping span > disabled Button, TooltipContent conditionally rendered"

requirements-completed: [PROD-02, PROD-03]

# Metrics
duration: 8min
completed: 2026-04-02
---

# Phase 06 Plan 02: Feature-flag AI Background and AI Photoshoot buttons Summary

**AI Background and AI Photoshoot buttons disabled via VITE_FEATURE_* env vars, showing SOON badge and "Coming soon" tooltip when flags are unset**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-02T22:35:00Z
- **Completed:** 2026-04-02T22:43:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- `AI_BG_REMOVAL_ENABLED` and `AI_PHOTOSHOOT_ENABLED` constants added at module level reading Vite env vars
- Both AI buttons wrapped with `TooltipProvider`/`Tooltip` showing "Coming soon" when flags are false
- Both buttons visually disabled (`opacity-50`, `cursor-not-allowed`, `disabled` prop) and show `SOON` inline badge when flags are false
- `showBgPicker` overlay guarded with `AI_BG_REMOVAL_ENABLED` so the bg picker cannot appear even if state gets set while flag is off
- Tooltip component from shadcn/ui already present — no installation needed

## Task Commits

Each task was committed atomically:

1. **Task 1: Check Tooltip component availability** - verified `tooltip.tsx` exists, no code changes
2. **Task 2: Apply feature-flag disabled state** - `3732a7d` (feat)

**Plan metadata:** (docs commit, see below)

## Files Created/Modified
- `client/src/pages/ProductDetails.tsx` - Added feature flag constants, Tooltip import, wrapped both AI buttons with TooltipProvider/disabled pattern, guarded showBgPicker overlay

## Decisions Made
- Feature flags read from `VITE_FEATURE_AI_BG_REMOVAL` and `VITE_FEATURE_AI_PHOTOSHOOT` Vite env vars (must be string `"true"` to enable)
- Buttons kept visible (not hidden) per CONTEXT.md D-03 — communicates features are planned
- `TooltipContent` rendered conditionally (`{!FLAG && <TooltipContent>}`) so tooltip only shows when disabled — avoids tooltip on enabled state

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. To re-enable features, set `VITE_FEATURE_AI_BG_REMOVAL=true` or `VITE_FEATURE_AI_PHOTOSHOOT=true` in the client `.env` file.

## Next Phase Readiness
- AI Background and AI Photoshoot buttons are now disabled with "Coming soon" UX
- Phase 06-03 (AI content generation UI) can proceed — no dependency on these buttons
- Re-enabling either feature requires only setting the corresponding env var to `"true"`

---
*Phase: 06-product-detail-ai-content*
*Completed: 2026-04-02*
