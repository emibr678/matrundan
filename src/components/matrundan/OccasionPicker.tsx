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
            Kategorierna beskriver vilken typ av besök stället passar för – inte hur bra det är.
            Samma ställe kan passa i flera kategorier.
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

  return (
    <div className="space-y-2">
      <div className="flex min-h-11 items-center justify-between gap-2">
        <Label id={`${id}-label`}>Passar för</Label>
        <OccasionGuide />
      </div>
      <p id={descriptionId} className="text-xs leading-relaxed text-muted-foreground">
        Välj ett eller flera sammanhang. Ställets kvalitet bedöms separat med betyget.
      </p>
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-labelledby={`${id}-label`}
        aria-describedby={descriptionId}
      >
        {OCCASION_VALUES.map((occasion) => {
          const selected = value.includes(occasion);
          return (
            <button
              key={occasion}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              aria-describedby={`${id}-${occasion}-description`}
              onClick={() =>
                onChange(
                  selected ? value.filter((item) => item !== occasion) : [...value, occasion],
                )
              }
              className="min-h-11 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            >
              <Badge
                variant={selected ? "default" : "outline"}
                className="cursor-pointer rounded-full px-3 py-1 text-xs"
              >
                {OCCASION_LABEL[occasion]}
              </Badge>
              <span id={`${id}-${occasion}-description`} className="sr-only">
                {OCCASION_DESCRIPTION[occasion]}
              </span>
            </button>
          );
        })}
      </div>
      {required && value.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Välj minst ett sammanhang för att fortsätta.
        </p>
      ) : null}
    </div>
  );
}
