import * as React from "react";
import { Check, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { GeoapifyLocationInput } from "./GeoapifyLocationInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { demoSearchAreaFromText } from "@/lib/matrundan/places-provider";
import { SEARCH_RADIUS_OPTIONS, shortSearchAreaLabel } from "@/lib/matrundan/search-areas";
import type { SearchArea, SearchRadiusKm } from "@/lib/matrundan/types";

const MAX_SEARCH_CENTERS = 5;

export function SearchAreaControlsV16({
  savedAreas,
  selectedAreaIds,
  onSelectedAreaIdsChange,
  temporaryArea,
  onTemporaryAreaChange,
  radiusKm,
  onRadiusChange,
  isLive,
  fallbackCity,
}: {
  savedAreas: SearchArea[];
  selectedAreaIds: string[];
  onSelectedAreaIdsChange: (ids: string[]) => void;
  temporaryArea: SearchArea | null;
  onTemporaryAreaChange: (area: SearchArea | null) => void;
  radiusKm: SearchRadiusKm;
  onRadiusChange: (radius: SearchRadiusKm) => void;
  isLive: boolean;
  fallbackCity: string;
}) {
  const [showOtherLocation, setShowOtherLocation] = React.useState(savedAreas.length === 0);
  const [otherLocationText, setOtherLocationText] = React.useState("");
  const [candidate, setCandidate] = React.useState<SearchArea | null>(null);
  const selectedCount = savedAreas.filter((area) => selectedAreaIds.includes(area.id)).length;
  const activeCount = selectedCount + (temporaryArea ? 1 : 0);

  React.useEffect(() => {
    if (savedAreas.length === 0 && !temporaryArea) setShowOtherLocation(true);
  }, [savedAreas.length, temporaryArea]);

  function toggleArea(areaId: string) {
    onSelectedAreaIdsChange(
      selectedAreaIds.includes(areaId)
        ? selectedAreaIds.filter((id) => id !== areaId)
        : [...selectedAreaIds, areaId],
    );
  }

  function useOtherLocation() {
    if (isLive) {
      if (!candidate || otherLocationText.trim() !== candidate.label.trim()) {
        toast.error("Välj platsen från listan.");
        return;
      }
      onTemporaryAreaChange(candidate);
    } else {
      const area = demoSearchAreaFromText(otherLocationText, fallbackCity);
      if (!area) {
        toast.error("Ange ett område eller en stad.");
        return;
      }
      onTemporaryAreaChange(area);
    }
    setOtherLocationText("");
    setCandidate(null);
    setShowOtherLocation(false);
  }

  return (
    <div className="space-y-3">
      <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
        <div className="min-w-0 space-y-2">
          <Label>Sökområden</Label>
          <div className="flex min-w-0 flex-wrap gap-2" role="group" aria-label="Välj sökområden">
            {savedAreas.map((area) => {
              const selected = selectedAreaIds.includes(area.id);
              return (
                <button
                  key={area.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleArea(area.id)}
                  className={`flex min-h-11 max-w-full items-center gap-1.5 rounded-full border px-3 py-2 text-left text-sm transition-colors ${
                    selected
                      ? "border-primary/40 bg-primary/10 text-foreground"
                      : "border-border bg-background text-muted-foreground"
                  }`}
                >
                  {selected ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
                  <span className="min-w-0 break-words">{shortSearchAreaLabel(area.label)}</span>
                </button>
              );
            })}
            {temporaryArea ? (
              <div className="flex min-h-11 max-w-full items-center gap-1 rounded-full border border-primary/40 bg-primary/10 pl-3 pr-1 text-sm">
                <Check className="h-4 w-4 shrink-0 text-primary" />
                <span className="min-w-0 break-words">
                  {shortSearchAreaLabel(temporaryArea.label)}
                </span>
                <button
                  type="button"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-background/70"
                  onClick={() => onTemporaryAreaChange(null)}
                  aria-label={`Ta bort ${temporaryArea.label} från sökningen`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : null}
            {!temporaryArea ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-11 rounded-full"
                onClick={() => setShowOtherLocation((current) => !current)}
                disabled={activeCount >= MAX_SEARCH_CENTERS}
              >
                <Plus className="h-4 w-4" /> Annan plats
              </Button>
            ) : null}
          </div>
          {activeCount >= MAX_SEARCH_CENTERS && !temporaryArea ? (
            <p className="text-xs text-muted-foreground">
              Avmarkera ett område för att söka på en annan plats samtidigt.
            </p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="place-radius">Sökradie</Label>
          <Select
            value={String(radiusKm)}
            onValueChange={(value) => onRadiusChange(Number(value) as SearchRadiusKm)}
          >
            <SelectTrigger id="place-radius" className="min-h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SEARCH_RADIUS_OPTIONS.map((value) => (
                <SelectItem key={value} value={String(value)}>
                  {value === 50 ? "Större område · inom 50 km" : `Inom ${value} km`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {showOtherLocation && !temporaryArea ? (
        <div className="space-y-2 rounded-xl border border-border/70 bg-muted/20 p-3">
          <Label htmlFor="temporary-area">Annan plats för den här sökningen</Label>
          {isLive ? (
            <GeoapifyLocationInput
              id="temporary-area"
              value={otherLocationText}
              onChange={(text) => {
                setOtherLocationText(text);
                if (candidate && text !== candidate.label) setCandidate(null);
              }}
              onSelect={(value) => {
                setOtherLocationText(value.label);
                setCandidate({
                  id: `temporary-${value.placeId}`,
                  label: value.label,
                  lat: value.lat,
                  lng: value.lng,
                  provider: "geoapify",
                  placeId: value.placeId,
                });
              }}
              onClearVerified={() => setCandidate(null)}
              placeholder="Sök stad eller område"
            />
          ) : (
            <Input
              id="temporary-area"
              value={otherLocationText}
              onChange={(event) => setOtherLocationText(event.target.value)}
              placeholder="t.ex. Majorna, Göteborg"
            />
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              className="min-h-11"
              onClick={() => {
                setShowOtherLocation(false);
                setOtherLocationText("");
                setCandidate(null);
              }}
            >
              Avbryt
            </Button>
            <Button
              type="button"
              className="min-h-11"
              onClick={useOtherLocation}
              disabled={!otherLocationText.trim()}
            >
              Använd platsen
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
