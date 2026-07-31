import { X } from "lucide-react";
import { shortSearchAreaLabel } from "@/lib/matrundan/search-areas";
import type { SearchArea } from "@/lib/matrundan/types";

export function SearchAreaPill({
  area,
  onRemove,
  removeAriaLabel,
}: {
  area: Pick<SearchArea, "label">;
  onRemove: () => void;
  removeAriaLabel: string;
}) {
  return (
    <div
      role="listitem"
      className="flex min-h-11 max-w-full items-center gap-1 rounded-full border border-primary/40 bg-primary/10 pl-3 pr-1 text-sm"
      title={area.label}
    >
      <span className="min-w-0 break-words">{shortSearchAreaLabel(area.label)}</span>
      <button
        type="button"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-background/70"
        onClick={onRemove}
        aria-label={removeAriaLabel}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
