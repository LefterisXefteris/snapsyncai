# Roadmap: LisAI Security Hardening

## Overview

This milestone closes the active fraud vector and security gaps found in the production codebase audit. All fixes are in-place inside existing files — no restructuring. Phases are ordered by severity: the credit double-grant (actively exploited) ships first, followed by the auth bypass guard (production-critical one-liner isolated to minimize blast radius), then at-rest encryption for all third-party OAuth tokens (five requirements that form one coherent system), and finally the Stripe SDK version fix. Every phase delivers a verifiable production-safe change.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Credit Idempotency** - Stop the active credit double-grant by making the verify and webhook paths atomic
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
- [ ] 01-02-PLAN.md — Wire verify endpoint and webhook to claimAndGrantCredits

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
| 1. Credit Idempotency | 1/2 | In Progress|  |
| 2. Auth Bypass Guard | 0/? | Not started | - |
| 3. Token Encryption | 0/? | Not started | - |
| 4. Stripe SDK Fix | 0/? | Not started | - |
