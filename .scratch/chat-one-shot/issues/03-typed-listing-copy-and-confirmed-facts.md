# 03 — Typed listing copy and confirmed facts

**What to build:** Quoted words and a facts confirm each get their own 9-second Undo. Undo restores the previous words or the previous facts pack. A facts Undo stales listing copy the way any facts change does. A missing field, missing words, or a missing required fact is asked, and nothing is saved.

**Blocked by:** 01 — Selling Undo

**Status:** done

- [x] Words they quote for a named listing-copy field are saved as typed listing copy, and that reply’s Undo restores the previous words, including empty
- [x] A message that supplies the facts the page would confirm confirms those facts, and that reply’s Undo confirms the previous pack again
- [x] A facts Undo stales listing copy the way any facts change does
- [x] A missing field, missing words, or a missing required fact is asked, and nothing is saved
- [x] Each reply keeps its own control for 9 seconds. Undo spends no Credit, adds no turn, and does not change Destination. A reload clears the control and leaves the write. A failed write-back keeps the control until the 9 seconds end

## Comments

- Seams: `ask` in `app/services/chat.py`, and the reply control in `client/src/lib/chat-page.ts`. The model is a dependency. Undo calls the same page writes: the image update for typed listing copy, and the product-facts confirm for the previous pack. The panel chrome is not a test seam.
- A landed quote returns the previous words of that field, including an empty string, tied to that reply. A landed confirm returns the previous pack when one was already confirmed. A first confirm has no pack to confirm again, so that reply has no Undo. The stored thread is role and text.
- A missing field, missing words, or a missing required fact returns no previous value and writes nothing.
- Undo stays in this browser for 9 seconds. Listing-copy Undo writes the previous words; empty words clear the field. Facts Undo confirms the previous pack, so stale listing copy follows that confirm. A failed write-back keeps the control. A reload does not.
- `uv run pytest`: 421 passed, 130 skipped, before the first-confirm case. That file and `tests/test_chat_copy_undo.py` then passed. Client `tsc` and `npm test` (154) passed. The workspace was not running, so the button itself was not clicked in the browser. Undo only appears after a turn that types listing copy, or confirms facts when a pack was already confirmed.
