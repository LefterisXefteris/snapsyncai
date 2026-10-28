# 08 — Import

**What to build:** Import starts through the same Import. The turn ends once it has started. The thread records the result when Import completes. A second start is refused the way the Import page already refuses it.

**Blocked by:** 01 — Ask in the card

**Status:** done

- [x] Import starts through the same Import
- [x] The turn ends once it has started
- [x] The thread records the result when Import completes
- [x] A second start is refused the way the Import page already refuses it

## Comments

- Seam: `ask` in `app/services/chat.py`, same as 01–05. The model is a dependency. Import is the page's Start. The route wires it. The card is not a test seam.
- A message whose act is Import calls that Start. The reply is "Import is in progress." The model is not called again in that turn, and no Credit is spent. A product name on the step does not turn it into "which product?"
- When the run finishes, the thread gains the page's counts: created, skipped, failed, and each failed Channel id. A request session writes that line after the turn commits. Tests record it on the memory thread.
- A second Start while that run is in progress is "An Import is already in progress." Nothing else starts. No Shopify shop is "Connect Shopify in Settings before you Import."
- The card keeps reading the thread from "Import is in progress." until the counts line is stored, including after a refused second Start, then refreshes the catalogue.
- If the turn rolls back after the run lock is taken, that lock is released. The run itself starts after the turn commits.
- Chat Import tests passed. Client `tsc` and `npm test` (132) passed. `uv run pytest`: 508 passed. 13 failed in listing-copy accept, propose, refresh HTTP, and one Trendyol test. Those files are unchanged by this ticket.
