# 01 — Selling Undo

**What to build:** “Set the price to 19” saves the price. That reply shows Undo for 9 seconds and puts the previous Selling back, including an empty price. A reload clears the control and leaves the write. A second Selling reply keeps its own control. A bare “19”, a missing product, and Push, Go live, delete, Import, and Accept carry no Undo. The model is told to run the act when the inputs are already in the message.

**Blocked by:** None — can start immediately.

**Status:** done

- [x] “Set the price to 19” saves the price and spends no Credit
- [x] That reply shows Undo for 9 seconds and puts the previous Selling back, including an empty price
- [x] One reply that changes more than one Selling field restores every field it changed
- [x] A second Selling reply keeps its own control until its own 9 seconds end
- [x] A reload clears the control and leaves the write. The stored thread does not keep the previous value
- [x] A bare “19”, a missing product, a refusal, and Push, Go live, delete, Import, and Accept carry no Undo
- [x] The model is told to run the act when the inputs are already in the message, and not to confirm or invent a price, a quantity, a fibre, or a legal fact

## Comments

- Seams: `ask` in `app/services/chat.py`, and the reply control in `client/src/lib/chat-page.ts`. The model is a dependency. Undo calls the product-page Selling write. The panel chrome is not a test seam.
- A landed Selling write returns the previous fields of what that reply changed, tied to that reply. An empty previous price is an empty string. The stored thread is role and text.
- Undo stays in this browser for 9 seconds. A landed write-back drops that control. A failed write-back keeps it. A reload does not.
- `uv run pytest`: 406 passed, 130 skipped. Client `tsc` and `npm test` (147) passed. The HTTP test that hands the previous price to the browser skipped because local Postgres was down.
