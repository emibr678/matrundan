import * as React from "react";
import { List, Map, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MultiAreaPlaceMap } from "./MultiAreaPlaceMap";
import { SearchResultSections } from "./SearchResultSections";
import {
  searchOsmStagingPreview,
  type OsmStagingPreviewResponse,
} from "@/lib/matrundan/osm-staging.functions";
import {
  isOsmPreviewFilter,
  mergeOsmPreviewPages,
  osmPreviewSuggestion,
  type OsmPreviewFilterId,
  type OsmPreviewPhase,
} from "@/lib/matrundan/osm-staging-preview";
import type { PlaceSuggestion } from "@/lib/matrundan/places-provider";
import type { SearchArea, SearchRadiusKm } from "@/lib/matrundan/types";

type Cursor = NonNullable<OsmStagingPreviewResponse["cursor"]>;
type View = "lista" | "karta";
interface Loaded {
  generation: number;
  rows: PlaceSuggestion[];
  directCursor: Cursor | null;
  relatedStarted: boolean;
  relatedCursor: Cursor | null;
}
const PER_PAGE = 20;

export function OsmStagingSearchResults({
  areas,
  radiusKm,
  filterId,
  view,
  onViewChange,
}: {
  areas: SearchArea[];
  radiusKm: SearchRadiusKm;
  filterId: string | null;
  view: View;
  onViewChange: (view: View) => void;
}) {
  const area = areas.length === 1 && areas[0].searchMode !== "boundary" ? areas[0] : null;
  const radius = radiusKm === 3 || radiusKm === 5 ? radiusKm : null;
  const filter: OsmPreviewFilterId | null = isOsmPreviewFilter(filterId) ? filterId : null;
  const key = JSON.stringify([area?.id, area?.lat, area?.lng, radius, filter]);
  const currentKey = React.useRef(key);
  currentKey.current = key;
  const [loaded, setLoaded] = React.useState<Loaded | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [shown, setShown] = React.useState(PER_PAGE);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [durationMs, setDurationMs] = React.useState<number | null>(null);
  const [notLoaded, setNotLoaded] = React.useState(false);
  const [retry, setRetry] = React.useState(0);

  const canRun = area !== null && radius !== null && filter !== null;

  React.useEffect(() => {
    let cancelled = false;
    setLoaded(null);
    setError(null);
    setShown(PER_PAGE);
    setSelectedId(null);
    setDurationMs(null);
    setNotLoaded(false);
    setPending(false);
    setLoadingMore(false);
    if (!area || !radius || !filter) return;

    const center = area;
    const selectedFilter = filter;
    const selectedRadius = radius;
    const started = performance.now();
    setPending(true);
    void (async () => {
      try {
        const direct = await searchOsmStagingPreview({
          data: {
            lat: center.lat,
            lng: center.lng,
            radiusKm: selectedRadius,
            filterId: selectedFilter,
            phase: "direct",
            cursor: null,
          },
        });
        if (cancelled) return;
        if (direct.status === "not_loaded") {
          setNotLoaded(true);
          return;
        }
        let rows = direct.results.map((row) =>
          osmPreviewSuggestion(row, selectedFilter, "direct", center.id, center.label),
        );
        let relatedStarted = false;
        let relatedCursor: Cursor | null = null;
        // If direct source tags do not fill the first page, try the documented
        // Pasta→Italienskt association, without reclassifying any OSM record.
        if (!direct.hasMore && rows.length < PER_PAGE && selectedFilter === "specialty:pasta") {
          const related = await searchOsmStagingPreview({
            data: {
              lat: center.lat,
              lng: center.lng,
              radiusKm: selectedRadius,
              filterId: selectedFilter,
              phase: "related",
              cursor: null,
            },
          });
          if (cancelled) return;
          if (related.status !== "ok" || related.generation !== direct.generation)
            throw new Error("OSM-indexet ändrades under sökningen. Försök igen.");
          rows = mergeOsmPreviewPages(
            rows,
            related.results.map((row) =>
              osmPreviewSuggestion(row, selectedFilter, "related", center.id, center.label),
            ),
          );
          relatedStarted = true;
          relatedCursor = related.cursor ?? null;
        }
        if (cancelled) return;
        setLoaded({
          generation: direct.generation!,
          rows,
          directCursor: direct.cursor ?? null,
          relatedStarted,
          relatedCursor,
        });
      } catch (caught) {
        if (!cancelled)
          setError(
            caught instanceof Error ? caught.message : "OSM-sökningen kunde inte genomföras.",
          );
      } finally {
        if (!cancelled) {
          setDurationMs(Math.round(performance.now() - started));
          setPending(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [key, retry]);

  const hasMore = Boolean(
    loaded &&
    (loaded.directCursor ||
      (filter === "specialty:pasta" && !loaded.relatedStarted) ||
      loaded.relatedCursor),
  );
  const canShowMore = Boolean(loaded && (loaded.rows.length > shown || hasMore));

  async function showMore() {
    if (!loaded || !area || !radius || !filter || loadingMore) return;
    if (loaded.rows.length > shown) {
      setShown((count) => count + PER_PAGE);
      return;
    }
    if (!hasMore) return;
    const originalKey = key;
    const phase: OsmPreviewPhase = loaded.directCursor ? "direct" : "related";
    const cursor = phase === "direct" ? loaded.directCursor : loaded.relatedCursor;
    const started = performance.now();
    setLoadingMore(true);
    setError(null);
    try {
      const response = await searchOsmStagingPreview({
        data: {
          lat: area.lat,
          lng: area.lng,
          radiusKm: radius,
          filterId: filter,
          phase,
          cursor,
        },
      });
      if (originalKey !== currentKey.current) return;
      if (response.status !== "ok" || response.generation !== loaded.generation)
        throw new Error("OSM-indexet ändrades under sökningen. Sök igen för att fortsätta.");
      const added = response.results.map((row) =>
        osmPreviewSuggestion(row, filter, phase, area.id, area.label),
      );
      setLoaded({
        ...loaded,
        rows: mergeOsmPreviewPages(loaded.rows, added),
        directCursor: phase === "direct" ? (response.cursor ?? null) : loaded.directCursor,
        relatedStarted: loaded.relatedStarted || phase === "related",
        relatedCursor: phase === "related" ? (response.cursor ?? null) : loaded.relatedCursor,
      });
      setShown((count) => count + PER_PAGE);
      setDurationMs(Math.round(performance.now() - started));
    } catch (caught) {
      if (originalKey === currentKey.current)
        setError(caught instanceof Error ? caught.message : "Kunde inte hämta fler OSM-träffar.");
    } finally {
      if (originalKey === currentKey.current) setLoadingMore(false);
    }
  }

  if (!canRun) {
    return (
      <div
        className="rounded-xl border border-border/70 p-4 text-sm"
        role="status"
        data-osm-preview-unsupported
      >
        OSM-jämförelsen stöder just nu bara Pasta, Ramen och Asiatiskt i ett punktområde med 3 eller
        5 km radie. Ändra sökvalet eller välj Geoapify.
      </div>
    );
  }

  const rows = (loaded?.rows ?? []).slice(0, shown);
  const pagination = canShowMore ? (
    <Button
      type="button"
      variant="secondary"
      className="min-h-11 w-full"
      disabled={loadingMore}
      onClick={() => void showMore()}
    >
      {loadingMore ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Laddar…
        </>
      ) : (
        "Visa fler"
      )}
    </Button>
  ) : null;
  const results = (
    <SearchResultSections
      available={rows}
      sourceMatches={[]}
      existing={[]}
      existingOpen={false}
      onExistingOpenChange={() => {}}
      selectedId={selectedId}
      selectedResultIds={new Set()}
      bulkMode={false}
      onSelect={setSelectedId}
      onToggleSelected={() => {}}
      onAdd={() => {}}
      onLinkSource={() => {}}
      places={[]}
      showNearestAreaLabel={false}
      disabled={false}
      readOnly
      pagination={pagination}
    />
  );
  const map = (
    <MultiAreaPlaceMap
      items={rows.map((row) => ({
        id: row.externalId,
        name: row.name,
        lat: row.lat,
        lng: row.lng,
        category: row.category,
        actionable: false,
        eyebrow:
          row.searchEvidence?.kind === "association" ? "Möjlig kökskoppling" : "Direkt OSM-tagg",
        description:
          row.distanceKm != null ? Math.round(row.distanceKm * 1000) + " m från centrum" : "",
      }))}
      centers={[
        {
          id: area!.id,
          label: area!.label,
          lat: area!.lat,
          lng: area!.lng,
          searchMode: "point",
        },
      ]}
      radiusKm={radius}
      searchContextKey={key}
      selectedId={selectedId}
      onSelect={setSelectedId}
      className="h-[55vh] min-h-[340px] lg:h-[52vh] lg:min-h-[390px]"
    />
  );
  return (
    <section className="min-w-0 space-y-3" aria-label="OSM-sökresultat" data-osm-preview-results>
      <div className="rounded-xl border border-border/70 bg-muted/20 p-3 text-xs leading-relaxed">
        <p className="font-medium">OSM · skrivskyddat sökprov</p>
        <p className="mt-1">
          Direkta OSM-taggar visas före möjliga kökskopplingar. Taggarna bevisar inte vilka rätter
          som finns på menyn. Träffar kan inte läggas till här.
        </p>
        {loaded ? (
          <p className="mt-1 text-muted-foreground">
            {loaded.rows.length} objekt hämtade · indexgeneration {loaded.generation}
            {durationMs !== null ? " · senaste svar " + durationMs + " ms" : ""}
          </p>
        ) : null}
      </div>
      {pending ? (
        <p role="status" className="flex items-center gap-2 py-4 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Söker i OSM-indexet…
        </p>
      ) : null}
      {notLoaded ? (
        <p role="alert" className="text-sm">
          OSM-indexet är inte inläst i staging. Det är inte ett nollresultat.
        </p>
      ) : null}
      {error ? (
        <div role="alert" className="rounded-lg border border-destructive/50 p-3 text-sm">
          {error}{" "}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="ml-2"
            onClick={() => setRetry((current) => current + 1)}
          >
            Försök igen
          </Button>
        </div>
      ) : null}
      {loaded && loaded.rows.length === 0 && !hasMore ? (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          Inga OSM-taggar matchade i det valda punktområdet.
        </p>
      ) : null}
      {loaded && (loaded.rows.length > 0 || hasMore) ? (
        <>
          <div className="min-w-0 lg:hidden">
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={view === "lista" ? "secondary" : "outline"}
                onClick={() => onViewChange("lista")}
              >
                <List className="mr-1 h-4 w-4" />
                Lista
              </Button>
              <Button
                type="button"
                size="sm"
                variant={view === "karta" ? "secondary" : "outline"}
                onClick={() => onViewChange("karta")}
              >
                <Map className="mr-1 h-4 w-4" />
                Karta
              </Button>
            </div>
            <div className="mt-3">
              {view === "lista" ? (
                results
              ) : (
                <div className="space-y-3">
                  {map}
                  {pagination}
                </div>
              )}
            </div>
          </div>
          <div className="hidden min-w-0 gap-4 lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="max-h-[52vh] min-w-0 overflow-y-auto pr-1">{results}</div>
            {map}
          </div>
        </>
      ) : null}
      <p className="text-[11px] text-muted-foreground">
        Platsdata: © OpenStreetMap-bidragsgivare ·{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2"
        >
          Källa och ODbL-licens
        </a>
        .
      </p>
    </section>
  );
}
