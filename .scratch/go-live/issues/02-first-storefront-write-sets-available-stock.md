# 02: First storefront write sets available stock

**What to build:** The first write that lands the product Active on the Online Store sets the single tracked variant’s available stock to the quantity on the page, including zero. The location is the Inventory location when the seller has one; otherwise the shop’s only active location, or the first active location. Tracking off does not set a quantity. A Draft write does not set stock. A later Sync of a product that is still Active on the Online Store does not change Shopify stock. Leaving the Online Store and landing again does set stock from the page. Several variants, no active location, or a failed stock write still leave the product Active on the Online Store, and the seller is told stock was not set. Products already on the Online Store are not backfilled. When Inventory is on, its ledger starts from that same page quantity.

**Blocked by:** 01: Go live in the header

**Status:** ready-for-agent

- [x] The first storefront write with tracking on and one variant sets available stock to the page quantity, including zero
- [x] That stock is written at the Inventory location when one exists; otherwise the only active location, or the first active location
- [x] Tracking off does not set a quantity; a Draft write does not set stock
- [x] A later Sync of a product already Active on the Online Store does not change Shopify stock
- [x] A later landing, after the product has left the Online Store, sets available stock from the page again
- [x] Several variants, no active location, or a failed stock write still leave the product Active on the Online Store and tell the seller stock was not set
- [x] A product already Active on the Online Store is not backfilled
- [x] When Inventory is on, the ledger start is that same page quantity, not a second number
