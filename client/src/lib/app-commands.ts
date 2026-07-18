/**
 * Tiny event bus connecting the app shell (command palette, glass dock)
 * to page-owned dialogs and actions without prop drilling.
 */
export type AppCommand =
  | "upload"
  | "review-queue"
  | "export-json"
  | "connect-shopify"
  | "connect-etsy"
  | "connect-amazon"
  | "connect-instagram"
  | "subscribe"
  | "cancel-subscription"
  | "open-palette";

const EVENT_NAME = "snapsync:command";

export function dispatchAppCommand(command: AppCommand) {
  window.dispatchEvent(new CustomEvent<AppCommand>(EVENT_NAME, { detail: command }));
}

export function onAppCommand(handler: (command: AppCommand) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<AppCommand>).detail);
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}
