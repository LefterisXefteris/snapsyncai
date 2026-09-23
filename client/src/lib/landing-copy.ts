export const LANDING_BRAND = "SnapSync";

export const LANDING_DOCUMENT_TITLE =
  "SnapSync — seller workspace for textile listings on Shopify";

export const LANDING_META_DESCRIPTION =
  "SnapSync is a seller workspace for textile listings on Shopify. New listing from photos, confirm fibre composition, care instructions, and GPSR identity, then listing copy. Push to Shopify. Inventory Autopilot included. Plan from £19/month.";

export const LANDING_EYEBROW = "Shopify · textiles";

export const LANDING_H1 = "The Shopify workspace for textile sellers";

export const LANDING_SUBHEAD =
  "New listing from photos. Confirm fibre composition, care instructions, and GPSR identity. Then listing copy. Push to Shopify.";

export const LANDING_NON_TEXTILE =
  "Not a textile? You still confirm facts. The fibre pack is only for textile products.";

export const LANDING_MICRO = "No card required · catalogue, facts, and typed listing copy free";

export const LANDING_PRIMARY_CTA = "Start free";
export const LANDING_SECONDARY_CTA = "How it works";

export const LANDING_FINE_PRINT = "Plan from £19/month · £190/year · Extra uses £0.70 · Cancel anytime";

export const JOBS = [
  {
    title: "New listing",
    description:
      "Drag in up to 200 photos and group them into products. New listing is the photo job, not the whole workspace.",
  },
  {
    title: "Product facts, then listing copy",
    description:
      "A photo may suggest fibre names. You confirm fibre composition, care instructions, and GPSR identity. Listing copy — including SEO and AEO — is not generated until those facts are confirmed.",
  },
  {
    title: "Products",
    description:
      "The catalogue you live in. Review, edit, and push to Shopify when the listing is ready.",
  },
  {
    title: "Inventory Autopilot",
    description:
      "Import the Shopify catalogue you already sell, set a safety buffer, and keep tracked variants from overselling. A parallel job, not a listing step.",
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
  "20 listing-copy writes per calendar month",
  "New listing from photos (up to 200)",
  "Product facts, then listing copy",
  "SEO and AEO in the listing copy",
  "Push to Shopify",
  "Inventory Autopilot",
  "Extra uses £0.70 — not a hard stop",
] as const;

export const ANNUAL_BULLETS = [
  "20 listing-copy writes per calendar month",
  "New listing from photos (up to 200)",
  "Product facts, then listing copy",
  "SEO and AEO in the listing copy",
  "Push to Shopify",
  "Inventory Autopilot",
  "Two months free vs paying monthly",
] as const;

export const FAQ_DATA = [
  {
    question: "What is SnapSync?",
    answer:
      "SnapSync is a seller workspace for textile listings on Shopify. New listing from photos is one job inside it. You also get a product catalogue, confirmed product facts before listing copy, and Inventory Autopilot.",
  },
  {
    question: "Why do I confirm facts before listing copy?",
    answer:
      "Listing copy must not invent product facts a photo cannot establish. You confirm fibre composition, care instructions, and GPSR identity — or skip the blocks you do not have. Only then is listing copy generated.",
  },
  {
    question: "How does the Plan Allowance work?",
    answer:
      "Each calendar month a Plan includes 20 listing-copy writes (first generate or listing copy refresh) and website handoffs. Extra uses are £0.70 on the invoice. Unused uses expire at month end. Confirming facts does not spend. No card is required to use the workspace.",
  },
  {
    question: "How do I create a product from photos?",
    answer:
      "Open New listing and drag in up to 200 photos. Group them into products. Confirm facts, generate listing copy, then push to Shopify. No card is required to start.",
  },
  {
    question: "Which channels does SnapSync publish to?",
    answer:
      "Shopify. Connect your shop in Settings, then push products from the catalogue.",
  },
  {
    question: "How much does SnapSync cost?",
    answer:
      "No card to start. A Plan is £19/month or £190/year for 20 listing-copy writes each calendar month — listing copy, listing copy refresh, website, push to Shopify, and Inventory Autopilot. Extra uses £0.70. Cancel anytime.",
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
  "Seller workspace for textile listings on Shopify. New listing from photos is one job inside it.";

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
