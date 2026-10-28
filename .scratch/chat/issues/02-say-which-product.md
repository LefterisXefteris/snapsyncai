# 02 — Say which product, or be asked

**What to build:** "This" means the product page that was open when they sent the message. A product they name clearly is that product. Two matches, or none, and Chat asks and runs nothing. It does not invent a product.

**Blocked by:** 01 — Ask in the card

**Status:** done

- [x] "This" is the product page that was open when the message was sent
- [x] A product named clearly is that product
- [x] Two matches, or none, and Chat asks and runs nothing
- [x] Chat does not invent a product

## Comments

- Seam: `ask` in `app/services/chat.py`, same as 01. The catalogue and the open product page are inputs. The model is a dependency. The route loads this seller's products and passes the page id. The card sends that id only from a product page.
- "This" is that photo's page: its id, and its title or file name. A clear name is an exact list name or an exact photo name, not a fragment of a longer title. Two products with that name, or none, ask, and the turn stops. An id the model sends is ignored.
- The product list's name is the primary photo, the one with a description, otherwise the lowest id. Same rule as Products.
- Postgres was down, so the route test that posts the open page id did not run. Module tests passed without it. `uv run pytest`: 339 passed, 120 skipped. Client `tsc` and `npm test` (127) passed.
