# Phase 8: Embeddings Variant Clustering - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the GPT-5.2 vision call inside `runAutoGrouping()` (`server/routes.ts:124-280`) with an image-embeddings + cosine-similarity clustering approach, so same-product / variant images are grouped faster and cheaper than the current VLM path.

The existing seam is preserved: both `/api/images/auto-group` (SSE) and `/api/images/auto-group-existing` (JSON) funnel through `runAutoGrouping()`, so the swap happens in one function. The apparel-token cross-batch merger in `server/auto-group-utils.ts:192-287` is a separate concern and is only referenced here for the fallback path.

Out of scope for Phase 8: persistent embedding storage, search, cross-session dedup, fixture-set construction, threshold tuning UI, label-generation changes. Those land in other phases or were explicitly deferred below.

</domain>

<decisions>
## Implementation Decisions

### Provider

- **Primary: Cohere Embed v4** — 1536-dimensional multimodal embeddings, up to 96 images per call, Vercel-serverless compatible.
- **No secondary embeddings provider.** If Cohere fails we fall back to filename-only grouping (see below), not to another embeddings vendor and not to the Phase 7 VLM path.
- **API key must be provisioned before deploy.** `COHERE_API_KEY` is NOT currently set in Vercel. Treat this as a deployment prerequisite exactly like `ENCRYPTION_KEY` in Phase 3 — plan must add it to the STATE.md blockers list so the deploy doesn't silently break.

### Batching

- **Sequential batches of 96 images.** A 200-image upload becomes at most 3 sequential Cohere calls.
- Rationale: stays well under Vercel's function timeout, makes partial-failure handling and retry logic simple, avoids fighting rate limits.
- Parallel batching is explicitly rejected for v1 — revisit only if latency measurements demand it.

### Fallback trigger

- **Any non-2xx response from Cohere after 1 retry with exponential backoff → fall back.**
- Timeouts count as failures (same path).
- No distinction between 4xx and 5xx in v1 — the UX cost of a hard error is higher than the debugging cost of degraded grouping. Logs should record the upstream status so config bugs are still diagnosable.

### Fallback behavior

- **Filename-only grouping using the existing apparel-token merger** from `server/auto-group-utils.ts:192-287`.
- This is NOT an auto-fallback to the VLM. The VLM path may remain in the codebase for Phase 7 flows the planner decides not to touch, but it is not wired into the Phase 8 fallback chain.
- Quality drop is acceptable because the user is told (see Fallback UX).

### Fallback UX

- **Warning banner above the groups:** "Grouped by filename — AI grouping unavailable."
- Banner is shown whenever the fallback path produced the result (not when Cohere succeeded).
- Banner dismissal behavior and exact copy are Claude's discretion.
- A retry button was considered and deferred — ship the banner first, add retry later if users ask.

### Claude's Discretion

- Exact Cohere model version string (e.g., `embed-v4.0` vs whatever is current at implementation time — planner should verify against live Cohere docs).
- Request timeout value per Cohere call (pick something sane given the 3-sequential-batches budget).
- Backoff interval for the single retry.
- Banner copy, styling, and dismissal semantics.
- How the fallback path signals "I was used" back to the SSE stream / JSON response — invent a minimal flag, don't over-engineer.
- Whether to keep or delete dead VLM code paths touched by the refactor — default: leave untouched unless the diff gets ugly.
- Clustering algorithm details (threshold-based cosine + union-find is the recommended starting point from research, but the planner owns the exact implementation).

</decisions>

<specifics>
## Specific Ideas

- Follow the `ENCRYPTION_KEY` precedent from Phase 3 for the `COHERE_API_KEY` provisioning story — same "blocker in STATE.md, deploy will break without it" treatment.
- The one-seam refactor is the whole point: touch `runAutoGrouping()` and nothing else in the routing layer. If the planner finds itself editing more than 2-3 files it should stop and reconsider.

</specifics>

<deferred>
## Deferred Ideas

- **Persistent embedding cache** (compute once, reuse across re-groupings) — not discussed in this session. Revisit if re-grouping becomes a common user action.
- **Labeled fixture set for quality evaluation** — research flagged as a risk; deferred to a later phase or separate eval milestone.
- **Cosine threshold as an env knob** — start hardcoded, expose only if tuning becomes a bottleneck.
- **GPT text-only label generation per cluster** — keeping Phase 7 labels as-is for v1.
- **Secondary embeddings provider** (Voyage, transformers.js) as a multi-provider fallback chain — out of scope.
- **Auto-retry button on the fallback banner** — ship banner only in v1.
- **Replacing the apparel-token merger itself** — stays as-is and doubles as the fallback path.
- **Parallel Cohere batching** — revisit only if sequential latency is measured as too slow.

</deferred>

---

*Phase: 08-embeddings-variant-clustering*
*Context gathered: 2026-04-10*
