import * as React from "react";
import { CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";

export function ReviewContextGuideContent({
  showHeading = true,
}: {
  showHeading?: boolean;
}) {
  return (
    <div className="space-y-2">
      {showHeading ? (
        <div className="font-medium">Olika matupplevelser, olika betyg</div>
      ) : null}
      <p className="text-xs leading-relaxed text-muted-foreground">
        Ett enkelt gatukök och en finkrog är olika slags matupplevelser. Båda
        kan få lika höga betyg – fast av olika skäl.
      </p>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Typ av upplevelse visar om matstället är Snabbt & enkelt, Avslappnat
        eller Något extra.
      </p>
    </div>
  );
}

const ReviewContextTrigger = React.forwardRef<
  React.ElementRef<typeof Button>,
  React.ComponentPropsWithoutRef<typeof Button>
>((props, ref) => (
  <Button
    ref={ref}
    {...props}
    type="button"
    variant="ghost"
    size="sm"
    className="h-auto min-h-9 rounded-full px-2 py-1 text-xs text-muted-foreground"
    aria-label="Hur hänger typ av upplevelse och betyg ihop?"
  >
    <CircleHelp className="h-3.5 w-3.5" />
    Om betygen
  </Button>
));
ReviewContextTrigger.displayName = "ReviewContextTrigger";

export function ReviewContextHelp() {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <ReviewContextTrigger />
        </DialogTrigger>
        <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-sm">
          <DialogHeader className="pr-8 text-left">
            <DialogTitle>Typ av upplevelse och betyg</DialogTitle>
          </DialogHeader>
          <ReviewContextGuideContent showHeading={false} />
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" className="min-h-11 w-full">
                Stäng
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <ReviewContextTrigger />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[calc(100vw-2rem)] max-w-sm rounded-2xl p-4"
      >
        <ReviewContextGuideContent />
      </PopoverContent>
    </Popover>
  );
}
