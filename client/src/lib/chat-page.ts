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
