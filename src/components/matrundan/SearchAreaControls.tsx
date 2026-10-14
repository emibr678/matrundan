import * as React from "react";
import { CheckCircle2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import {
  SEARCH_RADIUS_OPTIONS,
  searchAreaMode,
  shortSearchAreaLabel,
} from "@/lib/matrundan/search-areas";
import type { SearchArea, SearchRadiusKm } from "@/lib/matrundan/types";

const MAX_SEARCH_CENTERS = 5;
const SEARCH_PLACEHOLDER = "Sök ort, område eller adress";

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
  mobileEditorOpen?: boolean;
}

interface SearchAreaFieldProps {
  isLive: boolean;
  query: string;
  placeholder: string;
  disabled: boolean;
  fallbackCity: string;
  selectedAreaPlaceIds: string[];
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
  selectedAreaPlaceIds,
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
      excludedPlaceIds={selectedAreaPlaceIds}
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
        className="h-9 w-auto shrink-0 gap-1 rounded-lg border-border/60 bg-muted/50 px-3 text-sm font-normal"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-[min(38dvh,13rem)]">
        {SEARCH_RADIUS_OPTIONS.map((value) => (
          <SelectItem key={value} value={String(value)}>
            {`${value} km`}
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
  mobileEditorOpen = false,
}: SearchAreaControlsProps) {
  const [areaQuery, setAreaQuery] = React.useState("");
  const [addingArea, setAddingArea] = React.useState(false);
  const wasMobileEditorOpen = React.useRef(mobileEditorOpen);
  React.useEffect(() => {
    if (wasMobileEditorOpen.current && !mobileEditorOpen) {
      setAreaQuery("");
      setAddingArea(false);
    }
    wasMobileEditorOpen.current = mobileEditorOpen;
  }, [mobileEditorOpen]);
  const selectedSavedAreas = savedAreas.filter((area) => selectedAreaIds.includes(area.id));
  const activeAreas = [...selectedSavedAreas, ...temporaryAreas];
  const atLimit = activeAreas.length >= MAX_SEARCH_CENTERS;
  const selectedAreaPlaceIds = activeAreas.map((area) => area.placeId).filter(Boolean);
  const boundaryAreas = activeAreas.filter((area) => searchAreaMode(area) === "boundary");
  const pointAreas = activeAreas.filter((area) => searchAreaMode(area) === "point");
  const boundaryCount = boundaryAreas.length;
  const pointCount = pointAreas.length;

  React.useEffect(() => {
    if (atLimit) {
      setAreaQuery("");
      setAddingArea(false);
    }
  }, [atLimit]);

  React.useEffect(() => {
    if (mobileEditorOpen && addingArea) {
      document.getElementById("search-area-query")?.focus();
    }
  }, [mobileEditorOpen, addingArea]);

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
    if (mobileEditorOpen) {
      document.getElementById("search-area-query")?.blur();
      setAddingArea(false);
    }
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
    <section className={mobileEditorOpen ? "space-y-2 lg:space-y-3" : "space-y-3"} aria-label={heading}>
      <h3 className="sr-only lg:not-sr-only lg:text-sm lg:font-medium">{heading}</h3>
      <SelectedAreas
        savedAreas={selectedSavedAreas}
        temporaryAreas={temporaryAreas}
        onRemoveSaved={removeSavedArea}
        onRemoveTemporary={removeTemporaryArea}
      />

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
        <div className="space-y-2">
          {mobileEditorOpen && !addingArea ? (
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 w-full touch-manipulation justify-start gap-2 rounded-lg px-2 text-foreground hover:bg-transparent active:bg-accent lg:hidden lg:hover:bg-accent"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setAddingArea(true)}
              aria-controls="search-area-query"
              aria-expanded={false}
            >
              <Plus className="h-4 w-4" />
              Lägg till sökområde
            </Button>
          ) : null}
          <div className={mobileEditorOpen && !addingArea ? "hidden lg:block" : ""}>
            <Label htmlFor="search-area-query" className="sr-only">
              {addAreaActionLabel}
            </Label>
            <SearchAreaField
              isLive={isLive}
              query={areaQuery}
              placeholder={SEARCH_PLACEHOLDER}
              disabled={false}
              fallbackCity={fallbackCity}
              selectedAreaPlaceIds={selectedAreaPlaceIds}
              onQueryChange={setAreaQuery}
              onSelect={addVerifiedArea}
            />
          </div>
        </div>
      )}

      {pointCount > 0 ? (
        <div
          role="group"
          aria-label={
            pointCount === 1
              ? `Vi söker inom ${radiusKm} km från ${shortSearchAreaLabel(pointAreas[0].label)}.`
              : `Vi söker inom ${radiusKm} km från de valda platserna.`
          }
          className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5"
        >
          <div className="min-w-0 space-y-0.5">
            <Label htmlFor="place-radius" className="block text-sm font-medium">
              Avstånd
            </Label>
            <p className="text-xs text-muted-foreground">
              {pointCount === 1
                ? `Runt ${shortSearchAreaLabel(pointAreas[0].label)}`
                : "Runt valda platser"}
            </p>
          </div>
          <InlineSearchRadius radiusKm={radiusKm} onRadiusChange={onRadiusChange} />
        </div>
      ) : boundaryCount > 0 ? (
        <p className="text-xs text-muted-foreground">
          {boundaryCount === 1
            ? `Vi söker i hela ${shortSearchAreaLabel(boundaryAreas[0].label)}.`
            : "Vi söker i hela de valda områdena."}
        </p>
      ) : null}
      {boundaryCount > 0 && pointCount > 0 ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {boundaryCount === 1
            ? `Vi söker också i hela ${shortSearchAreaLabel(boundaryAreas[0].label)}.`
            : "Vi söker också i hela de andra valda områdena."}
        </p>
      ) : null}
    </section>
  );
}
