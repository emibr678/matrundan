import { CircleHelp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

export function OccasionGuide({ compact = false }: { compact?: boolean }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-11 rounded-full px-2 text-xs text-muted-foreground"
          aria-label="Vad betyder Passar för?"
        >
          <CircleHelp className="h-4 w-4" />
          {compact ? null : <span>Så fungerar det</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[calc(100vw-2rem)] max-w-sm space-y-3 rounded-2xl p-4"
      >
        <div>
          <div className="font-medium">Välj efter sammanhang</div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Topplistorna beskriver inte objektiv kvalitet eller prisnivå. De hjälper gruppen att
            välja ett ställe som passar situationen. En pizzeria och en finkrog kan båda få höga
            betyg i sina sammanhang.
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
          Välj ett obligatoriskt <strong className="text-foreground">Passar bäst för</strong> och
          högst ett frivilligt <strong className="text-foreground">Passar också för</strong>.
          Topplistan utgår från det primära valet.
        </div>
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

  return (
    <div className="space-y-2">
      <div className="flex min-h-11 items-center justify-between gap-2">
        <Label id={`${id}-label`}>Passar för</Label>
        <OccasionGuide />
      </div>
      <p id={descriptionId} className="text-xs leading-relaxed text-muted-foreground">
        Välj det sammanhang stället främst passar för. Lägg bara till ett andra när det är ett
        tydligt gränsfall.
      </p>
      <div className="space-y-2" aria-describedby={descriptionId}>
        <div>
          <div id={`${id}-primary-label`} className="mb-1.5 text-xs font-medium">
            Passar bäst för <span className="text-muted-foreground">(obligatoriskt)</span>
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
                onClick={() =>
                  onChange(
                    occasionClassification(
                      occasion,
                      secondary === occasion ? undefined : secondary,
                    ),
                  )
                }
              />
            ))}
          </div>
        </div>

        {primary ? (
          <div>
            <div id={`${id}-secondary-label`} className="mb-1.5 text-xs font-medium">
              Passar också för <span className="text-muted-foreground">(valfritt)</span>
            </div>
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-labelledby={`${id}-secondary-label`}
            >
              <button
                type="button"
                disabled={disabled}
                aria-pressed={!secondary}
                onClick={() => onChange(occasionClassification(primary))}
                className="min-h-11 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              >
                <Badge
                  variant={!secondary ? "secondary" : "outline"}
                  className="cursor-pointer rounded-full px-3 py-1 text-xs"
                >
                  Inget andra sammanhang
                </Badge>
              </button>
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
