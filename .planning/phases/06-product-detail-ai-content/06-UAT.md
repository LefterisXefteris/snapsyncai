---
status: testing
phase: 06-product-detail-ai-content
source: [06-01-SUMMARY.md, 06-02-SUMMARY.md, 06-03-SUMMARY.md]
started: 2026-04-02T23:10:00Z
updated: 2026-04-02T23:10:00Z
---

## Current Test

number: 1
name: AI Content Panel is visible in Product Detail
expected: |
  Open a product detail page (click a product). For a paid user, an "AI Content" panel
  should be visible above the title/description fields. It should contain three guided
  inputs — Category, Style/Tone, and Audience — and a Generate button.
awaiting: user response

## Tests

### 1. AI Content Panel is visible in Product Detail
expected: Open a product detail page (click a product). For a paid user, an "AI Content" panel should be visible above the title/description fields. It should contain three guided inputs — Category, Style/Tone, and Audience — and a Generate button.
result: [pending]

### 2. Generate All streams content into all four fields
expected: Fill in Category, Style/Tone, and Audience inputs in the AI Content panel. Click Generate. Text should stream word-by-word into four field previews — Title, Description, SEO Keywords, and AEO FAQs — appearing progressively as the AI generates them.
result: [pending]

### 3. Accept title — title input updates
expected: After generation completes, click the Accept button next to the Title preview. The main title input field (above the description) should update with the accepted value.
result: [pending]

### 4. Accept description — description input updates
expected: Click the Accept button next to the Description preview. The product description textarea should update with the accepted value.
result: [pending]

### 5. Accept SEO keywords — badges appear in listing card
expected: Click the Accept button next to the SEO Keywords preview. The "Search engine listing" card should show the accepted keywords as badge chips.
result: [pending]

### 6. Per-field regenerate streams just that field
expected: After a full generation, click the Regenerate button on one field (e.g., Title). Only that field's preview should stream new content — the other three previews should remain unchanged.
result: [pending]

### 7. Save persists AI-accepted content
expected: Accept title, description, and/or tags from the panel, then click Save. Navigate away and return to the same product. The saved title, description, and tags should reflect the accepted AI-generated values.
result: [pending]

### 8. AI Background button is disabled with Coming Soon tooltip
expected: In the product detail image toolbar, the "AI Background" button should be visible but greyed out (dimmed, not clickable). Hovering over it should show a "Coming soon" tooltip.
result: [pending]

### 9. AI Photoshoot button is disabled with Coming Soon tooltip
expected: In the product detail image toolbar, the "AI Photoshoot" button should be visible but greyed out. Hovering over it should show a "Coming soon" tooltip.
result: [pending]

## Summary

total: 9
passed: 0
issues: 0
pending: 9
skipped: 0

## Gaps

[none yet]
