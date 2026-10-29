import { extractAsDraft } from "./draft-products";
import { filterImageLikeFiles } from "./image-file-utils";

/** The product page open when the message is sent. Any other path is not a product. */
export function openProductId(pathname: string): number | null {
  const match = /^\/product\/(\d+)$/.exec(pathname);
  if (!match) return null;
  return Number(match[1]);
}

/** A generate proposal sitting on the open product page, not yet in the thread. */
export type PageProposal = {
  productId: number;
  title: string;
  description: string;
  tags: string[];
  seoTitle: string;
  seoDescription: string;
  aeoFaqs: { q: string; a: string }[];
};

let remembered: PageProposal | null = null;
let bulkSeoTicks: number[] = [];

export type ListingDraft = { id: string; items: { id: string }[] };

type PhotoFile = { name: string; type?: string };

let listingDrafts: ListingDraft[] = [];
let listingSelection: string[] = [];
let intakeLines: string[] = [];
let intakeEpoch = 0;
let photoIntake: ((files: PhotoFile[]) => boolean | void) | null = null;

/** Drafts already on this browser's New listing canvas. */
export function rememberNewListingDrafts(drafts: readonly ListingDraft[]): void {
  listingDrafts = drafts.map((draft) => ({
    id: draft.id,
    items: draft.items.map((item) => ({ id: item.id })),
  }));
}

export function rememberNewListingSelection(ids: readonly string[]): void {
  listingSelection = [...ids];
}

export function newListingDrafts(): readonly ListingDraft[] {
  return listingDrafts;
}

export function selectedDraftPhotoIds(): readonly string[] {
  return listingSelection;
}

let onGroupedDrafts: ((ids: readonly string[]) => boolean) | null = null;

/** The open New listing canvas runs Group on these photos. */
export function registerGroupedDrafts(apply: (ids: readonly string[]) => boolean): () => void {
  onGroupedDrafts = apply;
  return () => {
    if (onGroupedDrafts === apply) onGroupedDrafts = null;
  };
}

/** Group these photos. False means New listing is closed, so the caller writes the stored canvas. */
export function applyGroupedDraftPhotos(ids: readonly string[]): boolean {
  if (onGroupedDrafts !== null) {
    if (onGroupedDrafts(ids)) listingSelection = [];
    return true;
  }
  const next = extractAsDraft(listingDrafts, ids, crypto.randomUUID());
  if (next === listingDrafts) return false;
  listingDrafts = next;
  listingSelection = [];
  return false;
}

export function intakeSentences(): readonly string[] {
  return intakeLines;
}

/** The open canvas takes the photos. Return false when it keeps none of them. */
export function registerPhotoIntake(take: (files: PhotoFile[]) => boolean | void): () => void {
  photoIntake = take;
  return () => {
    if (photoIntake === take) photoIntake = null;
  };
}

/** Chosen files become draft products. A cancelled pick adds nothing. */
export function choosePhotos<T extends PhotoFile>(
  files: readonly T[] | null,
): { handedOff: boolean; photos: T[]; epoch: number } {
  if (files === null || files.length === 0) return { handedOff: false, photos: [], epoch: 0 };
  const photos = filterImageLikeFiles(files);
  if (photos.length === 0) {
    intakeLines = [...intakeLines, "None of those are photos."];
    return { handedOff: false, photos: [], epoch: 0 };
  }
  const added: ListingDraft[] = photos.map(() => ({
    id: crypto.randomUUID(),
    items: [{ id: crypto.randomUUID() }],
  }));
  listingDrafts = [...listingDrafts, ...added];
  intakeLines = [
    ...intakeLines,
    photos.length === 1
      ? "1 draft product is on New listing."
      : `${photos.length} draft products are on New listing.`,
  ];
  const epoch = ++intakeEpoch;
  if (photoIntake?.(photos) === false) {
    rollbackPhotoIntake(photos.length, epoch);
    return { handedOff: true, photos: [], epoch };
  }
  return { handedOff: photoIntake !== null, photos, epoch };
}

/** The canvas refused that pick. A newer pick is left alone. */
export function rollbackPhotoIntake(photoCount: number, epoch: number): void {
  if (epoch !== intakeEpoch) return;
  listingDrafts = listingDrafts.slice(0, Math.max(0, listingDrafts.length - photoCount));
  intakeLines = intakeLines.slice(0, -1);
}

/** Eligible rows ticked on Bulk SEO. A Products selection is not stored here. */
export function rememberBulkSeoTicks(ids: readonly number[]): void {
  bulkSeoTicks = [...ids];
}

export function rememberPageProposal(proposal: PageProposal | null): void {
  remembered = proposal;
}

export function pageProposalFor(productId: number | null): PageProposal | null {
  if (productId === null || remembered === null || remembered.productId !== productId) {
    return null;
  }
  return remembered;
}

export function chatBody(message: string, pathname: string) {
  const productId = openProductId(pathname);
  const proposal = pageProposalFor(productId);
  const ticks = pathname === "/bulk-seo" ? bulkSeoTicks : [];
  const photos = pathname === "/new" && listingSelection.length >= 2 ? [...listingSelection] : [];
  return {
    message,
    ...(productId === null ? {} : { openProductId: productId }),
    ...(proposal === null
      ? {}
      : {
          pageProposal: {
            title: proposal.title,
            description: proposal.description,
            tags: proposal.tags,
            seoTitle: proposal.seoTitle,
            seoDescription: proposal.seoDescription,
            aeoFaqs: proposal.aeoFaqs,
          },
        }),
    ...(ticks.length === 0 ? {} : { bulkSeoIds: [...ticks] }),
    ...(photos.length === 0 ? {} : { draftPhotoIds: photos }),
  };
}

export type InventoryUndo = {
  replyIndex: number;
  itemId: number;
  quantity: number;
};

export type HeldInventoryUndo = InventoryUndo & { shownAt: number };

export const UNDO_MS = 9_000;

/** Each reply keeps its own previous quantity. A later reply does not clear an earlier one. */
export function holdInventoryUndos(
  held: readonly HeldInventoryUndo[],
  incoming: readonly InventoryUndo[],
  shownAt: number,
): HeldInventoryUndo[] {
  return [...held, ...incoming.map((undo) => ({ ...undo, shownAt }))];
}

/** Present before 9 seconds, gone after. A thread with no previous quantity has none. */
export function inventoryUndoControls(
  held: readonly HeldInventoryUndo[],
  now: number,
): InventoryUndo[] {
  return held
    .filter((undo) => now - undo.shownAt < UNDO_MS)
    .map(({ replyIndex, itemId, quantity }) => ({ replyIndex, itemId, quantity }));
}

/** The Inventory page write. The control stays until that write lands. */
export function inventoryUndoWrite(
  held: readonly HeldInventoryUndo[],
  replyIndex: number,
  now: number,
): { itemId: number; mode: "set"; quantity: number; reason: "Undo" } | null {
  const undo = held.find(
    (item) => item.replyIndex === replyIndex && now - item.shownAt < UNDO_MS,
  );
  if (!undo) return null;
  return { itemId: undo.itemId, mode: "set", quantity: undo.quantity, reason: "Undo" };
}

/** The write-back landed. That reply's control is gone. */
export function landInventoryUndo(
  held: readonly HeldInventoryUndo[],
  replyIndex: number,
): HeldInventoryUndo[] {
  return held.filter((item) => item.replyIndex !== replyIndex);
}

const COPY_FIELDS = ["title", "description", "tags", "seoTitle", "seoDescription", "aeoSnippet"] as const;

export type CopyField = (typeof COPY_FIELDS)[number];

export type CopyUndo = {
  replyIndex: number;
  productId: number;
} & Partial<Record<CopyField, string>>;

export type HeldCopyUndo = CopyUndo & { shownAt: number };

/** Each typed listing-copy reply keeps its own previous words. */
export function holdCopyUndos(
  held: readonly HeldCopyUndo[],
  incoming: readonly CopyUndo[],
  shownAt: number,
): HeldCopyUndo[] {
  return [...held, ...incoming.map((undo) => ({ ...undo, shownAt }))];
}

/** Present before 9 seconds, gone after. A thread with no previous words has none. */
export function copyUndoControls(
  held: readonly HeldCopyUndo[],
  now: number,
): CopyUndo[] {
  return held
    .filter((undo) => now - undo.shownAt < UNDO_MS)
    .map(({ shownAt: _shownAt, ...undo }) => undo);
}

/** The listing-copy page write. Empty words clear the field. The control stays until the write lands. */
export function copyUndoWrite(
  held: readonly HeldCopyUndo[],
  replyIndex: number,
  now: number,
): { productId: number; body: Partial<Record<CopyField, string | string[] | null>> } | null {
  const undo = held.find(
    (item) => item.replyIndex === replyIndex && now - item.shownAt < UNDO_MS,
  );
  if (!undo) return null;
  const body: Partial<Record<CopyField, string | string[] | null>> = {};
  for (const key of COPY_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(undo, key)) continue;
    const words = undo[key];
    if (words === undefined) continue;
    if (key === "tags") {
      const tags = words
        .split(",")
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
      body.tags = tags.length === 0 ? null : tags;
      continue;
    }
    body[key] = words === "" ? null : words;
  }
  return { productId: undo.productId, body };
}

/** The write-back landed. That reply's control is gone. A failed write does not call this. */
export function landCopyUndo(
  held: readonly HeldCopyUndo[],
  replyIndex: number,
): HeldCopyUndo[] {
  return held.filter((item) => item.replyIndex !== replyIndex);
}

export type FactsUndo = {
  replyIndex: number;
  productId: number;
  facts: Record<string, unknown>;
};

export type HeldFactsUndo = FactsUndo & { shownAt: number };

/** Each facts reply keeps its own previous pack. A later reply does not clear an earlier one. */
export function holdFactsUndos(
  held: readonly HeldFactsUndo[],
  incoming: readonly FactsUndo[],
  shownAt: number,
): HeldFactsUndo[] {
  return [...held, ...incoming.map((undo) => ({ ...undo, shownAt }))];
}

/** Present before 9 seconds, gone after. A thread with no previous pack has none. */
export function factsUndoControls(
  held: readonly HeldFactsUndo[],
  now: number,
): FactsUndo[] {
  return held
    .filter((undo) => now - undo.shownAt < UNDO_MS)
    .map(({ replyIndex, productId, facts }) => ({ replyIndex, productId, facts }));
}

/** The page's confirm. Stale listing copy follows that confirm. The control stays until it lands. */
export function factsUndoWrite(
  held: readonly HeldFactsUndo[],
  replyIndex: number,
  now: number,
): { productId: number; body: Record<string, unknown> } | null {
  const undo = held.find(
    (item) => item.replyIndex === replyIndex && now - item.shownAt < UNDO_MS,
  );
  if (!undo) return null;
  return { productId: undo.productId, body: undo.facts };
}

/** The write-back landed. That reply's control is gone. A failed write does not call this. */
export function landFactsUndo(
  held: readonly HeldFactsUndo[],
  replyIndex: number,
): HeldFactsUndo[] {
  return held.filter((item) => item.replyIndex !== replyIndex);
}

const SELLING_FIELDS = ["price", "compareAtPrice", "costPerItem", "sku", "barcode"] as const;

export type SellingField = (typeof SELLING_FIELDS)[number];

export type SellingUndo = {
  replyIndex: number;
  productId: number;
} & Partial<Record<SellingField, string>>;

export type HeldSellingUndo = SellingUndo & { shownAt: number };

/** Each Selling reply keeps its own previous fields. A later reply does not clear an earlier one. */
export function holdSellingUndos(
  held: readonly HeldSellingUndo[],
  incoming: readonly SellingUndo[],
  shownAt: number,
): HeldSellingUndo[] {
  return [...held, ...incoming.map((undo) => ({ ...undo, shownAt }))];
}

/** Present before 9 seconds, gone after. A thread with no previous Selling has none. */
export function sellingUndoControls(
  held: readonly HeldSellingUndo[],
  now: number,
): SellingUndo[] {
  return held
    .filter((undo) => now - undo.shownAt < UNDO_MS)
    .map(({ shownAt: _shownAt, ...undo }) => undo);
}

/** The product page write. An empty previous field clears. The control stays until the write lands. */
export function sellingUndoWrite(
  held: readonly HeldSellingUndo[],
  replyIndex: number,
  now: number,
): { productId: number; body: Partial<Record<SellingField, string | null>> } | null {
  const undo = held.find(
    (item) => item.replyIndex === replyIndex && now - item.shownAt < UNDO_MS,
  );
  if (!undo) return null;
  const body: Partial<Record<SellingField, string | null>> = {};
  for (const key of SELLING_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(undo, key)) continue;
    const value = undo[key];
    if (value === undefined) continue;
    body[key] = value === "" ? null : value;
  }
  return { productId: undo.productId, body };
}

/** The write-back landed. That reply's control is gone. A failed write does not call this. */
export function landSellingUndo(
  held: readonly HeldSellingUndo[],
  replyIndex: number,
): HeldSellingUndo[] {
  return held.filter((item) => item.replyIndex !== replyIndex);
}

export type PublicationsUndo = {
  replyIndex: number;
  productId: number;
  publicationIds: string[];
};

export type HeldPublicationsUndo = PublicationsUndo & { shownAt: number };

/** Each publications reply keeps its own previous set. A later reply does not clear an earlier one. */
export function holdPublicationsUndos(
  held: readonly HeldPublicationsUndo[],
  incoming: readonly PublicationsUndo[],
  shownAt: number,
): HeldPublicationsUndo[] {
  return [...held, ...incoming.map((undo) => ({ ...undo, shownAt }))];
}

/** Present before 9 seconds, gone after. A thread with no previous set has none. */
export function publicationsUndoControls(
  held: readonly HeldPublicationsUndo[],
  now: number,
): PublicationsUndo[] {
  return held
    .filter((undo) => now - undo.shownAt < UNDO_MS)
    .map(({ shownAt: _shownAt, ...undo }) => undo);
}

/** The product page write. An empty previous set clears. The control stays until the write lands. */
export function publicationsUndoWrite(
  held: readonly HeldPublicationsUndo[],
  replyIndex: number,
  now: number,
): { productId: number; body: { shopifyPublicationIds: string[] } } | null {
  const undo = held.find(
    (item) => item.replyIndex === replyIndex && now - item.shownAt < UNDO_MS,
  );
  if (!undo) return null;
  return { productId: undo.productId, body: { shopifyPublicationIds: [...undo.publicationIds] } };
}

/** The write-back landed. That reply's control is gone. A failed write does not call this. */
export function landPublicationsUndo(
  held: readonly HeldPublicationsUndo[],
  replyIndex: number,
): HeldPublicationsUndo[] {
  return held.filter((item) => item.replyIndex !== replyIndex);
}

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

export type GpsrUndo = {
  replyIndex: number;
  identity?: GpsrIdentity | null;
};

export type HeldGpsrUndo = GpsrUndo & { shownAt: number };

/** Each Shop GPSR reply keeps its own previous identity. A later reply does not clear an earlier one. */
export function holdGpsrUndos(
  held: readonly HeldGpsrUndo[],
  incoming: readonly GpsrUndo[],
  shownAt: number,
): HeldGpsrUndo[] {
  return [...held, ...incoming.map((undo) => ({ ...undo, shownAt }))];
}

/** Present before 9 seconds, gone after. A thread with no previous identity has none. */
export function gpsrUndoControls(
  held: readonly HeldGpsrUndo[],
  now: number,
): GpsrUndo[] {
  return held
    .filter((undo) => now - undo.shownAt < UNDO_MS)
    .map(({ shownAt: _shownAt, ...undo }) => undo);
}

/** The Settings write. A missing identity clears. The control stays until the write lands. */
export function gpsrUndoWrite(
  held: readonly HeldGpsrUndo[],
  replyIndex: number,
  now: number,
): { body: GpsrIdentity | null } | null {
  const undo = held.find(
    (item) => item.replyIndex === replyIndex && now - item.shownAt < UNDO_MS,
  );
  if (!undo) return null;
  return { body: undo.identity ?? null };
}

/** The write-back landed. That reply's control is gone. A failed write does not call this. */
export function landGpsrUndo(
  held: readonly HeldGpsrUndo[],
  replyIndex: number,
): HeldGpsrUndo[] {
  return held.filter((item) => item.replyIndex !== replyIndex);
}

/** The Import page's in-progress line. The card keeps reading until that run's result is stored. */
export function importRunning(thread: { role: string; text: string }[]): boolean {
  let waiting = false;
  for (const turn of thread) {
    if (turn.role !== "chat") continue;
    if (turn.text === "Import is in progress.") waiting = true;
    else if (turn.text.startsWith("Created ") || turn.text === "Could not list Channel products") {
      waiting = false;
    }
  }
  return waiting;
}
