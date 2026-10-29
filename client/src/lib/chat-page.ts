import { api, buildUrl } from "./api-routes";
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

export const UNDO_MS = 9_000;

const SELLING_FIELDS = ["price", "compareAtPrice", "costPerItem", "sku", "barcode"] as const;
const COPY_FIELDS = ["title", "description", "tags", "seoTitle", "seoDescription", "aeoSnippet"] as const;
const CATALOGUE = ["/api/images", "/api/images/group"];

export type UndoKind = "inventory" | "selling" | "copy" | "facts" | "publications" | "gpsr";

export type Undo = {
  replyIndex: number;
  kind: UndoKind;
  itemId?: number;
  quantity?: number;
  productId?: number;
  price?: string;
  compareAtPrice?: string;
  costPerItem?: string;
  sku?: string;
  barcode?: string;
  title?: string;
  description?: string;
  tags?: string;
  seoTitle?: string;
  seoDescription?: string;
  aeoSnippet?: string;
  facts?: Record<string, unknown>;
  publicationIds?: string[];
  identity?: {
    manufacturer: { name: string; postalAddress: string; email: string };
    manufacturerInEu: boolean;
    euResponsiblePerson?: { name: string; postalAddress: string; email: string } | null;
  } | null;
};

export type HeldUndo = Undo & { shownAt: number };

export type UndoRequest = {
  method: "POST" | "PUT";
  path: string;
  body: unknown;
  refresh: string[];
};

/** Each reply keeps its own previous value. A later reply does not clear an earlier one. */
export function holdUndos(
  held: readonly HeldUndo[],
  incoming: readonly Undo[],
  shownAt: number,
): HeldUndo[] {
  return [...held, ...incoming.map((undo) => ({ ...undo, shownAt }))];
}

/** Present before 9 seconds, gone after. */
export function undoControls(held: readonly HeldUndo[], now: number): Undo[] {
  return held
    .filter((undo) => now - undo.shownAt < UNDO_MS)
    .map(({ shownAt: _shownAt, ...undo }) => undo);
}

/** The page write for that reply. The control stays until the write lands. */
export function undoWrite(
  held: readonly HeldUndo[],
  replyIndex: number,
  now: number,
): UndoRequest | null {
  const undo = held.find(
    (item) => item.replyIndex === replyIndex && now - item.shownAt < UNDO_MS,
  );
  if (!undo) return null;
  if (undo.kind === "inventory") {
    if (undo.itemId === undefined || undo.quantity === undefined) return null;
    return {
      method: "POST",
      path: `/api/inventory/items/${undo.itemId}/adjustments`,
      body: { mode: "set", quantity: undo.quantity, reason: "Undo" },
      refresh: ["/api/inventory/overview", "/api/inventory/items"],
    };
  }
  if (undo.productId === undefined && undo.kind !== "gpsr") return null;
  if (undo.kind === "selling") {
    return {
      method: "PUT",
      path: buildUrl(api.images.update.path, { id: undo.productId! }),
      body: cleared(undo, SELLING_FIELDS),
      refresh: [...CATALOGUE],
    };
  }
  if (undo.kind === "copy") {
    return {
      method: "PUT",
      path: buildUrl(api.images.update.path, { id: undo.productId! }),
      body: copyBody(undo),
      refresh: [...CATALOGUE],
    };
  }
  if (undo.kind === "facts") {
    return {
      method: "POST",
      path: buildUrl(api.images.confirmProductFacts.path, { id: undo.productId! }),
      body: undo.facts ?? {},
      refresh: [...CATALOGUE],
    };
  }
  if (undo.kind === "publications") {
    return {
      method: "PUT",
      path: buildUrl(api.images.update.path, { id: undo.productId! }),
      body: { shopifyPublicationIds: [...(undo.publicationIds ?? [])] },
      refresh: [...CATALOGUE],
    };
  }
  return {
    method: "PUT",
    path: api.shopify.gpsrIdentity.path,
    body: undo.identity ?? null,
    refresh: [api.shopify.status.path, ...CATALOGUE],
  };
}

/** The write-back landed. That reply's control is gone. A failed write does not call this. */
export function landUndo(held: readonly HeldUndo[], replyIndex: number): HeldUndo[] {
  return held.filter((item) => item.replyIndex !== replyIndex);
}

function cleared(
  undo: Undo,
  keys: readonly string[],
): Record<string, string | null> {
  const body: Record<string, string | null> = {};
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(undo, key)) continue;
    const value = undo[key as keyof Undo];
    if (typeof value !== "string") continue;
    body[key] = value === "" ? null : value;
  }
  return body;
}

function copyBody(undo: Undo): Record<string, string | string[] | null> {
  const body: Record<string, string | string[] | null> = {};
  for (const key of COPY_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(undo, key)) continue;
    const words = undo[key];
    if (typeof words !== "string") continue;
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
  return body;
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
