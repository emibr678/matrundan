import * as React from "react";
import { Check, List, Loader2, Map, Search } from "lucide-react";
import { MultiAreaPlaceMap, type MultiAreaMapItem } from "./MultiAreaPlaceMap";
import { SearchAreaControlsV16 } from "./SearchAreaControlsV16";
import { SearchResultSectionsV16, type SourceMatchResult } from "./SearchResultSectionsV16";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  configuredSearchAreas,
  matchingPlace,
  providerMessage,
  toPlaceSuggestion,
} from "@/lib/matrundan/add-place-v16-utils";
import { geoapifySearchPlacesMulti } from "@/lib/matrundan/geoapify.functions";
import {
  hiddenPlaceRecordKey,
  hiddenPlaceSuggestionKey,
  listDemoHiddenPlaceSuggestions,
  listGroupHiddenPlaceSuggestions,
} from "@/lib/matrundan/hidden-place-suggestions";
import {
  findManualSourceLinkCandidate,
  hasActiveProviderSource,
} from "@/lib/matrundan/manual-place-source-linking";
import {
  hasLocalManualSourceLink,
  listLocalManualSourceLinks,
  type LocalManualSourceLink,
} from "@/lib/matrundan/manual-place-source-links";
import { getPlacesProvider, type PlaceSuggestion } from "@/lib/matrundan/places-provider";
import { mergeAreaSearchResults, shortSearchAreaLabel } from "@/lib/matrundan/search-areas";
import { useSession } from "@/lib/matrundan/session";
import { useStore } from "@/lib/matrundan/store";
import { CATEGORY_LABEL, type SearchArea, type SearchRadiusKm } from "@/lib/matrundan/types";

type ResultView = "lista" | "karta";
type ResultStatus = "available" | "linkable" | "existing";

export interface PlaceDiscoverySnapshot {
  query: string;
  selectedAreaIds: string[];
  temporaryAreas: SearchArea[];
  radiusKm: SearchRadiusKm;
  results: PlaceSuggestion[];
  failedAreas: string[];
  selectedId: string | null;
  resultView: ResultView;
  existingOpen: boolean;
  bulkMode: boolean;
  error: string | null;
}

export function PlaceDiscoveryV16({
  addedResultIds,
  selectedResults,
  bulkBusy,
  snapshot,
  onSnapshotChange,
  onToggleSelected,
  onClearSelected,
  onAddSelected,
  onBeginAdd,
  onLinkSource,
  onClose,
}: {
  addedResultIds: Set<string>;
  selectedResults: PlaceSuggestion[];
  bulkBusy: boolean;
  snapshot?: PlaceDiscoverySnapshot | null;
  onSnapshotChange?: (snapshot: PlaceDiscoverySnapshot) => void;
  onToggleSelected: (suggestion: PlaceSuggestion) => void;
  onClearSelected: () => void;
  onAddSelected: () => void;
  onBeginAdd: (suggestion: PlaceSuggestion) => void;
  onLinkSource: (match: SourceMatchResult) => void;
  onClose: () => void;
}) {
  const { state, submitting } = useStore();
  const { mode, activeGroupId, exampleMode } = useSession();
  const isLive = mode === "live";
  const groupId = isLive ? activeGroupId : state.group.id;
  const currentRole = state.members.find((member) => member.id === state.currentUserId)?.role;
  const canLinkSources = currentRole === "ägare" || currentRole === "admin";
  const localStorageKind = exampleMode ? "session" : "local";
  const savedAreas = React.useMemo(() => configuredSearchAreas(state, isLive), [isLive, state]);
  const selectedResultIds = React.useMemo(
    () => new Set(selectedResults.map((result) => result.externalId)),
    [selectedResults],
  );
  const [query, setQuery] = React.useState(snapshot?.query ?? "");
  const [selectedAreaIds, setSelectedAreaIds] = React.useState<string[]>(
    snapshot?.selectedAreaIds ?? savedAreas.map((area) => area.id),
  );
  const [temporaryAreas, setTemporaryAreas] = React.useState<SearchArea[]>(
    snapshot?.temporaryAreas ?? [],
  );
  const [radiusKm, setRadiusKm] = React.useState<SearchRadiusKm>(
    snapshot?.radiusKm ?? state.group.defaultSearchRadiusKm ?? 1,
  );
  const [results, setResults] = React.useState<PlaceSuggestion[]>(snapshot?.results ?? []);
  const [hiddenKeys, setHiddenKeys] = React.useState<Set<string>>(() => new Set());
  const [localSourceLinks, setLocalSourceLinks] = React.useState<LocalManualSourceLink[]>([]);
  const [hiddenLoading, setHiddenLoading] = React.useState(true);
  const [failedAreas, setFailedAreas] = React.useState<string[]>(snapshot?.failedAreas ?? []);
  const [selectedId, setSelectedId] = React.useState<string | null>(snapshot?.selectedId ?? null);
  const [resultView, setResultView] = React.useState<ResultView>(snapshot?.resultView ?? "lista");
  const [existingOpen, setExistingOpen] = React.useState(snapshot?.existingOpen ?? false);
  const [bulkMode, setBulkMode] = React.useState(snapshot?.bulkMode ?? false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(snapshot?.error ?? null);
  const [retry, setRetry] = React.useState(0);
  const requestRef = React.useRef(0);
  const previousBulkBusyRef = React.useRef(false);
  const lastMapToggleRef = React.useRef<{ id: string; at: number } | null>(null);
  const interactionsDisabled = submitting || bulkBusy;

  React.useEffect(() => {
    onSnapshotChange?.({
      query,
      selectedAreaIds,
      temporaryAreas,
      radiusKm,
      results,
      failedAreas,
      selectedId,
      resultView,
      existingOpen,
      bulkMode,
      error,
    });
  }, [
    bulkMode,
    error,
    existingOpen,
    failedAreas,
    onSnapshotChange,
    query,
    radiusKm,
    resultView,
    results,
    selectedAreaIds,
    selectedId,
    temporaryAreas,
  ]);

  const activeAreas = React.useMemo(() => {
    const selected = savedAreas.filter((area) => selectedAreaIds.includes(area.id));
    return [...selected, ...temporaryAreas].slice(0, 5);
  }, [savedAreas, selectedAreaIds, temporaryAreas]);

  React.useEffect(() => {
    if (previousBulkBusyRef.current && !bulkBusy && selectedResults.length === 0) {
      setBulkMode(false);
    }
    previousBulkBusyRef.current = bulkBusy;
  }, [bulkBusy, selectedResults.length]);

  React.useEffect(() => {
    if (!bulkMode && !bulkBusy && selectedResults.length > 0) onClearSelected();
  }, [bulkBusy, bulkMode, onClearSelected, selectedResults.length]);

  React.useEffect(() => {
    if (isLive || !groupId) {
      setLocalSourceLinks([]);
      return;
    }
    const load = () => setLocalSourceLinks(listLocalManualSourceLinks(groupId, localStorageKind));
    load();
    window.addEventListener("matrundan:manual-place-source-links-changed", load);
    return () => window.removeEventListener("matrundan:manual-place-source-links-changed", load);
  }, [groupId, isLive, localStorageKind]);

  const loadHiddenSuggestions = React.useCallback(async () => {
    if (!groupId) {
      setHiddenKeys(new Set());
      setHiddenLoading(false);
      return;
    }

    setHiddenLoading(true);
    try {
      const rows = isLive
        ? await listGroupHiddenPlaceSuggestions(groupId)
        : listDemoHiddenPlaceSuggestions(groupId);
      setHiddenKeys(new Set(rows.map(hiddenPlaceRecordKey)));
    } catch (caught) {
      console.warn("[Matrundan] kunde inte läsa dolda sökträffar:", caught);
      setHiddenKeys(new Set());
    } finally {
      setHiddenLoading(false);
    }
  }, [groupId, isLive]);

  React.useEffect(() => {
    void loadHiddenSuggestions();
    const handleChanged = () => void loadHiddenSuggestions();
    window.addEventListener("matrundan:hidden-place-suggestions-changed", handleChanged);
    return () =>
      window.removeEventListener("matrundan:hidden-place-suggestions-changed", handleChanged);
  }, [loadHiddenSuggestions]);

  React.useEffect(() => {
    if (activeAreas.length === 0) {
      setResults([]);
      setFailedAreas([]);
      setError(null);
      return;
    }
    const requestId = ++requestRef.current;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      setFailedAreas([]);
      try {
        let nextResults: PlaceSuggestion[];
        let nextFailedAreas: string[] = [];
        if (isLive) {
          const response = await geoapifySearchPlacesMulti({
            data: {
              text: query.trim() || undefined,
              centers: activeAreas.map((area) => ({
                id: area.id,
                label: shortSearchAreaLabel(area.label),
                lat: area.lat,
                lng: area.lng,
              })),
              radiusKm,
              limit: 50,
            },
          });
          nextResults = response.results.map(toPlaceSuggestion);
          nextFailedAreas = response.failedAreaLabels;
        } else {
          const settled = await Promise.allSettled(
            activeAreas.map(async (area) => ({
              area,
              results: await getPlacesProvider().search({
                query: query.trim() || undefined,
                center: { lat: area.lat, lng: area.lng },
                areaLabel: shortSearchAreaLabel(area.label),
                radiusKm,
              }),
            })),
          );
          const successful = settled.flatMap((outcome) =>
            outcome.status === "fulfilled"
              ? [
                  {
                    areaId: outcome.value.area.id,
                    areaLabel: shortSearchAreaLabel(outcome.value.area.label),
                    results: outcome.value.results,
                  },
                ]
              : [],
          );
          nextFailedAreas = settled.flatMap((outcome, index) =>
            outcome.status === "rejected" ? [shortSearchAreaLabel(activeAreas[index].label)] : [],
          );
          if (successful.length === 0 && nextFailedAreas.length > 0) {
            throw new Error("Kunde inte söka i de valda områdena.");
          }
          nextResults = mergeAreaSearchResults(successful, 50);
        }
        if (requestId !== requestRef.current) return;
        setResults(nextResults);
        setFailedAreas(nextFailedAreas);
        setSelectedId(nextResults[0]?.externalId ?? null);
      } catch (caught) {
        if (requestId !== requestRef.current) return;
        setResults([]);
        setError(providerMessage(caught));
      } finally {
        if (requestId === requestRef.current) setLoading(false);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [activeAreas, isLive, query, radiusKm, retry]);

  const visibleResults = React.useMemo(
    () => results.filter((result) => !hiddenKeys.has(hiddenPlaceSuggestionKey(result))),
    [hiddenKeys, results],
  );

  const sourceMatches = React.useMemo<SourceMatchResult[]>(() => {
    if (!canLinkSources) return [];
    return visibleResults.flatMap((result) => {
      if (
        addedResultIds.has(result.externalId) ||
        state.places.some((place) => hasActiveProviderSource(place, result)) ||
        hasLocalManualSourceLink(localSourceLinks, result)
      ) {
        return [];
      }
      const match = findManualSourceLinkCandidate(state.places, result);
      return match ? [{ result, place: match.place, reason: match.reason }] : [];
    });
  }, [addedResultIds, canLinkSources, localSourceLinks, state.places, visibleResults]);
  const sourceMatchIds = React.useMemo(
    () => new Set(sourceMatches.map((match) => match.result.externalId)),
    [sourceMatches],
  );

  const statusForResult = React.useCallback(
    (suggestion: PlaceSuggestion): ResultStatus => {
      if (
        addedResultIds.has(suggestion.externalId) ||
        state.places.some((place) => hasActiveProviderSource(place, suggestion)) ||
        hasLocalManualSourceLink(localSourceLinks, suggestion)
      ) {
        return "existing";
      }
      if (sourceMatchIds.has(suggestion.externalId)) return "linkable";
      const match = matchingPlace(state.places, suggestion);
      return match && match.collectionStatus !== "archived" ? "existing" : "available";
    },
    [addedResultIds, localSourceLinks, sourceMatchIds, state.places],
  );
  const availableResults = React.useMemo(
    () => visibleResults.filter((result) => statusForResult(result) === "available"),
    [statusForResult, visibleResults],
  );
  const existingResults = React.useMemo(
    () => visibleResults.filter((result) => statusForResult(result) === "existing"),
    [statusForResult, visibleResults],
  );

  React.useEffect(() => {
    const primaryResults = [...sourceMatches.map((match) => match.result), ...availableResults];
    const visible = existingOpen ? [...primaryResults, ...existingResults] : primaryResults;
    if (!visible.some((result) => result.externalId === selectedId)) {
      setSelectedId(visible[0]?.externalId ?? null);
    }
  }, [availableResults, existingOpen, existingResults, selectedId, sourceMatches]);

  function toggleBulkMode() {
    if (bulkMode) {
      onClearSelected();
      setBulkMode(false);
      return;
    }
    setExistingOpen(false);
    setBulkMode(true);
  }

  function handleMapSelect(id: string) {
    setSelectedId(id);
    const result = availableResults.find((candidate) => candidate.externalId === id);
    if (!result || interactionsDisabled) return;
    if (bulkMode) {
      const now = performance.now();
      const previous = lastMapToggleRef.current;
      if (previous?.id === id && now - previous.at < 150) return;
      lastMapToggleRef.current = { id, at: now };
      onToggleSelected(result);
    } else {
      onBeginAdd(result);
    }
  }

  const mapResults = existingOpen ? [...availableResults, ...existingResults] : availableResults;
  const mapItems: MultiAreaMapItem[] = mapResults.map((result) => ({
    id: result.externalId,
    name: result.name,
    lat: result.lat,
    lng: result.lng,
    category: result.category,
    actionable: statusForResult(result) === "available",
    bulkSelected: bulkMode && selectedResultIds.has(result.externalId),
    eyebrow: `${CATEGORY_LABEL[result.category]}${
      result.distanceKm != null
        ? ` · ~${result.distanceKm} km${
            result.nearestAreaLabel ? ` från ${result.nearestAreaLabel}` : ""
          }`
        : ""
    }`,
    description: [result.address, result.area, result.city].filter(Boolean).join(" · "),
  }));
  const unmappedCount = mapResults.filter(
    (result) => result.lat == null || result.lng == null,
  ).length;
  const actionableResultCount = sourceMatches.length + availableResults.length;
  const resultSections = (
    <SearchResultSectionsV16
      available={availableResults}
      sourceMatches={sourceMatches}
      existing={existingResults}
      existingOpen={existingOpen}
      onExistingOpenChange={setExistingOpen}
      selectedId={selectedId}
      selectedResultIds={selectedResultIds}
      bulkMode={bulkMode}
      onSelect={setSelectedId}
      onToggleSelected={onToggleSelected}
      onAdd={onBeginAdd}
      onLinkSource={onLinkSource}
      places={state.places}
      disabled={interactionsDisabled}
    />
  );
  const map = (
    <MultiAreaPlaceMap
      items={mapItems}
      centers={activeAreas.map((area) => ({
        id: area.id,
        label: shortSearchAreaLabel(area.label),
        lat: area.lat,
        lng: area.lng,
      }))}
      radiusKm={radiusKm}
      selectedId={selectedId}
      onSelect={handleMapSelect}
      onToggleBulkSelection={
        bulkMode
          ? (item) => {
              const result = availableResults.find((candidate) => candidate.externalId === item.id);
              if (result) onToggleSelected(result);
            }
          : undefined
      }
      actionsDisabled={interactionsDisabled}
      className="h-[55vh] min-h-[340px] lg:h-[52vh] lg:min-h-[390px]"
    />
  );

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="place-query">Sök</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="place-query"
            className="pl-9"
            placeholder="Namn, kök eller kategori"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>

      <SearchAreaControlsV16
        savedAreas={savedAreas}
        selectedAreaIds={selectedAreaIds}
        onSelectedAreaIdsChange={setSelectedAreaIds}
        temporaryAreas={temporaryAreas}
        onTemporaryAreasChange={setTemporaryAreas}
        radiusKm={radiusKm}
        onRadiusChange={setRadiusKm}
        isLive={isLive}
        fallbackCity={state.group.city}
      />

      {activeAreas.length === 0 ? (
        <Empty text="Sök och välj minst ett sökområde." />
      ) : loading || hiddenLoading ? (
        <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Söker…
        </div>
      ) : error ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <p className="min-w-0 flex-1 text-destructive">{error}</p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="min-h-11"
            onClick={() => setRetry((value) => value + 1)}
          >
            Försök igen
          </Button>
        </div>
      ) : (
        <>
          {failedAreas.length > 0 ? (
            <div className="rounded-xl border border-amber-300/60 bg-amber-50/60 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
              Kunde inte söka i {failedAreas.join(", ")}. Övriga resultat visas.
            </div>
          ) : null}
          {visibleResults.length === 0 ? (
            <Empty text="Inga matställen hittades. Prova större radie, andra områden eller lägg till manuellt." />
          ) : (
            <>
              <h3 className="text-sm font-medium lg:hidden">Ställen att lägga till</h3>
              <div className="lg:hidden">
                <ResultToggle value={resultView} onChange={setResultView} />
                <div className="mt-2 flex min-h-11 items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground">
                    {actionableResultCount} {actionableResultCount === 1 ? "träff" : "träffar"}
                  </span>
                  {availableResults.length > 0 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="min-h-11 shrink-0"
                      disabled={interactionsDisabled}
                      onClick={toggleBulkMode}
                    >
                      {bulkMode ? "Avbryt" : "Välj flera"}
                    </Button>
                  ) : null}
                </div>
                <div className="mt-3">{resultView === "lista" ? resultSections : map}</div>
              </div>
              <div className="hidden min-h-11 items-center justify-between gap-3 lg:flex">
                <h3 className="text-sm font-medium">Ställen att lägga till</h3>
                {availableResults.length > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="min-h-11 shrink-0"
                    disabled={interactionsDisabled}
                    onClick={toggleBulkMode}
                  >
                    {bulkMode ? "Avbryt" : "Välj flera"}
                  </Button>
                ) : null}
              </div>
              <div className="hidden gap-4 lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <div className="max-h-[52vh] overflow-y-auto pr-1">{resultSections}</div>
                {map}
              </div>
              {unmappedCount > 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  {unmappedCount} {unmappedCount === 1 ? "träff saknar" : "träffar saknar"}{" "}
                  kartposition och visas bara i listan.
                </p>
              ) : null}
            </>
          )}
        </>
      )}

      {bulkMode && selectedResults.length > 0 ? (
        <div className="sticky bottom-2 z-30 rounded-2xl border border-primary/25 bg-background/95 p-2 shadow-lg backdrop-blur">
          <div className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 flex-1 text-sm font-medium">
              {selectedResults.length}{" "}
              {selectedResults.length === 1 ? "ställe valt" : "ställen valda"}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-11 shrink-0"
              disabled={interactionsDisabled}
              onClick={onClearSelected}
            >
              Rensa
            </Button>
          </div>
          <Button
            type="button"
            className="mt-1 min-h-11 w-full"
            disabled={interactionsDisabled}
            onClick={onAddSelected}
          >
            {bulkBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Lägg till {selectedResults.length} {selectedResults.length === 1 ? "ställe" : "ställen"}
          </Button>
        </div>
      ) : null}

      {addedResultIds.size > 0 ? (
        <div
          className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/[0.06] px-3 py-2 text-sm"
          role="status"
        >
          <Check className="h-4 w-4 shrink-0 text-primary" />
          {addedResultIds.size}{" "}
          {addedResultIds.size === 1 ? "ställe hanterat" : "ställen hanterade"} i den här omgången
        </div>
      ) : null}

      <p className="text-[11px] text-muted-foreground">
        {isLive
          ? "Platsdata från Geoapify och © OpenStreetMap-bidragsgivare."
          : "Fiktiv demodata för utveckling."}
      </p>
      <div className="flex justify-end">
        <Button className="min-h-11" disabled={bulkBusy} onClick={onClose}>
          Klar
        </Button>
      </div>
    </div>
  );
}

function ResultToggle({
  value,
  onChange,
}: {
  value: ResultView;
  onChange: (value: ResultView) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
      <button
        type="button"
        className={`flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm font-medium ${
          value === "lista" ? "bg-background shadow-sm" : "text-muted-foreground"
        }`}
        onClick={() => onChange("lista")}
        aria-pressed={value === "lista"}
      >
        <List className="h-4 w-4" /> Lista
      </button>
      <button
        type="button"
        className={`flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm font-medium ${
          value === "karta" ? "bg-background shadow-sm" : "text-muted-foreground"
        }`}
        onClick={() => onChange("karta")}
        aria-pressed={value === "karta"}
      >
        <Map className="h-4 w-4" /> Karta
      </button>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border/70 bg-card/60 p-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
