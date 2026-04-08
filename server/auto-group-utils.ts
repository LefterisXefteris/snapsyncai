export type AutoGroupConfidence = "high" | "medium" | "low";
export type AutoGroupMode = "default" | "variant-family";

export interface AutoGroupCandidate {
  label: string;
  imageIndices: number[];
  confidence: string;
  familyKey?: string;
  descriptor?: string;
}

export interface ApparelIdentityProfile {
  familyKey: string;
  mergeStrength: "strong" | "weak";
  garmentType: string | null;
  silhouetteKey: string;
  graphicSignature: string;
  coreTokens: string[];
}

const COLOR_TOKENS = new Set([
  "black", "white", "red", "blue", "navy", "green", "olive", "khaki", "pink",
  "purple", "violet", "lavender", "yellow", "gold", "silver", "orange", "brown",
  "beige", "cream", "tan", "grey", "gray", "charcoal", "burgundy", "maroon",
  "teal", "turquoise", "aqua", "mint", "coral", "peach", "mustard", "camel",
  "ivory", "multi", "multicolor", "stone", "washed", "acid", "faded",
]);

const VIEW_TOKENS = new Set([
  "front", "back", "side", "detail", "details", "closeup", "close", "zoom",
  "angle", "flatlay", "flat", "laid", "model", "modeled", "hanger", "folded",
  "worn", "shot", "view", "views", "studio", "lifestyle", "look",
]);

const SIZE_TOKENS = new Set([
  "xs", "s", "m", "l", "xl", "xxl", "xxxl", "small", "medium", "large",
]);

const GENERIC_TOKENS = new Set([
  "men", "mens", "man", "women", "womens", "woman", "unisex", "adult",
  "title", "category", "main", "filename", "product", "products", "apparel",
  "clothing", "garment", "style", "fashion", "seller", "shop", "collection",
  "premium", "classic", "new", "drop", "piece", "pieces",
]);

const GRAPHIC_MARKERS = new Set([
  "graphic", "graphics", "print", "printed", "logo", "logos", "art", "artwork",
  "embroidered", "embroidery", "illustration", "poster",
]);

const SILHOUETTE_PATTERNS: Array<{ pattern: string[]; canonical: string }> = [
  { pattern: ["wide", "leg"], canonical: "wide-leg" },
  { pattern: ["straight", "leg"], canonical: "straight-leg" },
  { pattern: ["boot", "cut"], canonical: "bootcut" },
  { pattern: ["bootcut"], canonical: "bootcut" },
  { pattern: ["flared"], canonical: "flared" },
  { pattern: ["flare"], canonical: "flared" },
  { pattern: ["cropped"], canonical: "cropped" },
  { pattern: ["boxy"], canonical: "boxy" },
  { pattern: ["oversized"], canonical: "oversized" },
  { pattern: ["relaxed"], canonical: "relaxed" },
  { pattern: ["slim"], canonical: "slim" },
  { pattern: ["skinny"], canonical: "skinny" },
  { pattern: ["baggy"], canonical: "baggy" },
  { pattern: ["fitted"], canonical: "fitted" },
  { pattern: ["regular", "fit"], canonical: "regular-fit" },
  { pattern: ["zip", "up"], canonical: "zip-up" },
  { pattern: ["full", "zip"], canonical: "full-zip" },
  { pattern: ["half", "zip"], canonical: "half-zip" },
  { pattern: ["pullover"], canonical: "pullover" },
];

const GARMENT_ALIAS_ENTRIES: Array<[string, string]> = [
  ["tshirt", "tee"],
  ["tee", "tee"],
  ["tees", "tee"],
  ["shirt", "shirt"],
  ["shirts", "shirt"],
  ["hoodie", "hoodie"],
  ["hoodies", "hoodie"],
  ["sweatshirt", "sweatshirt"],
  ["sweatshirts", "sweatshirt"],
  ["crewneck", "sweatshirt"],
  ["sweater", "sweater"],
  ["sweaters", "sweater"],
  ["cardigan", "cardigan"],
  ["jacket", "jacket"],
  ["jackets", "jacket"],
  ["coat", "coat"],
  ["coats", "coat"],
  ["vest", "vest"],
  ["pants", "trouser"],
  ["pant", "trouser"],
  ["trouser", "trouser"],
  ["trousers", "trouser"],
  ["jean", "jean"],
  ["jeans", "jean"],
  ["short", "short"],
  ["shorts", "short"],
  ["dress", "dress"],
  ["dresses", "dress"],
  ["skirt", "skirt"],
  ["skirts", "skirt"],
  ["tank", "tank"],
  ["tanktop", "tank"],
  ["top", "top"],
];

const GARMENT_ALIASES = new Map<string, string>(GARMENT_ALIAS_ENTRIES);

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function bestConfidence(confidences: string[]): AutoGroupConfidence {
  if (confidences.includes("high")) return "high";
  if (confidences.includes("medium")) return "medium";
  return "low";
}

function tokenizeIdentityText(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\bimg\b/g, " ")
    .replace(/\b\d+\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function removeVariantNoise(tokens: string[]) {
  return tokens
    .filter((token) => !COLOR_TOKENS.has(token))
    .filter((token) => !VIEW_TOKENS.has(token))
    .filter((token) => !SIZE_TOKENS.has(token))
    .filter((token) => !GENERIC_TOKENS.has(token));
}

function detectSilhouetteTokens(tokens: string[]) {
  const matches = new Set<string>();

  for (const { pattern, canonical } of SILHOUETTE_PATTERNS) {
    for (let index = 0; index <= tokens.length - pattern.length; index++) {
      const window = tokens.slice(index, index + pattern.length);
      if (window.join(" ") === pattern.join(" ")) {
        matches.add(canonical);
      }
    }
  }

  return Array.from(matches).sort();
}

function detectGarmentType(tokens: string[]) {
  for (const token of tokens) {
    const garmentType = GARMENT_ALIASES.get(token);
    if (garmentType) return garmentType;
  }
  return null;
}

function normalizeGraphicTokens(tokens: string[], garmentType: string | null, silhouetteTokens: string[]) {
  const silhouetteParts = new Set(
    silhouetteTokens.flatMap((token) => token.split("-")),
  );

  const cleaned = tokens.filter((token) => {
    if (garmentType && GARMENT_ALIASES.get(token) === garmentType) return false;
    if (silhouetteParts.has(token)) return false;
    return true;
  });

  const nonMarkerTokens = cleaned.filter((token) => !GRAPHIC_MARKERS.has(token));
  if (nonMarkerTokens.length > 0) {
    return Array.from(new Set(nonMarkerTokens)).slice(0, 4);
  }

  return Array.from(new Set(cleaned)).slice(0, 4);
}

export function normalizeAutoGroupLabel(label: string): string {
  const tokens = removeVariantNoise(tokenizeIdentityText(label));
  return tokens.join(" ").trim();
}

export function buildApparelIdentityProfile(text: string): ApparelIdentityProfile {
  const rawTokens = tokenizeIdentityText(text);
  const cleanedTokens = removeVariantNoise(rawTokens);
  const garmentType = detectGarmentType(cleanedTokens);
  const silhouetteTokens = detectSilhouetteTokens(cleanedTokens);
  const graphicTokens = normalizeGraphicTokens(cleanedTokens, garmentType, silhouetteTokens);

  const baseTokens = graphicTokens.filter((token) => token.length > 1);
  const identityParts = [
    ...baseTokens,
    ...silhouetteTokens,
    ...(garmentType ? [garmentType] : []),
  ];

  const uniqueIdentityParts = Array.from(new Set(identityParts)).filter(Boolean);
  const familyKey = uniqueIdentityParts.join(" ").trim() || normalizeAutoGroupLabel(text) || text.toLowerCase().trim();
  const mergeStrength = baseTokens.length > 0 || silhouetteTokens.length > 0 ? "strong" : "weak";

  return {
    familyKey,
    mergeStrength,
    garmentType,
    silhouetteKey: silhouetteTokens.join(" "),
    graphicSignature: baseTokens.join(" "),
    coreTokens: uniqueIdentityParts,
  };
}

export function buildCandidateBucketKey(text: string, mode: AutoGroupMode = "variant-family") {
  if (mode !== "variant-family") return "all";
  const profile = buildApparelIdentityProfile(text);
  return profile.garmentType || "unknown";
}

function pickStrongerFamilyKey(group: AutoGroupCandidate, profile: ApparelIdentityProfile) {
  const explicitKey = group.familyKey?.trim().toLowerCase();
  if (!explicitKey) return profile.familyKey;

  const explicitProfile = buildApparelIdentityProfile(`${group.label} ${explicitKey}`);
  if (profile.mergeStrength === "strong" && explicitProfile.mergeStrength === "weak") {
    return profile.familyKey;
  }

  return explicitKey;
}

export function canonicalizeAutoGroup(group: AutoGroupCandidate): AutoGroupCandidate {
  const profile = buildApparelIdentityProfile(
    [group.label, group.familyKey, group.descriptor].filter(Boolean).join(" "),
  );
  const familyKey = pickStrongerFamilyKey(group, profile).trim();

  return {
    ...group,
    familyKey,
    descriptor: group.descriptor,
  };
}

export function mergeAutoGroupsByFamily(groups: AutoGroupCandidate[]): AutoGroupCandidate[] {
  const merged = new Map<string, AutoGroupCandidate[]>();

  groups.forEach((rawGroup, index) => {
    const group = canonicalizeAutoGroup(rawGroup);
    const profile = buildApparelIdentityProfile(
      [group.label, group.familyKey, group.descriptor].filter(Boolean).join(" "),
    );
    const mergeKey =
      profile.mergeStrength === "strong"
        ? profile.familyKey
        : `${group.familyKey || group.label.toLowerCase()}::__solo__${index}`;

    const bucket = merged.get(mergeKey) ?? [];
    bucket.push(group);
    merged.set(mergeKey, bucket);
  });

  return Array.from(merged.entries()).map(([mergeKey, familyGroups]) => {
    const canonicalProfile = buildApparelIdentityProfile(
      familyGroups.map((group) => [group.label, group.familyKey, group.descriptor].filter(Boolean).join(" ")).join(" "),
    );
    const imageIndices = Array.from(new Set(familyGroups.flatMap((group) => group.imageIndices))).sort((a, b) => a - b);
    const fallbackLabel =
      familyGroups.find((group) => normalizeAutoGroupLabel(group.label) === canonicalProfile.familyKey)?.label
      ?? titleCase(canonicalProfile.familyKey || mergeKey)
      ?? familyGroups[0].label;

    return {
      label: canonicalProfile.familyKey ? titleCase(canonicalProfile.familyKey) : fallbackLabel,
      familyKey: canonicalProfile.familyKey || mergeKey.replace(/::__solo__\d+$/, ""),
      imageIndices,
      confidence: bestConfidence(familyGroups.map((group) => group.confidence)),
      descriptor: familyGroups.map((group) => group.descriptor).filter(Boolean).join(" || "),
    };
  });
}

export function buildAutoGroupSystemPrompt(mode: AutoGroupMode = "default", productContext?: string): string {
  const variantRules = mode === "variant-family"
    ? `Rules:
- Same product in different colors = same group
- Same product in different sizes = same group
- Same product in different washes, fabrics, or materials can be the same group when the base garment construction and design are clearly the same
- Same product from different angles (front, back, detail, side, model shot, flat lay) = same group
- Different front graphics, different prints, different logo/art placements, and different base silhouettes should usually be different groups
- Different products = different groups
- If an image is ambiguous or you're unsure, put it in its own solo group
- Favor grouping clearly matching variants together, but do not merge different garments just because they share a category or styling
- Your label should describe the product family, not the specific color or shot
- Your familyKey must be a short lowercase canonical key for the base product family with colors/views removed`
    : `Rules:
- Same product in different colors = same group
- Same product from different angles (front, back, detail, side, model shot, flat lay) = same group
- Different products = different groups
- If an image is ambiguous or you're unsure, put it in its own solo group
- Your label should be a short product description
- Your familyKey should be a short lowercase canonical key for the product`;

  return `You are a product image grouping assistant for an e-commerce platform, specializing in clothing and fashion.

You will receive multiple product images. Your job is to identify which images show the SAME underlying product family and group them together.

${variantRules}

Examples:
- "Blue denim jacket" + "Black denim jacket" + back view of the black jacket => one group
- "Cream eagle graphic tee" + "Black eagle graphic tee" + back view => one group
- "Cream eagle graphic tee" + "Black world tour graphic tee" => different groups
- "Wide-leg trouser" + "Straight-leg trouser" => different groups unless the visuals clearly show the same base product
- "Denim jacket" + "Denim jeans" => different groups

${productContext ? `Seller context: "${productContext}"` : ""}

Respond with JSON:
{
  "groups": [
    {
      "label": "Canonical product family label (e.g. 'Eagle Graphic Tee')",
      "familyKey": "lowercase canonical family key (e.g. 'eagle graphic tee')",
      "imageIndices": [0, 3, 7],
      "confidence": "high" | "medium" | "low"
    }
  ]
}

imageIndices are 0-based indices referring to the order images appear in this message.
Every image index must appear in exactly one group. Do not skip any.`;
}

export function buildAutoGroupMergePrompt(mode: AutoGroupMode = "default"): string {
  const mergeRules = mode === "variant-family"
    ? `Rules:
- Merge groups when they are the same product in different colors, sizes, washes, fabrics, materials, or camera angles
- Do not merge groups that appear to have different front graphics, artwork, logo placement, silhouettes, or base garment structures
- Do not merge genuinely different products just because they are in the same category
- Prefer the canonical familyKey when labels vary by color or wording
- Return a canonical product-family label without color-specific wording`
    : `Rules:
- Merge groups only when they clearly describe the same product
- Do not merge genuinely different products just because they are in the same category
- Prefer canonical labels when wording differs`;

  return `You have product groups from multiple batches. Merge groups that describe the same underlying product family.

${mergeRules}

Return JSON:
{
  "mergedGroups": [
    {
      "label": "Canonical product family label",
      "familyKey": "lowercase canonical family key",
      "sourceGroupIds": [0, 2]
    }
  ]
}`;
}
