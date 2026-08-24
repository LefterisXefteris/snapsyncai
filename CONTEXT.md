# SnapSync

Textile-first seller workspace for Shopify, Wix, and Vinted. Listing from photos is one job inside it, not the whole product. This glossary is the domain language for that workspace.

## Language

**Channel**:
Shopify, Wix, or Vinted — a place the seller lists or fetches products.
_Avoid_: Platform, integration, marketplace (as the general term), store (when you mean the channel type)

**Product**:
The sellable thing the seller is listing. One product may have several photos. Listing copy and product facts belong to the product, not to a single photo.
_Avoid_: Image (as the sellable thing), listing (as the thing being sold), snap

**Photo**:
A picture of a product. Several photos may belong to one product.
_Avoid_: Image (when you mean the sellable thing), snap

**New listing**:
The job of creating a product from photos.
_Avoid_: Upload, upload product, add product

**Import**:
The job of fetching products from a channel.
_Avoid_: Sync, fetch, pull, scrape

**Bulk SEO**:
The job of changing listing copy for many products at once. Not the SEO fields on a single product.
_Avoid_: SEO (alone)

**Inventory**:
Stock on hand for products in the workspace. Distinct from listing copy and from Import.
_Avoid_: Stock, quantity (alone)

**Listing copy**:
The title, description, tags, SEO, and AEO text written for a product. It must not be generated until product facts are confirmed.
_Avoid_: AI content, content, listing (alone)

**Product facts**:
Structured attributes of a product that listing copy is not allowed to invent. The seller must confirm them before listing copy is generated.
_Avoid_: Metadata, product context, product data, context

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
_Avoid_: Brand, seller (as the maker)

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
