export type ChannelPushProduct = {
  paymentStatus?: string | null;
  listingCopyStale?: boolean;
};

export type ChannelPushDecision =
  | { kind: "unpaid"; count: number }
  | { kind: "stale-warning"; count: number }
  | { kind: "push" };

export function channelPushDecision(selected: ChannelPushProduct[]): ChannelPushDecision {
  const unpaid = selected.filter((product) => product.paymentStatus !== "paid").length;
  if (unpaid > 0) {
    return { kind: "unpaid", count: unpaid };
  }
  const stale = selected.filter((product) => product.listingCopyStale).length;
  if (stale > 0) {
    return { kind: "stale-warning", count: stale };
  }
  return { kind: "push" };
}
