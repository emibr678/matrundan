import * as React from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { GeoapifyLocationInput, type VerifiedLocationSelection } from "./GeoapifyLocationInput";
import { SearchAreaPill } from "./SearchAreaPill";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { transientSearchAreaId } from "@/lib/matrundan/add-place-utils";
import { SEARCH_RADIUS_OPTIONS, searchAreaMode } from "@/lib/matrundan/search-areas";
import type { SearchArea, SearchRadiusKm } from "@/lib/matrundan/types";

const MAX_SEARCH_CENTERS = 5;
const SEARCH_PLACEHOLDER = "Sök kommun, ort, stadsdel eller adress";

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
  onSelect: (location: VerifiedLocationSelection) => void;
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
      allowBoundaryAreas
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
    return <p className="text-sm text-muted-foreground">Välj minst ett område eller en plats.</p>;
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
            {`Inom ${value} km från punktval`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function SearchAreaControls({
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
  const boundaryCount = activeAreas.filter((area) => searchAreaMode(area) === "boundary").length;
  const pointCount = activeAreas.length - boundaryCount;

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

  function addVerifiedArea(value: VerifiedLocationSelection) {
    addArea({
      id: transientSearchAreaId("temporary", value.lat, value.lng),
      label: value.label,
      lat: value.lat,
      lng: value.lng,
      provider: isLive ? "geoapify" : "demo",
      placeId: value.placeId,
      searchMode: value.searchMode ?? "point",
      resultType: value.resultType,
      boundary: value.boundary,
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
        {pointCount > 0 ? (
          <InlineSearchRadius radiusKm={radiusKm} onRadiusChange={onRadiusChange} />
        ) : boundaryCount > 0 ? (
          <span className="rounded-full border border-border/60 bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground">
            Söker inom områdesgränser
          </span>
        ) : null}
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

      {boundaryCount > 0 && pointCount > 0 ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Områden söks inom sin gräns. Avståndet gäller bara adresser och andra punktval.
        </p>
      ) : null}
    </section>
  );
}
