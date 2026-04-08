# Phase 7: AI Auto-Grouping Agent - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

When users bulk-upload up to 200 images, an AI agent visually identifies which images show the same product and auto-groups them into product clusters. Users review and tweak the suggested groupings, then confirm to trigger full AI analysis (title, description, SEO, AEO, pricing) per product group. The existing manual drag-and-drop flow remains available as an alternative.

</domain>

<decisions>
## Implementation Decisions

### Grouping review UX
- Review UI presentation — Claude's discretion (reuse existing cards or new review screen)
- Groups appear live as the agent identifies them — user watches grouping build in real time
- Fixing mistakes: drag-to-move (same as manual mode) — no multi-select reassignment needed
- Single "Confirm & Analyze All" button triggers full AI analysis on all groups at once
- Add a simple one-click action in the workspace to sort uploaded images into product families automatically
- The button language should make the outcome obvious: same product variants get sorted under one product

### Product scope
- Clothing/fashion is the priority — optimize grouping accuracy for clothing first
- Other product categories (electronics, furniture, etc.) should work but may be less accurate initially
- Same product in different colors = one product group (treat as variants, group together)
- Same product in different sizes, materials, prints, washes, and camera angles = one product group when the base design is clearly the same
- Unmatched/low-confidence images — Claude's discretion on solo groups vs unsorted bucket
- Working assumption: when genuinely uncertain, prefer separate groups over destructive over-merging

### Upload flow transition
- After upload, user sees a choice: "Auto-group with AI" or "Group manually"
- Neither is the default — explicit user choice every time
- The review screen and manual drag-drop share a unified UI — one consistent interface, not two separate screens
- User can switch from auto-group to manual mid-flow — images are kept, AI groupings are cleared
- After confirming groups and analysis completes, user lands on the main image gallery
- The workspace should expose the variant-aware grouping as a simple button, not as a hidden prompt or advanced setting

### Claude's Discretion
- Technical approach: LangGraph agent loop vs single vision call vs embedding-based similarity — pick what works best for accuracy and cost at 200-image scale
- Batching/chunking strategy for large uploads (cost vs speed tradeoff)
- Review screen layout and visual design
- Handling unmatched images (solo group vs unsorted bucket)
- Whether to use optional user-provided product context to improve grouping accuracy

</decisions>

<specifics>
## Specific Ideas

- User's pain point: dragging 200 images one by one takes too long — this should feel like "upload and done"
- The agent should recognize clothing items from different angles as the same product (front, back, detail shots)
- The agent should collapse large batches of variant-heavy uploads into the true underlying product count as closely as possible
- Live progress: groups appearing one by one as the agent works, not a spinner-then-reveal
- "Smart suggest" model: agent does the heavy lifting, user just reviews and tweaks

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-ai-auto-grouping-agent*
*Context gathered: 2026-04-06*
