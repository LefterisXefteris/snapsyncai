---
phase: 07-ai-auto-grouping-agent
plan: 01
subsystem: api
tags: [gpt-5.2, vision, sse, auto-grouping, openai, streaming]

# Dependency graph
requires:
  - phase: 06-product-detail-ai-content
    provides: SSE streaming pattern with GPT-5.2 vision and openai client
provides:
  - POST /api/images/auto-group SSE endpoint for AI-powered image grouping
  - api.images.autoGroup route constant in shared/routes.ts
affects: [07-ai-auto-grouping-agent]

# Tech tracking
tech-stack:
  added: []
  patterns: [batched-vision-grouping, cross-batch-merge-pass, json_object-response-format]

key-files:
  created: []
  modified:
    - shared/routes.ts
    - server/routes.ts

key-decisions:
  - "Batch size 15 images per GPT call for accuracy vs cost balance"
  - "Non-streaming GPT calls (no stream: true) since full JSON response needed for parsing"
  - "Cross-batch merge pass uses label similarity via GPT to combine groups across batches"

patterns-established:
  - "Batched vision grouping: split large image sets into batches, map local indices to global, merge cross-batch"
  - "json_object response_format for structured GPT responses (vs stream mode in Phase 06)"

requirements-completed: [GROUP-01]

# Metrics
duration: 2min
completed: 2026-04-06
---

# Phase 07 Plan 01: Auto-Group SSE Endpoint Summary

**SSE endpoint for AI-powered product image grouping using GPT-5.2 vision with batched processing and cross-batch merge**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-06T21:29:47Z
- **Completed:** 2026-04-06T21:31:20Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added autoGroup route constant to shared/routes.ts for client-side route resolution
- Implemented POST /api/images/auto-group SSE endpoint that accepts up to 200 base64 images
- Batched vision analysis (15 images/batch) with GPT-5.2 for product grouping
- Cross-batch merge pass to unify groups that span multiple batches
- SSE streaming of each identified product group with label, imageIndices, and confidence

## Task Commits

Each task was committed atomically:

1. **Task 1: Add autoGroup route constant** - `955b1a7` (feat)
2. **Task 2: Implement SSE auto-grouping endpoint** - `aad548d` (feat)

## Files Created/Modified
- `shared/routes.ts` - Added api.images.autoGroup route constant with POST /api/images/auto-group
- `server/routes.ts` - Implemented SSE auto-grouping endpoint with batched GPT-5.2 vision calls

## Decisions Made
- Batch size of 15 images per GPT call balances accuracy with API cost
- Used response_format json_object (not streaming) since full JSON response is needed for index parsing
- Cross-batch merge pass uses GPT to compare group labels and combine similar groups
- Confidence escalation during merge: highest confidence from source groups propagates

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## Known Stubs
None - endpoint is fully functional with real GPT-5.2 vision calls.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SSE endpoint ready for client-side integration (Plan 02+)
- Route constant available for frontend fetch calls via api.images.autoGroup

---
*Phase: 07-ai-auto-grouping-agent*
*Completed: 2026-04-06*
