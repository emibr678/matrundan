import * as React from "react";
import { CircleHelp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  normalizeOccasionClassification,
  toggleOccasionSelection,
} from "@/lib/matrundan/occasions";
import { useSession } from "@/lib/matrundan/session";
import {
  OCCASION_DESCRIPTION,
  OCCASION_LABEL,
  OCCASION_VALUES,
  type Occasion,
} from "@/lib/matrundan/types";
import { USER_GUIDANCE } from "@/lib/matrundan/user-guidance";
import { useUserGuidance } from "@/lib/matrundan/user-guidance-context";

const OccasionGuideTrigger = React.forwardRef<
  React.ElementRef<typeof Button>,
  React.ComponentPropsWithoutRef<typeof Button> & { compact: boolean }
>(({ compact, ...props }, ref) => (
  <Button
    ref={ref}
    {...props}
    type="button"
    variant="ghost"
    size="sm"
    className="min-h-11 rounded-full px-2 text-xs text-muted-foreground"
    aria-label="Vad betyder Passar för?"
  >
    <CircleHelp className="h-4 w-4" />
    {compact ? null : <span>Så fungerar det</span>}
  </Button>
));
OccasionGuideTrigger.displayName = "OccasionGuideTrigger";

export function OccasionGuideContent({
  showHeading = true,
}: {
  showHeading?: boolean;
}) {
  return (
    <div className="min-w-0 space-y-3">
      <div>
        {showHeading ? <div className="font-medium">Passar för</div> : null}
        <p
          className={`${
            showHeading ? "mt-1 " : ""
          }text-xs leading-relaxed text-muted-foreground`}
        >
          En pizzeria och en finkrog är olika slags upplevelser, men kan båda
          vara fullträffar och få lika höga betyg vid rätt tillfälle.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Passar för sätter sammanhanget och rätt förväntningar när ni bedömer
          stället. Jämför hur väl stället lyckas i sin egen typ av upplevelse –
          inte hur påkostat det är.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Valet hjälper också gruppen att filtrera ställen. Om bara{" "}
          <strong className="font-medium text-foreground">
            {OCCASION_LABEL.snabbt}
          </strong>{" "}
          är valt ingår inte Atmosfär i nya omdömen. Tidigare omdömen ändras
          inte.
        </p>
      </div>
      <div className="space-y-2.5">
        {OCCASION_VALUES.map((occasion) => (
          <div key={occasion}>
            <div className="text-sm font-medium">
              {OCCASION_LABEL[occasion]}
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {OCCASION_DESCRIPTION[occasion]}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function OccasionFirstTimeGuide({
  active = true,
}: {
  active?: boolean;
}) {
  const { mode, user } = useSession();
  const { status, isAcknowledged, isPreviewing } = useUserGuidance();
  const [visibleForUserId, setVisibleForUserId] = React.useState<string | null>(
    null,
  );
  const occasionGuideAcknowledged = isAcknowledged(USER_GUIDANCE.reviewContext);
  const occasionGuidePreviewing = isPreviewing(USER_GUIDANCE.reviewContext);

  React.useEffect(() => {
    const userId = user?.id;
    if (!active || mode !== "live" || !userId) {
      setVisibleForUserId(null);
      return;
    }
    if (
      occasionGuidePreviewing ||
      (status === "ready" && !occasionGuideAcknowledged)
    ) {
      setVisibleForUserId(userId);
    }
  }, [
    active,
    mode,
    occasionGuideAcknowledged,
    occasionGuidePreviewing,
    status,
    user?.id,
  ]);

  if (!active || mode !== "live" || !user?.id || visibleForUserId !== user.id) {
    return null;
  }

  return (
    <div className="rounded-2xl bg-secondary/40 p-3">
      <p className="text-xs leading-relaxed text-muted-foreground">
        <strong className="font-medium text-foreground">
          Bedöm stället i rätt sammanhang.
        </strong>{" "}
        En pizzeria och en finkrog är olika slags upplevelser, men båda kan vara
        fullträffar och få lika höga betyg vid rätt tillfälle.
      </p>
    </div>
  );
}

export function OccasionGuide({ compact = false }: { compact?: boolean }) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <OccasionGuideTrigger compact={compact} />
        </DialogTrigger>
        <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-sm">
          <DialogHeader className="pr-8 text-left">
            <DialogTitle>Passar för</DialogTitle>
          </DialogHeader>
          <OccasionGuideContent showHeading={false} />
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
        <OccasionGuideTrigger compact={compact} />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-sm overflow-y-auto rounded-2xl p-4"
      >
        <OccasionGuideContent />
      </PopoverContent>
    </Popover>
  );
}

export function OccasionPicker({
  id,
  value,
  onChange,
  disabled = false,
  required = false,
  description,
}: {
  id: string;
  value: Occasion[];
  onChange: (value: Occasion[]) => void;
  disabled?: boolean;
  required?: boolean;
  description?: string;
}) {
  const descriptionId = `${id}-description`;
  const selected = normalizeOccasionClassification(value);
  const atLimit = selected.length >= 2;

  function handleChange(occasion: Occasion) {
    onChange(toggleOccasionSelection(selected, occasion));
  }

  return (
    <div className="space-y-2">
      <div className="flex min-h-11 items-center justify-between gap-2">
        <Label id={`${id}-label`}>Passar för</Label>
        <OccasionGuide />
      </div>
      <p
        id={descriptionId}
        className="text-xs leading-relaxed text-muted-foreground"
      >
        {description ??
          (required ? "Välj en eller två." : "Valfritt – välj upp till två.")}
      </p>
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-labelledby={`${id}-label`}
        aria-describedby={descriptionId}
      >
        {OCCASION_VALUES.map((occasion) => {
          const isSelected = selected.includes(occasion);
          return (
            <OccasionButton
              key={occasion}
              id={`${id}-${occasion}`}
              occasion={occasion}
              selected={isSelected}
              disabled={disabled || (atLimit && !isSelected)}
              onClick={() => handleChange(occasion)}
            />
          );
        })}
      </div>
      {required && selected.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Välj minst ett alternativ för att fortsätta.
        </p>
      ) : null}
    </div>
  );
}

function OccasionButton({
  id,
  occasion,
  selected,
  disabled,
  onClick,
}: {
  id: string;
  occasion: Occasion;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={`Passar för: ${OCCASION_LABEL[occasion]}`}
      aria-pressed={selected}
      aria-describedby={`${id}-description`}
      onClick={onClick}
      className="min-h-11 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
    >
      <Badge
        variant={selected ? "default" : "outline"}
        className="cursor-pointer rounded-full px-3 py-1 text-xs"
      >
        {OCCASION_LABEL[occasion]}
      </Badge>
      <span id={`${id}-description`} className="sr-only">
        {OCCASION_DESCRIPTION[occasion]}
      </span>
    </button>
  );
}
