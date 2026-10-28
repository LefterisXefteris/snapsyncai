# 05 — Refresh and Bulk SEO

**What to build:** Listing copy refresh and Bulk SEO start through those same jobs, for products the message names. On Bulk SEO, the ticked eligible rows are that set. A selection on Products is not a Bulk SEO pick and is not a Push. The thread shows each proposal. "Accept all three" is three Accepts, in order, one Credit each. The first refusal stops the rest. Dismiss and regenerate-a-field are the same acts as on the page. Above 25 products, Bulk SEO Start refuses.

**Blocked by:** 04 — Generate, then Accept

**Status:** done

- [x] Listing copy refresh and Bulk SEO start through those same jobs, for products the message names
- [x] On Bulk SEO, the ticked eligible rows are that set
- [x] A selection on Products is not a Bulk SEO pick and is not a Push
- [x] The thread shows each proposal
- [x] "Accept all three" is three Accepts, in order, one Credit each
- [x] The first refusal stops the rest
- [x] Dismiss and regenerate-a-field are the same acts as on the page
- [x] Above 25 products, Bulk SEO Start refuses

## Comments

- Seam: `ask` in `app/services/chat.py`, same as 01–04. The model is a dependency. Listing copy refresh, Bulk SEO, Accept, dismiss, and regenerate-a-field are the page's jobs. The route wires them. The card is not a test seam.
- Refresh shows Description, SEO Keywords, Page title, and Meta description. Accept in that same message does not run. A later message Accepts with the refresh or Bulk SEO Accept, one Credit, and does not Push.
- Named products are the Bulk SEO set. On Bulk SEO, `bulkSeoIds` are the ticked eligible rows. A Products path does not send them. "These" with no ticks asks, and a later Push in that message does not run.
- "Accept all three" accepts the proposals already in the thread, in that order. The first refusal stops the rest. Credits are the Accepts that landed.
- Dismiss of a refresh proposal is the page's dismiss, including its trace. Bulk SEO dismiss drops that proposal from the thread, as the page does. Regenerate-a-field is the page's field regenerate. It updates a generate proposal already in the thread. A later Accept keeps that field.
- Above 25 products, Bulk SEO Start returns the page's refusal. Nothing is Accepted.
- Chat module tests passed. Client `tsc` and `npm test` (131) passed. `uv run pytest`: 480 passed. 13 failed in listing-copy accept, propose, refresh HTTP, and one Trendyol Push test. Those files are unchanged on this branch and fail on their own.
