import * as React from "react";
import { CircleHelp, Plus } from "lucide-react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  OCCASION_DESCRIPTION,
  OCCASION_LABEL,
  OCCASION_VALUES,
  type Occasion,
} from "@/lib/matrundan/types";
import {
  occasionClassification,
  primaryOccasion,
  secondaryOccasion,
} from "@/lib/matrundan/occasions";

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

function OccasionGuideContent() {
  return (
    <div className="min-w-0 space-y-3">
      <div>
        <div className="font-medium">Topplistor för olika sorters besök</div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Topplistorna beskriver inte objektiv kvalitet eller prisnivå. De hjälper gruppen att välja
          ett ställe som passar för besöket. En pizzeria och en finkrog kan båda få höga betyg – i
          olika listor.
        </p>
      </div>
      <div className="space-y-2.5">
        {OCCASION_VALUES.map((occasion) => (
          <div key={occasion}>
            <div className="text-sm font-medium">{OCCASION_LABEL[occasion]}</div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {OCCASION_DESCRIPTION[occasion]}
            </p>
          </div>
        ))}
      </div>
      <div className="border-t border-border/70 pt-3 text-xs leading-relaxed text-muted-foreground">
        Välj ett <strong className="text-foreground">Passar bäst för</strong> och högst ett
        frivilligt <strong className="text-foreground">Passar också för</strong> när gruppen vet.
        Det går bra att lämna valet tomt tills stället har upplevts. Topplistan utgår från det
        primära valet.
      </div>
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
            <DialogTitle>Så fungerar Passar för</DialogTitle>
          </DialogHeader>
          <OccasionGuideContent />
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
}: {
  id: string;
  value: Occasion[];
  onChange: (value: Occasion[]) => void;
  disabled?: boolean;
  required?: boolean;
}) {
  const descriptionId = `${id}-description`;
  const primary = primaryOccasion(value);
  const secondary = secondaryOccasion(value);
  const [showSecondary, setShowSecondary] = React.useState(Boolean(secondary));

  React.useEffect(() => {
    if (secondary) setShowSecondary(true);
    if (!primary) setShowSecondary(false);
  }, [primary, secondary]);

  return (
    <div className="space-y-2">
      <div className="flex min-h-11 items-center justify-between gap-2">
        <Label id={`${id}-label`}>Passar för</Label>
        <OccasionGuide />
      </div>
      <p id={descriptionId} className="text-xs leading-relaxed text-muted-foreground">
        {required
          ? "Välj vad stället passar bäst för. Lägg till ett alternativ till om det också passar tydligt."
          : "Välj om du redan vet – annars kan gruppen bestämma efter ett besök."}
      </p>
      <div className="space-y-2" aria-describedby={descriptionId}>
        <div>
          <div id={`${id}-primary-label`} className="mb-1.5 text-xs font-medium">
            Passar bäst för
          </div>
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-labelledby={`${id}-primary-label`}
          >
            {OCCASION_VALUES.map((occasion) => (
              <OccasionButton
                key={occasion}
                id={`${id}-primary-${occasion}`}
                occasion={occasion}
                ariaLabel={`Passar bäst för: ${OCCASION_LABEL[occasion]}`}
                selected={primary === occasion}
                disabled={disabled}
                onClick={() => {
                  if (primary === occasion) {
                    onChange([]);
                    return;
                  }
                  onChange(
                    occasionClassification(
                      occasion,
                      secondary === occasion ? undefined : secondary,
                    ),
                  );
                }}
              />
            ))}
          </div>
        </div>

        {primary && !showSecondary ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => setShowSecondary(true)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-1 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          >
            <Plus className="h-3.5 w-3.5" />
            Lägg till ett alternativ till <span className="font-normal">(valfritt)</span>
          </button>
        ) : null}

        {primary && showSecondary ? (
          <div>
            <div id={`${id}-secondary-label`} className="mb-1.5 text-xs font-medium">
              Passar också för <span className="text-muted-foreground">(valfritt)</span>
            </div>
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-labelledby={`${id}-secondary-label`}
            >
              {OCCASION_VALUES.filter((occasion) => occasion !== primary).map((occasion) => (
                <OccasionButton
                  key={occasion}
                  id={`${id}-secondary-${occasion}`}
                  occasion={occasion}
                  ariaLabel={`Passar också för: ${OCCASION_LABEL[occasion]}`}
                  selected={secondary === occasion}
                  disabled={disabled}
                  onClick={() =>
                    onChange(
                      occasionClassification(
                        primary,
                        secondary === occasion ? undefined : occasion,
                      ),
                    )
                  }
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
      {required && !primary ? (
        <p className="text-xs text-muted-foreground">
          Välj vad stället passar bäst för för att fortsätta.
        </p>
      ) : null}
    </div>
  );
}

function OccasionButton({
  id,
  occasion,
  ariaLabel,
  selected,
  disabled,
  onClick,
}: {
  id: string;
  occasion: Occasion;
  ariaLabel: string;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={ariaLabel}
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
