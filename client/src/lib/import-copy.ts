export const IMPORT_IDLE =
  "Start Import to add Channel products that are not already in the catalogue.";

export function importStartEnabled(args: {
  startBlockedReason: string | null;
  inProgress: boolean;
}): boolean {
  return args.startBlockedReason == null && !args.inProgress;
}
