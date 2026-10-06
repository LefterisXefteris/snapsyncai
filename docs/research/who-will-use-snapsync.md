# Who will use SnapSync

**Researched:** 2026-10-06  
**Aligned:** 2026-10-06, same day, to ADR 0039 and the seller bet below. The legal quotations were not re-fetched.  
**Question:** Who would pay for SnapSync, and where are those sellers?  
**Confidence:** HIGH on the product map, the articles quoted below, Trendyol’s storefront table, Vinted’s own Pro page, and the Eurostat cells. MEDIUM on willingness to pay: no official survey asks who would buy this workspace, and the five-brand test in section 5 has not been run. The number of Shopify textile sellers is unknown.  
**Sources:** `CONTEXT.md` (Seller, Plan), `client/src/lib/landing-copy.ts`, `client/src/pages/Settings.tsx`, `docs/adr/0039-the-plan-has-no-use-count.md`. ADR 0020 is superseded by ADR 0039. Official Journal texts of Regulation (EU) No 1007/2011 and Regulation (EU) 2023/988 (Publications Office English XHTML; CELEX on EUR-Lex). GOV.UK textile labelling. Trendyol International Marketplace docs. Shopify App Store category list, Shopify Community guidelines, Shopify Partners. Vinted Pro. UKFT. Enterprise Europe Network. Eurostat dataset `sbs_ovw_act`.

## Bottom line

The first seller is an independent clothing or home-textile brand, one Shopify shop, in the EU or the UK, with fibre percentages already on a label, a tech pack, or a mill sheet. The Plan is £19/month or £190/year for that one shop. Listing-copy generate, listing copy refresh, Bulk SEO, and the website are included, with no use count. A textile write still waits until the seller types percentages that sum to 100.

Willingness to pay is unmeasured. The test is five of those brands. One yes holds the bet. Zero drops it. The Shopify App Store listing under **Product content** is how the Plan situation grows after a yes. It waits if the five say no.

Eurostat’s specialised-store counts are a different population from Shopify shops, and from sellers who would pay.

## 1. Product map

SnapSync is a textile-first seller workspace. Listing from photos is one job inside it. The glossary names four Channels: Shopify, Wix, Vinted, and Trendyol International (`CONTEXT.md`).

**Who it is for.** A seller with a Shopify shop, or willing to claim one. The Plan is paid access for one seller and one Shopify shop (`CONTEXT.md`, Plan). The landing eyebrow is “Textile listings · Shopify” (`client/src/lib/landing-copy.ts`).

**The job the landing promises.** H1: “Your e-commerce agent for textile listings.” Subhead: it groups photos into products, waits until the seller confirms the facts, then writes listing copy and pushes to Shopify. Jobs on the page: New listing (up to 200 photos), product facts then listing copy, catalogue, Import from Shopify, Inventory, Bulk SEO from search demand, a website whose checkout stays on Shopify, and Settings. The public answer to “Which shops does SnapSync publish to?” is “Shopify.”

**The wedge.** Listing copy must not invent legal facts (`CONTEXT.md`, Product facts, Legal fact). For a textile, fibre composition is EU fibre names and percentages that sum to 100. Vision may suggest textile-or-not and fibre names. The seller types the percentages. Care instructions are English text for wash, bleach, dry, iron, and professional care, or an explicit skip. GPSR identity is manufacturer name, postal address, and email; if the manufacturer is outside the EU, an EU responsible person’s name, postal address, and email. An explicit skip omits care or GPSR from the copy and must not invent them. Non-textiles still confirm facts. The fibre pack is only for textiles.

**What is live.** Shopify connect, Push, Go live, Import, Inventory, listing copy, Bulk SEO, the website, and the conversation. Settings connects Trendyol International as one origin storefront (`client/src/pages/Settings.tsx`). The glossary defines that Channel as Trendyol’s stores in CEE, the Gulf, and DACH: one barcode, one storefront (the seller’s origin country), category, brand, required attributes, sale price and list price in the storefront currency. The Turkey marketplace and cross-country listing are outside this Channel. Cargo, addresses, and dimensional weight stay with Trendyol (`CONTEXT.md`).

**Named, and not a live Channel.** Settings says “Wix is not connected yet” and “Vinted is not connected yet” (`client/src/pages/Settings.tsx`).

**Price.** Plan £19/month or £190/year for one seller and one Shopify shop. Listing-copy generate, listing copy refresh, Bulk SEO, and the website are included, with no use count and no extra charge (`CONTEXT.md`, Plan; `docs/adr/0039-the-plan-has-no-use-count.md`; `client/src/lib/landing-copy.ts`). Annual is the same Plan for a cheaper fee. No card is required to start. Confirming facts is free and is not a compliance check. Without a Plan the seller still has the catalogue, Inventory, New listing, Import, confirmed facts, and Push of listing copy they typed. Generate, refresh, Bulk SEO, and the website need a Plan. Leftover weekly stays £4/week with a 30-use hard stop until that seller cancels or switches. New checkouts are the Plan.

ADR 0039 is the current Plan. It supersedes the Allowance meter in ADR 0014, and it supersedes ADR 0020 and ADR 0021. ADR 0016, ADR 0029, ADR 0035, and ADR 0037 still say an accept or a first Publish spends an Allowance use. Those sentences conflict with ADR 0039. This note follows the Plan entry and ADR 0039.

**Two situations.** The Plan situation and the workspace situation are defined on Seller (`CONTEXT.md`). The Plan situation is the result that answers whether the product will have sellers. A Plan with no accept and no Publish is neither, and so is an empty workspace.

**Bad fit.** A seller who will not type fibre percentages. An enterprise PIM across many shops. A peer-to-peer closet clear-out. Anyone whose only channel is Wix or Vinted.

## 2. Who is willing to pay

Fit below is a judgment from the product and the legal duties in section 3. It is not a measured conversion rate.

### Independent EU or UK fashion and home-textile brands on Shopify

**Fit: strong.**

They write their own product pages, the catalogue is dozens of products rather than thousands, and they know the cloth. The pain SnapSync removes is grouping photos, holding listing copy until fibre composition is confirmed, then writing that listing copy and, if they want it, listing copy refresh from search demand. Home textiles are in scope: the glossary treats a textile product as wider than apparel (`CONTEXT.md`, Textile product).

**Why £19.** The Plan is one shop, and the writes are included. Facts, the catalogue, and typed copy cost £0, so they can put the legal lines in before they pay for generation. Generate does not run without a Plan, so the five in section 5 read listing copy on a workspace that already has a Plan, and the £19 question comes after they have read it. A UK-only shop still has the fibre-content duty in section 3. The EU responsible-person duty is about products placed on the Union market, so it bites when the offer is aimed at consumers in the Union.

**Why they would not.** They already have copy they trust and only want a PIM, a theme, or orders. They do not have the percentages. They sell only where SnapSync cannot push. A busier catalogue is not priced out of the Plan. It is not the first five.

### Sellers who manufacture outside the EU

**Fit: possible.**

GPSR requires an economic operator established in the Union when a product covered by that regulation is placed on the Union market, and the online offer has to show that person’s name, postal address, and electronic address (section 3). SnapSync stores the name, postal address, and email the seller enters, on the shop or on one product.

**Why £19.** The same small-catalogue Shopify brand, with the extra pain of repeating a manufacturer and an EU contact across product pages without the model inventing them. Recording that identity is free. They pay when they also want the listing copy written.

**Why they would not.** They need someone to *be* the EU responsible person. SnapSync does not appoint that person, check that they are established in the Union, or certify the product. A seller with no EU contact can explicitly skip GPSR identity; the block is then omitted. That skip does not satisfy the regulation.

### Sellers already on Shopify and Trendyol International

**Fit: possible.**

The live second Channel is one origin storefront, one barcode, sale and list price in that storefront’s currency. Trendyol’s own storefront table (section 4) lists Germany, a Gulf set, and a CEE set. It does not use the word DACH, and it does not list Austria or Switzerland. The glossary’s “DACH” is wider than that table.

**Why £19.** They already confirm fibre and identity once, and they want that record pushed to Shopify and to the one Trendyol storefront they are connected to.

**Why they would not.** They need the Turkey marketplace, or cross-country listing, or cargo and dimensional weight inside SnapSync. Those stay outside this Channel (`CONTEXT.md`). The landing page they would read promises Shopify only. This segment will not discover the second Channel from the homepage.

### High-volume marketplace listers, print-on-demand, and dropshippers who do not know the fibre

**Fit: weak.**

Shopify’s App Store taxonomy already separates this job from listing copy. Under Finding products it defines **Dropshipping** as apps that manage third-party inventory and fulfilment, and **Print on demand (POD)** as apps that manage third-party custom product design, printing, and shipping ([App listing categories](https://shopify.dev/docs/apps/launch/app-store-review/app-listing-categories)). SnapSync does not source the product. For a textile it will not generate listing copy until the seller enters percentages that sum to 100. Vision must not invent them.

**Why £19 would not hold.** They cannot confirm the fact the product is built around. Writes on a Plan are included, so volume is not the price that excludes them. A lister who cannot type the percentages never reaches an accept on a textile.

### Enterprise fashion brands with a PIM

**Fit: weak.**

The Plan is one seller and one Shopify shop (`CONTEXT.md`). An enterprise PIM already holds fibre, care, and supplier identity across many channels and many sellers.

### Vinted casual resellers

**Fit: weak.**

Vinted’s own Pro page separates the two kinds of seller. A standard account is for clearing out a closet. “If you want to sell a high volume of items on Vinted (more than just clearing out your closet!), you need to sign up as a professional seller.” Vinted Pro is for registered businesses (sole traders, non-profits, and companies), it is free, and it is for listing second-hand items, including clothing and home textiles ([Vinted Pro](https://www.vinted.co.uk/pro)). SnapSync’s job is new textile products on Shopify, with fibre percentages the seller knows. Vinted is not connected. A closet clear-out and a free second-hand Pro account are both outside the wedge.

## 3. Why a textile seller cannot skip the facts

SnapSync records facts the seller confirms. Confirming them is free, and it is not a compliance check (`CONTEXT.md`, Plan). The product is not a compliance certificate. A seller can explicitly skip care instructions and GPSR identity, and listing copy is then written without those blocks. Fibre composition is the block the product requires before a textile’s listing copy is generated.

The legal duties below are why skipping the facts is the seller’s problem. They are not a claim that a SnapSync Push makes the offer meet those duties.

### Fibre composition in the EU

Regulation (EU) No 1007/2011 of 27 September 2011, on textile fibre names and related labelling and marking of the fibre composition of textile products. Published in the Official Journal, L 272, 18 October 2011. The quotations here are from that published text (CELEX 32011R1007), read as the Publications Office English XHTML, not from a later consolidated edition.

- EUR-Lex: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32011R1007
- Text quoted: https://publications.europa.eu/resource/celex/32011R1007.ENG.xhtml

Article 4: textile products shall only be made available on the market when labelled, marked, or accompanied by commercial documents in compliance with the Regulation.

Article 5: only the textile fibre names listed in Annex I shall be used on labels and markings.

Article 9(1): a textile product shall be labelled or marked with the name and percentage by weight of all constituent fibres in descending order. Later paragraphs allow limited “other fibres” derogations. Article 20 allows a manufacturing tolerance of 3 percent between the stated composition and the analysis, and it allows small shares of extraneous fibres to go unstated when they are technically unavoidable. The Regulation’s rule is the full composition, with those tolerances. SnapSync’s own rule is stricter and simpler: the seller’s percentages must sum to 100.

Article 14: textile products shall be labelled or marked with their fibre composition whenever they are made available on the market.

Article 15: when placing a textile product on the market, the manufacturer shall supply the label or marking and the accuracy of the information. If the manufacturer is not established in the Union, the importer shall. A distributor who places a product on the market under their own name or trademark, or who attaches or changes the label, is treated as the manufacturer.

Article 16(1): the fibre composition shall be indicated in catalogues and trade literature, on packaging, labels, and markings, and shall be clearly visible to the consumer before the purchase, including when the purchase is made by electronic means.

Article 16(3): the labelling or marking shall be in the official language or languages of the Member State where the products are made available to the consumer, unless that Member State provides otherwise. English listing copy in SnapSync does not, by itself, meet that language rule.

Care symbols are not a requirement of this Regulation. SnapSync asks for care as English text, or an explicit skip, so the model does not invent a wash instruction. That is a product rule.

### GPSR: who made it, and who in the EU answers for it

Regulation (EU) 2023/988 of 10 May 2023 on general product safety. Official Journal L 135, 23 May 2023. CELEX 32023R0988.

- EUR-Lex: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32023R0988
- Text quoted: https://publications.europa.eu/resource/celex/32023R0988.ENG.xhtml

Article 52: it enters into force on the twentieth day after publication in the Official Journal, and it applies from 13 December 2024.

Article 1: it lays down essential rules on the safety of consumer products placed or made available on the market. Article 2(2) excludes medicines, food, feed, and a short list of other products. Textiles are not in that exclusion list. Article 2(1) also says the Regulation applies only where Union law does not already regulate the safety of the product with the same objective, and that for products subject to Union harmonisation legislation some chapters, including Chapter III Section 1, do not apply. This note did not check Annex I of Regulation (EU) 2019/1020, which is how that phrase is defined. Ordinary clothing is the case the articles below are written for. A textile that is also a toy, protective equipment, or another harmonised product needs that product’s own law checked before anyone treats GPSR as the whole duty.

Article 4: a product offered online or by other distance sales is made available on the market if the offer is targeted at consumers in the Union. An offer is targeted if the economic operator directs its activities to one or more Member States.

Article 9(6): manufacturers shall indicate their name, registered trade name or trade mark, and their postal and electronic address, on the product or, where that is not possible, on its packaging or in a document accompanying the product.

Article 16(1): a product covered by the Regulation shall not be placed on the market unless there is an economic operator established in the Union who is responsible for the tasks in Article 4(3) of Regulation (EU) 2019/1020. Article 16(3): that operator’s name, trade name or trade mark, and contact details, including postal and electronic address, shall be indicated on the product, its packaging, the parcel, or an accompanying document.

Article 19: where economic operators make products available online or by other distance sales, the offer shall clearly and visibly indicate at least the manufacturer’s name, postal and electronic address, and, where the manufacturer is not established in the Union, the name, postal and electronic address of the responsible person within the meaning of Article 16(1) or of Article 4(1) of Regulation (EU) 2019/1020, plus information identifying the product and any warning or safety information.

SnapSync’s GPSR fields match the shape of those lines: manufacturer name, postal address, email, and an EU contact when the manufacturer is outside the EU. The seller types them. The workspace does not check that the person is established in the Union.

Article 9(7) requires instructions and safety information in a language consumers in that Member State can understand, where the product cannot be used safely without them. That is not the same duty as a wash label.

### United Kingdom fibre content

GOV.UK, “Textile labelling”, Department for Business, Innovation, Science and Trade, still tells manufacturers and retailers: “You must follow special rules if you manufacture, distribute or sell textiles.” “The label must show the fibre content, including fur and other animal parts.” If a product has two or more components with different fibre contents, each must be shown. “Manufacturers and retailers are responsible for complying with the labelling requirements.”

https://www.gov.uk/guidance/textile-labelling

That page does not state a UK equivalent of the EU responsible person. This note did not verify one. A UK shop that only sells to UK customers still has the fibre-content duty. The EU GPSR duties above apply when the product is placed or offered on the Union market.

## 4. Where to find them

Channels below match a Shopify-first textile seller in the EU or UK, with Trendyol International as an optional second Channel. Wix and Vinted are not live, so their app markets and closet communities are the wrong door.

No official count of Shopify textile sellers was found. Eurostat does count specialised stores, which is a different population. In dataset `sbs_ovw_act` (“Enterprises by detailed NACE Rev. 2 activity and special aggregates”), indicator `ENT_NR` (Enterprises - number), year 2023, geo `EU27_2020`, updated 30 September 2026:

| NACE | Label in the dataset | Enterprises |
| --- | --- | --- |
| G4771 | Retail sale of clothing in specialised stores | 251,310 |
| G4751 | Retail sale of textiles in specialised stores | 50,000 |

The same query returns Germany, G4771, as 18,118. A UK geo code was requested and was not in the response. These are enterprises whose activity is specialised-store retail. They include shops that are not on Shopify and exclude online sellers coded under another activity. They are not the buyer count.

- Dataset: https://ec.europa.eu/eurostat/databrowser/view/sbs_ovw_act/default/table
- Cells quoted: https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/sbs_ovw_act?format=JSON&lang=en&freq=A&nace_r2=G4771&nace_r2=G4751&indic_sbs=ENT_NR&geo=EU27_2020&geo=DE&time=2023
- DOI: https://doi.org/10.2908/SBS_OVW_ACT

### Shopify App Store — the count after a yes

Shopify’s category page says app categories, subcategories, and tags “allow merchants to find apps that meet their specific needs.” A primary tag is required and should be the app’s main function. The tag that matches the landing promise is **Product content**: “Apps for creating product descriptions or product listings,” under Content. **SEO** (“Apps that help boost and manage search engine optimization”) matches Bulk SEO as a secondary tag. **Inventory sync** matches Inventory only as a side job. Dropshipping and print-on-demand are different tags, for a different seller.

https://shopify.dev/docs/apps/launch/app-store-review/app-listing-categories

The App Store requirements are the checklist for getting that listing in front of merchants. They are already noted in `docs/research/shopify-app-store-requirements.md`. The listing is how the Plan situation grows after one of the five in section 5 says they would pay. It waits if none of them do. The repo does not record a live listing.

### Shopify Community — read it, do not pitch it

Shopify calls this the Shopify Merchant Community: “a safe, supportive, and informative space for Shopify merchants, Partners, and ecommerce enthusiasts.” Merchants ask there about product copy. The guidelines allow app recommendations only on the [Ask and Offer](https://community.shopify.com/c/community-corner/ask-offer/294) board. Recommending an app on any other board is prohibited, even when someone asks for one.

- Community: https://community.shopify.com/
- Guidelines: https://community.shopify.com/guidelines

Useful searches on that community, as questions merchants actually type, not as evidence of volume: “product description”, “material composition”, “product labeling”.

### Shopify Partners — the builder door, not the buyer door

https://www.shopify.com/partners is addressed to people who build apps, storefronts, and services. It is how an app reaches the App Store. It is not where the textile brand shops for listing copy. The headcount on that marketing page is not a count of textile sellers and is not used here.

### Trendyol International — only the storefronts Trendyol lists

Trendyol’s International Marketplace doc “4. Regions and Store Front Codes” says the caller must send `storeFrontCode` as a header, and prints this table (page updated in the doc set on 2026-10-05):

| Region on that page | Country | storeFrontCode |
| --- | --- | --- |
| Europe | Germany | DE |
| GULF | Saudi Arabia | SA |
| GULF | United Arab Emirates | AE |
| GULF | Kuwait | KW |
| CEE | Greece | GR |
| CEE | Slovakia | SK |
| CEE | Romania | RO |
| CEE | Czechia | CZ |
| CEE | Bulgaria | BG |

https://developers.trendyol.com/v3.0/docs/5-regions-and-store-front-codes

CEE and Gulf are on that page. Germany is on that page under “Europe”. The word DACH is not on that page. Austria and Switzerland are not in the table. There is no public directory of those sellers on this page; it is integrator documentation, and it refers to a seller panel for cross-country transfers. SnapSync’s Channel is one origin storefront, not that cross-country transfer (`CONTEXT.md`). The people to look for are Shopify brands who already sell on one of the nine storefronts above. Turkey is a different Trendyol doc set (the Türkiye Marketplace versions on the same developer site) and is outside the Channel.

### UKFT — UK fashion and textile businesses

UK Fashion and Textile Association. Membership “connects your business to the largest, most inclusive network in the UK fashion and textile industry” and offers “practical help on compliance, trade, skills, sustainability and operations.” They “welcome organisations from across the fashion and textile industry ecosystem, from brands and retailers, manufacturers and suppliers through to educators and specialist service providers.” A business category is “for fashion and textile businesses at all stages,” with rates based on turnover.

- https://ukft.org/
- https://ukft.org/membership

That is a real room of UK brands and retailers, which is the strong segment, limited to the UK. It is the UK door for the five in section 5. It is not a list of Shopify shops.

### Enterprise Europe Network — later, and broader than textiles

The European Commission network describes itself as “the world’s largest support network for small and medium-sized enterprises (SMEs) with international ambitions.”

https://een.ec.europa.eu/

The audience is SMEs, not Shopify fashion brands. Useful once the first Shopify and UKFT meetings exist. It is not the first door.

## 5. The five-brand test

Willingness to pay is this test. It has not been run.

Five brands, in the UK or the EU. One Shopify shop. Clothing or home textile. Fibre percentages already on a label, a tech pack, or a mill sheet. UKFT is the UK door. The others are approached directly. Enterprise Europe Network is the wrong room for this filter.

Each brand types those percentages on a workspace that already has a Plan, from photos or a product of their own, and reads the listing copy. The £19 question comes after that. The session leaves them outside the Plan situation. Their shop enters it when they later accept listing copy or Publish on their own Plan.

One yes holds the bet: they would pay £19 to do that on their own shop, to accept listing copy, run Bulk SEO, or Publish. The Shopify App Store listing under **Product content** is the count after that yes.

Zero yeses drops the bet. This brand stays the first seller. The fibre step stays. The product stays. The listing waits. The five are not widened to brands that still have to find the percentages, or to shops that are not textiles.

Later, and not these five: a brand whose maker is outside the EU and whose EU responsible person is already appointed; a Shopify catalogue that wants Bulk SEO on products whose percentages are already confirmed; a brand that already sells on one Trendyol International storefront from the table in section 4. The landing they would read promises Shopify.
