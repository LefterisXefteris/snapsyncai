export const BULK_SEO_EMPTY = "Add products to the catalogue, then pick them here for Bulk SEO.";

export type BulkSeoCatalogueRow = {
  id: number;
  title: string | null;
  photoUrl: string | null;
  eligible: boolean;
  blockedReason: string | null;
};

export function bulkSeoEligibleIds(rows: { id: number; eligible: boolean }[]): number[] {
  return rows.filter((row) => row.eligible).map((row) => row.id);
}

export function bulkSeoEligibleTickCount(
  rows: { id: number; eligible: boolean }[],
  selectedIds: Iterable<number>,
): number {
  const wanted = new Set(selectedIds);
  return rows.filter((row) => row.eligible && wanted.has(row.id)).length;
}

export function bulkSeoStartEnabled(args: {
  startBlockedReason: string | null;
  eligibleTickCount: number;
}): boolean {
  return args.startBlockedReason == null && args.eligibleTickCount > 0;
}
