import * as React from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { GeoapifyLocationInput } from "./GeoapifyLocationInput";
import { SearchAreaPill } from "./SearchAreaPill";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { transientSearchAreaId } from "@/lib/matrundan/add-place-v16-utils";
import type { VerifiedHomeLocation } from "@/lib/matrundan/live-admin";
import { SEARCH_RADIUS_OPTIONS } from "@/lib/matrundan/search-areas";
import type { SearchArea, SearchRadiusKm } from "@/lib/matrundan/types";

const MAX_SEARCH_CENTERS = 5;
const SEARCH_PLACEHOLDER = "Sök ort, stadsdel eller adress";


interface SearchAreaControlsProps {
  heading: string;
  addAreaActionLabel: string;
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

interface SearchAreaFieldProps {
  isLive: boolean;
  query: string;
  placeholder: string;
  disabled: boolean;
  fallbackCity: string;
  onQueryChange: (query: string) => void;
  onSelect: (location: VerifiedHomeLocation) => void;
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

function SearchAreaField({
  isLive,
  query,
  placeholder,
  disabled,
  fallbackCity,
  onQueryChange,
  onSelect,
}: SearchAreaFieldProps) {
  return (
    <GeoapifyLocationInput
      id="search-area-query"
      value={query}
      onChange={onQueryChange}
      onSelect={onSelect}
      placeholder={placeholder}
      disabled={disabled}
      demoMode={!isLive}
      demoFallbackCity={fallbackCity}
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
    return <p className="text-sm text-muted-foreground">Välj minst en plats att söka runt.</p>;
  }

  return (
    <div
      className="flex min-w-0 flex-wrap gap-x-1.5 gap-y-2"
      role="list"
      aria-label="Valda sökområden"
    >
      {savedAreas.map((area) => (
        <SearchAreaPill
          key={area.id}
          area={area}
          onRemove={() => onRemoveSaved(area.id)}
          removeAriaLabel={`Ta bort ${area.label} från sökningen`}
        />
      ))}
      {temporaryAreas.map((area) => (
        <SearchAreaPill
          key={`${area.provider}:${area.placeId}`}
          area={area}
          onRemove={() => onRemoveTemporary(area)}
          removeAriaLabel={`Ta bort ${area.label} från sökningen`}
        />
      ))}
    </div>
  );
}

function InlineSearchRadius({
  radiusKm,
  onRadiusChange,
}: {
  radiusKm: SearchRadiusKm;
  onRadiusChange: (radius: SearchRadiusKm) => void;
}) {
  return (
    <Select
      value={String(radiusKm)}
      onValueChange={(value) => onRadiusChange(Number(value) as SearchRadiusKm)}
    >
      <SelectTrigger
        id="place-radius"
        aria-label="Avstånd runt adresser och platser"
        className="h-8 w-auto shrink-0 gap-1 rounded-full border-border/60 bg-muted/50 px-2.5 text-xs font-normal text-muted-foreground"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SEARCH_RADIUS_OPTIONS.map((value) => (
          <SelectItem key={value} value={String(value)}>
            {`Avstånd ${value} km`}
          </SelectItem>
        ))}
      </SelectContent>

    </Select>
  );
}

export function SearchAreaControlsV16({
  heading,
  addAreaActionLabel,
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

  React.useEffect(() => {
    if (atLimit) setAreaQuery("");
  }, [atLimit]);

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
      id: transientSearchAreaId("temporary", value.lat, value.lng),
      label: value.label,
      lat: value.lat,
      lng: value.lng,
      provider: isLive ? "geoapify" : "demo",
      placeId: value.placeId,
    });
  }

  function removeSavedArea(areaId: string) {
    onSelectedAreaIdsChange(selectedAreaIds.filter((id) => id !== areaId));
  }

  function removeTemporaryArea(area: SearchArea) {
    const remainingAreas = temporaryAreas.filter((candidate) => !sameSearchArea(candidate, area));
    onTemporaryAreasChange(remainingAreas);
  }

  return (
    <section className="space-y-2" aria-label={heading}>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{heading}</h3>
        <InlineSearchRadius radiusKm={radiusKm} onRadiusChange={onRadiusChange} />
      </div>

      {atLimit ? (
        <div
          role="status"
          className="flex min-h-10 items-center gap-2 rounded-xl border border-border/70 bg-muted/30 px-3 py-2 text-sm text-muted-foreground"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>
            <span className="font-medium text-foreground">5 av 5 områden valda.</span> Ta bort ett
            område för att söka efter ett annat.
          </span>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="search-area-query" className="sr-only">
            {addAreaActionLabel}
          </Label>
          <SearchAreaField
            isLive={isLive}
            query={areaQuery}
            placeholder={SEARCH_PLACEHOLDER}
            disabled={false}
            fallbackCity={fallbackCity}
            onQueryChange={setAreaQuery}
            onSelect={addVerifiedArea}
          />
        </div>
      )}

      <SelectedAreas
        savedAreas={selectedSavedAreas}
        temporaryAreas={temporaryAreas}
        onRemoveSaved={removeSavedArea}
        onRemoveTemporary={removeTemporaryArea}
      />

    </section>
  );
}
