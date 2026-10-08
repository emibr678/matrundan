import { Checkbox } from "@/components/ui/checkbox";
import type { Occasion } from "@/lib/matrundan/types";
import { OccasionPicker } from "./OccasionPicker";

/** The visible selection is saved only when the caller submits the dialog. */
export function VisitShareExperience({
  groups,
  value,
  onChange,
  confirmed,
  onConfirmedChange,
  disabled = false,
  id,
}: {
  groups: string[];
  value: Occasion[];
  onChange: (value: Occasion[]) => void;
  confirmed: boolean;
  onConfirmedChange: (value: boolean) => void;
  disabled?: boolean;
  id: string;
}) {
  if (groups.length === 0) return null;
  const groupNames = new Intl.ListFormat("sv", { style: "long", type: "conjunction" }).format(
    groups,
  );
  return (
    <div
      className="min-w-0 space-y-2 rounded-xl border border-border/70 p-3 [overflow-wrap:anywhere]"
      data-testid="share-experience"
    >
      <OccasionPicker
        id={id}
        label="Typ av upplevelse för matstället"
        value={value}
        onChange={(next) => {
          onChange(next);
          if (next.length === 0) onConfirmedChange(false);
          else if (value.length === 0) onConfirmedChange(true);
        }}
        disabled={disabled}
        showGuide={false}
        description={`${groupNames} har inte valt någon typ ännu. ${
          value.length > 0
            ? "Här är ett förslag som du kan ändra."
            : "Du kan välja upp till två typer."
        }`}
      />
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
        <Checkbox
          checked={confirmed && value.length > 0}
          onCheckedChange={(checked) => {
            onChange([...value]);
            onConfirmedChange(checked === true);
          }}
          disabled={disabled || value.length === 0}
        />
        <span>Spara de här typerna i {groupNames}</span>
      </label>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Avmarkera om du vill välja senare.
      </p>
    </div>
  );
}
