import { Checkbox } from "@/components/ui/checkbox";
import type { Occasion } from "@/lib/matrundan/types";
import { OccasionPicker } from "./OccasionPicker";

/** A suggestion remains a draft until the caller explicitly confirms it. */
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
  return (
    <div
      className="min-w-0 space-y-2 rounded-xl border border-border/70 p-3 [overflow-wrap:anywhere]"
      data-testid="share-experience"
    >
      <OccasionPicker
        id={id}
        value={value}
        onChange={(next) => {
          onChange(next);
          if (next.length === 0) onConfirmedChange(false);
        }}
        disabled={disabled}
        showGuide={false}
        description={
          value.length > 0
            ? `Förslag för ${groups.join(", ")}. Välj upp till två, eller välj senare.`
            : `Välj upp till två för ${groups.join(", ")}, eller välj senare.`
        }
      />
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
        <Checkbox
          checked={confirmed && value.length > 0}
          onCheckedChange={(checked) => onConfirmedChange(checked === true)}
          disabled={disabled || value.length === 0}
        />
        <span>Spara valet i {groups.length === 1 ? "den här gruppen" : "de här grupperna"}</span>
      </label>
    </div>
  );
}
