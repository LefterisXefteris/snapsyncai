# 01: Go live in the header

**What to build:** On the product page, Go live sits in the header beside Save until the product is Active on the Online Store. It writes the page as it stands, sets the product Active, includes Online Store (other chosen publications stay chosen), and Push. After that, the header action is Sync updates, and Push and Sync write the page as it stands too. Save still only keeps work off Shopify. The button stays visible and names a missing listing copy, a missing or zero price, a disconnected shop, publications that need a reconnect, or a shop with no Online Store. Any write that leaves the product Active on the Online Store needs listing copy and a price greater than zero. A Draft push needs only listing copy. Typed copy can go live without confirmed facts. Stale listing copy does not block the write. The Shopify card keeps Draft or Active, the publication ticks, and the quieter Push. Catalogue bulk Push is unchanged. Stock is not this ticket.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] Header is Go live beside Save until the last sent state is Active with Online Store included; then the header is Sync updates, and the card does not grow a second Sync
- [x] Go live, Push, and Sync persist the page as it stands, then write to Shopify; a failed save does not write; a failed Shopify write keeps the page and does not mark the product live
- [x] Go live sets Active and adds Online Store to the ticks already chosen, even when Online Store was unticked
- [x] Quieter Push sends the picked Draft or Active and the ticks as chosen; the Draft default stays
- [x] A storefront write (Active, Online Store included) is refused without listing copy or without a price greater than zero, from Go live or from Push, and the refusal is not a Plan or Allowance refusal
- [x] A Draft write, or an Active write that does not include Online Store, needs only listing copy
- [x] Missing listing copy, a missing or zero price, Shopify not connected, publications not ready, and no Online Store publication each leave the control visible and name that gap
- [x] Unconfirmed facts and stale listing copy do not refuse the write
- [x] Clearing the price on a live product makes Sync name the missing price; switching that product to Draft needs only listing copy
- [x] Catalogue bulk Push is unchanged
