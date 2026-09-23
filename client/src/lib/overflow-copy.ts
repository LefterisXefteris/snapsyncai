export const NEED_OVERFLOW_CONFIRM = "overflow_confirm_required";

export function overflowPounds(overagePence: number): string {
  return (overagePence / 100).toFixed(2);
}

export function overflowConfirmBody(overagePence: number): string {
  return `This write is an extra Allowance use. £${overflowPounds(overagePence)} on this month's Plan invoice.`;
}

export function overflowNoticeText(overagePence: number): string {
  return `The next write that lands is an extra Allowance use at £${overflowPounds(overagePence)} on this month's Plan invoice.`;
}

export function showGenerateOverflowNotice(
  overflowNotice: boolean,
  listingCopyStale: boolean | undefined,
): boolean {
  return overflowNotice && listingCopyStale !== true;
}

export function isOverflowConfirmError(message: string): boolean {
  return message.includes(NEED_OVERFLOW_CONFIRM);
}
