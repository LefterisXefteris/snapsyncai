# SnapSync

Textile-first seller workspace for Shopify, Wix, Vinted, and Trendyol International. Listing from photos is one job inside it, not the whole product. This glossary is the domain language for that workspace.

## Language

**Channel**:
Shopify, Wix, Vinted, or Trendyol International — a place the seller lists or fetches products. Each Channel keeps its own connect and publish fields. A seller may connect any one of them while the others stay disconnected, and connecting or disconnecting one leaves the others as they were.
_Avoid_: Platform, plugin, integration, marketplace (as the general term), store (when you mean the channel type)

**Trendyol International**:
The Channel for Trendyol's stores in CEE, the Gulf, and DACH. One product is one barcode on one storefront, the seller's origin country. A new barcode is a new product there; the previous barcode stays as it was. Connect carries that storefront, the storefront's currency, and VAT. Disconnect removes the account link only: the Trendyol listing stays on the product, the product stays on Trendyol, and Push waits until the seller connects again. Cargo, addresses, and dimensional weight stay with Trendyol. The Turkey marketplace and cross-country listing are not this Channel.
_Avoid_: Trendyol (alone), Turkey

**Trendyol listing**:
The category, brand, required category attributes, sale price, and list price the seller sets for one product on Trendyol International. Prices are in the storefront currency and are not Selling. The sale price is greater than zero, and the list price is at least the sale price; neither is inferred. Not product facts, not Classification, and not listing copy.
_Avoid_: product facts, classification, Shopify category, Selling

**Model code**:
The SKU from the first accepted Push of a barcode on Trendyol International. It stays if the seller later changes the SKU. The seller does not enter it, and a Push waits until both barcode and SKU exist.
_Avoid_: SKU, variant

**Trendyol approval**:
Trendyol's decision on a product after a Push. The Push is done when Trendyol accepts the batch. Until Trendyol approves, the product is not for sale on that Channel. A rejection includes Trendyol's reason. The product page learns the decision when the seller opens it; there is no schedule, and the catalogue does not show it. Quantity goes only on the first accepted Push for that barcode. A later Push sends the Trendyol listing, the title and description, photos, and the current SKU as they stand, in the language they were written, and leaves quantity and the model code unchanged.
_Avoid_: Go live, Active, review, Sync, translation

**Channel claim**:
The seller taking ownership, on Shopify, of a shop opened for them because they had no Shopify Channel yet. They confirm a shop name and the email for their Shopify account before that shop is opened. Until that claim, it is not their Channel. Distinct from connecting a shop they already own.
_Avoid_: store setup, create store, MCP

**Conversation**:
The one dialogue for a Shopify shop, kept on that shop, and a destination beside the catalogue. Opening the workspace lands on Products, whether or not a Shopify Channel is connected. A destination the seller opens stays until they leave. Disconnecting, and a connect or Channel claim trip, are not leaving. A job it starts is the same job the catalogue page runs; confirming facts, accepting listing copy, going live, and Publish stay with the seller.
_Avoid_: agent, Agentic SEO, SEO agent, copilot, home, thread

**Silence**:
A shop-level choice on that conversation. It can stop job offers, or stop the conversation offering or starting Bulk SEO, listing copy refresh, or a website prototype. The catalogue page for a silenced job stays. Inventory, a Channel claim, and connect cannot be silenced.
_Avoid_: disable chat, hide page, mute

**Job offer**:
A proposal, in the conversation, of a job the seller did not ask for. It does not start the job, and declining it does not silence that job.
_Avoid_: suggestion, agent nudge, autopilot

**Publication**:
Where this product is available inside a connected Shopify shop — Online Store, Point of Sale, Shop, and other sales apps on that shop. Not a Channel.
_Avoid_: Channel, sales channel (as SnapSync language), available channels

**Push**:
Sending the product page as it stands to one Channel. A Shopify Push sends listing copy, price, photos, status, and publications; Go live and Sync are those Pushes. A Trendyol International Push waits until the Trendyol listing is complete, listing copy exists, and both barcode and SKU exist. It sends that listing, the title and description, the barcode, the SKU, and the photos. Tags, the SEO title, and the meta description stay with the Shopify Push. AEO stays on the product. It leaves the Shopify shop unchanged.
_Avoid_: publish, upload, export

**Go live**:
The seller’s choice, on the product page, to put this product on the Online Store as Active, once listing copy exists and the price is greater than zero. It is a Push with that status and that publication. Other publications already chosen stay chosen. On a single tracked variant it also sets that variant’s available stock, including zero.
_Avoid_: production, publish, make live, push production

**Product**:
The sellable thing the seller is listing. One product may have several photos. Listing copy and product facts belong to the product, not to a single photo.
_Avoid_: Image (as the sellable thing), listing (as the thing being sold), snap, variant (as the sellable thing)

**Photo**:
A picture of a product. Several photos may belong to one product.
_Avoid_: Image (when you mean the sellable thing), snap

**Draft product**:
A product on the New listing canvas that is not yet in the catalogue. Each photo starts as its own draft product. Several photos on one draft are still that draft, not a finished or categorised product.
_Avoid_: Upload, staged image, group (as the sellable thing), categorised, assigned

**Variant**:
A channel-level option of a product, such as color or size, with its own selling when the Channel has more than one. Grouping photos in New listing does not create variants. Distinct from Inventory (stock on that option).
_Avoid_: Group, listing (as a color/size option)

**New listing**:
The job of creating a product from photos.
_Avoid_: Upload, upload product, add product

**Import**:
The job of fetching products from a channel into the catalogue that are not already there. The seller starts it; it is not a schedule. Match is the Channel product id. Not Inventory pulling stock, and not Push.
_Avoid_: Sync, fetch, pull, scrape, Inventory Autopilot setup, two-way merge

**Bulk SEO**:
The job of running listing copy refresh for many seller-picked products at once. The seller starts it and accepts per product; it is not a schedule, not a second rewrite engine, and accept does not Push to a Channel.
_Avoid_: SEO (alone), Agentic SEO, SEO agent

**Listing copy refresh**:
The job of proposing new tags, description, SEO title, and meta description for one product after looking at search demand. The seller starts it and accepts; it is not the first generate, not Bulk SEO, and it does not run when listing copy is missing or stale.
_Avoid_: Agentic SEO, SEO agent, trend rewrite, competitor SEO

**Accept**:
The seller's explicit choice to keep proposed listing copy for one product. It saves that copy, spends one Allowance use when the write lands (not when stale listing copy is regenerated), and does not Push. First generate, listing copy refresh, and Bulk SEO each end in an accept; the same accept runs from the product page, the Bulk SEO page, or the conversation.
_Avoid_: approve, apply, save (as the seller act)

**Search demand**:
Queries people type for this kind of product, from a query source — not the model’s guesses — and this shop’s performance when it exists. Not fashion-season media and not other sellers’ listings.
_Avoid_: Trends (alone), competitor research, keyword research (as the job)

**Inventory**:
Stock on hand for products in the workspace. Distinct from listing copy and from Import.
_Avoid_: Stock, quantity (alone)

**Listing copy**:
The title, description, tags, SEO title, meta description, and AEO text written for a product. It must not be generated until product facts are confirmed.
_Avoid_: AI content, content, listing (alone)

**Selling**:
Price, compare-at price, cost, SKU, and barcode on the product, or on a variant when the product has more than one. Distinct from Inventory and from listing copy.
_Avoid_: Commerce, merchandising, quantity, stock

**Product facts**:
Structured attributes of a product that listing copy is not allowed to invent. The seller must confirm them before listing copy is generated.
_Avoid_: Metadata, product context, product data, context, Trendyol listing

**Visible attribute**:
A product fact a photo can reasonably suggest. In v1 that is whether the product is a textile, and likely fibre names (percentages left blank). Color is a variant, not a product fact.
_Avoid_: Inferred spec, guessed material, color (as a fact)

**Legal fact**:
A product fact a photo cannot establish, such as fibre percentages, care code, manufacturer, or EU responsible person. The seller enters it; vision must not invent it.
_Avoid_: Compliance field, EU data

**Confirmed facts**:
Product facts the seller has accepted. Listing copy does not generate until these exist.
_Avoid_: Approved data, validated spec

**Suggested facts**:
Visible attributes proposed from a photo, not yet accepted by the seller.
_Avoid_: Draft facts, AI facts

**Fibre composition**:
A legal fact: EU fibre names and percentages that sum to 100. Required for a textile product before listing copy is generated. Vision may pre-fill fibre names; the seller types the percentages.
_Avoid_: Fabric, material, blend

**Care instructions**:
A legal fact: one pick each for washing, bleaching, drying, ironing, and professional textile care, written as English text. Not inferred from a photo. Not GINETEX pictograms.
_Avoid_: Care label, washing info, care symbols

**GPSR identity**:
A legal fact: manufacturer name, postal address, and email; and, when the manufacturer is not in the EU, the EU responsible person’s name, postal address, and email.
_Avoid_: Compliance, EU person, responsible person (alone)

**Manufacturer**:
The maker named on GPSR identity (or the importer, if that is who the seller is identifying). Name, postal address, email.
_Avoid_: Brand, seller (as the maker), vendor

**EU responsible person**:
The EU-established contact on GPSR identity when the manufacturer is not in the EU. Name, postal address, email.
_Avoid_: Responsible person (alone), authorised representative (unless that is who they named)

**Textile product**:
A product the fibre-composition pack applies to. Confirmed by the seller; vision may suggest it from the photo or category.
_Avoid_: Apparel, clothing (as the only textile)

**Classification**:
Category and product type inferred from a photo. Not listing copy. May run before facts are confirmed.
_Avoid_: Analysis, preview, unlock

**Explicit skip**:
The seller states they do not have care instructions or GPSR identity. Those blocks are omitted from listing copy and must not be invented.
_Avoid_: Optional field, empty field (an empty field is not a skip)

**Stale listing copy**:
Listing copy that no longer matches the confirmed facts, or the Shop GPSR identity those facts use, because those were changed after generation. It is not a second generate or publish gate.
_Avoid_: Out of date, dirty

**Shop GPSR identity**:
The default GPSR identity for a connected Shopify shop. A product may override it. Changing it stales listing copy on products that use the shop default.
_Avoid_: Account compliance, store settings (as the fact itself)

**Website**:
The seller's own storefront for one Shopify shop, hosted by SnapSync at that shop's address, not the workspace and not a Channel. Words, photos, and layout are whatever the last Publish froze; the shop's price and checkout stay on the Channel.
_Avoid_: store, shop (when you mean this), channel, theme, Lovable, handoff

**Website prototype**:
The products the seller picks, in that order, among products already pushed with listing copy, an optional Website brief, and the look the Website agent last built for a home and one page per product; a product that is no longer eligible leaves the picks. Listing copy, photos, confirmed facts, price, and checkout are supplied by SnapSync for every picked product; the seller does not edit that look; the Website page stores the picks, the Website brief, and the last look, and shows them again; a later run replaces the look; a run that returns no look leaves the previous one; it is not the live storefront.
_Avoid_: theme, mock, preview (as the job), prompt, palette

**Website brief**:
An optional instruction on a Website prototype about the look. Shoppers do not see it, and a run uses that brief and the picked products from the moment the seller started it.
_Avoid_: prompt, tagline, story

**Website agent**:
SnapSync's own agent, inside the product, that builds one shop's Website prototype look at a time. The seller does not run their own; one run is in flight and at most one is waiting; a newer start replaces the waiting run; a run keeps going if the seller leaves the page, sees that shop's picked products and Website brief only, does not Publish, and does not invent product words, fibre, care, or GPSR.
_Avoid_: Lovable, builder (as a separate product)

**Publish**:
The seller putting this shop's Website on its SnapSync address, once a Website agent run has returned a look for the picks and Website brief now on the page. The first one that lands spends one Allowance use; a later one does not; taking the site down keeps the address; it is not a Push and not Go live.
_Avoid_: handoff, deploy, launch

**Plan**:
Paid access to the workspace for one seller and one Shopify shop. Monthly and annual are how they pay; annual is cheaper for the same Plan, not a bigger Allowance. It includes an Allowance. Connecting a Channel does not require a Plan. Without a Plan the seller still has the workspace — catalogue, Inventory, New listing, Import, confirmed facts, and push of listing copy they typed — but not listing-copy generate, listing copy refresh, Bulk SEO, or website.
_Avoid_: Pro, SnapSync AI Pro, subscription (as the product name), credits, unlock

**Allowance**:
The listing-copy jobs and website included in a Plan before overflow. One use is one product's listing-copy write (first generate or listing copy refresh) or one website. Bulk SEO spends one per product whose accepted listing copy lands. Twenty uses refill each calendar month on both monthly and annual Plans; unused uses expire at month end. A use spends only when the write lands or the first Publish lands. A later Publish does not spend. A Website agent run does not spend, and there is no cap on runs. A failed generate does not. Regenerating stale listing copy does not spend. Overflow is billed per extra use on the Plan, not a pack and not a hard stop. Confirming legal facts is not an Allowance use and not a paid compliance check. Talk in the conversation is not a use, and there is no separate cap on it.
_Avoid_: credits, weekly product limit, unlock, compliance check, top-up, yearly bank

**Overflow**:
A £0.70 charge on the Plan invoice for one Allowance use after the included 20 in the UTC calendar month. Not a pack, not a prepaid balance, not a purchase of a write. Leftover weekly has none.
_Avoid_: top-up, credit, extra pack, overage (as seller-facing language)
