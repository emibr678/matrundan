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
        <div className="font-medium">Bedöm stället i rätt sammanhang</div>
      ) : null}
      <p className="text-xs leading-relaxed text-muted-foreground">
        En pizzeria och en finkrog är olika slags upplevelser, men båda kan vara
        fullträffar och få lika höga betyg vid rätt tillfälle.
      </p>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Bedöm hur väl stället lyckas med den upplevelse och de förväntningar som
        är rimliga för den typen av ställe – inte hur påkostat det är.
      </p>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Passar för hjälper gruppen att sätta sammanhanget. Smak, service,
        prisvärdhet och ibland atmosfär bygger sedan helhetsbetyget.
      </p>
    </div>
  );
}

export function ReviewContextFirstTimeNotice() {
  return (
    <div className="rounded-2xl bg-secondary/40 p-3">
      <p className="text-xs leading-relaxed text-muted-foreground">
        <strong className="font-medium text-foreground">
          Bedöm stället i rätt sammanhang.
        </strong>{" "}
        En pizzeria och en finkrog är olika slags upplevelser, men båda kan vara
        fullträffar och få lika höga betyg vid rätt tillfälle.
      </p>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        Utgå från hur väl stället lyckas med den upplevelse du faktiskt hade –
        inte hur påkostat det är.
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
    aria-label="Varför ska stället bedömas i rätt sammanhang?"
  >
    <CircleHelp className="h-3.5 w-3.5" />
    Bedöm i rätt sammanhang
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
            <DialogTitle>Bedöm stället i rätt sammanhang</DialogTitle>
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
      <PopoverContent align="start" className="w-[calc(100vw-2rem)] max-w-sm rounded-2xl p-4">
        <ReviewContextGuideContent />
      </PopoverContent>
    </Popover>
  );
}
