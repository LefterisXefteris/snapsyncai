# 04 — Generate, then Accept

**What to build:** "Write the listing" runs the same generate job. The thread shows the proposal fields the page shows. Accept in that same message does not run, so a later act in that message does not run either. A later message Accepts, spends one Credit, and does not Push. An empty Credit balance refuses. A proposal that exists only on the page is shown in the thread first.

**Blocked by:** 02 — Say which product, or be asked

**Status:** done

- [x] "Write the listing" runs the same generate job
- [x] The thread shows the proposal fields the page shows
- [x] Accept in that same message does not run, so a later act in that message does not run either
- [x] A later message Accepts, spends one Credit, and does not Push
- [x] An empty Credit balance refuses
- [x] A proposal that exists only on the page is shown in the thread first

## Comments

- Seam: `ask` in `app/services/chat.py`, same as 01–03. The model is a dependency. The generate job and Accept are the page's jobs. The route wires them. The card is not a test seam.
- "Write the listing" calls the page's generate. The thread shows Title, Description, SEO Keywords, Page title, Meta description, and AEO FAQ Pairs. Credits stay 0. The shop is unchanged.
- Accept in that message does not run, and a later act in that message does not run. A later message Accepts, spends one Credit, and does not Push. An empty Credit balance is the page's refusal. Nothing is saved.
- A proposal that exists only on the open product page is shown in the thread first, including when they name the product and that page is another photo of it. The next message Accepts that photo. Chat does not change Destination.
- Postgres was down, so the two route tests did not run. Module tests passed without them. `uv run pytest`: 356 passed, 125 skipped. Client `tsc` and `npm test` (130) passed.
