import * as React from "react";
import { AboutContent } from "@/components/matrundan/AboutContent";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { APP_NAME, APP_VERSION, APP_VERSION_DATE } from "@/lib/matrundan/version";

/**
 * Publik dialog för Om Matrundan. Det faktiska innehållet delas med
 * inställningssidan genom AboutContent.
 */
export function AboutDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-secondary text-2xl">
              🍽️
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="font-display text-2xl">Om {APP_NAME}</DialogTitle>
              <DialogDescription>
                {APP_NAME} {APP_VERSION} · {APP_VERSION_DATE}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <AboutContent />
      </DialogContent>
    </Dialog>
  );
}
