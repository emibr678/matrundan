import { ArrowRight, MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PlaceMapItem } from "./PlaceMap";

interface ExamplePlaceMapProps {
  items: PlaceMapItem[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onAction?: (item: PlaceMapItem) => void;
  actionLabel?: string;
  className?: string;
  emptyText?: string;
  ariaLabel?: string;
}

function position(value: number, min: number, max: number): number {
  if (max <= min) return 50;
  return 8 + ((value - min) / (max - min)) * 84;
}

export function ExamplePlaceMap({
  items,
  selectedId,
  onSelect,
  onAction,
  actionLabel = "Visa ställe",
  className,
  emptyText = "Inga exempelställen med kartposition i den här vyn.",
  ariaLabel = "Demokarta över fiktiva matställen",
}: ExamplePlaceMapProps) {
  const mappedItems = items.filter((item) => item.lat != null && item.lng != null);
  if (mappedItems.length === 0) {
    return (
      <div
        className={`rounded-2xl border border-dashed border-border bg-card/60 p-8 text-center text-sm text-muted-foreground ${className ?? ""}`}
      >
        {emptyText}
      </div>
    );
  }

  const selected = mappedItems.find((item) => item.id === selectedId) ?? mappedItems[0];
  const latitudes = mappedItems.map((item) => item.lat!);
  const longitudes = mappedItems.map((item) => item.lng!);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-map-renderer="example-static"
      className={`relative min-h-[420px] overflow-hidden rounded-2xl border border-border/70 bg-secondary/50 ${className ?? ""}`}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] bg-[size:48px_48px] opacity-45"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-[8%] top-[18%] h-8 -rotate-6 rounded-full border-y border-primary/20 bg-primary/10"
      />
      <div
        aria-hidden="true"
        className="absolute bottom-[18%] left-[12%] right-[8%] h-12 rotate-3 rounded-full border-y border-sage/40 bg-sage/25"
      />

      <div className="pointer-events-none absolute left-3 top-3 z-20 max-w-[calc(100%-1.5rem)] rounded-xl border border-border/70 bg-background/95 px-3 py-2 text-xs leading-relaxed text-muted-foreground shadow-sm">
        Exempelgruppen använder fiktiva ställen. I riktiga grupper visas den vanliga kartbakgrunden
        här.
      </div>

      {mappedItems.map((item) => {
        const active = item.id === selected.id;
        const left = position(item.lng!, minLng, maxLng);
        const top = 100 - position(item.lat!, minLat, maxLat);
        return (
          <button
            key={item.id}
            type="button"
            aria-label={`Visa ${item.name} på demokartan`}
            aria-pressed={active}
            onClick={() => onSelect?.(item.id)}
            className={`absolute z-10 grid min-h-11 min-w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 bg-background text-xl shadow-md transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              active ? "scale-110 border-primary" : "border-background hover:scale-105"
            }`}
            style={{ left: `${left}%`, top: `${top}%` }}
          >
            <span aria-hidden>{item.markerLabel ?? "🍽️"}</span>
          </button>
        );
      })}

      <div className="absolute inset-x-3 bottom-3 z-20 rounded-2xl border border-border/70 bg-background/95 p-3 shadow-lg">
        <div className="flex min-w-0 items-center gap-3">
          <MapPin className="h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            {selected.eyebrow ? (
              <div className="truncate text-[11px] font-medium text-primary">
                {selected.eyebrow}
              </div>
            ) : null}
            <div className="truncate font-medium">{selected.name}</div>
            {selected.description ? (
              <div className="truncate text-xs text-muted-foreground">{selected.description}</div>
            ) : null}
          </div>
          {onAction ? (
            <Button
              type="button"
              size="sm"
              className="min-h-11 shrink-0"
              onClick={() => onAction(selected)}
            >
              {actionLabel}
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
