import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { OverflowConfirmDialog } from "@/components/overflow-confirm-dialog";
import { usePaymentConfig, useSubscriptionStatus } from "@/hooks/use-images";
import {
  creditsNeededNotice,
  isCreditsNeededError,
  isOverflowConfirmError,
} from "@/lib/overflow-copy";
import { useToast } from "@/hooks/use-toast";

export function useOverflowConfirm() {
  const { data: status } = useSubscriptionStatus();
  const { data: config } = usePaymentConfig();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const resume = useRef<((confirmOverflow: boolean) => void) | null>(null);
  const overagePence = config?.overagePence ?? 70;
  const creditsNeeded = status?.creditsNeeded === true;

  function run(action: (confirmOverflow: boolean) => void) {
    // Do not gate here on creditsNeeded — stale regenerate Accept stays free;
    // the server refuses paid Accepts with NEED_CREDITS.
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
    if (isCreditsNeededError(message)) {
      toast({
        title: "Credits needed",
        description: message || creditsNeededNotice(),
        variant: "destructive",
      });
      setLocation("/settings");
      return true;
    }
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
    creditsNeeded,
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
