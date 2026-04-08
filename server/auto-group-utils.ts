export type AutoGroupConfidence = "high" | "medium" | "low";
export type AutoGroupMode = "default" | "variant-family";

export interface AutoGroupCandidate {
  label: string;
  imageIndices: number[];
  confidence: string;
  familyKey?: string;
}

const COLOR_TOKENS = new Set([
  "black", "white", "red", "blue", "navy", "green", "olive", "khaki", "pink",
  "purple", "violet", "lavender", "yellow", "gold", "silver", "orange", "brown",
  "beige", "cream", "tan", "grey", "gray", "charcoal", "burgundy", "maroon",
  "teal", "turquoise", "aqua", "mint", "coral", "peach", "mustard", "camel",
  "ivory", "multi", "multicolor",
]);

const VIEW_TOKENS = new Set([
  "front", "back", "side", "detail", "details", "closeup", "close", "zoom",
  "angle", "flatlay", "flat", "laid", "model", "modeled", "hanger", "folded",
  "worn", "shot", "view", "views",
]);

const SIZE_TOKENS = new Set([
  "xs", "s", "m", "l", "xl", "xxl", "xxxl", "small", "medium", "large",
]);

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

export function normalizeAutoGroupLabel(label: string): string {
  const tokens = label
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !COLOR_TOKENS.has(token))
    .filter((token) => !VIEW_TOKENS.has(token))
    .filter((token) => !SIZE_TOKENS.has(token));

  return tokens.join(" ").trim();
}

export function canonicalizeAutoGroup(group: AutoGroupCandidate): AutoGroupCandidate {
  const familyKey = (group.familyKey?.trim().toLowerCase() || normalizeAutoGroupLabel(group.label) || group.label.toLowerCase()).trim();

  return {
    ...group,
    familyKey,
  };
}

export function mergeAutoGroupsByFamily(groups: AutoGroupCandidate[]): AutoGroupCandidate[] {
  const merged = new Map<string, AutoGroupCandidate[]>();

  for (const rawGroup of groups) {
    const group = canonicalizeAutoGroup(rawGroup);
    const key = group.familyKey || group.label.toLowerCase();
    const bucket = merged.get(key) ?? [];
    bucket.push(group);
    merged.set(key, bucket);
  }

  return Array.from(merged.entries()).map(([familyKey, familyGroups]) => {
    const imageIndices = Array.from(new Set(familyGroups.flatMap((group) => group.imageIndices))).sort((a, b) => a - b);
    const preferredLabel =
      familyGroups.find((group) => normalizeAutoGroupLabel(group.label) === familyKey)?.label
      ?? titleCase(familyKey)
      ?? familyGroups[0].label;

    return {
      label: normalizeAutoGroupLabel(preferredLabel) === familyKey ? titleCase(familyKey) : preferredLabel,
      familyKey,
      imageIndices,
      confidence: bestConfidence(familyGroups.map((group) => group.confidence)),
    };
  });
}

export function buildAutoGroupSystemPrompt(mode: AutoGroupMode = "default", productContext?: string): string {
  const variantRules = mode === "variant-family"
    ? `Rules:
- Same product in different colors = same group
- Same product in different sizes = same group
- Same product in different patterns, washes, prints, or materials = same group when it is clearly the same base design sold as variants
- Same product from different angles (front, back, detail, side, model shot, flat lay) = same group
- Different products = different groups
- If an image is ambiguous or you're unsure, put it in its own solo group
- Favor grouping likely variants together over splitting them into near-duplicate products
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
- "Red floral midi dress" + "Blue floral midi dress" => one group if silhouette/design match
- "Black ankle boots" + "Brown ankle boots" => one group
- "Denim jacket" + "Denim jeans" => different groups

${productContext ? `Seller context: "${productContext}"` : ""}

Respond with JSON:
{
  "groups": [
    {
      "label": "Canonical product family label (e.g. 'Denim Jacket')",
      "familyKey": "lowercase canonical family key (e.g. 'denim jacket')",
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
- Merge groups when they are the same product in different colors, sizes, prints, washes, materials, or camera angles
- Do not merge genuinely different products just because they are in the same category
- Prefer using the canonical familyKey when labels vary by color or wording
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
