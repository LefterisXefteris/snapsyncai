# 07 — Stock, Selling, publications, Shop GPSR, and delete

**What to build:** An Inventory adjustment runs only with the quantity and the reason the page requires. Selling, the publication set, and Shop GPSR run when the message names them. A delete runs only for the product named. Anything missing is asked for, and nothing is written.

**Blocked by:** 02 — Say which product, or be asked

**Status:** done

- [x] An Inventory adjustment runs only with the quantity and the reason the page requires
- [x] Selling runs when the message names the selling fields
- [x] The publication set runs when the message names it
- [x] Shop GPSR runs when the message names a complete identity
- [x] A delete runs only for the product named
- [x] Anything missing is asked for, and nothing is written

## Comments

- Seam: `ask` in `app/services/chat.py`, same as 01–06. The model is a dependency. Stock, Selling, publications, Shop GPSR, and delete are the page's writes. The route wires them. The card is not a test seam.
- An adjustment needs a quantity of zero or more and a reason of 3 to 250 characters, the same bar as the Inventory page. Anything outside that asks, and the stock job is not called. No Credit is spent.
- Selling saves only the fields the message names: price, compare-at price, cost, SKU, barcode. Publications save the named set. Shop GPSR does not need a product. A missing identity asks with the page's incomplete line, and nothing is saved.
- Delete runs for the named product only. A missing product asks, and nothing is deleted.
- A refusal stops a later act in that message. A write that lands can be followed by the next act.
- Chat module tests passed, including the channel and import siblings. `uv run pytest`: 505 passed. 13 failed in listing-copy accept, propose, refresh HTTP, and one Trendyol Push test. Those files are unchanged by this ticket.
