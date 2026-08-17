import type { Image } from "@shared/schema";

export type ProductFactsRecord = {
  suggested?: {
    isTextile?: boolean | null;
    fibreNames?: string[];
  };
  confirmed?: {
    isTextile?: boolean;
  };
};

export function productFacts(image: Pick<Image, "productFacts"> | undefined): ProductFactsRecord | null {
  const raw = image?.productFacts;
  if (!raw || typeof raw !== "object") return null;
  return raw as ProductFactsRecord;
}

export function mayGenerateListingCopy(image: Pick<Image, "productFacts"> | undefined): boolean {
  return productFacts(image)?.confirmed?.isTextile === false;
}
