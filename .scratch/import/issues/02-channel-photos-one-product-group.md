# 02: Channel photos land as one product group

**What to build:** An imported Shopify product’s media become Photos on that one catalogue product (one group, one Products row). Several media stay one product, not one row per file. A product with no media still imports. A dead media URL drops that photo and still keeps the SKU when listing copy can land. Vision does not run; suggested facts are not guessed from photos.

**Blocked by:** 01 — Start Import; missing Shopify products land with grandfathered listing copy

**Status:** done

- [x] Channel media URLs persist as Photos on one product group; primary holds listing copy and the Channel product id
- [x] Several media of one Shopify product appear as one Products row, not duplicate SKUs
- [x] No media still creates the product (honest placeholder if the catalogue row needs file metadata)
- [x] One dead media URL fails that photo, not the whole product, when listing copy can land
- [x] Import does not run vision or write suggested product facts from photos
