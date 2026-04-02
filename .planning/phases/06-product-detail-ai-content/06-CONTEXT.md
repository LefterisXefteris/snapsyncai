# Phase 6: Product Detail AI Content Generation - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can prompt and generate AI-written product content (title, description, SEO tags, AEO tags) directly within the product detail view, using guided inputs and product images as context. AI background removal and AI photoshop features are temporarily disabled with "coming soon" indicators, controlled via a feature flag or env toggle.

</domain>

<decisions>
## Implementation Decisions

### Prompt & generation UX
- One shared prompt generates all four fields (title, description, SEO tags, AEO tags) in a single AI call
- Prompt style is guided — structured inputs for category, style/tone, and target audience (not a free-form textarea)
- AI uses both the prompt inputs AND the product images already in the product detail as context (multimodal generation)
- Prompt placement within the product detail layout: Claude's discretion — fit naturally above or alongside the content fields

### Content display & editing
- Generated content appears as a preview alongside current field values — user accepts field by field, not auto-replaced
- Each field has a per-field regenerate button — user can rerun just that field without regenerating everything
- After accepting, the field becomes a normal editable input (no locked state)
- Content streams in as it generates (word by word), not a spinner-then-reveal pattern

### SEO and AEO tags
- SEO tag format: Claude's discretion — determine the right format (keyword list vs full meta fields) based on what existing platform publish flows (Shopify, Etsy, Amazon) consume
- AEO tag format: Claude's discretion — pick the format (FAQ Q&A pairs vs structured attribute tags) that best serves answer engine discoverability for product listings
- Tags are stored in the product record and mapped to platform-specific fields at publish time (not copy-paste only)
- No fixed cap on tag count — generate as many as are relevant, user can trim

### Disabling AI features
- AI background removal and AI photoshop buttons remain visible but are greyed out with a "coming soon" label or tooltip
- Disable is temporary — implement via a feature flag or env toggle so features can be re-enabled without code changes

### Claude's Discretion
- Exact placement of the prompt input within the product detail layout
- SEO tag format (keyword list vs meta fields) — infer from platform publish requirements
- AEO tag format (FAQ pairs vs key-value attributes) — infer from answer engine best practices
- Feature flag naming and toggle mechanism (env var vs config constant)
- Loading/error states for generation failures

</decisions>

<specifics>
## Specific Ideas

- This feature is tied to the lisai-app-0kt issue
- Guided prompt inputs (not free-form) — category, style/tone, audience fields feed the generation
- Multimodal: the AI should see the product's staged/uploaded images alongside the prompt to generate accurate content
- "Coming soon" treatment on disabled features — not hidden entirely, keeps user aware these are planned

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 06-product-detail-ai-content*
*Context gathered: 2026-04-02*
