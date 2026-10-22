---
name: improve-ui
description: Audit one workspace destination's seller-facing words, pictures, or layout against the glossary and current ADRs, then write a design plan for each finding the user selects. Use when the user asks to improve a destination's presentation, or to plan a finding from that audit.
---

# Improve UI

Audit one destination. Prove each finding. Stop. Write a plan only after the user selects.

Leave product source, `CONTEXT.md`, and `docs/adr/` unchanged. The only files this skill creates or edits are under `design-plans/`. Another agent executes a plan, and that agent installs and commits. Read source. Look at the running workspace when the user asks, or when the user supplies rendered evidence, and use that look to confirm a presentation already tied to a contract.

## 1. Select the destination

Honor a destination or region the user names.

A broad request audits **Products**. A request that names the nav, and no destination, audits **Products**.

The destinations are the **Destination** entry in `CONTEXT.md`. The landing page and the shopper-facing storefront enter when the user names them.

A named region is the whole audit. Trace the rest of the destination only to see what reaches that region.

Follow a shared act such as Accept onto the other destinations where that act runs when the user names the act. A sentence that lives on another destination stays there unless the user names that wording.

On the Website page, audit the workspace controls. The HTML the Website agent returned stays out.

**Done when** the audit names one destination, plus the region when the user named one.

## 2. Trace what renders

Start at that destination's route. Follow the compositions, components, variants, and styles that render there, through imports, props, and CSS. A shared name connects only when that path reaches the destination.

**Done when** each seller-facing presentation under audit has the component that renders it.

## 3. Gather the contracts

Read `CONTEXT.md`. Read each ADR that states the words, the picture, or the layout the seller sees on this destination. Cite the ADR that currently states the sentence. Skip an ADR whose status is superseded, and skip a sentence an amendment has replaced.

A contract is that ADR sentence, or two seller-facing presentations of the same glossary term on this destination in the same condition. A wide layout and a narrow layout are the same condition when both show the term. An empty state may use different words from the filled state. Where the seller sees both Products and catalogue, the correction is Products. The glossary Avoid line chooses between two presentations already on the destination. A sentence that recommends, rather than states the words, the picture, or the layout, stays out of the contract set.

**Done when** the contracts in hand are current ADR sentences or same-term pairs on this destination.

## 4. Prove findings

Inspect the destination's labels and each layout width. Compare the active nav item's label with this destination's heading. A finding's correction changes the words, the picture, the layout, or the component's presentation. When the user asks for accessibility, include those findings under the same three proofs.

Keep a candidate only when all three are true:

1. **Contract** — the ADR sentence or the same-term pair, cited.
2. **Runtime** — the component from step 2 renders that presentation on this destination.
3. **Correction** — one change the evidence already determines. Name the existing component. When more than one correction fits, drop the candidate.

One finding is one glossary term, or one ADR sentence. Every place that shows it wrong is evidence on that single row.

The component change stays on this destination. When the component can vary per destination, record the other destinations it also reaches. When the same component cannot vary, drop the candidate. A new shared component is a dropped candidate.

Color, type, and spacing count when an ADR states the value, or the same glossary term is presented two ways.

**Done when** each kept row lists the places that show it wrong, a contract, a component on the traced path, and one correction.

## 5. Vet

Re-open every cited source. Drop a row when the cited implementation differs, the rule covers a different property, the difference is deliberate, more than one correction fits, or the correction would change whether the destination works.

**Done when** every remaining row has survived that re-read.

## 6. Report and stop

Order by how many places show the wrong presentation, then an ADR-backed finding ahead of a contradiction-only one. The heading wins a tie. Otherwise the finding higher on the destination comes first. **Improve first** is the first row.

```markdown
## Design language
- Audited destination:
- Region:
- Design sources:
- Documented decisions:
- Governing owners and consumers:
- Explicit exceptions:

## Findings
| # | Problem | Evidence | Proposed change | Scope |
| --- | --- | --- | --- | --- |

## Improve first
```

Omit Region when the user named none. Design sources are `CONTEXT.md` and the current ADRs you cited. Documented decisions are those cited sentences. Governing owners and consumers are the components on the traced path. Write `None documented` under Explicit exceptions until a cited ADR names an exception. Evidence lists each place that shows it wrong, plus the contract, the component, and the one correction. Scope is the destination, or the region.

When no row survives:

```markdown
## Findings

No supported findings were found.

## Improve first

No supported recommendation.
```

**Done when** the report is delivered and you have stopped for the user's selection.

## 7. Write plans

This step starts when the user selects one or more findings.

Read [references/plan-template.md](references/plan-template.md). Write one plan per finding, as if the executor has not seen the audit. When a file already exists for that same destination and glossary term, or that same ADR sentence, update it.

**Done when** each selected finding has its plan file, and product source, the glossary, and the ADRs are unchanged.
