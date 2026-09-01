export type ChannelPushProduct = {
  listingCopyPresent?: boolean | null;
  listingCopyStale?: boolean | null;
};

export type ChannelPushDecision =
  | { kind: "missing-copy"; count: number }
  | { kind: "stale-warning"; count: number }
  | { kind: "push" };

export function channelPushDecision(selected: ChannelPushProduct[]): ChannelPushDecision {
  const missing = selected.filter((product) => product.listingCopyPresent !== true).length;
  if (missing > 0) {
    return { kind: "missing-copy", count: missing };
  }
  const stale = selected.filter((product) => product.listingCopyStale).length;
  if (stale > 0) {
    return { kind: "stale-warning", count: stale };
  }
  return { kind: "push" };
}
