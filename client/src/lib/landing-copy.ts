export const LANDING_BRAND = "SnapSync";

export const LANDING_DOCUMENT_TITLE =
  "SnapSync — your e-commerce agent for textile listings";

export const LANDING_META_DESCRIPTION =
  "SnapSync is your e-commerce agent for textile listings. New listing from photos, confirm fibre composition, care instructions, and GPSR identity, then listing copy. Import, inventory, and Bulk SEO. Push to Shopify. Three free AI listing-copy writes, then £0.70 each.";

export const LANDING_EYEBROW = "Textile listings · Shopify";

export const LANDING_H1 = "Your e-commerce agent for textile listings";

export const LANDING_SUBHEAD =
  "It groups photos into products, waits until you confirm the facts, then writes listing copy and pushes to Shopify.";

export const LANDING_NON_TEXTILE =
  "Not a textile? You still confirm facts. The fibre pack is only for textile products.";

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
      "A photo may suggest fibre names. You confirm fibre composition, care instructions, and GPSR identity. Listing copy — including SEO and AEO — is not written until those facts are confirmed.",
  },
  {
    title: "Products",
    description:
      "The catalogue you live in. Review and edit every field, then push to Shopify when the listing is ready.",
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
      "Refresh tags, description, SEO title, and meta description for the products you pick, using search demand. You accept each one. Accept does not push to Shopify.",
  },
  {
    title: "Settings",
    description:
      "Connect your Shopify shop, save the shop GPSR identity, and see your AI listing-copy writes. Catalogue, facts, and listing copy you type stay free.",
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
    description: "Accept fibre composition, care instructions, and GPSR identity — or skip what you do not have.",
  },
  {
    number: "03",
    title: "Listing copy",
    description: "Title, description, tags, SEO, and AEO — written from confirmed facts, not invented from the photo.",
  },
  {
    number: "04",
    title: "Push to Shopify",
    description: "Edit anything, then publish the product to your connected Shopify shop.",
  },
] as const;

export const WEEKLY_BULLETS = [
  "Three free AI listing-copy writes, then £0.70 each",
  "New listing from photos (up to 200)",
  "Product facts, then listing copy",
  "SEO and AEO in the listing copy",
  "Push to Shopify",
  "Import, inventory, and Bulk SEO free",
] as const;

export const ANNUAL_BULLETS = [
  "Three free AI listing-copy writes, then £0.70 each",
  "New listing from photos (up to 200)",
  "Product facts, then listing copy",
  "SEO and AEO in the listing copy",
  "Push to Shopify",
  "Import, inventory, and Bulk SEO free",
] as const;

export const FAQ_DATA = [
  {
    question: "What is SnapSync?",
    answer:
      "SnapSync is your e-commerce agent for textile listings. New listing from photos is one job. You also get a product catalogue, Import from Shopify, confirmed product facts before listing copy, inventory, and Bulk SEO.",
  },
  {
    question: "Why do I confirm facts before listing copy?",
    answer:
      "Listing copy must not invent product facts a photo cannot establish. You confirm fibre composition, care instructions, and GPSR identity — or skip the blocks you do not have. Only then is listing copy written.",
  },
  {
    question: "What do AI listing-copy writes cost?",
    answer:
      "Three free AI listing-copy writes for life on your shop, then £0.70 each when the write lands. Catalogue, facts, and typed listing copy stay free. No card is required to start.",
  },
  {
    question: "How do I create a product from photos?",
    answer:
      "Open New listing and drag in up to 200 photos. Group them into products. Confirm facts, generate listing copy, then push to Shopify. No card is required to start.",
  },
  {
    question: "Which shops does SnapSync publish to?",
    answer:
      "Shopify. Connect your shop in Settings, then push products from the catalogue.",
  },
  {
    question: "How much does SnapSync cost?",
    answer:
      "Catalogue, facts, and typed listing copy are free. Three free AI listing-copy writes, then £0.70 each. Push to Shopify and inventory stay available. No card to start.",
  },
  {
    question: "Can I edit listing copy before I push to Shopify?",
    answer:
      "Yes. Every field on the product is editable — title, description, price, facts, SEO, AEO, variants, and media — before you push.",
  },
  {
    question: "What if the product is not a textile?",
    answer:
      "You can still list it. You still confirm facts. The fibre pack applies to textile products; non-textiles skip that pack, not the confirm step.",
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
  "Your e-commerce agent for textile listings. New listing from photos is one job.";

export function landingVisibleText(): string {
  return [
    LANDING_BRAND,
    LANDING_DOCUMENT_TITLE,
    LANDING_META_DESCRIPTION,
    LANDING_EYEBROW,
    LANDING_H1,
    LANDING_SUBHEAD,
    LANDING_NON_TEXTILE,
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
