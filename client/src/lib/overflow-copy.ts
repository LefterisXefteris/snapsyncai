export const NEED_OVERFLOW_CONFIRM = "overflow_confirm_required";
export const NEED_CREDITS = "Buy Credits to Accept after your three free ones.";

export function overflowPounds(overagePence: number): string {
  return (overagePence / 100).toFixed(2);
}

export function overflowConfirmBody(overagePence: number): string {
  return `This AI listing-copy write is £${overflowPounds(overagePence)}. A card on file is charged when the write lands.`;
}

export function overflowNoticeText(overagePence: number): string {
  return `The next AI listing-copy write that lands is £${overflowPounds(overagePence)}.`;
}

export function creditsNeededNotice(): string {
  return "You’ve used your three free Credits. Buy a pack in Settings to Accept.";
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

export function isCreditsNeededError(message: string): boolean {
  return (
    message.includes(NEED_CREDITS) ||
    message.toLowerCase().includes("buy credits")
  );
}
