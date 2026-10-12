import { Map, MapPin, X } from "lucide-react";
import { searchAreaMode, shortSearchAreaLabel } from "@/lib/matrundan/search-areas";
import type { SearchArea } from "@/lib/matrundan/types";

export function SearchAreaPill({
  area,
  onRemove,
  removeAriaLabel,
}: {
  area: Pick<SearchArea, "label" | "searchMode">;
  onRemove: () => void;
  removeAriaLabel: string;
}) {
  const isBoundary = searchAreaMode(area) === "boundary";

  return (
    <div
      role="listitem"
      className="flex h-8 max-w-full items-center gap-1 rounded-full border border-primary/40 bg-primary/10 pl-2.5 pr-0.5 text-xs"
      title={area.label}
    >
      {isBoundary ? (
        <Map aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      ) : (
        <MapPin aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      )}
      <span className="min-w-0 max-w-[min(14rem,calc(100vw-6rem))] truncate whitespace-nowrap">
        {shortSearchAreaLabel(area.label)}
      </span>
      <button
        type="button"
        className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full hover:bg-background/70 after:absolute after:-inset-1.5 after:content-['']"
        onClick={onRemove}
        aria-label={removeAriaLabel}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
