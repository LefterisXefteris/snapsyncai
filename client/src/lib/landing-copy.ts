export const LANDING_BRAND = "SnapSync";

export const LANDING_DOCUMENT_TITLE =
  "SnapSync — your e-commerce agent for textile and coffee listings";

export const LANDING_META_DESCRIPTION =
  "SnapSync is your e-commerce agent for textile and coffee listings. Pick Product kind, confirm the facts pack, then listing copy. Import, inventory, and Bulk SEO. Textile products push to Shopify or Trendyol International; coffee to Shopify only. Three free AI listing-copy writes, then £0.70 each.";

export const LANDING_EYEBROW = "Textile-first · Coffee on Shopify";

export const LANDING_H1 = "Your e-commerce agent for textile and coffee listings";

export const LANDING_SUBHEAD =
  "It groups photos into products, waits until you confirm the facts for that Product kind, then writes listing copy and pushes to Shopify or Trendyol International — coffee to Shopify only.";

export const LANDING_PRODUCT_KIND =
  "Pick Textile product or Coffee product. Each kind has its own facts pack before listing copy.";

export const LANDING_MICRO = "No card required · catalogue, facts, and typed listing copy free";

export const LANDING_PRIMARY_CTA = "Start free";
export const LANDING_SECONDARY_CTA = "How it works";

export const LANDING_FINE_PRINT =
  "Three free AI listing-copy writes · then £0.70 each · catalogue free";

export const JOBS = [
  {
    title: "New listing",
    description:
      "Drag in up to 200 photos and group them into products. New listing is the photo job, not the whole agent.",
  },
  {
    title: "Product facts, then listing copy",
    description:
      "Pick Product kind. Textile products confirm fibre composition, care instructions, and GPSR identity. Coffee products confirm the food-label pack — form, roast, net weight, ingredients, and allergens. Listing copy is not written until those facts are confirmed.",
  },
  {
    title: "Products",
    description:
      "The catalogue you live in. Review and edit every field, then push to Shopify or Trendyol International when the listing is ready. Coffee products push to Shopify only.",
  },
  {
    title: "Import",
    description:
      "Bring in Shopify products that are not already in the catalogue. You start it. It does not pull stock and it does not push.",
  },
  {
    title: "Inventory",
    description:
      "Load Shopify stock, hold a safety buffer, and keep tracked variants from overselling. A parallel job, not a listing step.",
  },
  {
    title: "Bulk SEO",
    description:
      "Refresh tags, description, SEO title, and meta description for the products you pick, using search demand. You accept each one. Accept does not push to a Channel.",
  },
  {
    title: "Settings",
    description:
      "Connect Shopify and Trendyol International, save the shop GPSR identity for textiles, and see your AI listing-copy writes. Catalogue, facts, and listing copy you type stay free.",
  },
] as const;

export const STEPS = [
  {
    number: "01",
    title: "Photos",
    description: "Drop product photos into New listing and group them.",
  },
  {
    number: "02",
    title: "Confirm facts",
    description:
      "Pick Textile product or Coffee product, then confirm that kind’s facts pack — or skip only what that pack allows.",
  },
  {
    number: "03",
    title: "Listing copy",
    description: "Title, description, tags, SEO, and AEO — written from confirmed facts, not invented from the photo.",
  },
  {
    number: "04",
    title: "Push to a Channel",
    description:
      "Edit anything, then push to Shopify or Trendyol International. Coffee products push to Shopify only.",
  },
] as const;

export const WEEKLY_BULLETS = [
  "Three free AI listing-copy writes, then £0.70 each",
  "New listing from photos (up to 200)",
  "Product kind facts, then listing copy",
  "SEO and AEO in the listing copy",
  "Push to Shopify or Trendyol International",
  "Import, inventory, and Bulk SEO free",
] as const;

export const ANNUAL_BULLETS = [
  "Three free AI listing-copy writes, then £0.70 each",
  "New listing from photos (up to 200)",
  "Product kind facts, then listing copy",
  "SEO and AEO in the listing copy",
  "Push to Shopify or Trendyol International",
  "Import, inventory, and Bulk SEO free",
] as const;

export const FAQ_DATA = [
  {
    question: "What is SnapSync?",
    answer:
      "SnapSync is your e-commerce agent for textile and coffee listings. New listing from photos is one job. You also get a product catalogue, Import from Shopify, confirmed product facts before listing copy, inventory, and Bulk SEO.",
  },
  {
    question: "Why do I confirm facts before listing copy?",
    answer:
      "Listing copy must not invent product facts a photo cannot establish. You pick Product kind, confirm that kind’s pack, and only then is listing copy written.",
  },
  {
    question: "What is Product kind?",
    answer:
      "Textile product or Coffee product — which facts pack applies. Textile uses fibre composition, care instructions, and GPSR identity. Coffee uses the food-label pack and may Push only to Shopify.",
  },
  {
    question: "What do AI listing-copy writes cost?",
    answer:
      "Three free AI listing-copy writes for life on your shop, then £0.70 each when the write lands. Catalogue, facts, and typed listing copy stay free. No card is required to start.",
  },
  {
    question: "How do I create a product from photos?",
    answer:
      "Open New listing and drag in up to 200 photos. Group them into products. Pick Product kind, confirm facts, generate listing copy, then push to Shopify or Trendyol International. Coffee products push to Shopify only. No card is required to start.",
  },
  {
    question: "Which shops does SnapSync publish to?",
    answer:
      "Shopify and Trendyol International. Connect each Channel in Settings, then push from the catalogue. Coffee products Push to Shopify only.",
  },
  {
    question: "How much does SnapSync cost?",
    answer:
      "Catalogue, facts, and typed listing copy are free. Three free AI listing-copy writes, then £0.70 each. Push and Shopify inventory stay available. No card to start.",
  },
  {
    question: "Can I edit listing copy before I push?",
    answer:
      "Yes. Every field on the product is editable — title, description, price, facts, SEO, AEO, variants, and media — before you push.",
  },
] as const;

export const DEMO = {
  title: "Merino Crew Neck — Charcoal",
  description: "Fine merino knit with a dry hand and a clean crew.",
  fibre: "Wool 100%",
  care: "Wool wash 30°C",
  gpsr: "Shop GPSR identity",
} as const;

export const FOOTER_BLURB =
  "Your e-commerce agent for textile and coffee listings. New listing from photos is one job.";

export function landingVisibleText(): string {
  return [
    LANDING_BRAND,
    LANDING_DOCUMENT_TITLE,
    LANDING_META_DESCRIPTION,
    LANDING_EYEBROW,
    LANDING_H1,
    LANDING_SUBHEAD,
    LANDING_PRODUCT_KIND,
    LANDING_MICRO,
    LANDING_PRIMARY_CTA,
    LANDING_SECONDARY_CTA,
    LANDING_FINE_PRINT,
    FOOTER_BLURB,
    DEMO.title,
    DEMO.description,
    DEMO.fibre,
    DEMO.care,
    DEMO.gpsr,
    ...JOBS.flatMap((job) => [job.title, job.description]),
    ...STEPS.flatMap((step) => [step.title, step.description]),
    ...WEEKLY_BULLETS,
    ...ANNUAL_BULLETS,
    ...FAQ_DATA.flatMap((faq) => [faq.question, faq.answer]),
  ].join("\n");
}
