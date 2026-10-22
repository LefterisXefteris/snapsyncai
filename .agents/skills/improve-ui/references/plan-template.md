# Design plan

One finding. One file. The executor has not seen the audit.

Path: `design-plans/<destination>-<term-or-adr>.md`

Kebab-case the destination name from the **Destination** entry in `CONTEXT.md`. The term slug is the glossary term. The ADR slug names that sentence, so two sentences of one ADR get two files.

```markdown
# <destination>: <glossary term or ADR sentence>

- Destination:
- Region:
- Commit:
- Contract:
- Owner:
- Also reaches:
- Correction:

## Executor

1. Change the owner so this destination shows the correction. Keep the edit on this destination.
2. When the correction changes an ADR sentence about what the seller sees, amend that ADR.
3. Open this destination in the running workspace and confirm the corrected presentation.
```

Omit Region when the audit named none. Omit Also reaches when the owner renders only here. Commit is `git rev-parse HEAD` at the time of writing. The correction names an existing component and the one change. Amend that ADR only when the contract is its sentence. A glossary pair leaves the ADRs unchanged. The Executor section names no new ADR.
