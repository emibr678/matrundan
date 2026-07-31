import * as React from "react";
import { Link } from "@tanstack/react-router";
import { Check, ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { matchingPlace, emojiForCategory } from "@/lib/matrundan/add-place-v16-utils";
import type { PlaceSuggestion } from "@/lib/matrundan/places-provider";
import { CATEGORY_LABEL, type Place } from "@/lib/matrundan/types";

export function SearchResultSectionsV16({
  available,
  existing,
  existingOpen,
  onExistingOpenChange,
  selectedId,
  onSelect,
  onAdd,
  places,
  disabled,
}: {
  available: PlaceSuggestion[];
  existing: PlaceSuggestion[];
  existingOpen: boolean;
  onExistingOpenChange: (open: boolean) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: (result: PlaceSuggestion) => void;
  places: Place[];
  disabled: boolean;
}) {
  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h3 className="text-sm font-medium">Ställen att lägga till</h3>
        {available.length > 0 ? (
          available.map((result) => (
            <SuggestionRowV16
              key={result.externalId}
              result={result}
              selected={selectedId === result.externalId}
              onSelect={() => onSelect(result.externalId)}
              action={
                <Button
                  size="sm"
                  className="min-h-11 w-full shrink-0 sm:w-auto"
                  disabled={disabled}
                  onClick={() => onAdd(result)}
                >
                  <Plus className="h-4 w-4" /> Lägg till
                </Button>
              }
            />
          ))
        ) : (
          <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            Inga nya ställen i den här sökningen.
          </p>
        )}
      </section>

      {existing.length > 0 ? (
        <Collapsible open={existingOpen} onOpenChange={onExistingOpenChange}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/30 px-3 py-2 text-left text-sm font-medium"
            >
              <span>Redan i gruppen ({existing.length})</span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 transition-transform ${existingOpen ? "rotate-180" : ""}`}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-2">
            {existing.map((result) => {
              const place = matchingPlace(places, result);
              return (
                <SuggestionRowV16
                  key={result.externalId}
                  result={result}
                  selected={selectedId === result.externalId}
                  onSelect={() => onSelect(result.externalId)}
                  action={
                    place ? (
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="min-h-11 w-full sm:w-auto"
                      >
                        <Link to="/matstallen/$placeId" params={{ placeId: place.id }}>
                          Öppna
                        </Link>
                      </Button>
                    ) : (
                      <span className="flex min-h-11 items-center gap-1.5 text-xs text-muted-foreground">
                        <Check className="h-4 w-4" /> Tillagd
                      </span>
                    )
                  }
                />
              );
            })}
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </div>
  );
}

function SuggestionRowV16({
  result,
  selected,
  onSelect,
  action,
}: {
  result: PlaceSuggestion;
  selected: boolean;
  onSelect: () => void;
  action: React.ReactNode;
}) {
  return (
    <div
      className={`flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:items-center ${
        selected ? "border-primary/60 bg-primary/5" : "border-border/70"
      }`}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 items-start gap-3 rounded-lg text-left focus-visible:ring-2 focus-visible:ring-ring"
        onClick={onSelect}
        aria-pressed={selected}
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-secondary text-xl">
          {emojiForCategory(result.category)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block break-words font-medium">{result.name}</span>
          <span className="block break-words text-xs text-muted-foreground">
            {CATEGORY_LABEL[result.category]}
            {result.cuisines?.length ? ` · ${result.cuisines.join(", ")}` : ""}
          </span>
          <span className="block break-words text-[11px] text-muted-foreground">
            {result.area ? `${result.area} · ` : ""}
            {result.city}
            {result.distanceKm != null
              ? ` · ~${result.distanceKm} km${
                  result.nearestAreaLabel ? ` från ${result.nearestAreaLabel}` : ""
                }`
              : ""}
          </span>
          {result.address ? (
            <span className="block break-words text-[11px] text-muted-foreground">
              {result.address}
            </span>
          ) : null}
        </span>
      </button>
      <div className="shrink-0">{action}</div>
    </div>
  );
}
