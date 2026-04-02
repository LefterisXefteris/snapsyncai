---
phase: 06-product-detail-ai-content
verified: 2026-04-02T23:00:00Z
status: gaps_found
score: 10/12 must-haves verified
re_verification: false
gaps:
  - truth: "The user can save the accepted values using the existing Save button"
    status: failed
    reason: "Schema mismatch: AiContentPanel generates aeoFaqs as {q, a}[] but the server updateSchema validates aeoFaqs as {question, answer}[]. Sending accepted AEO FAQs to PUT /api/images/:id will return HTTP 400 from Zod validation, silently failing the save."
    artifacts:
      - path: "client/src/components/ai-content-panel.tsx"
        issue: "Generates aeoFaqs as {q: string, a: string}[] — plan-specified format from 06-01 SSE endpoint prompt"
      - path: "client/src/hooks/use-images.ts"
        issue: "GeneratedContent interface defines aeoFaqs as {q: string, a: string}[] — same mismatch"
      - path: "server/routes.ts"
        issue: "updateSchema line 199 validates aeoFaqs as z.array(z.object({ question, answer })) — rejects {q, a} input"
    missing:
      - "Either: update updateSchema in server/routes.ts line 199 to accept {q, a} format (z.object({ q: z.string(), a: z.string() }))"
      - "Or: transform aeoFaqs in ProductDetails.tsx handleSave — map {q,a} to {question,answer} before sending"
      - "Also update GeneratedContent interface in use-images.ts and AiContentPanel types if format is changed server-side"

  - truth: "The stream yields a complete title, description, seo keywords array, and aeoFaqs array by the time it closes"
    status: partial
    reason: "The generate-content SSE endpoint stream is correctly implemented. However, the aeoFaqs format from the AI prompt uses {q, a} (instructed in system prompt) while the rest of the app expects {question, answer}. The streamed JSON is valid and the UI accepts it — but accepted values cannot be persisted (blocked by gap above). The stream itself works; persistence is broken."
    artifacts:
      - path: "server/routes.ts"
        issue: "System prompt at line 3130 instructs AI to output aeoFaqs as {q, a} — correct for SSE consumption — but this conflicts with the updateSchema that persists {question, answer}"
    missing:
      - "Align the aeoFaqs key convention across: SSE prompt output, GeneratedContent interface, updateSchema, and DB storage — pick one format and apply consistently"
human_verification:
  - test: "Visually confirm AI Content Generator panel renders above title/description for a paid product"
    expected: "Panel with Category, Style/Tone, Audience inputs and Generate All button is visible at the top of the main content column"
    why_human: "Cannot verify rendered UI layout programmatically — needs browser"
  - test: "Click Generate All and observe streaming"
    expected: "All four fields (Title, Description, SEO Keywords, AEO FAQ Pairs) fill word-by-word; Accept and Regenerate buttons appear for each"
    why_human: "SSE streaming behavior and word-by-word animation cannot be verified without running the app"
  - test: "AI Background and AI Photoshoot buttons visible with SOON badge and Coming Soon tooltip"
    expected: "Both buttons greyed out, opacity-50, SOON badge visible inline, tooltip shows 'Coming soon' on hover"
    why_human: "Visual state and tooltip hover behavior requires browser"
  - test: "Accepting Title and Description via AI panel, then clicking Save"
    expected: "Title and Description are persisted. AEO FAQs will fail to save due to schema mismatch gap — verify the 400 error occurs."
    why_human: "Need to observe actual API response to confirm the gap is live"
---

# Phase 06: Product Detail AI Content Verification Report

**Phase Goal:** Users can prompt and generate AI-written title, description, SEO tags, and AEO tags directly within the product detail view; AI background removal and AI photoshoot features are temporarily disabled with "coming soon" indicators controlled via a feature flag or env toggle.
**Verified:** 2026-04-02T23:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | POST /api/images/:id/generate-content returns an SSE stream of content chunks | VERIFIED | server/routes.ts line 3098-3176; SSE headers set, openai stream iterated, chunks written |
| 2 | The stream yields title, description, seo keywords, and aeoFaqs (stream impl correct; save broken) | PARTIAL | Stream code correct; aeoFaqs {q,a} format conflicts with {question,answer} updateSchema |
| 3 | POST /api/images/:id/regenerate-field returns an SSE stream for a single specified field | VERIFIED | server/routes.ts line 3178-3256; fieldPrompts map, same SSE pattern |
| 4 | Both endpoints use product images (multimodal) and guided prompt inputs as context | VERIFIED | userContent array includes image_url base64 part + text part with category/styleTone/audience |
| 5 | Endpoints reject requests for images not owned by the requesting user | VERIFIED | Both endpoints: `image.sessionId !== getUserId(req)` returns 404 |
| 6 | AI Background button is visible but visually disabled with a Coming Soon tooltip | VERIFIED | ProductDetails.tsx line 909-931; TooltipProvider, opacity-50, disabled prop, SOON badge |
| 7 | AI Photoshoot button is visible but visually disabled with a Coming Soon tooltip | VERIFIED | ProductDetails.tsx line 935-956; same pattern, AI_PHOTOSHOOT_ENABLED guard |
| 8 | Feature flags controlled via VITE_FEATURE_AI_BG_REMOVAL and VITE_FEATURE_AI_PHOTOSHOOT | VERIFIED | Lines 22-23 in ProductDetails.tsx; import.meta.env pattern, default false |
| 9 | Panel with Category, Style/Tone, and Audience guided inputs is visible in product detail view | VERIFIED | ai-content-panel.tsx lines 117-151; all three inputs rendered |
| 10 | Clicking Generate streams all four fields word-by-word into preview areas | VERIFIED | AiContentPanel.handleGenerate calls useGenerateContent with onChunk/onDone; FieldPreview shows results |
| 11 | Each preview area has Accept and Regenerate buttons | VERIFIED | FieldPreview component lines 288-310; both buttons present with correct handlers |
| 12 | The user can save the accepted values using the existing Save button | FAILED | aeoFaqs schema mismatch: client sends {q,a}[], server rejects with 400 (expects {question,answer}[]) |

**Score:** 10/12 truths verified (11 VERIFIED, 1 PARTIAL treated as FAILED for scoring, 1 FAILED)

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `server/routes.ts` | generate-content and regenerate-field SSE endpoints | VERIFIED | Lines 3098-3256; 160 lines of substantive implementation |
| `shared/routes.ts` | Route constants for generate-content and regenerate-field | VERIFIED | Lines 111-118; generateContent and regenerateField in api.images |
| `client/src/components/ai-content-panel.tsx` | AiContentPanel with guided inputs + streaming + per-field accept/regenerate | VERIFIED | 316 lines (exceeds 120 minimum); complete implementation |
| `client/src/hooks/use-images.ts` | useGenerateContent and useRegenerateField hooks | VERIFIED | Lines 869-1000+; both hooks export confirmed |
| `client/src/pages/ProductDetails.tsx` | Feature flags + AiContentPanel wired in | VERIFIED | AiContentPanel imported line 20, rendered line 343-352 |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| server/routes.ts | openai (gpt-5.2 multimodal) | openai.chat.completions.create with stream: true + image_url content parts | WIRED | Lines 3148-3156 and 3228-3236; model "gpt-5.2", stream true, image_url base64 |
| shared/routes.ts | server/routes.ts | api.images.generateContent.path constant | WIRED | Path '/api/images/:id/generate-content' matches route registration |
| client/src/components/ai-content-panel.tsx | /api/images/:id/generate-content | useGenerateContent hook — SSE fetch with ReadableStream reader | WIRED | use-images.ts line 886: buildUrl(api.images.generateContent.path, {id: imageId}) |
| client/src/pages/ProductDetails.tsx | ai-content-panel.tsx | AiContentPanel onAccept callbacks update title/description/tags/aeoFaqs state | WIRED | Lines 347-350; onAcceptTitle/Description/Tags/AeoFaqs all wired to setState |
| client state (tags, aeoFaqs) | server PUT /api/images/:id | handleSave includes tags and aeoFaqs in updateMutation payload | BROKEN | aeoFaqs sent as {q,a}[] but updateSchema expects {question,answer}[] — Zod rejects |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| ai-content-panel.tsx | generated (GeneratedContent) | useGenerateContent hook — fetch POST to SSE endpoint | Yes (openai.chat.completions.create with stream) | FLOWING |
| ProductDetails.tsx | title, description | setTitle/setDescription from AiContentPanel onAccept callbacks | Yes — updates local state that renders in Input fields | FLOWING |
| ProductDetails.tsx | tags, aeoFaqs | setTags/setAeoFaqs from onAccept callbacks; initialized from image.tags/image.aeoFaqs | Partially — state updates correctly, but aeoFaqs cannot be saved due to schema mismatch | HOLLOW (save path broken) |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Route constants exist in shared/routes.ts | grep generateContent shared/routes.ts | Lines 111, 115 found | PASS |
| SSE endpoints registered in server/routes.ts | grep "generate-content" server/routes.ts | Lines 3098, 3168 found | PASS |
| AiContentPanel component substantive (>120 lines) | wc -l ai-content-panel.tsx | 316 lines | PASS |
| Feature flag constants defined in ProductDetails | grep VITE_FEATURE_AI ProductDetails.tsx | Lines 22-23 found | PASS |
| AiContentPanel imported and rendered in ProductDetails | grep AiContentPanel ProductDetails.tsx | Import line 20, render line 343 | PASS |
| handleSave includes tags and aeoFaqs | grep "tags,\|aeoFaqs," in handleSave block | Lines 265-266 in handleSave | PASS |
| updateSchema aeoFaqs format vs client format | grep updateSchema + GeneratedContent interface | MISMATCH: server {question,answer} vs client {q,a} | FAIL |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PROD-01 | 06-01, 06-03 | AI content generation for title, description, SEO tags, AEO FAQs | PARTIAL | Generation and UI work; persisting AEO FAQs broken by schema mismatch |
| PROD-02 | 06-02 | AI Background Removal disabled with Coming Soon | SATISFIED | Feature flag guard + tooltip verified in ProductDetails.tsx |
| PROD-03 | 06-02 | AI Photoshoot disabled with Coming Soon | SATISFIED | Feature flag guard + tooltip verified in ProductDetails.tsx |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| server/routes.ts | 199 | updateSchema aeoFaqs expects `{question, answer}` | Blocker | Rejects `{q, a}[]` from AI panel with HTTP 400; AEO FAQs cannot be saved after generation |
| client/src/hooks/use-images.ts | 873 | GeneratedContent.aeoFaqs typed as `{q, a}[]` | Blocker | Perpetuates the {q,a} convention on client — mismatched with server schema |
| server/routes.ts | 3130 | SSE system prompt outputs `{q, a}` format for aeoFaqs | Blocker | AI generates {q,a}, client accepts {q,a}, server rejects {q,a} on save — full-stack inconsistency |

No placeholder/stub patterns. The "SOON" matches are intentional feature-flag text (not stubs).

---

## Human Verification Required

### 1. AI Content Generator Panel Layout

**Test:** Open a paid product's detail page — verify the AI Content Generator card is the first item in the main content column, above the Title/Description card.
**Expected:** Card with "AI Content Generator" header, Sparkles icon, Category/Style/Tone/Audience inputs, and "Generate All" button visible.
**Why human:** Cannot verify React render order and visual layout without a browser.

### 2. Streaming Word-by-Word Behavior

**Test:** Click "Generate All" in the panel and observe all four field areas filling.
**Expected:** Streaming indicator shows raw JSON building, then all four FieldPreview sections appear with Title, Description, SEO Keywords (as badges), and AEO FAQ Pairs (q+a pairs).
**Why human:** SSE streaming and animated text fill cannot be verified statically.

### 3. Coming Soon Tooltip Interaction

**Test:** Hover over the AI Background and AI Photoshoot buttons in a paid product view.
**Expected:** Both buttons are greyed out (opacity-50) with SOON badge; tooltip "Coming soon" appears on hover.
**Why human:** Tooltip hover behavior requires browser interaction.

### 4. Save Behavior with Accepted AEO FAQs (Gap Confirmation)

**Test:** Accept an AEO FAQ result from the panel then click Save.
**Expected (current broken state):** Save fails silently or shows toast error "Update Failed" due to 400 from server. Title and description acceptance + save should work fine.
**Why human:** Need to observe the actual API response in devtools to confirm the gap is live.

---

## Gaps Summary

**One root-cause, two symptoms:** The phase has a single structural inconsistency introduced across the three plans — the aeoFaqs key convention was never aligned.

- Plan 06-01 used `{q, a}` in the SSE system prompt (intentional — short JSON for streaming)
- Plan 06-03 followed that convention in `GeneratedContent` interface and `AiContentPanel`
- The pre-existing `updateSchema` in `server/routes.ts` (used long before Phase 06) uses `{question, answer}` for the aeoFaqs column — this was the app's established convention

The result: generation works, UI works, accept works, but the save pathway fails Zod validation at the server with a 400 response whenever `aeoFaqs` contains accepted AI-generated content.

**Fix scope:** Small — either update the `updateSchema` Zod shape (2 lines) or add a transform in `handleSave` (3-5 lines). No architectural changes required.

Title, description, and SEO keywords (tags) are unaffected — they save correctly.

---

_Verified: 2026-04-02T23:00:00Z_
_Verifier: Claude (gsd-verifier)_
