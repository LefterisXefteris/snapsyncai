import type { Image } from "@/lib/image";

export const EU_FIBRE_NAMES = [
  "cotton",
  "wool",
  "silk",
  "flax (linen)",
  "viscose",
  "cupro",
  "modal",
  "lyocell",
  "polyester",
  "polyamide",
  "acrylic",
  "elastane",
  "polypropylene",
] as const;

export const OTHER_FIBRE = "Other";

export type FibreRowDraft = {
  name: string;
  percent: string;
  otherName: string;
};

export type GpsrParty = {
  name: string;
  postalAddress: string;
  email: string;
};

export type GpsrIdentity = {
  manufacturer: GpsrParty;
  manufacturerInEu: boolean;
  euResponsiblePerson?: GpsrParty | null;
};

export type GpsrChoice = "skip" | "shop_default" | "override";

export type CareChoice = "skip" | "fill";

export type ProductKind = "textile" | "coffee";

export type CoffeeForm = "beans" | "ground" | "capsules";

export type CoffeeOriginChoice = "skip" | "fill";

export const COFFEE_FORMS: { value: CoffeeForm; label: string }[] = [
  { value: "beans", label: "Beans" },
  { value: "ground", label: "Ground" },
  { value: "capsules", label: "Capsules" },
];

export type CareFamily =
  | "washing"
  | "bleaching"
  | "drying"
  | "ironing"
  | "professionalTextileCare";

export type CareInstructions = Record<CareFamily, string>;

export const CARE_FAMILIES: { key: CareFamily; label: string }[] = [
  { key: "washing", label: "Washing" },
  { key: "bleaching", label: "Bleaching" },
  { key: "drying", label: "Drying" },
  { key: "ironing", label: "Ironing" },
  { key: "professionalTextileCare", label: "Professional textile care" },
];

export const CARE_PICKS: Record<CareFamily, { code: string; label: string }[]> = {
  washing: [
    { code: "do_not_wash", label: "Do not wash" },
    { code: "hand_wash", label: "Hand wash" },
    { code: "wash_30c", label: "Wash at 30°C" },
    { code: "wash_40c", label: "Wash at 40°C" },
    { code: "wash_60c", label: "Wash at 60°C" },
    { code: "wash_95c", label: "Wash at 95°C" },
  ],
  bleaching: [
    { code: "any_bleach", label: "Any bleach" },
    { code: "non_chlorine_bleach", label: "Non-chlorine bleach only" },
    { code: "do_not_bleach", label: "Do not bleach" },
  ],
  drying: [
    { code: "tumble_dry_normal", label: "Tumble dry normal" },
    { code: "tumble_dry_low", label: "Tumble dry low" },
    { code: "do_not_tumble_dry", label: "Do not tumble dry" },
    { code: "line_dry", label: "Line dry" },
  ],
  ironing: [
    { code: "iron_high", label: "Iron high" },
    { code: "iron_medium", label: "Iron medium" },
    { code: "iron_low", label: "Iron low" },
    { code: "do_not_iron", label: "Do not iron" },
  ],
  professionalTextileCare: [
    { code: "dry_clean", label: "Dry clean" },
    { code: "do_not_dry_clean", label: "Do not dry clean" },
    { code: "professional_wet_clean", label: "Professional wet clean" },
  ],
};

export function emptyCare(): CareInstructions {
  return {
    washing: "",
    bleaching: "",
    drying: "",
    ironing: "",
    professionalTextileCare: "",
  };
}

export function isCompleteCare(care: CareInstructions | null | undefined): boolean {
  if (!care) return false;
  return CARE_FAMILIES.every(({ key }) => Boolean(care[key]));
}

export function emptyGpsrParty(): GpsrParty {
  return { name: "", postalAddress: "", email: "" };
}

export function emptyGpsrIdentity(): GpsrIdentity {
  return {
    manufacturer: emptyGpsrParty(),
    manufacturerInEu: false,
    euResponsiblePerson: emptyGpsrParty(),
  };
}

export function isCompleteGpsr(identity: GpsrIdentity | null | undefined): boolean {
  if (!identity) return false;
  if (!partyComplete(identity.manufacturer)) return false;
  if (identity.manufacturerInEu) return true;
  return partyComplete(identity.euResponsiblePerson);
}

function partyComplete(party: GpsrParty | null | undefined): boolean {
  return Boolean(party?.name?.trim() && party.postalAddress?.trim() && party.email?.trim());
}

export type ProductFactsRecord = {
  suggested?: {
    isTextile?: boolean | null;
    fibreNames?: string[];
  };
  confirmed?: {
    isTextile?: boolean;
    productKind?: ProductKind;
    composition?: { name?: string; percent?: number }[];
    gpsrChoice?: GpsrChoice;
    gpsrIdentity?: GpsrIdentity;
    careChoice?: CareChoice;
    care?: CareInstructions;
    coffeeForm?: CoffeeForm;
    roastLevel?: string;
    netWeight?: string;
    coffeeOriginChoice?: CoffeeOriginChoice;
    coffeeOrigin?: string;
    ingredientsList?: string;
    allergenStatement?: string;
  };
};

export function confirmedProductKind(
  facts: ProductFactsRecord | null | undefined,
): ProductKind | null {
  const kind = facts?.confirmed?.productKind;
  if (kind === "textile" || kind === "coffee") return kind;
  if (facts?.confirmed?.isTextile === true) return "textile";
  return null;
}

export function isCoffeeProduct(facts: ProductFactsRecord | null | undefined): boolean {
  return confirmedProductKind(facts) === "coffee";
}

export function productFacts(image: Pick<Image, "productFacts"> | undefined): ProductFactsRecord | null {
  const raw = image?.productFacts;
  if (!raw || typeof raw !== "object") return null;
  return raw as ProductFactsRecord;
}

export function draftsFromConfirmed(facts: ProductFactsRecord | null): {
  composition: FibreRowDraft[];
  gpsrChoice: GpsrChoice | "";
  careChoice: CareChoice | "";
  care: CareInstructions;
  gpsr: GpsrIdentity;
} {
  const confirmed = facts?.confirmed;
  return {
    composition: compositionFromConfirmed(facts),
    gpsrChoice: confirmed?.gpsrChoice ?? "",
    careChoice: confirmed?.careChoice ?? "",
    care: confirmed?.care ?? emptyCare(),
    gpsr: confirmed?.gpsrIdentity ?? emptyGpsrIdentity(),
  };
}

function compositionFromConfirmed(facts: ProductFactsRecord | null): FibreRowDraft[] {
  const rows = facts?.confirmed?.composition;
  if (!rows || rows.length === 0) return draftComposition(facts);
  return rows.map((row) => fibreDraft(row.name ?? "", row.percent));
}

function fibreDraft(name: string, percent: number | undefined): FibreRowDraft {
  const canonical = canonicalFibre(name);
  const percentText = typeof percent === "number" ? String(percent) : "";
  if (EU_FIBRE_NAMES.includes(canonical as (typeof EU_FIBRE_NAMES)[number])) {
    return { name: canonical, percent: percentText, otherName: "" };
  }
  return { name: OTHER_FIBRE, percent: percentText, otherName: name.trim() };
}

/** Selling the open product page is showing. A Chat write and Undo change this. Listing copy does not. */
export function sellingOnTheOpenPage(
  image:
    | {
        id?: number;
        price?: string | null;
        compareAtPrice?: string | null;
        costPerItem?: string | null;
        sku?: string | null;
        barcode?: string | null;
      }
    | null
    | undefined,
): string {
  if (!image) return "";
  return JSON.stringify({
    id: image.id ?? null,
    price: image.price ?? "",
    compareAtPrice: image.compareAtPrice ?? "",
    costPerItem: image.costPerItem ?? "",
    sku: image.sku ?? "",
    barcode: image.barcode ?? "",
  });
}

/** Publications the open product page is showing. A Chat write and Undo change this. */
export function publicationsOnTheOpenPage(
  image:
    | {
        id?: number;
        shopifyPublicationIds?: string[] | null;
        shopifyProductStatus?: string | null;
      }
    | null
    | undefined,
): string {
  if (!image) return "";
  return JSON.stringify({
    id: image.id ?? null,
    shopifyPublicationIds: image.shopifyPublicationIds ?? [],
    shopifyProductStatus: image.shopifyProductStatus ?? "",
  });
}

/** Changes when the open product page should show new facts or typed listing copy. */
export function shownOnProductPage(
  image:
    | {
        id?: number;
        productFacts?: unknown;
        title?: string | null;
        description?: string | null;
        tags?: string[] | null;
        seoTitle?: string | null;
        seoDescription?: string | null;
        aeoSnippet?: string | null;
        aeoFaqs?: unknown;
      }
    | null
    | undefined,
): string {
  if (!image) return "";
  return JSON.stringify({
    id: image.id ?? null,
    productFacts: image.productFacts ?? null,
    title: image.title ?? "",
    description: image.description ?? "",
    tags: image.tags ?? [],
    seoTitle: image.seoTitle ?? "",
    seoDescription: image.seoDescription ?? "",
    aeoSnippet: image.aeoSnippet ?? "",
    aeoFaqs: image.aeoFaqs ?? [],
  });
}

export function draftComposition(facts: ProductFactsRecord | null): FibreRowDraft[] {
  const names = facts?.suggested?.fibreNames ?? [];
  if (names.length === 0) {
    return [{ name: "cotton", percent: "", otherName: "" }];
  }
  return names.map((raw) => {
    const canonical = canonicalFibre(raw);
    if (EU_FIBRE_NAMES.includes(canonical as (typeof EU_FIBRE_NAMES)[number])) {
      return { name: canonical, percent: "", otherName: "" };
    }
    return { name: OTHER_FIBRE, percent: "", otherName: raw };
  });
}

function canonicalFibre(name: string): string {
  const lowered = name.trim().toLowerCase();
  for (const official of EU_FIBRE_NAMES) {
    if (official === lowered) return official;
    const open = official.indexOf("(");
    if (open !== -1) {
      const inner = official.slice(open + 1, official.indexOf(")")).toLowerCase();
      const outer = official.slice(0, open).trim().toLowerCase();
      if (lowered === inner || lowered === outer) return official;
    }
  }
  return name.trim();
}
