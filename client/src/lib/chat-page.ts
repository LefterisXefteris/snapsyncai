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

export function closeChatCard(): void {
  intakeLines = [];
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
