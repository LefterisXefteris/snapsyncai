---
status: investigating
trigger: "unlock-images endpoint deducts credits but fullAnalyzeImage fails silently — images get no title/description/price populated"
created: 2026-03-31T00:00:00Z
updated: 2026-03-31T00:00:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: fullAnalyzeImage throws rather than returns a graceful failure — the throw escapes the outer endpoint try/catch at line 1471. Root cause not determinable by code reading alone because: (a) inner function has comprehensive try/catch, (b) memoizee is well-tested. Fix applied: isolated try/catch around fullAnalyzeImage call itself so if it throws, analysis=null and code falls through to graceful "AI analysis failed" path instead of hitting outer catch.
test: Server logs with [unlock-images] prefix will show exactly where the error originates
expecting: After fix: either fullAnalyzeImage throws (caught by inner try/catch, returns line 1478 message) or returns normally (returns title or "AI analysis failed" message). Either way, no more "Full analysis failed" message.
next_action: User triggers unlock-images endpoint, checks server logs for [unlock-images] CAUGHT ERROR or [unlock-images] fullAnalyzeImage THREW messages

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: POST /api/subscription/unlock-images calls fullAnalyzeImage for each image, populates title, description, price, category, tags, seoTitle, etc. and saves to DB
actual: Endpoint returns 200 with "Full analysis failed but product unlocked. You can edit details manually." for every image. All fields remain null except original filename as title.
errors: |
  POST /api/subscription/unlock-images 200 in 335ms
  {"processed":5,"results":[
    {"id":255,"error":"Full analysis failed but product unlocked. You can edit details manually."},
    {"id":243,"error":"Full analysis failed but product unlocked. You can edit details manually."},
    ...all 5 images same error
  ]}
  Credits ARE deducted (balance went from 10 to 5) but analysis produces nothing.
  Images exist in Supabase Storage (GET /api/images/:id/file returns 302 to storage URL successfully).
reproduction: Upload images on free tier (quick preview only), buy a credit pack, trigger unlock/analyze on those images
started: Unknown — may be pre-existing. Not related to Phase 1 changes

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: loadImageBuffer returns null (Supabase fetch fails) → outer catch fires
  evidence: If loadImageBuffer returns null, code hits line 1434 "!buffer" branch which returns a "basic data" note — NOT the outer catch. Outer catch only fires on thrown exceptions.
  timestamp: 2026-03-31

- hypothesis: fullAnalyzeImage returns failure object → outer catch fires
  evidence: If analysis.description === "Failed to analyze image.", code hits line 1474-1476 else branch which returns line 1476 "AI analysis failed" message — NOT the outer catch.
  timestamp: 2026-03-31

- hypothesis: loadImageBuffer throws (has its own try/catch around fetch call)
  evidence: loadImageBuffer has try/catch wrapping the fetch call. The only non-wrapped path is Buffer.from(imageData) but imageData is null for free-tier images so that path is skipped.
  timestamp: 2026-03-31

- hypothesis: memoizee circular invocation causes throw
  evidence: Traced through memoizee source — circular invocation only fires if same cache key is set during synchronous execution of inner function. _fullAnalyzeImage doesn't call fullAnalyzeImage synchronously before its first await. attempt=1 and attempt=2 have different cache keys. Cannot be the cause.
  timestamp: 2026-03-31

- hypothesis: DB unavailability causes storage.updateImage to throw in else/success branches
  evidence: If DB were unavailable, catch block's storage.updateImage (line 1477) would ALSO throw, making worker Promise reject, making runWithConcurrency reject, making endpoint return 500 — but we see 200. Therefore DB IS available during catch block execution. DB availability is not the issue.
  timestamp: 2026-03-31

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-03-31T00:10:00Z
  checked: server/routes.ts loadImageBuffer (lines 51-68)
  found: Fetches from storageUrl with try/catch, returns null on failure (never throws). Full select via getImagesByIds returns storageUrl.
  implication: loadImageBuffer path is safe — null buffer → "basic data" note (not outer catch)

- timestamp: 2026-03-31T00:10:00Z
  checked: server/routes.ts fullAnalyzeImage (lines 341-445)
  found: Inner function has comprehensive try/catch. On failure after MAX_RETRIES=2, returns { description: "Failed to analyze image." }. Model is "gpt-5.2" (Replit proxy alias, same as quickPreviewImage which works).
  implication: fullAnalyzeImage should resolve (not reject) with failure object. Outer catch at 1471 should NOT fire via this path.

- timestamp: 2026-03-31T00:10:00Z
  checked: Timing — 335ms for 5 images in outer catch
  found: Too fast for real OpenAI calls (those take 1-2s each). Either fails before OpenAI call, or OpenAI returns immediate error.
  implication: Something is failing synchronously or very quickly for ALL 5 images consistently

- timestamp: 2026-03-31T00:10:00Z
  checked: Lines 1449-1465 — storage.updateImage with analysis data
  found: Called after analysisSucceeded=true. CAN throw if DB error. Would hit outer catch → "Full analysis failed"
  implication: If OpenAI succeeds but updateImage throws, we'd see the outer catch error. BUT 335ms is too fast for OpenAI + DB to both complete.

- timestamp: 2026-03-31T00:10:00Z
  checked: Added debug logging at lines 1431, 1432, 1445, 1446 and enhanced catch at 1471
  found: Logging added to reveal buffer status, OpenAI call entry/exit, and exact caught error
  implication: Next test run will show exactly where the throw originates

- timestamp: 2026-03-31T00:20:00Z
  checked: Applied defensive fix — isolated try/catch around fullAnalyzeImage call so it CANNOT propagate to outer catch
  found: TypeScript compiles cleanly. If fullAnalyzeImage throws, analysis=null, code falls to "AI analysis failed" graceful path instead of outer catch
  implication: This fix prevents the "Full analysis failed" message from appearing even if root cause of throw is not yet known

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: Unknown — requires server logs to confirm. Outer catch at line 1471 fires for all 5 images. All logical paths that should gracefully handle failure without throwing have been verified. The remaining candidates are: (1) fullAnalyzeImage memoized wrapper throws for an unknown reason, (2) a very subtle Node.js/memoizee interaction.
fix: Defensive try/catch around fullAnalyzeImage call (lines 1448-1453) so that if it throws, analysis=null and code falls to graceful "AI analysis failed" path. Added [unlock-images] debug logging at each step to reveal actual error on next test run.
verification: Awaiting user test with server logs
files_changed: [server/routes.ts]
