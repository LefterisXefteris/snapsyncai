# 06 — Push, Go live, and Trendyol

**What to build:** "Put it live" is Go live. A Push that names no Channel is asked, and nothing is sent. A product the page would refuse is refused with that reason. A Trendyol Push is that Push, not Go live. Several acts in one message run in order, and the first refusal stops the later ones.

**Blocked by:** 02 — Say which product, or be asked

**Status:** done

- [x] "Put it live" is Go live
- [x] A Push that names no Channel is asked, and nothing is sent
- [x] A product the page would refuse is refused with that reason
- [x] A Trendyol Push is that Push, not Go live
- [x] Several acts in one message run in order, and the first refusal stops the later ones

## Comments

- Seam: `ask` in `app/services/chat.py`, same as 01–05. The model is a dependency. Go live, a Shopify Push, and a Trendyol International Push are the page's jobs. The route wires them. The card is not a test seam.
- "Put it live" calls the page's Go live: Active, Online Store added to the publications already chosen, and available stock when that Push sets it. The thread says "It's on the Online Store." When stock was not set, it also says "Available stock was not set."
- A Push with no Channel, or a Channel that is not Shopify or Trendyol International, asks "Which Channel — Shopify or Trendyol International?" Nothing is sent, and a later act in that message does not run.
- A named Shopify Push sends the page as it stands. It is not Go live.
- A product the page would refuse is refused with that reason. A missing price on Go live is "This product needs a price greater than zero." Missing listing copy is "This product needs listing copy." The first refusal stops the later acts.
- The word Trendyol alone is not a Channel. Chat asks which Channel, and nothing is sent.
- "Trendyol International" calls that Push with the listing already on the product. It does not call Go live.
- Several sends in one message run in order.
- Chat tests passed, including the real Go live and Shopify Push against the in-memory shop. Client `tsc` and `npm test` (131) passed. `uv run pytest` Chat files passed. The full API run still has the pre-existing listing-copy accept, propose, refresh HTTP, and Trendyol coffee failures.
