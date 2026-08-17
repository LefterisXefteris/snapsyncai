import type { Image } from "@shared/schema";

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
    composition?: { name?: string; percent?: number }[];
    gpsrChoice?: GpsrChoice;
    gpsrIdentity?: GpsrIdentity;
  };
};

export function productFacts(image: Pick<Image, "productFacts"> | undefined): ProductFactsRecord | null {
  const raw = image?.productFacts;
  if (!raw || typeof raw !== "object") return null;
  return raw as ProductFactsRecord;
}

export function mayGenerateListingCopy(image: Pick<Image, "productFacts"> | undefined): boolean {
  const confirmed = productFacts(image)?.confirmed;
  if (!confirmed) return false;
  if (confirmed.isTextile === false) return true;
  return confirmed.isTextile === true && (confirmed.composition?.length ?? 0) > 0;
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

export function compositionBlockHtml(facts: ProductFactsRecord | null): string {
  const rows = facts?.confirmed?.composition;
  if (!facts?.confirmed?.isTextile || !rows?.length) return "";
  const parts = rows
    .filter((row) => row.name && typeof row.percent === "number")
    .map((row) => `${row.percent}% ${row.name}`);
  if (!parts.length) return "";
  return `<p>Fibre composition: ${parts.join(", ")}.</p>`;
}

export function gpsrBlockHtml(identity: GpsrIdentity | null | undefined): string {
  if (!identity || !partyComplete(identity.manufacturer)) return "";
  const maker = identity.manufacturer;
  let html = `<p>Manufacturer: ${maker.name}, ${maker.postalAddress}, ${maker.email}.</p>`;
  if (!identity.manufacturerInEu && partyComplete(identity.euResponsiblePerson)) {
    const person = identity.euResponsiblePerson!;
    html += `<p>EU responsible person: ${person.name}, ${person.postalAddress}, ${person.email}.</p>`;
  }
  return html;
}

export function effectiveGpsrIdentity(
  facts: ProductFactsRecord | null,
  shopGpsr: GpsrIdentity | null | undefined,
): GpsrIdentity | null {
  const choice = facts?.confirmed?.gpsrChoice;
  if (!choice || choice === "skip") return null;
  if (choice === "override") {
    return isCompleteGpsr(facts?.confirmed?.gpsrIdentity) ? facts!.confirmed!.gpsrIdentity! : null;
  }
  return isCompleteGpsr(shopGpsr) ? shopGpsr! : null;
}

export function withDescriptionBlocks(
  description: string,
  facts: ProductFactsRecord | null,
  shopGpsr?: GpsrIdentity | null,
): string {
  const composition = compositionBlockHtml(facts);
  const gpsr = gpsrBlockHtml(effectiveGpsrIdentity(facts, shopGpsr));
  const block = [composition, gpsr].filter(Boolean).join("\n");
  const stripped = description
    .replace(/<p>Fibre composition:.*?<\/p>/gi, "")
    .replace(/<p>Manufacturer:.*?<\/p>(?:\s*<p>EU responsible person:.*?<\/p>)?/gi, "")
    .trim();
  if (!block) return stripped;
  return stripped ? `${stripped}\n${block}` : block;
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
