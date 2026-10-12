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
  const groupNames =
    groups.length <= 3
      ? new Intl.ListFormat("sv", { style: "long", type: "conjunction" }).format(groups)
      : `${groups.length} grupper`;
  return (
    <div
      className="min-w-0 space-y-2 rounded-xl border border-border/70 p-3 [overflow-wrap:anywhere]"
      data-testid="share-experience"
    >
      <OccasionPicker
        id={id}
        label="Typ av upplevelse"
        value={value}
        onChange={(next) => {
          onChange(next);
          if (next.length === 0) onConfirmedChange(false);
          else if (value.length === 0) onConfirmedChange(true);
        }}
        disabled={disabled}
        showGuide={false}
        description={
          value.length > 0
            ? "Ändra förslaget om du vill."
            : "Välj upp till två typer, eller lämna tomt."
        }
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
      {value.length > 0 ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Avmarkera om du vill välja senare.
        </p>
      ) : null}
    </div>
  );
}
