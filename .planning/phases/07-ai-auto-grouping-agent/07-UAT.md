---
status: testing
phase: 07-ai-auto-grouping-agent
source:
  - 07-01-SUMMARY.md
  - 07-02-SUMMARY.md
  - 07-03-SUMMARY.md
  - 07-05-SUMMARY.md
  - 07-06-SUMMARY.md
started: 2026-04-10T00:00:00Z
updated: 2026-04-10T00:00:00Z
---

## Current Test

number: 6
name: "Sort Variants Into Products" variant-family action
expected: |
  In the workspace/chooser there is a "Sort Variants Into Products" action.
  Running it on a variant-heavy batch collapses same-product variants
  (same tee in multiple colors/angles) into one family, while keeping
  genuinely different products separate.
awaiting: user response

## Tests

### 1. Mode choice appears after drop
expected: After dropping images, UI shows "Auto-group with AI" and "Group manually" buttons. Nothing runs until a choice is made.
result: skipped
reason: user scoped UAT to variant-family feature only

### 2. Auto-group streams AI-suggested groups (GROUP-01)
expected: Picking "Auto-group with AI" processes the batch via GPT-5.2 vision. Group cards appear live as batches finish. Each card shows an AI-suggested label (e.g. "Blue Denim Jacket") and a confidence badge (green/yellow/red).
result: skipped
reason: user scoped UAT to variant-family feature only

### 3. Review, split, merge, rearrange before confirming (GROUP-02)
expected: While auto-grouped cards are on screen you can drag thumbnails between groups, split a group by moving images out, and merge by dragging all images of one card into another. Manual tweaks persist — nothing reverts.
result: skipped
reason: user scoped UAT to variant-family feature only

### 4. Confirm & Analyze All triggers per-group analysis (GROUP-03)
expected: After auto-grouping finishes, a "Confirm & Analyze All" button appears. Clicking it uploads each group as one product and runs full AI analysis (title, description, SEO, AEO, pricing) per group automatically — no per-product clicks.
result: skipped
reason: user scoped UAT to variant-family feature only

### 5. Manual drag-and-drop mode still works (GROUP-04)
expected: Picking "Group manually" on a fresh drop skips the AI call entirely and drops you into the pre-existing manual drag-and-drop grouping flow from Phase 5. All drag, multi-select, +/- max, and IDB persistence behaviors still work.
result: skipped
reason: user scoped UAT to variant-family feature only

### 6. "Sort Variants Into Products" variant-family action
expected: In the workspace/chooser there is a "Sort Variants Into Products" action (replaces the old "One product" shortcut). Running it on a variant-heavy batch (same tee in multiple colors/angles) collapses same-product variants into one product family while keeping genuinely different products (different graphics, different silhouettes, different garment types) as separate products.
result: [pending]

### 7. Apparel-family grouping quality on real batch
expected: On a 100+ image apparel batch, the grouped family count is close to the actual product count. Same tee in different colors/angles collapses into one family; different graphic tees stay separate; different trouser cuts stay separate.
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 2
skipped: 5

## Gaps

[none yet]
