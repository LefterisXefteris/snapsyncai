# 02 — Inventory Undo

**What to build:** A quantity and a reason set Inventory, and that reply’s Undo puts the previous quantity back with the reason Undo. A missing quantity or reason still asks, and nothing is written.

**Blocked by:** 01 — Selling Undo

**Status:** done

- [x] A quantity and a reason set Inventory
- [x] That reply’s Undo puts the previous quantity back with the reason Undo
- [x] A missing quantity or reason still asks, and nothing is written

## Comments

- Seams: `ask` in `app/services/chat.py`, and the reply control in `client/src/lib/chat-page.ts`. The model is a dependency. The Inventory adjustment is the page write. The panel chrome is not a test seam.
- A landed adjustment returns the previous ledger quantity and the inventory item id, tied to that reply. The stored thread is role and text, so a later read has no previous quantity.
- A missing quantity, a reason outside 3 to 250 characters, or a refusal returns no previous quantity and writes nothing.
- Undo stays in this browser for 9 seconds. It sets the previous quantity with the reason Undo. A failed write-back keeps the control. A reload does not.
- `uv run pytest`: 406 passed, 130 skipped. Client `tsc` and `npm test` (147) passed.
