export const LANDING_BRAND = "SnapSync";

export const LANDING_DOCUMENT_TITLE = "SnapSync — AI listing copy from your product photos";

export const LANDING_META_DESCRIPTION =
  "SnapSync turns product photos into AI listing copy. Confirm the facts first, then AI writes title, description, tags, and SEO — and you Push to Shopify or Trendyol International. Three free Credits, then packs of 10, 50, or 100.";

export const LANDING_EYEBROW = "Photos → facts → AI listing copy";

export const LANDING_H1_LEAD = "AI listing copy";
export const LANDING_H1 = `${LANDING_H1_LEAD} from your product photos.`;

export const LANDING_SUBHEAD =
  "Drop in photos and confirm the facts. Then AI writes the listing copy, and you Push to Shopify or Trendyol International.";

export const LANDING_CHANNELS = "Push to Shopify · Trendyol International";

export const LANDING_MICRO = "No card required · catalogue, facts, and typed listing copy free";

export const LANDING_PRIMARY_CTA = "Start free";
export const LANDING_SECONDARY_CTA = "How it works";

export const STEPS_HEADING = "Four steps, facts first.";
export const STEPS_SUBHEAD = "Nothing is written until you have confirmed what the product is.";

export const STEPS = [
  {
    number: "01",
    title: "Photos",
    description: "Drop product photos into New listing and group them into products.",
  },
  {
    number: "02",
    title: "Confirm facts",
    description: "Check the facts a photo cannot prove, then confirm them.",
  },
  {
    number: "03",
    title: "Listing copy",
    description: "Title, description, tags, SEO, and AEO — written from confirmed facts, not invented from the photo.",
  },
  {
    number: "04",
    title: "Push to a Channel",
    description: "Edit anything, then Push to Shopify or Trendyol International.",
  },
] as const;

export const JOBS_HEADING = "Listing from photos is one job.";
export const JOBS_SUBHEAD = "After New listing, this is where you run the shop.";

export const JOBS = [
  {
    title: "Products",
    description:
      "The catalogue you live in after New listing. Review and edit every field, then Push when the listing is ready.",
  },
  {
    title: "Import & Inventory",
    description:
      "Two parallel Channel jobs. Import brings in Shopify products the catalogue does not have yet; Inventory holds stock on hand with a safety buffer. Neither one Pushes or Accepts.",
  },
  {
    title: "Bulk SEO",
    description:
      "Refresh listing copy for the products you pick, using search demand. You Accept each one — one Credit per Accept. Accept does not Push.",
  },
] as const;

export const PRICING_HEADING = "Pay for AI listing copy you keep.";
export const PRICING_SUBHEAD = "Credits meter one thing: an Accept. Everything else stays free.";

export const CREDIT_PACKS = [
  { credits: 10, price: "£7" },
  { credits: 50, price: "£30" },
  { credits: 100, price: "£55" },
] as const;

export const PRICING_BULLETS = [
  "Three free Credits for life on your shop",
  "One Credit is spent when an Accept lands — first generate, refresh, or Bulk SEO",
  "Catalogue, facts, and typed listing copy stay free",
  "Push does not spend a Credit",
] as const;

export const PRICING_FINE_PRINT = "No subscription · Secure payments via Stripe";

export const FAQ_DATA = [
  {
    question: "What is SnapSync?",
    answer:
      "SnapSync writes AI listing copy from your product photos once you have confirmed the facts. New listing from photos is one job; you also get a product catalogue, Import, Inventory, and Bulk SEO.",
  },
  {
    question: "What facts do I confirm?",
    answer:
      "It depends on what you sell. A Textile product confirms fibre composition, care instructions, and GPSR identity. A Coffee product confirms the food-label pack — form, roast, net weight, ingredients, and allergens — and a Coffee product may Push to Shopify only.",
  },
  {
    question: "What are Credits?",
    answer:
      "Three free Credits for life on your shop. Then buy a pack of 10 (£7), 50 (£30), or 100 (£55). One Credit is spent when an Accept lands for first generate, refresh, or Bulk SEO. Catalogue, facts, and typed listing copy stay free.",
  },
  {
    question: "How do I create a product from photos?",
    answer:
      "Open New listing and drag in up to 200 photos. Group them into products, confirm the facts, generate listing copy, then Push.",
  },
  {
    question: "Which Channels does SnapSync Push to?",
    answer: "Shopify and Trendyol International. Connect each Channel in Settings, then Push from the catalogue.",
  },
  {
    question: "How much does SnapSync cost?",
    answer:
      "Starting is free and needs no card. You only spend Credits when you Accept AI listing copy; packs start at £7 for 10.",
  },
  {
    question: "Can I edit listing copy before I Push?",
    answer:
      "Yes. Every field on the product is editable — title, description, price, facts, SEO, AEO, variants, and media — before you Push.",
  },
] as const;

export const FAQ_SUBHEAD = "Facts, Credits, and Channels.";

export const CLOSING_HEADING = "Start with a New listing.";
export const CLOSING_SUBHEAD =
  "Photos in, facts confirmed, AI listing copy, then Push to Shopify or Trendyol International. No card required.";

export const DEMO = {
  title: "Merino Crew Neck — Charcoal",
  description: "Fine merino knit with a dry hand and a clean crew.",
  fibre: "Wool 100%",
  care: "Wool wash 30°C",
  gpsr: "Shop GPSR identity",
} as const;

export const FOOTER_BLURB = "AI listing copy from your product photos. New listing from photos is one job.";

export function landingVisibleText(): string {
  return [
    LANDING_BRAND,
    LANDING_DOCUMENT_TITLE,
    LANDING_META_DESCRIPTION,
    LANDING_EYEBROW,
    LANDING_H1,
    LANDING_SUBHEAD,
    LANDING_CHANNELS,
    LANDING_MICRO,
    LANDING_PRIMARY_CTA,
    LANDING_SECONDARY_CTA,
    STEPS_HEADING,
    STEPS_SUBHEAD,
    ...STEPS.flatMap((step) => [step.title, step.description]),
    JOBS_HEADING,
    JOBS_SUBHEAD,
    ...JOBS.flatMap((job) => [job.title, job.description]),
    PRICING_HEADING,
    PRICING_SUBHEAD,
    ...CREDIT_PACKS.map((pack) => `${pack.credits} Credits ${pack.price}`),
    ...PRICING_BULLETS,
    PRICING_FINE_PRINT,
    ...FAQ_DATA.flatMap((faq) => [faq.question, faq.answer]),
    FAQ_SUBHEAD,
    CLOSING_HEADING,
    CLOSING_SUBHEAD,
    DEMO.title,
    DEMO.description,
    DEMO.fibre,
    DEMO.care,
    DEMO.gpsr,
    FOOTER_BLURB,
  ].join("\n");
}
