---
phase: 06-product-detail-ai-content
plan: "01"
subsystem: api
tags: [openai, sse, streaming, multimodal, gpt-5.2, routes]

# Dependency graph
requires: []
provides:
  - "POST /api/images/:id/generate-content SSE endpoint (streams title, description, seoKeywords, aeoFaqs)"
  - "POST /api/images/:id/regenerate-field SSE endpoint (streams single specified field)"
  - "Route constants generateContent and regenerateField in shared/routes.ts"
affects:
  - "06-product-detail-ai-content/06-03 (UI consuming these SSE endpoints)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SSE streaming with openai.chat.completions.create({ stream: true })"
    - "Multimodal gpt-5.2 with image_url base64 content parts"
    - "Ownership check via image.sessionId !== getUserId(req) before streaming"

key-files:
  created: []
  modified:
    - shared/routes.ts
    - server/routes.ts

key-decisions:
  - "Single image only for both endpoints — storage.getImagesByGroup not available, fallback to primary image"
  - "String(req.params.id) cast required for TypeScript compatibility with express param typing"
  - "No response_format json_object — SSE stream mode does not support it; JSON is enforced via system prompt instructions"

patterns-established:
  - "SSE endpoint pattern: set headers, create openai stream, write chunks, write done event, end response"
  - "Error handling: if headers sent on error, write error SSE event and end; otherwise return 500 JSON"

requirements-completed:
  - PROD-01

# Metrics
duration: 10min
completed: "2026-04-02"
---

# Phase 06 Plan 01: Generate Content SSE Endpoints Summary

**Two multimodal SSE streaming endpoints added — generate-content yields full JSON (title, description, seoKeywords, aeoFaqs) from gpt-5.2, regenerate-field streams a single specified field on demand**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-02T22:21:00Z
- **Completed:** 2026-04-02T22:31:29Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- POST /api/images/:id/generate-content streams word-by-word JSON content via SSE using gpt-5.2 with multimodal image context
- POST /api/images/:id/regenerate-field streams a targeted single-field regeneration (title, description, seoKeywords, or aeoFaqs)
- Both endpoints enforce image ownership before opening SSE stream
- Route constants generateContent and regenerateField added to shared/routes.ts for type-safe client usage

## Task Commits

1. **Task 1: Add route constants to shared/routes.ts** - `3191eec` (feat)
2. **Task 2: Implement SSE endpoints in server/routes.ts** - `d0ac180` (feat)

## Files Created/Modified
- `shared/routes.ts` - Added generateContent and regenerateField route constants to api.images
- `server/routes.ts` - Added ~160 lines: two new SSE POST endpoints before return httpServer

## Decisions Made
- Single image only: `storage.getImagesByGroup` does not exist in storage.ts; falling back to the single primary image for multimodal context
- `String(req.params.id)` cast used to satisfy TypeScript's `string | string[]` express param type (consistent with existing handler patterns in the file)
- No `response_format: json_object` — OpenAI streaming API does not support JSON mode; JSON output is enforced purely via system prompt instructions

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Wrapped req.params.id in String() for TypeScript compatibility**
- **Found during:** Task 2 (TypeScript check after implementation)
- **Issue:** `parseInt(req.params.id)` produced TS2345 error — express types param as `string | string[]`
- **Fix:** Changed to `parseInt(String(req.params.id))` in both new handlers, matching pattern used elsewhere in routes.ts (lines 2885, 2958, 3012, 3057)
- **Files modified:** server/routes.ts
- **Verification:** tsc --noEmit shows zero errors in lines 3098+ of server/routes.ts
- **Committed in:** d0ac180 (Task 2 commit)

**2. [Rule 3 - Blocking] Skipped multi-image group loading — storage.getImagesByGroup unavailable**
- **Found during:** Task 2 (reading storage.ts)
- **Issue:** Plan specified loading up to 3 group images via `storage.getImagesByGroup(productGroupId)` but this method does not exist in storage.ts
- **Fix:** Fell back to single image content part as plan instructed as fallback ("or fallback to single image if method unavailable")
- **Files modified:** None (no code change needed)
- **Verification:** Implementation uses single image consistently, plan fallback honored

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking/fallback)
**Impact on plan:** Both deviations addressed within plan-specified fallback guidance. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in server/routes.ts (lines 1105, 1106, 1236, 1237, 1922) related to Stripe Subscription type and other files — confirmed pre-existing, not introduced by this plan

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Both SSE endpoints are live and ready for Plan 06-03 UI consumption
- Client can use `api.images.generateContent` and `api.images.regenerateField` constants from shared/routes.ts to construct URLs
- EventSource / fetch + ReadableStream pattern needed on the client side to consume the SSE chunks

---
*Phase: 06-product-detail-ai-content*
*Completed: 2026-04-02*
