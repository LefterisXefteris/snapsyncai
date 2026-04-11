# Roadmap: LisAI Security Hardening

## Overview

This milestone closes the active fraud vector and security gaps found in the production codebase audit. All fixes are in-place inside existing files — no restructuring. Phases are ordered by severity: the credit double-grant (actively exploited) ships first, followed by the auth bypass guard (production-critical one-liner isolated to minimize blast radius), then at-rest encryption for all third-party OAuth tokens (five requirements that form one coherent system), and finally the Stripe SDK version fix. Every phase delivers a verifiable production-safe change.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Credit Idempotency** - Stop the active credit double-grant by making the verify and webhook paths atomic (completed 2026-03-31)
- [ ] **Phase 2: Auth Bypass Guard** - Prevent DEV_BYPASS_AUTH from silently disabling auth in production
- [ ] **Phase 3: Token Encryption** - Encrypt all third-party OAuth tokens at rest before writing to the DB
- [ ] **Phase 4: Stripe SDK Fix** - Remove the `as any` cast on the Stripe API version string

## Phase Details

### Phase 1: Credit Idempotency
**Goal**: Credits are granted exactly once per Stripe checkout session, regardless of how many times the verify endpoint or webhook fires
**Depends on**: Nothing (first phase)
**Requirements**: PAY-01
**Success Criteria** (what must be TRUE):
  1. Calling `POST /api/credits/verify` twice with the same `checkoutSessionId` grants credits only once — the second call returns a success response but adds zero credits
  2. If the Stripe webhook fires for a session that was already processed by the verify endpoint (or vice versa), no additional credits are added
  3. The idempotency check reads and sets `paidSessions.used` atomically so concurrent calls cannot both pass the check
**Plans**: 2 plans
Plans:
- [x] 01-01-PLAN.md — Add claimAndGrantCredits atomic storage method
- [x] 01-02-PLAN.md — Wire verify endpoint and webhook to claimAndGrantCredits

### Phase 2: Auth Bypass Guard
**Goal**: The server hard-errors on startup if `DEV_BYPASS_AUTH=true` is set in a production environment, making misconfiguration impossible to miss
**Depends on**: Phase 1
**Requirements**: AUTH-01
**Success Criteria** (what must be TRUE):
  1. Starting the server with `DEV_BYPASS_AUTH=true` and `NODE_ENV=production` throws an error (not a warning) and halts startup
  2. Starting the server with `DEV_BYPASS_AUTH=true` and `NODE_ENV=development` proceeds normally — no regression
  3. Starting the server without `DEV_BYPASS_AUTH` set (the production default) proceeds normally
**Plans**: TBD

### Phase 3: Token Encryption
**Goal**: Shopify, Etsy, Amazon, and Instagram OAuth tokens are encrypted before being written to the database and decrypted transparently on read, so no plaintext credential is stored at rest
**Depends on**: Phase 2
**Requirements**: CRED-01, CRED-02, CRED-03, CRED-04, CRED-05
**Success Criteria** (what must be TRUE):
  1. After a user connects Shopify, the `access_token` column in `shopify_connections` contains ciphertext, not a plaintext token
  2. After a user connects Etsy, Amazon, or Instagram, the respective token columns in each connection table contain ciphertext
  3. All existing platform push flows (Shopify, Etsy, Amazon, Instagram) continue to work without errors — tokens are decrypted transparently before being passed to the platform SDK
  4. A token encrypted with `ENCRYPTION_KEY` at write time decrypts correctly on the next read without any caller changes
**Plans**: TBD

### Phase 4: Stripe SDK Fix
**Goal**: The Stripe client is initialized with a valid supported API version string so TypeScript type safety is fully enforced on Stripe objects
**Depends on**: Phase 3
**Requirements**: INFRA-01
**Success Criteria** (what must be TRUE):
  1. `server/stripeClient.ts` compiles without the `as any` cast on the API version string
  2. The Stripe SDK accepts the version string without a type error at compile time
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Credit Idempotency | 2/2 | Complete   | 2026-03-31 |
| 2. Auth Bypass Guard | 0/? | Not started | - |
| 3. Token Encryption | 0/? | Not started | - |
| 4. Stripe SDK Fix | 0/? | Not started | - |

---

## Milestone 2: Product UX

Improvements to the core product experience — image upload flow, drag-and-drop UX, and staging persistence.

### Phase 5: Drag-and-Drop UI Improvements
**Goal**: Make the pre-upload image staging UI reliable and easy to use — staged images persist across page reloads and drag-and-drop grouping is intuitive
**Depends on**: Nothing (independent of security phases)
**Beads**: lisai-app-pde
**Requirements**: UX-01 (persistence), UX-02 (drag UX), UX-03 (group management)
**Success Criteria** (what must be TRUE):
  1. Staged images (not yet uploaded) survive a page refresh — user returns to the same groups automatically, no prompt
  2. Staged images are stored in IndexedDB as blobs and auto-expire after 24 hours
  3. The entire group card is a drop target (not just a narrow strip)
  4. Users can select multiple thumbnails and drag them together as a batch
  5. First image in a group is the hero — reordering within a group changes which image is first
  6. Each group card has a +/- control to adjust max images per group
**Plans**: 5 plans
Plans:
- [x] 05-01-PLAN.md — Install idb + create use-staged-images IndexedDB hook
- [x] 05-02-PLAN.md — Migrate upload-zone to Group[] state + wire IDB persistence + restore-on-mount
- [x] 05-03-PLAN.md — Add multi-select drag batch move + per-group max +/- controls
- [x] 05-04-PLAN.md — Fix full-card drop target + scale hover feedback
- [ ] 05-05-PLAN.md — Human verification of all 6 success criteria

### Phase 6: Product Detail AI Content Generation
**Goal**: Users can prompt and generate AI-written title, description, SEO tags, and AEO tags directly within the product detail view; AI background removal and AI photoshop features are disabled
**Depends on**: Nothing (independent of security phases)
**Beads**: lisai-app-0kt
**Requirements**: PROD-01 (AI content generation), PROD-02 (disable AI background), PROD-03 (disable AI photoshop)
**Success Criteria** (what must be TRUE):
  1. Within the product detail view, the user can enter a prompt and generate a product title
  2. Within the product detail view, the user can enter a prompt and generate a product description
  3. Within the product detail view, the user can generate SEO tags for the product
  4. Within the product detail view, the user can generate AEO (Answer Engine Optimization) tags for the product
  5. Generated content is editable before saving — user can tweak before committing
  6. AI background removal feature is disabled (visible but greyed out with "coming soon" tooltip)
  7. AI photoshop feature is disabled (visible but greyed out with "coming soon" tooltip)
**Plans**: 3 plans
Plans:
- [x] 06-01-PLAN.md — Add generate-content + regenerate-field SSE endpoints to server/routes.ts
- [x] 06-02-PLAN.md — Feature-flag disable AI Background and AI Photoshoot buttons with "coming soon" tooltips
- [x] 06-03-PLAN.md — Build AiContentPanel component + wire into ProductDetails.tsx

### Phase 7: AI Auto-Grouping Agent
**Goal**: When users upload up to 200 images, an AI agent visually identifies which images show the same product and auto-groups them — then runs full AI analysis per group. Users review and tweak the suggested groupings before confirming.
**Depends on**: Phase 6
**Beads**: lisai-app-2xh
**Requirements**: GROUP-01 (AI visual grouping), GROUP-02 (review and tweak), GROUP-03 (confirm triggers analysis), GROUP-04 (manual mode preserved)
**Success Criteria** (what must be TRUE):
  1. Uploading multiple images triggers AI-based visual similarity detection that groups images of the same product together
  2. Suggested groupings are presented to the user for review — user can split, merge, or rearrange before confirming
  3. After the user confirms groupings, full AI analysis (title, description, SEO, AEO, pricing) runs automatically per product group
  4. The existing manual drag-and-drop grouping flow remains available as an alternative
**Plans**: 6 plans
Plans:
- [x] 07-01-PLAN.md — SSE auto-grouping endpoint with batched GPT-5.2 vision calls
- [x] 07-02-PLAN.md — useAutoGroup hook + mode choice UI + live group streaming
- [x] 07-03-PLAN.md — AI labels on group cards + Confirm & Analyze All button
- [ ] 07-04-PLAN.md — Human verification of all 4 success criteria
- [x] 07-05-PLAN.md — One-click variant-family grouping button + stronger same-product merge behavior
- [ ] 07-06-PLAN.md — Strengthen apparel-family grouping quality + truthful workspace review feedback

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 5. Drag-and-Drop UI | 4/5 | In Progress|  |
| 6. Product Detail AI Content | 3/3 | Complete | 2026-04-02 |
| 7. AI Auto-Grouping Agent | 4/6 | In Progress | - |
| 8. Embeddings Variant Clustering | 0/? | Not started | - |
| 9. Manual Grouping-First UX | 0/5 | Not started | - |

### Phase 8: Embeddings Variant Clustering
**Goal**: Replace the GPT-5.2 vision call inside `runAutoGrouping` with a Cohere Embed v4 + cosine-similarity + union-find clustering pipeline so same-product / variant images are grouped faster and cheaper, with a filename-only fallback path (via the existing apparel-token merger) and a user-visible warning banner when the fallback runs
**Depends on**: Phase 7
**Requirements**: CLUSTER-01, CLUSTER-02, CLUSTER-03, CLUSTER-04
**Success Criteria** (what must be TRUE):
  1. The auto-group SSE and JSON endpoints no longer call GPT-5.2 vision inside their hot path — embeddings + clustering produce the groups
  2. End-to-end latency on 50 images is at most the prior VLM baseline and cost per 100 images is strictly lower (verified during human checkpoint)
  3. When Cohere fails (any non-2xx after 1 retry, including timeouts), grouping falls back to filename-only bucketing via `mergeAutoGroupsByFamily` — NOT to the VLM path
  4. The fallback path surfaces a warning banner above the group cards (pre-upload flow) and a destructive toast (workspace Sort Variants flow) so the user knows grouping degraded
  5. `COHERE_API_KEY` is recorded as a deploy blocker in STATE.md (mirroring the Phase 3 ENCRYPTION_KEY precedent)
**Plans**: 3 plans
Plans:
- [x] 08-01-PLAN.md — Install cohere-ai + add embedding-utils (clusterByCosine, embedImagesCohere) + unit tests
- [x] 08-02-PLAN.md — Rewrite runAutoGrouping with Cohere primary path + filename-only fallback + propagate fallbackUsed signal
- [ ] 08-03-PLAN.md — Client fallback banner + toast + STATE.md deploy blocker + human verification checkpoint

### Phase 9: Manual Grouping-First UX
**Goal**: Make manual drag-and-drop the primary grouping UX — fast and frictionless enough that AI auto-sort is an optional secondary button, not the default. Staged groups in IndexedDB are promoted to Supabase as product records one group at a time via the existing POST /api/images/upload groupAsOne=true path, with per-group failure isolation so a single upload error never wipes the user's staging work. The free-text AI prompt and preset group-size controls are permanently removed from the staging UI.
**Depends on**: Phase 8
**Requirements**: GROUP-05, GROUP-06, GROUP-07, GROUP-08, GROUP-09, GROUP-10, GROUP-11, GROUP-12
**Success Criteria** (what must be TRUE):
  1. On file drop, the user lands directly in manual drag-and-drop mode — no three-card mode chooser appears; AI auto-sort is only reachable as a secondary toolbar button
  2. The "Custom AI Prompt" textarea, brand-tone selector, per-group maxImages +/- controls, and [1..5] presets toolbar are gone from upload-zone.tsx
  3. Clicking a thumbnail selects only that one; Shift-click extends a range in visual order across groups; Cmd/Ctrl-click toggles a single thumbnail; selection persists through drag so multi-select batch moves work
  4. Dropping a dragged thumbnail onto an invalid target (page background, over === null) animates it back to its origin instead of vanishing
  5. Groups with more than 20 items show an amber "Large group (N) — consider splitting" badge but adding more items is never blocked
  6. Clicking "Confirm" uploads each group with POST /api/images/upload groupAsOne=true (parallelism capped at 2); successful groups have their IDB blobs removed; failed groups remain in the grid with a red "Retry" button and the user can click to retry without losing work
  7. A "+ New group" drop target is always visible at the end of the grid and accepts dropped thumbnails to create a new empty group
**Plans**: 5 plans
Plans:
- [x] 09-01-PLAN.md — Define GROUP-05..12 in REQUIREMENTS.md and fill Phase 9 Goal + Success Criteria in ROADMAP.md
- [x] 09-02-PLAN.md — Delete prompt UI, presets, mode chooser, maxImages controls, chunkArray, TONES from upload-zone.tsx
- [x] 09-03-PLAN.md — Add useGroupSelection hook (Shift/Cmd-click) + fix snap-back dropAnimation timing
- [ ] 09-04-PLAN.md — Per-file landing (one group per file), soft large-group warning (threshold 20), verify always-visible "+ New group"
- [ ] 09-05-PLAN.md — Per-group failure-isolated handleConfirm rewrite with inline retry + human verification checkpoint
