**Status:** done

# Push a product to Trendyol International

## Problem Statement

I already Push products to my Shopify shop. I also sell on Trendyol International, and nothing in the workspace can send a product there. Go live puts the product on the Shopify Online Store. I need a separate send, for one product, to my Trendyol International storefront, without that send changing my Shopify shop.

## Solution

Trendyol International is a second Channel on a workspace that already has a Shopify Channel. In Settings, beside Shopify, I connect one origin storefront. Currency is that storefront's. I set one VAT rate. Disconnect removes the link only.

On the product page I pick Trendyol's category, brand, and the attributes that category requires, plus my own sale price and list price in the storefront currency. Push sends that listing, the listing copy as written, the barcode, the SKU, and the photos. It waits until those are all present and the prices are valid. The first Push Trendyol accepts also sends my available quantity, or zero, and freezes the model code as the SKU at that moment. A later Push sends the listing, the copy, the photos, and the current SKU, and leaves quantity and the model code alone. A new barcode is a new product there; the old one stays.

Push is done when Trendyol accepts the batch. The product is not for sale on that Channel until Trendyol approves it. Opening the product page shows waiting, approved, or rejected with Trendyol's reason. Go live stays the Shopify Online Store.

## User Stories

1. As a seller with a Shopify shop, I want to connect one Trendyol International account, so that I can list on that Channel as well as Shopify.
2. As a seller, I want that connect in Settings beside Shopify, so that the conversation stays about my Shopify shop.
3. As a seller, I want the connection to be my origin storefront, so that I list in the country where my Trendyol store is registered.
4. As a seller, I want the currency to be that storefront's currency, so that I am not asked to pick a second currency.
5. As a seller, I want to set one VAT rate on the connection, so that every Push uses the rate for that storefront.
6. As a seller whose account has more than one origin storefront, I want to pick one at connect, so that the workspace has a single storefront.
7. As a seller, I want a Turkey storefront refused, so that this Channel is not the Turkey marketplace.
8. As a seller with no Shopify Channel, I want connect unavailable, so that Trendyol International stays on a workspace that already has a Shopify shop.
9. As a seller, I want a rejected account link to leave me disconnected, so that I do not look connected when Trendyol refused the credentials.
10. As a seller, I want to disconnect, so that Push waits until I connect again.
11. As a seller who disconnects, I want the Trendyol listing to stay on the product, so that my picks are not thrown away.
12. As a seller who disconnects, I want the product to stay on Trendyol, so that disconnect does not delete it there.
13. As a seller, I want one Trendyol International account on the workspace, so that I am not managing two storefronts.
14. As a seller, I want a Trendyol row on the product page, so that this Channel's fields stay off the Shopify card.
15. As a seller, I want to pick Trendyol's category from Trendyol's list, so that the product is filed where Trendyol sells it.
16. As a seller, I want to pick Trendyol's brand from Trendyol's list, so that I send their brand and not my Shopify vendor.
17. As a seller, I want the attributes that category requires, so that I can fill what a create is refused without.
18. As a seller, I want optional category attributes left off the row, so that the page does not become Trendyol's admin.
19. As a seller, I want my own sale price and list price on that row, so that a Shopify price in another currency is not sent as-is.
20. As a seller, I want the sale price to be greater than zero, so that a placeholder is not a price.
21. As a seller, I want the list price to be at least the sale price, so that the list covers the sale.
22. As a seller who leaves the list price empty, I want it not copied from the sale price, so that I choose both numbers.
23. As a seller, I want Selling left as the Shopify price, so that a Trendyol Push does not change my shop price.
24. As a seller, I want Classification not to choose the Trendyol category or brand, so that a photo guess is not Trendyol's list.
25. As a seller, I want product facts and listing copy left alone by the Trendyol listing, so that fibre, care, and GPSR are not category attributes.
26. As a seller, I want changing the Trendyol listing not to stale listing copy, so that a category pick is not a new copy job.
27. As a seller, I want Push on the product page for this one product, so that I send the page I am looking at.
28. As a seller whose Trendyol listing is incomplete, I want Push to wait and name the gap, so that I know what is missing.
29. As a seller without listing copy, I want Push to wait, so that the title and description exist.
30. As a seller without a barcode, I want Push to wait, so that Trendyol can tell the product apart.
31. As a seller without a SKU, I want Push to wait, so that the stock code and the model code exist.
32. As a seller with stale listing copy, I want Push still allowed, so that stale copy is not a gate on this Channel.
33. As a seller who typed listing copy without confirming facts, I want Push allowed, so that typed copy is not trapped behind the generate rule.
34. As a seller, I want this Push not to spend Allowance, so that the send is not a listing-copy use.
35. As a seller without a Plan, I want Push of listing copy I already have, so that the Plan rule for a Push still holds.
36. As a seller whose Trendyol International account is disconnected, I want Push to wait and point at Settings, so that I am not offered a write that cannot run.
37. As a seller, I want the title and description sent as written, so that the storefront gets the language I wrote.
38. As a seller, I want the barcode and the current SKU sent, so that Trendyol has the identity and the stock code.
39. As a seller, I want the product's photos in the product's order, so that the gallery matches the page.
40. As a seller, I want the first accepted Push to send Inventory's available quantity, including zero, so that Trendyol starts from the stock I have.
41. As a seller with no Inventory quantity, I want that first Push to send zero, so that a missing count is not a guessed number.
42. As a seller, I want the model code to be the SKU at that first accepted Push, so that I do not type a separate code.
43. As a seller, I want VAT and currency taken from the connection, so that I do not set them on every product.
44. As a seller, I want cargo, addresses, and dimensional weight left in Trendyol, so that the product page does not collect them.
45. As a seller, I want Push done when Trendyol accepts the batch, so that acceptance is not the same as being for sale.
46. As a seller, I want the row to show waiting after acceptance, so that I do not think the product is already for sale.
47. As a seller whose batch Trendyol does not accept, I want the page kept and the Push not counted, so that the next try can still send quantity and set the model code.
48. As a seller, I want Go live left as the Shopify Online Store, so that one action does not send to both Channels.
49. As a seller who changes the description, prices, attributes, photos, or SKU after acceptance, I want the same Push to send them again, so that there is not a second update job.
50. As a seller who Pushes again, I want Trendyol's quantity left as it is, so that a sale on Trendyol is not overwritten.
51. As a seller who changes the SKU, I want the model code to stay the first SKU, so that the product stays the same model.
52. As a seller who changes the barcode, I want a new Trendyol product, so that barcode stays how Trendyol tells products apart.
53. As a seller who changes the barcode, I want the previous product left on Trendyol, so that SnapSync does not delete it.
54. As a seller whose new barcode has not been accepted yet, I want that first accepted Push to send quantity and freeze a new model code, so that the new product starts the same way.
55. As a seller whose product was rejected, I want Trendyol's reason on the row, so that I can correct the listing.
56. As a seller who corrects a rejection and Pushes again, I want the same Push, with quantity left unchanged, so that a fix is not a new stock write.
57. As a seller whose product is still waiting, I want a later Push to send the page as it stands, so that I can fix the copy before approval.
58. As a seller, I want the product page to show waiting, approved, or rejected when I open it, so that I see Trendyol's decision.
59. As a seller, I want that check only when I open the product, so that nothing polls on a schedule.
60. As a seller looking at the catalogue, I want no Trendyol column, so that the catalogue stays the product list.
61. As a seller, I want an approved product not treated as live on Shopify, so that Go live remains the storefront action.
62. As a seller, I want catalogue bulk Push unchanged, so that this slice is the product page.
63. As a seller, I want Import not to fetch Trendyol products, so that this slice is outbound only.
64. As a seller in the conversation, I want no Trendyol Push and no Trendyol connect offered there, so that the conversation keeps speaking about the Shopify shop.
65. As a seller with sizes or colors, I want this Push to stay one barcode, so that variant grouping waits.
66. As a seller, I want no translation of the listing copy, so that the words sent are the words I accepted.
67. As a seller, I want the website, Shop GPSR, and Inventory Autopilot left Shopify-shaped, so that this Channel does not take them over.

## Implementation Decisions

- One Trendyol Channel module owns connect, disconnect, the listing, Push, and the approval read. It is an adapter for this Channel, not a protocol extracted from Shopify. Publications, Draft/Active, Go live, Inventory Autopilot, Shop GPSR, and the website stay Shopify-shaped.
- Tests call that module with the real database and an in-memory Trendyol. The in-memory Trendyol records the account, the storefront, products by barcode, quantity, model code, and approval. Tests assert that state and the refusal the seller would see. The product page renders the module's result and does not grow its own decision helper. The route maps outcomes onto HTTP and is not where the rules live.
- The connection is its own record for the seller: one origin storefront, that storefront's currency, and one VAT rate. It is not columns on the Shopify connection. Connect is refused without a Shopify Channel, and refused for the Turkey storefront. When the account has several origin storefronts, the seller's pick is the one stored. Credentials stay on the server.
- The Trendyol listing is per product: Trendyol category, Trendyol brand, that category's required attribute values, sale price, and list price. Optional attributes are not stored. Classification does not fill category or brand. Saving the listing does not change Selling, product facts, or listing copy, and does not mark listing copy stale.
- Push waits, and names the gap, until the listing is complete, listing copy exists, barcode and SKU exist, the sale price is greater than zero, and the list price is greater than or equal to the sale price. An empty list price is not copied from the sale price. Stale listing copy and unconfirmed facts do not wait the Push. The Push does not spend Allowance and does not require a Plan beyond the listing copy already being present.
- The payload sends the listing, title and description as written, barcode, current SKU, photos in the product's order, the connection's currency and VAT. It does not send cargo, addresses, or dimensional weight. Photos are handed to Trendyol the same way a Shopify Push lets Shopify fetch them: a short-lived URL, not a public bucket.
- Quantity and model code are fixed on the first Push that Trendyol accepts for that barcode. Quantity is Inventory's available quantity for that single product, including zero, or zero when Inventory has none. The model code is the SKU at that moment. A batch Trendyol does not accept does not fix either. A later Push sends the listing, listing copy, photos, and the current SKU, and leaves quantity and the model code unchanged. Changing the barcode is a new product: the previous barcode is left on Trendyol, and the new barcode gets its own first-Push quantity and model code.
- Approval is waiting once the batch is accepted. Opening the product asks Trendyol and stores waiting, approved, or rejected, with Trendyol's reason on a rejection. The catalogue read does not ask. There is no schedule. Approved is not Go live and does not change Shopify status or publications.
- Disconnect deletes the connection only. The listing remains on the product. Nothing is deleted on Trendyol. Push then waits and points at Settings.
- Go live, catalogue bulk Push, Import, the conversation, and the website are unchanged.

## Testing Decisions

- A good test asserts what the seller can observe: connected or not, which gap a Push names, what the in-memory Trendyol holds after a Push, and which approval the product page shows on open. It does not assert request text, call order, or component layout.
- The Trendyol Channel module is the only rule seam. Prior art is the Shopify Push module tests that drive an in-memory shop and the real database, and assert shop state rather than query strings. Cases that must exist: connect refused without Shopify and for a Turkey storefront; currency follows the storefront; disconnect keeps the listing and removes the link; Push waits for an incomplete listing, missing listing copy, missing barcode, missing SKU, a sale price that is missing or zero, and a list price below the sale price; an empty list price is not inferred; the first accepted Push stores quantity (including zero, or zero when Inventory has none) and the model code; a refused batch stores neither; a later Push updates copy, prices, photos, and SKU and leaves quantity and model code; a new barcode is a second product and the old barcode remains; opening the product shows waiting, approved, or rejected with the reason; the catalogue read does not.
- The route keeps a thin set of outcome mappings, in the same spirit as the Shopify Push route tests: no connection, a named wait, and an accepted batch. Those tests do not re-prove the rules.
- No second seam renders the product page. No test is added for catalogue bulk Push, Import, Go live, Allowance, or the conversation except to show they are untouched.

## Out of Scope

- The Turkey marketplace and cross-country listing
- Import from Trendyol International
- Catalogue bulk Push, and a Trendyol column on the catalogue
- A schedule that polls approval
- Translation of listing copy
- Size and color variants, and more than one barcode per product except when the seller changes the barcode
- Cargo, shipment and return addresses, and dimensional weight
- Sending Shopify's Selling price, or converting currency
- Inventory Autopilot, or a later Push updating quantity
- Go live, publications, Shop GPSR, and the website
- The conversation offering connect or Push
- A Channel protocol shared with Shopify
- Deleting a product on Trendyol when the seller disconnects or changes the barcode
- Spending Allowance on this Push

## Further Notes

- Glossary terms are **Trendyol International**, **Trendyol listing**, **Trendyol approval**, **Model code**, and **Push**. Push to this Channel is its own act. Go live stays the Shopify Online Store.
- A rejection is corrected by changing the Trendyol listing or the listing copy and Pushing again. That Push is a later Push, so quantity stays.
- If Trendyol refuses a create because dimensional weight or cargo was absent, the row shows that reason. This spec does not add those fields to the product page.
