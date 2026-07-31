import * as React from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { GeoapifyLocationInput } from "./GeoapifyLocationInput";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { VerifiedHomeLocation } from "@/lib/matrundan/live-admin";
import { demoSearchAreaFromText } from "@/lib/matrundan/places-provider";
import { SEARCH_RADIUS_OPTIONS, shortSearchAreaLabel } from "@/lib/matrundan/search-areas";
import type { SearchArea, SearchRadiusKm } from "@/lib/matrundan/types";

const MAX_SEARCH_CENTERS = 5;
const SEARCH_PLACEHOLDER = "Sök ort, stadsdel eller adress";
const LIMIT_PLACEHOLDER = "Ta bort ett område för att lägga till ett nytt";

interface SearchAreaControlsProps {
  savedAreas: SearchArea[];
  selectedAreaIds: string[];
  onSelectedAreaIdsChange: (ids: string[]) => void;
  temporaryAreas: SearchArea[];
  onTemporaryAreasChange: (areas: SearchArea[]) => void;
  radiusKm: SearchRadiusKm;
  onRadiusChange: (radius: SearchRadiusKm) => void;
  isLive: boolean;
  fallbackCity: string;
}

interface SearchAreaPillProps {
  area: SearchArea;
  onRemove: () => void;
}

interface SearchAreaFieldProps {
  isLive: boolean;
  query: string;
  placeholder: string;
  disabled: boolean;
  onQueryChange: (query: string) => void;
  onSelect: (location: VerifiedHomeLocation) => void;
  onDemoSubmit: () => void;
}

interface SelectedAreasProps {
  savedAreas: SearchArea[];
  temporaryAreas: SearchArea[];
  onRemoveSaved: (areaId: string) => void;
  onRemoveTemporary: (area: SearchArea) => void;
}

function sameSearchArea(a: SearchArea, b: Pick<SearchArea, "provider" | "placeId">) {
  return a.provider === b.provider && a.placeId === b.placeId;
}

function SearchAreaPill({ area, onRemove }: SearchAreaPillProps) {
  return (
    <div
      role="listitem"
      className="flex min-h-11 max-w-full items-center gap-1 rounded-full border border-primary/40 bg-primary/10 pl-3 pr-1 text-sm"
    >
      <span className="min-w-0 break-words">{shortSearchAreaLabel(area.label)}</span>
      <button
        type="button"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-background/70"
        onClick={onRemove}
        aria-label={`Ta bort ${area.label} från sökningen`}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function SearchAreaField({
  isLive,
  query,
  placeholder,
  disabled,
  onQueryChange,
  onSelect,
  onDemoSubmit,
}: SearchAreaFieldProps) {
  if (isLive) {
    return (
      <GeoapifyLocationInput
        id="search-area-query"
        value={query}
        onChange={onQueryChange}
        onSelect={onSelect}
        placeholder={placeholder}
        disabled={disabled}
      />
    );
  }

  return (
    <Input
      id="search-area-query"
      value={query}
      onChange={(event) => onQueryChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter" && query.trim()) {
          event.preventDefault();
          onDemoSubmit();
        }
      }}
      placeholder={placeholder}
      disabled={disabled}
    />
  );
}

function SelectedAreas({
  savedAreas,
  temporaryAreas,
  onRemoveSaved,
  onRemoveTemporary,
}: SelectedAreasProps) {
  if (savedAreas.length === 0 && temporaryAreas.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border/70 px-3 py-3 text-sm text-muted-foreground">
        Sök och välj minst en plats att utgå från.
      </p>
    );
  }

  return (
    <div
      className="flex min-w-0 flex-wrap gap-2"
      role="list"
      aria-label="Valda sökområden"
    >
      {savedAreas.map((area) => (
        <SearchAreaPill
          key={area.id}
          area={area}
          onRemove={() => onRemoveSaved(area.id)}
        />
      ))}
      {temporaryAreas.map((area) => (
        <SearchAreaPill
          key={`${area.provider}:${area.placeId}`}
          area={area}
          onRemove={() => onRemoveTemporary(area)}
        />
      ))}
    </div>
  );
}

function SearchRadiusSelect({
  radiusKm,
  onRadiusChange,
}: {
  radiusKm: SearchRadiusKm;
  onRadiusChange: (radius: SearchRadiusKm) => void;
}) {
  return (
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
  );
}

export function SearchAreaControlsV16({
  savedAreas,
  selectedAreaIds,
  onSelectedAreaIdsChange,
  temporaryAreas,
  onTemporaryAreasChange,
  radiusKm,
  onRadiusChange,
  isLive,
  fallbackCity,
}: SearchAreaControlsProps) {
  const [areaQuery, setAreaQuery] = React.useState("");
  const selectedSavedAreas = savedAreas.filter((area) => selectedAreaIds.includes(area.id));
  const activeAreas = [...selectedSavedAreas, ...temporaryAreas];
  const atLimit = activeAreas.length >= MAX_SEARCH_CENTERS;
  const placeholder = atLimit ? LIMIT_PLACEHOLDER : SEARCH_PLACEHOLDER;

  function addArea(area: SearchArea) {
    if (activeAreas.some((current) => sameSearchArea(current, area))) {
      toast.message("Platsen är redan vald.");
      setAreaQuery("");
      return;
    }
    if (atLimit) {
      toast.error("Du kan söka i högst fem områden samtidigt.");
      return;
    }

    const savedMatch = savedAreas.find((saved) => sameSearchArea(saved, area));
    if (savedMatch) {
      onSelectedAreaIdsChange([...selectedAreaIds, savedMatch.id]);
    } else {
      onTemporaryAreasChange([...temporaryAreas, area]);
    }
    setAreaQuery("");
  }

  function addVerifiedArea(value: VerifiedHomeLocation) {
    addArea({
      id: `temporary-${value.placeId}`,
      label: value.label,
      lat: value.lat,
      lng: value.lng,
      provider: value.provider,
      placeId: value.placeId,
    });
  }

  function addDemoArea() {
    const area = demoSearchAreaFromText(areaQuery, fallbackCity);
    if (!area) {
      toast.error("Ange en ort, stadsdel eller adress.");
      return;
    }
    addArea(area);
  }

  function removeSavedArea(areaId: string) {
    onSelectedAreaIdsChange(selectedAreaIds.filter((id) => id !== areaId));
  }

  function removeTemporaryArea(area: SearchArea) {
    const remainingAreas = temporaryAreas.filter((candidate) => !sameSearchArea(candidate, area));
    onTemporaryAreasChange(remainingAreas);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="search-area-query">Sökområden</Label>
        <SearchAreaField
          isLive={isLive}
          query={areaQuery}
          placeholder={placeholder}
          disabled={atLimit}
          onQueryChange={setAreaQuery}
          onSelect={addVerifiedArea}
          onDemoSubmit={addDemoArea}
        />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Välj en träff så läggs den till nedan. Valen gäller bara den här sökningen.
        </p>
        <SelectedAreas
          savedAreas={selectedSavedAreas}
          temporaryAreas={temporaryAreas}
          onRemoveSaved={removeSavedArea}
          onRemoveTemporary={removeTemporaryArea}
        />
        {atLimit ? (
          <p className="text-xs text-muted-foreground">
            Högst fem områden kan användas samtidigt. Ta bort ett för att välja ett annat.
          </p>
        ) : null}
      </div>
      <SearchRadiusSelect radiusKm={radiusKm} onRadiusChange={onRadiusChange} />
    </div>
  );
}
