# Requirements: LisAI Security Hardening

**Defined:** 2026-03-31
**Core Value:** Users' data stays theirs, payments are credited exactly once, and no unauthenticated path reaches paid AI features.

## v1 Requirements

### Authentication

- [ ] **AUTH-01**: Server throws a hard error on startup if `DEV_BYPASS_AUTH=true` and `NODE_ENV=production`

### Payments

- [x] **PAY-01**: Stripe checkout session credit grant is idempotent — `paidSessions.used` is checked and set atomically before `addCredits()` is called; repeated calls with the same `checkoutSessionId` (via verify endpoint or webhook) grant credits exactly once

### Credentials

- [ ] **CRED-01**: Shopify OAuth access tokens are encrypted before being written to `shopify_connections`
- [ ] **CRED-02**: Etsy OAuth tokens are encrypted before being written to `etsy_connections`
- [ ] **CRED-03**: Amazon LWA refresh tokens are encrypted before being written to `amazon_connections`
- [ ] **CRED-04**: Instagram long-lived tokens are encrypted before being written to `instagram_connections`
- [ ] **CRED-05**: Tokens are decrypted transparently on read so all existing platform push flows continue working without changes to callers

### Infrastructure

- [ ] **INFRA-01**: Stripe SDK is initialized with a valid supported API version string — `as any` cast removed from `server/stripeClient.ts`

## v2 Requirements

### Authorization (IDOR Fixes)

- **AUTHZ-01**: `GET /api/images/:id/bg/:key` requires authentication and verifies the image belongs to the requesting user
- **AUTHZ-02**: `POST /api/images/:id/rewrite-description` verifies image ownership before running AI
- **AUTHZ-03**: `POST /api/images/:id/generate-photoshoot` verifies image ownership before spending credits

### Infrastructure

- **INFRA-02**: Server-side Supabase client uses service-role key instead of anon key
- **INFRA-03**: Supabase storage bucket RLS policies restrict public writes
- **INFRA-04**: Instagram OAuth state nonce is stored in DB and invalidated on first use

## Product UX Requirements

### AI Auto-Grouping (Phase 7)

- [x] **GROUP-01**: AI-based visual similarity detection groups images of the same product together using GPT-5.2 vision
- [x] **GROUP-02**: Suggested groupings are presented for user review — user can split, merge, or rearrange groups before confirming
- [x] **GROUP-03**: After confirming groupings, full AI analysis (title, description, SEO, AEO, pricing) runs automatically per product group
- [x] **GROUP-04**: Manual drag-and-drop grouping flow remains available as an alternative to AI auto-grouping

### Embeddings Variant Clustering (Phase 8)

- [x] **CLUSTER-01**: Same-product / variant image grouping uses Cohere Embed v4 multimodal embeddings plus threshold-based cosine similarity + union-find clustering, replacing the GPT-5.2 vision batch loop inside `runAutoGrouping`
- [x] **CLUSTER-02**: End-to-end latency for the auto-group flow on a 50-image input is less than or equal to the existing VLM path baseline (verified during human checkpoint)
- [x] **CLUSTER-03**: Cost per 100 images is strictly less than the GPT-5.2 vision baseline (verified via Cohere dashboard usage readout during human checkpoint)
- [ ] **CLUSTER-04**: On any Cohere failure after one retry with exponential backoff (including timeouts), `runAutoGrouping` falls back to filename-only grouping via the existing `mergeAutoGroupsByFamily` apparel-token merger and surfaces a "Grouped by filename — AI grouping unavailable" warning banner (pre-upload SSE flow) or destructive toast (workspace Sort Variants flow)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Splitting `server/routes.ts` into domain files | Separate refactor milestone — restructuring increases blast radius |
| Splitting `client/src/pages/Home.tsx` | Same — separate refactor milestone |
| Adding test coverage | Separate milestone |
| `bgEditBuffers` memory leak fix | Not a security issue — separate milestone |
| Base64 image storage migration to Supabase | Not a security issue — separate milestone |
| Atomic `upsert*Connection` queries | Low severity — separate milestone |
| `migrateSession` transaction wrapper | Low severity — separate milestone |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PAY-01 | Phase 1 | Complete |
| AUTH-01 | Phase 2 | Pending |
| CRED-01 | Phase 3 | Pending |
| CRED-02 | Phase 3 | Pending |
| CRED-03 | Phase 3 | Pending |
| CRED-04 | Phase 3 | Pending |
| CRED-05 | Phase 3 | Pending |
| INFRA-01 | Phase 4 | Pending |
| GROUP-01 | Phase 7 | Complete |
| GROUP-02 | Phase 7 | Complete |
| GROUP-03 | Phase 7 | Complete |
| GROUP-04 | Phase 7 | Complete |
| CLUSTER-01 | Phase 8 | Complete |
| CLUSTER-02 | Phase 8 | Complete |
| CLUSTER-03 | Phase 8 | Complete |
| CLUSTER-04 | Phase 8 | Pending |

**Coverage:**
- v1 requirements: 8 total
- Product UX requirements: 8 total
- Mapped to phases: 16
- Unmapped: 0

---
*Requirements defined: 2026-03-31*
*Last updated: 2026-04-10 — added CLUSTER-01 through CLUSTER-04 for Phase 8*
