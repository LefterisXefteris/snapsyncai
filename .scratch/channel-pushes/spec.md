**Status:** done

# Two Pushes, one listing copy

## Problem Statement

I write one listing copy for a product: title, description, tags, SEO title, meta description, and AEO. The product page is shaped for my Shopify shop, and I want it to stay that way. I also sell on Trendyol International. That Channel needs its own Push, because its batch is not a Shopify product. I do not want one send that tries to update both Channels, and I do not want a second set of words.

## Solution

Listing copy stays one set on the product. The product page stays shaped for Shopify, with the Trendyol listing on its own row. Shopify Push and Trendyol International Push stay two sends. Each call goes to the Channel the seller chose.

A Shopify Push sends the title, description, tags, SEO title, and meta description, plus Selling, photos, status, and publications. A Trendyol International Push sends the title and description from that same listing copy, the product's photos, the barcode, the SKU, and the Trendyol listing. Quantity goes only on the first accepted Push for that barcode. VAT from the connection goes with the batch. The model code goes as Trendyol's product id. Tags, the SEO title, and the meta description stay with the Shopify Push. AEO stays on the product and is not part of either Push. Cargo, addresses, and dimensional weight stay with Trendyol. The Trendyol Push is done when Trendyol accepts the batch. A refusal shows Trendyol's reason. The Shopify shop is left unchanged.

## User Stories

1. As a seller, I want one listing copy on the product, so that I do not write a second title and description for Trendyol International.
2. As a seller, I want the product page to stay shaped for Shopify, so that Selling, status, and publications stay where they are.
3. As a seller, I want the Trendyol listing on its own row, so that category, brand, attributes, sale price, and list price stay off the Shopify card.
4. As a seller, I want a Shopify Push and a Trendyol International Push as two sends, so that each call updates one Channel.
5. As a seller, I want the catalogue's bulk Push to stay a Shopify Push, so that a multi-product send does not start a Trendyol batch.
6. As a seller, I want a Shopify Push to send the title, description, tags, SEO title, and meta description, so that the Shopify shop gets the words written for it.
7. As a seller, I want a Shopify Push to send Selling, photos, status, and publications, so that Go live and Sync stay that Push.
8. As a seller, I want AEO to stay on the product, so that neither Push invents a place for it.
9. As a seller, I want a Trendyol Push to send the title and description as written, so that Trendyol shows those words and not a rewrite.
10. As a seller, I want tags left off the Trendyol batch, so that Shopify tags are not sent as a Trendyol field.
11. As a seller, I want the SEO title and meta description left off the Trendyol batch, so that Shopify SEO stays on the Shopify Push.
12. As a seller, I want the product's photos on the Trendyol batch, in the product's order, so that Trendyol shows the same pictures.
13. As a seller, I want the barcode and the current SKU on the Trendyol batch, so that Trendyol can identify the product.
14. As a seller, I want the Trendyol listing on that batch, so that category, brand, required attributes, sale price, and list price are the ones I set for that storefront.
15. As a seller, I want the sale price and list price to stay the Trendyol listing, so that Selling in another currency is not sent as the Trendyol price.
16. As a seller, I want VAT from the connection on the batch, so that I do not type VAT on the product page.
17. As a seller, I want the storefront currency to ride with the connection, so that the create call is not given a second currency field.
18. As a seller, I want quantity only on the first accepted Push for that barcode, so that a later Push does not overwrite stock on Trendyol.
19. As a seller, I want the model code fixed as the SKU of that first accepted Push, so that a later SKU change does not rename the product on Trendyol.
20. As a seller, I want a later Trendyol Push to send the listing, the title, the description, the photos, and the current SKU as they stand, so that those edits reach Trendyol.
21. As a seller, I want a Trendyol Push to wait until the listing is complete, the title and description exist, and both barcode and SKU exist, so that an incomplete product is not submitted.
22. As a seller who has only tags, I want the Trendyol Push to wait for a title and a description, so that tags alone are not a Trendyol product.
23. As a seller, I want stale listing copy and unconfirmed facts not to block a Trendyol Push, so that the words already on the product can still be sent.
24. As a seller, I want cargo, addresses, and dimensional weight left in Trendyol, so that the product page does not collect them.
25. As a seller, I want a refusal to show Trendyol's reason, so that a missing cargo or dimensional weight is Trendyol's message and not a new field on the page.
26. As a seller, I want the Trendyol Push done when Trendyol accepts the batch, so that approval stays a later decision on the product page.
27. As a seller, I want the Shopify shop left unchanged by a Trendyol Push, so that status, publications, and the Shopify product id stay as they were.
28. As a seller, I want a Shopify Push to leave the Trendyol listing and the product on Trendyol unchanged, so that the two sends do not overwrite each other.
29. As a seller in the conversation, I want no Trendyol Push offered there, so that the conversation keeps speaking about the Shopify shop.
30. As a seller, I want Wix and Vinted left without a Push, so that this decision covers only the two Channels that already send.

## Implementation Decisions

- Two Channel modules stay separate. The Shopify Push module keeps the Shopify send. The Trendyol Channel module keeps connect, the Trendyol listing, the Trendyol Push, and the approval read. There is no shared function that takes the product page and sends to both Channels. ADR 0013 still holds: no generic Channel entry above the two.
- The product page stays shaped for Shopify. The Trendyol row remains the only place the seller sets the Trendyol listing. Saving that listing does not change Selling, product facts, or listing copy.
- Listing copy stays one set on the product. The Trendyol batch takes the title and the description from it. Tags, the SEO title, and the meta description are sent only on the Shopify Push. AEO is stored on the product and is not mapped onto either batch.
- The Trendyol batch is the listing, that title and description, the barcode, the current SKU, photos in the product's order, and the connection's VAT. The model code is sent as Trendyol's product id. Currency is the storefront and is not a field on the create call. Quantity is included only on the first accepted Push for that barcode. Cargo, addresses, and dimensional weight are omitted. A refusal returns Trendyol's reason and does not add those fields.
- A Trendyol Push does not write a Shopify product id, status, or publications, and does not spend Allowance. A Shopify Push does not submit a Trendyol batch.
- Catalogue bulk Push, Go live, Sync, Import, the conversation, and the website stay as they are.

## Testing Decisions

- A good test asserts what the seller can observe and what the Channel holds after a Push: which gap is named, which title and description arrived, which photos and prices arrived, and that the other Channel was left unchanged. It does not assert request text, call order, or page layout.
- No new seam. The Trendyol Channel module, called with the real database and an in-memory Trendyol, is the seam for the Trendyol batch. The Shopify Push module is the seam for the Shopify send. Prior art is the existing tests on those two modules.
- The Trendyol cases already locked there stay the lock: a wait until title and description exist, including when only tags are present; the first accepted Push stores quantity and the model code; a later Push updates the description, prices, photos, and SKU and leaves quantity and the model code; photos go in the product's order; a refused batch does not fix quantity or the model code; the Shopify shop is not given a product id. Tags, the SEO title, the meta description, and AEO are absent because the batch the in-memory Trendyol records has no place for them.
- No test is added that pushes both Channels in one call. No test is added for Wix, Vinted, cargo, or dimensional weight.

## Out of Scope

- A second listing copy, or a rewrite of the title and description for Trendyol
- Sending tags, the SEO title, the meta description, or AEO on the Trendyol batch
- Sending AEO on the Shopify Push
- One call that Pushes to both Channels
- A generic Channel module shared by Shopify and Trendyol
- Changing the product page away from its Shopify shape
- Cargo, addresses, and dimensional weight
- Sending Selling as the Trendyol price, or converting currency
- A later Push changing quantity or the model code
- Wix and Vinted Pushes
- Connect, disconnect, Import, catalogue bulk Push, Go live, the conversation, and the website
- Allowance spend on a Trendyol Push

## Further Notes

- This records the decision already in the product. The glossary term **Push** now says a Trendyol International Push sends the title and description, and that tags, the SEO title, and the meta description stay with the Shopify Push, while AEO stays on the product.
- A refusal for missing dimensional weight or cargo shows Trendyol's reason. The field is not added to make the batch accepted.
- Approval is still a later read when the seller opens the product. Accepting the batch is the end of the Push.
