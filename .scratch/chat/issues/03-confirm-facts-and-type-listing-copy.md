# 03 — Confirm facts and type listing copy

**What to build:** A message that supplies the inputs the page would demand confirms those facts, including an explicit skip. A missing or invalid input is asked for, and nothing is saved. Words they quote become typed listing copy and spend no Credit. "Write the listing" is not this. The open product page shows the new facts. Chat does not change Destination.

**Blocked by:** 02 — Say which product, or be asked

**Status:** done

- [x] A message that supplies the inputs the page would demand confirms those facts, including an explicit skip
- [x] A missing or invalid input is asked for, and nothing is saved
- [x] Words they quote become typed listing copy and spend no Credit
- [x] "Write the listing" is not this
- [x] The open product page shows the new facts
- [x] Chat does not change Destination

## Comments

- Seam: `ask` in `app/services/chat.py`, same as 01 and 02. The model is a dependency. The writer is the page's confirm and the page's image save. The route wires that writer. The card is not a test seam.
- A complete textile confirm, including a care skip and a GPSR skip, saves those facts. A coffee origin skip does too. The thread says "Those facts are confirmed." Credits stay 0. The shop is unchanged.
- A missing or invalid input is the page's own refusal. Nothing is saved, and a later act in that turn does not run. No product named asks which product.
- Quoted words save that one listing-copy field and spend no Credit. A quote with no field asks which part. While that product's page is open, the quote is saved on the open photo.
- Act `generate` does not confirm and does not type, even when the model also sends facts and a quote. "Write the listing" is the generate job, which is the next ticket.
- The open product page re-reads facts and listing copy when those change, and leaves price, stock, and publications as they were. Chat does not change Destination.
- Postgres was down, so the three route tests did not run. Module tests passed without them. `uv run pytest`: 349 passed, 123 skipped. Client `tsc` and `npm test` (129) passed.
