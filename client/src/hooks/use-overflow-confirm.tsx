import { useRef, useState } from "react";
import { OverflowConfirmDialog } from "@/components/overflow-confirm-dialog";
import { usePaymentConfig, useSubscriptionStatus } from "@/hooks/use-images";
import { isOverflowConfirmError } from "@/lib/overflow-copy";

export function useOverflowConfirm() {
  const { data: status } = useSubscriptionStatus();
  const { data: config } = usePaymentConfig();
  const [open, setOpen] = useState(false);
  const resume = useRef<((confirmOverflow: boolean) => void) | null>(null);
  const overagePence = config?.overagePence ?? 70;

  function run(action: (confirmOverflow: boolean) => void) {
    if (status?.overflowConfirmRequired) {
      resume.current = action;
      setOpen(true);
      return;
    }
    action(false);
  }

  function retryIfConfirmRequired(
    message: string,
    action: (confirmOverflow: boolean) => void,
  ): boolean {
    if (!isOverflowConfirmError(message)) return false;
    resume.current = action;
    setOpen(true);
    return true;
  }

  function cancel() {
    resume.current = null;
    setOpen(false);
  }

  function continueOverflow() {
    const action = resume.current;
    resume.current = null;
    setOpen(false);
    action?.(true);
  }

  return {
    overflowNotice: status?.overflowNotice === true,
    overagePence,
    run,
    retryIfConfirmRequired,
    dialog: (
      <OverflowConfirmDialog
        open={open}
        overagePence={overagePence}
        onCancel={cancel}
        onContinue={continueOverflow}
      />
    ),
  };
}
