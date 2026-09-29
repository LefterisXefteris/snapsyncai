export const SIDEBAR_WIDE_MIN_WIDTH = 1024;

export function sidebarStartsOpen({
  saved,
  viewportWidth,
}: {
  saved: boolean | null;
  viewportWidth: number;
}): boolean {
  return saved ?? viewportWidth >= SIDEBAR_WIDE_MIN_WIDTH;
}
