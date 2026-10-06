# The Website agent returns HTML on the same OpenHands

Building this waits for customer feedback, as [0038](./0038-openhands-waits-for-customer-feedback.md) records. The decision below stands.

The **Website agent** is the same self-hosted OpenHands as the **Conversation**, run from the Website page. A run has no tools, no shell, and no files. It sees that shop's picked products and brief only, and it returns HTML and CSS for a home and one page per product. The seller does not edit that look. A returned look replaces the stored look. The picked products and the Website brief are saved when the seller edits them. A failure or an empty return leaves the previous look. SnapSync strips scripts, iframes, external stylesheets, and any URL other than a product photo it supplied. The model does not see the Shopify token or the model key. The Conversation does not gain a tool that builds the look. Publish stays with the seller.

The Website brief is an instruction about the look, and shoppers do not see it. A run keeps going if the seller leaves the page. It uses the products and brief from the moment it was started. The agent returns a home and one region per product, with a slot in each region. SnapSync fills each slot with that product's listing copy, photos, confirmed facts, price, and checkout. Publish freezes that filled result. If the agent leaves a slot out, SnapSync still supplies that piece for every picked product. One run is in flight and at most one is waiting; a newer start replaces the waiting run, and the run already in flight is left alone.

The shopper address serves a SnapSync page. The agent's HTML and CSS are the layout, and the checkout slot is SnapSync's own cart and Buy. Price, compare-at, variant, quantity, and the cart rules in [0034](./0034-website-is-hosted-by-snapsync.md) stand. Publish is unavailable until a run has returned a look for the picks and Website brief now on the page. A product that is no longer eligible leaves the picks, and Publish waits. There is no default layout.

We rejected a document whose checkout script is added onto the agent's markup, a Buy link that leaves the cart on Shopify's Online Store, dropping a fact the agent forgot a slot for, and a queue of every start.

We rejected a shopper-visible brief, a home-page story written by the agent, abandoning a run when the seller leaves, and a waiting run that picks up later edits.

This closes the open engine sentence in [0035](./0035-the-website-agent-builds-the-look.md). What a run sees, what SnapSync supplies, script stripping, and the Allowance rule in 0035 stand.

We rejected leaving the engine undecided, building the look from the Conversation, and a generated app on disk.
