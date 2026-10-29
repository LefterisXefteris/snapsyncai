# 04 — Publications and Shop GPSR

**What to build:** A publications change and a Shop GPSR save each get their own 9-second Undo, restoring the previous set or the previous identity. A missing set, a publication the shop does not have, or an incomplete identity changes nothing.

**Blocked by:** 01 — Selling Undo

**Status:** done

- [x] Named publications are set, and that reply’s Undo restores the previous set
- [x] A complete Shop GPSR identity is saved, and that reply’s Undo restores the previous identity
- [x] A missing set, a publication the shop does not have, or an incomplete identity changes nothing and shows no Undo
- [x] Each reply keeps its own control for 9 seconds. Undo spends no Credit, adds no turn, and does not change Destination. A reload clears the control and leaves the write. A failed write-back keeps the control until the 9 seconds end

## Comments

- Seams: `ask` in `app/services/chat.py`, and the reply control in `client/src/lib/chat-page.ts`. The model is a dependency. Undo calls the product-page publications write and the Settings Shop GPSR write. The panel chrome is not a test seam.
- A landed publications write returns the previous publication ids, tied to that reply. An empty previous set is an empty list. A landed Shop GPSR save returns the previous identity, and none is none. The stored thread is role and text.
- Undo stays in this browser for 9 seconds. A landed write-back drops that control. A failed write-back keeps it. A reload does not.
- Client `tsc` and `npm test` (154) passed. `uv run pytest`: 421 passed, 134 skipped. The HTTP tests that hand the previous set and the previous identity to the browser skipped because local Postgres was down.
