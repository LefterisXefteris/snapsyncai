import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { overflowConfirmBody } from "@/lib/overflow-copy";

export function OverflowConfirmDialog({
  open,
  overagePence,
  onCancel,
  onContinue,
}: {
  open: boolean;
  overagePence: number;
  onCancel: () => void;
  onContinue: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onCancel(); }}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-overflow-confirm">
        <DialogHeader>
          <DialogTitle>Extra Allowance use</DialogTitle>
          <DialogDescription>{overflowConfirmBody(overagePence)}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} data-testid="button-overflow-cancel">
            Cancel
          </Button>
          <Button onClick={onContinue} data-testid="button-overflow-continue">
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
