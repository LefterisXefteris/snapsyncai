# SnapSync

Textile-first seller workspace. Live Channels are Shopify and Trendyol International; Wix and Vinted stay in the Channel language but are not connectable yet. Listing from photos is one job inside it, not the whole product. Packaged coffee is on the Shopify Channel only; broader food, accessories, and electronics stay out of scope until that kind is defined. This glossary is the domain language for that workspace.

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

**Destination**:
A place the seller opens in the signed-in workspace: Products, the product page, New listing, Import, Inventory, Bulk SEO, or Settings. Opening the workspace lands on Products, whether or not a Shopify Channel is connected. A destination the seller opens stays until they leave. Disconnecting, and a connect or Channel claim trip, are not leaving.
_Avoid_: surface, screen, Website, Conversation, Chat

**Chat**:
The card a seller opens along the bottom of the signed-in workspace. One thread per shop, the same thread across Destinations. A message is a request for an act that seller could already perform on that shop. A question is not an act. Not a Destination, and not where they buy Credits, connect or disconnect a Channel, claim a shop, cancel a Plan, or choose photos.
_Avoid_: Conversation, Agentic SEO, chat card, agent

**Landing**:
The public marketing page a stranger opens before sign-in. Distinct from a Destination.
_Avoid_: Homepage (as a Destination), Website

**Products**:
The destination where the workspace opens, which the seller sees named Products and this glossary calls the catalogue. Distinct from Product.
_Avoid_: catalog

**Publication**:
Where this product is available inside a connected Shopify shop — Online Store, Point of Sale, Shop, and other sales apps on that shop. Not a Channel.
_Avoid_: Channel, sales channel (as SnapSync language), available channels

**Push**:
Sending the product page as it stands to one Channel. A Shopify Push sends listing copy, price, photos, status, and publications; Go live and Sync are those Pushes. A Trendyol International Push waits until the Trendyol listing is complete, listing copy exists, and both barcode and SKU exist. It sends that listing, the title and description, the barcode, the SKU, and the photos. Tags, the SEO title, and the meta description stay with the Shopify Push. AEO stays on the product. It leaves the Shopify shop unchanged. A Coffee product may Push only to Shopify.
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
A channel-level option of a product, such as color or size, with its own selling when the Channel has more than one. On a Coffee product, bag size is a variant and carries that option’s net weight. Grouping photos in New listing does not create variants. Distinct from Inventory (stock on that option).
_Avoid_: Group, listing (as a color/size option), coffee form (form is a product fact, not a size option)

**New listing**:
The job of creating a product from photos. The seller picks Product kind before that kind’s visible attributes are suggested.
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
The seller's explicit choice to keep proposed listing copy for one product. It saves that copy and does not Push. When it lands it spends one Credit under that shop's Credit rules, and not when stale listing copy is regenerated. First generate, listing copy refresh, and Bulk SEO each end in an accept; the same accept runs from the product page, the Bulk SEO page, or Chat. From Chat it is a later message, after that proposal is already in the thread.
_Avoid_: approve, apply, save (as the seller act)

**Search demand**:
Queries people type for this kind of product, from a query source — not the model’s guesses — and this shop’s performance when it exists. Seeds may use title, tags, and kind facts that shape demand (fibre names on a Textile product; coffee form, roast level, and coffee origin on a Coffee product) — not ingredients list. Not fashion-season media and not other sellers’ listings.
_Avoid_: Trends (alone), competitor research, keyword research (as the job)

**Inventory**:
Stock on hand for products in the workspace. Distinct from listing copy and from Import.
_Avoid_: Stock, quantity (alone)

**Listing copy**:
The title, description, tags, SEO title, meta description, and AEO text written for a product. It must not be generated until product facts are confirmed. Words the seller quotes in Chat are typed listing copy. Confirmed kind facts that belong in the description are assembled as structured blocks (fibre, care, and GPSR on a Textile product; coffee form, roast level, net weight, coffee origin when not skipped, ingredients list, and allergen statement on a Coffee product) and must not be invented beyond those facts.
_Avoid_: AI content, content, listing (alone)

**Selling**:
Price, compare-at price, cost, SKU, and barcode on the product, or on a variant when the product has more than one. Distinct from Inventory and from listing copy.
_Avoid_: Commerce, merchandising, quantity, stock

**Product facts**:
Structured attributes of a product that listing copy is not allowed to invent. The seller must confirm them before listing copy is generated.
_Avoid_: Metadata, product context, product data, context, Trendyol listing

**Visible attribute**:
A product fact a photo can reasonably suggest. For a Textile product: likely fibre names (percentages left blank). For a Coffee product: coffee form and roast level when readable on the pack. Color is a variant, not a product fact.
_Avoid_: Inferred spec, guessed material, color (as a fact), Product kind (the seller picks kind; vision does not decide it), ingredients, allergens, net weight (those are legal facts)

**Legal fact**:
A product fact a photo cannot establish. For a Textile product: fibre percentages, care instructions, manufacturer, or EU responsible person. For a Coffee product: ingredients list, allergen statement, net weight, and coffee origin when not skipped. The seller enters it; vision must not invent it.
_Avoid_: Compliance field, EU data

**Confirmed facts**:
Product facts the seller has accepted for this Product kind’s pack. Listing copy does not generate until these exist. A product that was confirmed only as not-a-textile must pick Product kind and confirm that pack before a new generate, listing copy refresh, or Bulk SEO run.
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
A legal fact on a Textile product: manufacturer name, postal address, and email; and, when the manufacturer is not in the EU, the EU responsible person’s name, postal address, and email. Not part of the Coffee product pack.
_Avoid_: Compliance, EU person, responsible person (alone), food labelling

**Manufacturer**:
The maker named on GPSR identity (or the importer, if that is who the seller is identifying). Name, postal address, email.
_Avoid_: Brand, seller (as the maker), vendor

**EU responsible person**:
The EU-established contact on GPSR identity when the manufacturer is not in the EU. Name, postal address, email.
_Avoid_: Responsible person (alone), authorised representative (unless that is who they named)

**Product kind**:
Textile product or Coffee product — which facts pack applies before listing copy. The seller picks it on New listing. Distinct from Classification.
_Avoid_: category (when you mean kind), vertical, niche, isTextile, not-a-textile

**Textile product**:
A Product kind the fibre-composition pack applies to. Sibling of Coffee product.
_Avoid_: Apparel, clothing (as the only textile)

**Coffee product**:
A Product kind: packaged coffee (beans, ground, or capsules) on the Shopify Channel. The food-label facts pack applies; fibre composition, care instructions, and GPSR identity do not. Push is Shopify only for this kind. Sibling of Textile product.
_Avoid_: food (as the kind), grocery, beverage, not-a-textile

**Coffee form**:
A product fact on a Coffee product: beans, ground, or capsules. Vision may suggest it; the seller confirms. Required before listing copy.
_Avoid_: variant (when you mean form), grind size (as the form), product type

**Roast level**:
A product fact on a Coffee product (for example light, medium, dark). Vision may suggest it from pack text; the seller confirms. Required before listing copy.
_Avoid_: flavour notes, tasting notes, profile (as the fact)

**Net weight**:
A legal fact for Coffee product package quantity. On a single tracked variant it sits with the product facts; when the product has more than one variant, each variant has its own net weight and every variant must have one before listing copy. Not Inventory.
_Avoid_: Shipping weight, stock

**Coffee origin**:
A legal fact on a Coffee product: the origin country or region the seller enters, or an explicit skip. Vision must not invent it.
_Avoid_: Origin (alone), provenance, terroir

**Ingredients list**:
A legal fact on a Coffee product: the seller-entered ingredients. Required before listing copy. Vision must not invent it.
_Avoid_: Composition (when you mean food ingredients), recipe

**Allergen statement**:
A legal fact on a Coffee product: the seller-entered allergen text, including an explicit confirm of none. Required before listing copy. Empty is not a confirm; Explicit skip is not available for this field.
_Avoid_: Allergy info, may contain (as a skip)

**Classification**:
Category and product type inferred from a photo. Not listing copy, not Product kind. May run before facts are confirmed.
_Avoid_: Analysis, preview, unlock, Product kind

**Explicit skip**:
The seller states they do not have care instructions or GPSR identity on a Textile product, or coffee origin on a Coffee product. Those blocks are omitted from listing copy and must not be invented. Ingredients list, allergen statement, and net weight cannot be skipped.
_Avoid_: Optional field, empty field (an empty field is not a skip)

**Stale listing copy**:
Listing copy that no longer matches the confirmed facts, or — on a Textile product — the Shop GPSR identity those facts use, because those were changed after generation. It is not a second generate or publish gate.
_Avoid_: Out of date, dirty

**Shop GPSR identity**:
The default GPSR identity for a connected Shopify shop, used by Textile products. A product may override it. Changing it stales listing copy on Textile products that use the shop default. Not used by Coffee product.
_Avoid_: Account compliance, store settings (as the fact itself)

**Credit**:
A prepaid unit on one seller and one Shopify shop. One Credit is spent when an Accept lands for first generate, listing copy refresh, a per-field regenerate after an Accept, or one Bulk SEO product. Three free for the life of that shop, then the seller buys a fixed pack of 10 (£7), 50 (£30), or 100 (£55); larger packs cost less per Credit than £0.70. An empty balance refuses the Accept — there is no £0.70 per-Accept charge. Propose, Start, failed generate, and stale regenerate do not spend. Buying a pack is consent; Accept does not ask again. With no Shopify shop yet, the three free and unused Credits sit on the seller's workspace until a shop is connected, then stay with that shop and do not reset. Confirming facts, Classification, typed listing copy, and Push are not Credits.
_Avoid_: listing-copy write (as the meter), Allowance, Overflow, use (alone), AI generation (as the meter), top-up, pay-per-write

**Plan**:
The old £19/month or £190/year checkout for one seller and one Shopify shop, kept only until that paid period ends. While it runs, Accepts do not spend Credits. It does not renew; after it ends the shop follows Credit rules. New checkouts are not a Plan. Distinct from Leftover weekly.
_Avoid_: Pro, SnapSync AI Pro, subscription (as the product name), unlock, Allowance, Overflow, unlimited

**Leftover weekly**:
The old £4/week checkout, kept only until that paid week ends. Thirty Accepts each UTC week that do not spend Credits, then those jobs stop. It does not renew; after it ends the shop follows Credit rules. New checkouts are not Leftover weekly.
_Avoid_: weekly Plan, Allowance, Overflow
