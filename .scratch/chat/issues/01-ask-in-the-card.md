# 01 — Ask in the card

**What to build:** On any signed-in Destination the seller opens Chat by pointer or tap, and it stays until they close it. It is absent from the Landing page and it does not change Destination. They ask a question, the thread shows the answer, and nothing in the shop changes. No Credit is spent. Closing the card, changing Destination, and reloading keep the same thread, one per shop. A signed-out caller is refused. A second message waits until the turn ends. At 10 model calls the turn stops and the thread says so. Buying Credits, connecting or disconnecting a Channel, claiming a shop, cancelling a Plan, and choosing photos do nothing. The model service never receives the Shopify token or the session cookie.

**Blocked by:** None — can start immediately.

**Status:** done

- [x] A question is answered in the thread, the shop is unchanged, and no Credit is spent
- [x] The same thread is still there after reload, one per shop
- [x] A second message waits until the turn ends
- [x] The eleventh model call does not run, and the thread says it stopped
- [x] Buying Credits, connecting or disconnecting a Channel, claiming a shop, cancelling a Plan, and choosing photos do nothing
- [x] The model is not given the Shopify token or the session cookie
- [x] A signed-out caller is refused
- [x] The card opens by pointer or tap, stays until closed, and is absent from the Landing page

## Comments

- Seam: `ask` in `app/services/chat.py`. The model is a dependency. The route is an auth shell. The card is not a test seam.
- A question stores the seller's words and the answer. `credits_spent` is 0 and `shop_changed` is false. No job is called.
- One row per seller and shop domain (`chat_threads`). No shop yet is an empty domain, and it is not that shop's thread. A second message takes `pg_advisory_xact_lock` until the first request commits.
- Ten model calls that still want to continue append "Stopped after 10 steps." The eleventh call is not made.
- Those six browser acts append a fixed line and do not run. An act with no reply text still does that, not "Chat is not available right now."
- The model payload is the message, the thread, the shop domain, and the call count. The route never passes the Shopify token or the session cookie.
- `CHAT_MODEL_URL` unset, or a failed call, stores "Chat is not available right now."
- The card sits on the signed-in workspace only. Pointer enter or a tap opens it; Close hides it. The thread query key includes the shop domain, so a connect or disconnect loads that shop's thread.
- Postgres was down (`supabase start` / Docker not available), so the two `db` tests skipped. 18 Chat tests passed without them. Client `tsc` and `npm test` (125) passed. `uv run pytest`: 329 passed, 119 skipped.
