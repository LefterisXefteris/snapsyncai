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
**Plans**: 4 plans
Plans:
- [ ] 07-01-PLAN.md — SSE auto-grouping endpoint with batched GPT-5.2 vision calls
- [ ] 07-02-PLAN.md — useAutoGroup hook + mode choice UI + live group streaming
- [ ] 07-03-PLAN.md — AI labels on group cards + Confirm & Analyze All button
- [ ] 07-04-PLAN.md — Human verification of all 4 success criteria

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 5. Drag-and-Drop UI | 4/5 | In Progress|  |
| 6. Product Detail AI Content | 3/3 | Complete | 2026-04-02 |
| 7. AI Auto-Grouping Agent | 0/4 | Not started | - |
