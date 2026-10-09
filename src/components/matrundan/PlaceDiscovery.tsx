import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import type { PlaceResolution } from "@/lib/matrundan/place-discovery";
import {
  canBulkAddSuggestion,
  needsPlaceComparison,
  presentPlaceSearchResults,
  unambiguousPlaceCandidate,
} from "@/lib/matrundan/place-discovery";
import { Check, ChevronRight, List, Loader2, Map, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { MatrundanBrand } from "./MatrundanBrand";
import { MultiAreaPlaceMap, type MultiAreaMapItem } from "./MultiAreaPlaceMap";
import { SearchAreaControls } from "./SearchAreaControls";
import { SearchResultSections, type SourceMatchResult } from "./SearchResultSections";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  configuredSearchAreas,
  matchingPlace,
  providerMessage,
} from "@/lib/matrundan/add-place-utils";
import {
  geoapifyLoadSearchAreaBoundaries,
  searchPlaceDiscovery,
} from "@/lib/matrundan/geoapify.functions";
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
import {
  genericPlaceSearchSuggestions,
  type GenericPlaceSearchSuggestion,
} from "@/lib/matrundan/place-search-intent";
import {
  actionableSliceIndex,
  countActionableSuggestions,
  mergePlaceSearchPages,
  selectMapCandidates,
} from "@/lib/matrundan/place-search-pagination";
import { getPlacesProvider, type PlaceSuggestion } from "@/lib/matrundan/places-provider";
import { formatPlaceAddressWithCity } from "@/lib/matrundan/place-location";
import { formatSearchDistanceKm } from "@/lib/matrundan/search-distance";
import {
  mergeAreaSearchResults,
  searchAreaMode,
  shortSearchAreaLabel,
} from "@/lib/matrundan/search-areas";
import { useSession } from "@/lib/matrundan/session";
import { useStore } from "@/lib/matrundan/store";
import {
  CATEGORY_LABEL,
  type SearchArea,
  type SearchAreaBoundaryGeometry,
  type SearchRadiusKm,
} from "@/lib/matrundan/types";

type ResultView = "lista" | "karta";
type ResultStatus = "available" | "linkable" | "existing";

const RESULT_PAGE_SIZE = 20;
/** Defensivt tak på provideranrop per användarhandling. */
const MAX_PROVIDER_PAGES_PER_ACTION = 5;
type AreaProgress = { offsets: Record<string, number>; exhaustedIds: string[] };
type SearchBudget = { requests: number; credits: number };
const AUTO_SEARCH_BUDGET: SearchBudget = { requests: 25, credits: 40 };
const EXPLICIT_MORE_BUDGET: SearchBudget = { requests: 5, credits: 20 };

export interface PlaceDiscoverySnapshot {
  query: string;
  selectedAreaIds: string[];
  temporaryAreas: SearchArea[];
  radiusKm: SearchRadiusKm;
  results: PlaceSuggestion[];
  resultsForSearchKey?: string;
  failedAreas: string[];
  selectedId: string | null;
  resultView: ResultView;
  existingOpen: boolean;
  bulkMode: boolean;
  error: string | null;
  displayLimit: number;
  hasMore: boolean;
  nextOffset: number;
  areaProgress?: AreaProgress;
  budgetRemaining?: SearchBudget;
}

export function PlaceDiscovery({
  initialQuery = "",
  resolutions = {},
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
  onMissingPlace,
  onClose,
}: {
  initialQuery?: string;
  resolutions?: Record<string, PlaceResolution>;
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
  onMissingPlace: () => void;
  onClose: () => void;
}) {
  const navigate = useNavigate();
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
  const [query, setQuery] = React.useState(snapshot?.query ?? initialQuery);
  const [searchObservation, setSearchObservation] = React.useState<unknown>(null);
  const [selectedAreaIds, setSelectedAreaIds] = React.useState<string[]>(
    snapshot?.selectedAreaIds ?? savedAreas.map((area) => area.id),
  );
  const [temporaryAreas, setTemporaryAreas] = React.useState<SearchArea[]>(
    snapshot?.temporaryAreas ?? [],
  );
  const [radiusKm, setRadiusKm] = React.useState<SearchRadiusKm>(
    snapshot?.radiusKm ?? state.group.defaultSearchRadiusKm ?? 1,
  );
  const currentSearchKey = JSON.stringify([
    query.trim(),
    radiusKm,
    savedAreas
      .filter((area) => selectedAreaIds.includes(area.id))
      .map((area) => [area.id, area.lat, area.lng, searchAreaMode(area), area.placeId]),
    temporaryAreas.map((area) => [area.id, area.lat, area.lng, searchAreaMode(area), area.placeId]),
  ]);
  const [resultsForSearchKey, setResultsForSearchKey] = React.useState(
    snapshot?.resultsForSearchKey ?? currentSearchKey,
  );
  const resultMatchesSearch = resultsForSearchKey === currentSearchKey;
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
  const [displayLimit, setDisplayLimit] = React.useState(
    snapshot?.displayLimit ?? RESULT_PAGE_SIZE,
  );
  const [hasMore, setHasMore] = React.useState(snapshot?.hasMore ?? false);
  const [nextOffset, setNextOffset] = React.useState(snapshot?.nextOffset ?? 0);
  const [areaProgress, setAreaProgress] = React.useState<AreaProgress>(
    snapshot?.areaProgress ?? { offsets: {}, exhaustedIds: [] },
  );
  const [budgetRemaining, setBudgetRemaining] = React.useState<SearchBudget>(
    snapshot?.budgetRemaining ?? AUTO_SEARCH_BUDGET,
  );
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [queuedMore, setQueuedMore] = React.useState(false);
  const [mapFilling, setMapFilling] = React.useState(false);
  const completedMapFillKeyRef = React.useRef<string | null>(null);
  const [boundaryGeometryByAreaId, setBoundaryGeometryByAreaId] = React.useState<
    Record<string, SearchAreaBoundaryGeometry>
  >({});
  const [failedBoundaryGeometryIds, setFailedBoundaryGeometryIds] = React.useState<Set<string>>(
    () => new Set(),
  );
  const requestRef = React.useRef(0);
  const skipInitialSearchRef = React.useRef(Boolean(snapshot));
  const previousBulkBusyRef = React.useRef(false);
  const interactionsDisabled = submitting || bulkBusy;

  React.useEffect(() => {
    onSnapshotChange?.({
      query,
      selectedAreaIds,
      temporaryAreas,
      radiusKm,
      results,
      resultsForSearchKey,
      failedAreas,
      selectedId,
      resultView,
      existingOpen,
      bulkMode,
      error,
      displayLimit,
      hasMore,
      nextOffset,
      areaProgress,
      budgetRemaining,
    });
  }, [
    areaProgress,
    budgetRemaining,
    bulkMode,
    displayLimit,
    error,
    existingOpen,
    failedAreas,
    hasMore,
    nextOffset,
    onSnapshotChange,
    query,
    radiusKm,
    resultView,
    results,
    resultsForSearchKey,
    selectedAreaIds,
    selectedId,
    temporaryAreas,
  ]);

  const activeAreas = React.useMemo(() => {
    const selected = savedAreas.filter((area) => selectedAreaIds.includes(area.id));
    return [...selected, ...temporaryAreas].slice(0, 5);
  }, [savedAreas, selectedAreaIds, temporaryAreas]);

  const activeAreasWithGeometry = React.useMemo(
    () =>
      activeAreas.map((area) => {
        const boundary = area.boundary ?? boundaryGeometryByAreaId[area.id];
        return boundary ? { ...area, boundary } : area;
      }),
    [activeAreas, boundaryGeometryByAreaId],
  );
  const hasPointAreas = activeAreas.some((area) => searchAreaMode(area) === "point");
  const failedBoundaryGeometryLabels = activeAreas
    .filter((area) => failedBoundaryGeometryIds.has(area.id))
    .map((area) => shortSearchAreaLabel(area.label));

  React.useEffect(() => {
    if (!isLive) return;
    const pending = activeAreas.filter(
      (area) =>
        searchAreaMode(area) === "boundary" &&
        !area.boundary &&
        !boundaryGeometryByAreaId[area.id] &&
        !failedBoundaryGeometryIds.has(area.id),
    );
    if (pending.length === 0) return;

    let cancelled = false;
    void geoapifyLoadSearchAreaBoundaries({
      data: {
        areas: pending.map((area) => ({
          id: area.id,
          placeId: area.placeId,
          resultType: area.resultType,
        })),
      },
    })
      .then((rows) => {
        if (cancelled) return;
        const resolved: Record<string, SearchAreaBoundaryGeometry> = {};
        const failed = new Set<string>();
        for (const row of rows) {
          if (row.searchMode === "boundary" && row.boundary) resolved[row.id] = row.boundary;
          else failed.add(row.id);
        }
        if (Object.keys(resolved).length > 0) {
          setBoundaryGeometryByAreaId((current) => ({ ...current, ...resolved }));
        }
        if (failed.size > 0) {
          setFailedBoundaryGeometryIds((current) => new Set([...current, ...failed]));
        }
      })
      .catch((caught) => {
        if (cancelled) return;
        console.warn("[Matrundan] kunde inte hämta sökområdesgränser för kartan:", caught);
        setFailedBoundaryGeometryIds(
          (current) => new Set([...current, ...pending.map((area) => area.id)]),
        );
      });

    return () => {
      cancelled = true;
    };
  }, [activeAreas, boundaryGeometryByAreaId, failedBoundaryGeometryIds, isLive]);

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

  const isActionableSuggestion = React.useCallback(
    (suggestion: PlaceSuggestion) => {
      if (hiddenKeys.has(hiddenPlaceSuggestionKey(suggestion))) return false;
      if (addedResultIds.has(suggestion.externalId)) return false;
      if (state.places.some((place) => hasActiveProviderSource(place, suggestion))) return false;
      if (hasLocalManualSourceLink(localSourceLinks, suggestion)) return false;
      if (isLive) {
        const canonical =
          suggestion.canonical ??
          suggestion.identity?.knownPlace ??
          unambiguousPlaceCandidate(suggestion);
        const own = canonical ? state.places.find((p) => p.id === canonical.placeId) : undefined;
        return (own?.collectionStatus ?? canonical?.groupStatus) !== "active";
      }
      const match = matchingPlace(state.places, suggestion);
      return !(match && match.collectionStatus !== "archived");
    },
    [addedResultIds, hiddenKeys, isLive, localSourceLinks, state.places],
  );
  const isActionableRef = React.useRef(isActionableSuggestion);
  React.useEffect(() => {
    isActionableRef.current = isActionableSuggestion;
  }, [isActionableSuggestion]);

  const fillProviderPages = React.useCallback(
    async ({
      seed,
      startOffset,
      startProgress,
      startBudget,
      targetActionable,
      isStale,
      onProgress,
      maxPages = MAX_PROVIDER_PAGES_PER_ACTION,
    }: {
      seed: PlaceSuggestion[];
      startOffset: number;
      startProgress: AreaProgress;
      startBudget: SearchBudget;
      targetActionable: number;
      isStale: () => boolean;
      onProgress?: (currentResults: PlaceSuggestion[]) => void;
      maxPages?: number;
    }) => {
      let collected = seed;
      const failedAreaLabels = new Set<string>();
      let canonicalIncomplete = false;
      let offset = startOffset;
      let progress: AreaProgress = {
        offsets: { ...startProgress.offsets },
        exhaustedIds: [...startProgress.exhaustedIds],
      };
      let moreAvailable = false;
      let remaining: SearchBudget = { ...startBudget };
      let pages = 0;
      let recoveryPending = false;
      const observations: unknown[] = [];

      while (pages < maxPages && remaining.requests > 0 && remaining.credits > 0) {
        const isRecoveryPass = recoveryPending;
        const isFastFirstPage =
          pages === 0 && startOffset === 0 && seed.length === 0 && query.trim().length >= 2;
        const response = await searchPlaceDiscovery({
          data: {
            groupId: groupId!,
            text: query.trim() || undefined,
            centers: activeAreas.map((area) => ({
              id: area.id,
              label: shortSearchAreaLabel(area.label),
              lat: area.lat,
              lng: area.lng,
              searchMode: searchAreaMode(area),
              placeId: area.placeId,
            })),
            radiusKm,
            limit: RESULT_PAGE_SIZE,
            searchPhase: isFastFirstPage ? "primary" : "complete",
            offset: isRecoveryPass ? startOffset : offset,
            areaOffsets: isRecoveryPass ? startProgress.offsets : progress.offsets,
            exhaustedAreaIds: isRecoveryPass ? startProgress.exhaustedIds : progress.exhaustedIds,
            providerRequestLimit: remaining.requests,
            providerCreditLimit: remaining.credits,
          },
        });
        if (isStale()) return null;
        observations.push(response.observation);
        setSearchObservation(observations);
        pages += 1;
        remaining = {
          requests: Math.max(0, remaining.requests - response.budgetUsage.requests),
          credits: Math.max(0, remaining.credits - response.budgetUsage.reservedCredits),
        };
        canonicalIncomplete ||= response.canonicalIncomplete;
        collected = mergePlaceSearchPages(collected, response.results);
        // Make fully verified results usable while later pages are still loading.
        onProgress?.(collected);
        response.failedAreaLabels.forEach((label) => failedAreaLabels.add(label));
        moreAvailable = response.hasMore;
        offset = response.nextOffset;
        progress = { offsets: response.areaOffsets, exhaustedIds: response.exhaustedAreaIds };
        recoveryPending = !isRecoveryPass && response.pendingRecovery;
        // Stop if providers were limited or an area failed; never spin through its cursor.
        if (response.budgetUsage.limited || response.failedAreaIds.length > 0) break;
        // Display verified primary hits first; recovery uses the same remaining budget.
        if (recoveryPending) continue;
        if (!moreAvailable) break;
        if (countActionableSuggestions(collected, isActionableRef.current) >= targetActionable)
          break;
      }

      return {
        results: collected,
        failedAreaLabels: [
          ...failedAreaLabels,
          ...(canonicalIncomplete
            ? ["alla Matrundan-ställen (sök mer precist eller försök igen)"]
            : []),
        ],
        hasMore: moreAvailable,
        nextOffset: offset,
        areaProgress: progress,
        budgetRemaining: remaining,
      };
    },
    [activeAreas, groupId, query, radiusKm],
  );

  React.useEffect(() => {
    // Vänta in gömda förslag: fyllnaden till 20 handlingsbara träffar räknar mot
    // hiddenKeys, så en sökning som startar under laddningen kan bli underfylld.
    if (hiddenLoading) return;
    if (skipInitialSearchRef.current) {
      skipInitialSearchRef.current = false;
      return;
    }
    if (activeAreas.length === 0) {
      setResults([]);
      setResultsForSearchKey(currentSearchKey);
      setFailedAreas([]);
      setError(null);
      setDisplayLimit(RESULT_PAGE_SIZE);
      setHasMore(false);
      setNextOffset(0);
      setAreaProgress({ offsets: {}, exhaustedIds: [] });
      setBudgetRemaining(AUTO_SEARCH_BUDGET);
      setQueuedMore(false);
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
        let moreAvailable = false;
        let followingOffset = 0;
        let followingProgress: AreaProgress = { offsets: {}, exhaustedIds: [] };
        let followingBudget = AUTO_SEARCH_BUDGET;
        if (isLive) {
          const filled = await fillProviderPages({
            seed: [],
            startOffset: 0,
            startProgress: followingProgress,
            startBudget: AUTO_SEARCH_BUDGET,
            targetActionable: RESULT_PAGE_SIZE,
            isStale: () => requestId !== requestRef.current,
            onProgress: (currentResults) => {
              if (requestId !== requestRef.current) return;
              setResults(currentResults);
              setResultsForSearchKey(currentSearchKey);
            },
          });
          if (!filled) return;
          nextResults = filled.results;
          nextFailedAreas = filled.failedAreaLabels;
          moreAvailable = filled.hasMore;
          followingOffset = filled.nextOffset;
          followingProgress = filled.areaProgress;
          followingBudget = filled.budgetRemaining;
        } else {
          const settled = await Promise.allSettled(
            activeAreas.map(async (area) => ({
              area,
              results: await getPlacesProvider().search({
                query: query.trim() || undefined,
                center: { lat: area.lat, lng: area.lng },
                areaLabel: shortSearchAreaLabel(area.label),
                radiusKm,
                searchMode: searchAreaMode(area),
                boundary: area.boundary,
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
        setResultsForSearchKey(currentSearchKey);
        setFailedAreas(nextFailedAreas);
        setDisplayLimit(RESULT_PAGE_SIZE);
        setHasMore(moreAvailable);
        setNextOffset(followingOffset);
        setAreaProgress(followingProgress);
        setBudgetRemaining(followingBudget);
        // Keep an explicit point/autocomplete choice if the refreshed result still exists.
        setSelectedId((current) =>
          nextResults.some((result) => result.externalId === current) ? current : null,
        );
      } catch (caught) {
        if (requestId !== requestRef.current) return;
        setResults([]);
        setResultsForSearchKey(currentSearchKey);
        setHasMore(false);
        setNextOffset(0);
        setAreaProgress({ offsets: {}, exhaustedIds: [] });
        setBudgetRemaining(AUTO_SEARCH_BUDGET);
        setError(providerMessage(caught));
      } finally {
        if (requestId === requestRef.current) setLoading(false);
      }
    }, 300);
    return () => {
      window.clearTimeout(timer);
      requestRef.current++;
    };
  }, [
    activeAreas,
    currentSearchKey,
    fillProviderPages,
    hiddenLoading,
    isLive,
    query,
    radiusKm,
    retry,
  ]);

  const filteredResults = React.useMemo(
    () =>
      presentPlaceSearchResults(
        (resultMatchesSearch ? results : [])
          .map((result) => {
            const resolution = resolutions[result.externalId];
            return resolution
              ? {
                  ...result,
                  ...resolution.provider,
                  identity: {
                    providerPlaceId: result.externalId,
                    providerVersion:
                      resolution.providerVersion ?? result.identity?.providerVersion ?? "",
                    knownPlace: result.identity?.knownPlace ?? null,
                    candidates: resolution.candidates ?? [],
                    reviewRequired: resolution.status === "review_required",
                    identityConflict: resolution.status === "identity_conflict",
                  },
                }
              : result;
          })
          .filter((result) => !hiddenKeys.has(hiddenPlaceSuggestionKey(result))),
      ),
    [hiddenKeys, resolutions, resultMatchesSearch, results],
  );
  const visibleResults = React.useMemo(
    () =>
      filteredResults.slice(
        0,
        actionableSliceIndex(filteredResults, isActionableSuggestion, displayLimit),
      ),
    [displayLimit, filteredResults, isActionableSuggestion],
  );
  const shownActionableCount = countActionableSuggestions(visibleResults, isActionableSuggestion);
  const bufferedActionableCount = countActionableSuggestions(
    filteredResults,
    isActionableSuggestion,
  );
  const bufferedRemaining = Math.max(0, bufferedActionableCount - shownActionableCount);
  const canShowMore = bufferedRemaining > 0 || hasMore;
  const searchInFlight = loading || hiddenLoading || !resultMatchesSearch;
  const isReloadingResults = searchInFlight && visibleResults.length > 0;
  const isInitialSearchLoading = searchInFlight && visibleResults.length === 0;

  const showMoreResults = React.useCallback(async () => {
    const targetActionable = shownActionableCount + RESULT_PAGE_SIZE;
    if (bufferedRemaining > 0) {
      setDisplayLimit(targetActionable);
      if (bufferedActionableCount >= targetActionable) return;
    }
    if (mapFilling) {
      // Preserve the user's explicit "Visa fler" action while map refill settles.
      setQueuedMore(true);
      return;
    }
    if (!hasMore || !isLive || loadingMore) return;
    const requestId = requestRef.current;
    setLoadingMore(true);
    try {
      const filled = await fillProviderPages({
        seed: results,
        startOffset: nextOffset,
        startProgress: areaProgress,
        startBudget: EXPLICIT_MORE_BUDGET,
        targetActionable,
        isStale: () => requestId !== requestRef.current,
      });
      if (!filled) return;
      setResults(filled.results);
      setHasMore(filled.hasMore);
      setNextOffset(filled.nextOffset);
      setAreaProgress(filled.areaProgress);
      setDisplayLimit(targetActionable);
    } catch (caught) {
      if (requestId !== requestRef.current) return;
      console.warn("[Matrundan] kunde inte hämta fler sökträffar:", caught);
      toast.error(providerMessage(caught), {
        description: "Träffarna du redan ser ligger kvar. Försök gärna igen.",
      });
    } finally {
      if (requestId === requestRef.current) setLoadingMore(false);
    }
  }, [
    areaProgress,
    bufferedActionableCount,
    bufferedRemaining,
    fillProviderPages,
    hasMore,
    isLive,
    loadingMore,
    mapFilling,
    nextOffset,
    results,
    shownActionableCount,
  ]);

  React.useEffect(() => {
    if (!mapFilling && queuedMore) {
      setQueuedMore(false);
      void showMoreResults();
    }
  }, [mapFilling, queuedMore, showMoreResults]);

  React.useEffect(() => {
    if (
      !isLive ||
      !groupId ||
      hiddenLoading ||
      loading ||
      !resultMatchesSearch ||
      loadingMore ||
      queuedMore ||
      mapFilling ||
      !hasMore ||
      results.length === 0 ||
      results.length >= 200 ||
      budgetRemaining.requests <= 0 ||
      budgetRemaining.credits <= 0
    )
      return;
    const mapVisible = resultView === "karta" || window.matchMedia("(min-width: 1024px)").matches;
    if (!mapVisible) return;

    const searchKey = JSON.stringify([
      groupId,
      query,
      radiusKm,
      activeAreas.map((area) => [area.id, searchAreaMode(area), area.placeId]),
    ]);
    if (completedMapFillKeyRef.current === searchKey) return;
    completedMapFillKeyRef.current = searchKey;
    const requestId = requestRef.current;
    const budget: SearchBudget = {
      requests: Math.min(8, budgetRemaining.requests),
      credits: budgetRemaining.credits,
    };
    setMapFilling(true);
    void fillProviderPages({
      seed: results,
      startOffset: nextOffset,
      startProgress: areaProgress,
      startBudget: budget,
      maxPages: 8,
      targetActionable: 200,
      isStale: () => requestRef.current !== requestId,
      onProgress: (currentResults) => {
        if (requestRef.current === requestId) setResults(currentResults);
      },
    })
      .then((filled) => {
        if (!filled || requestRef.current !== requestId) return;
        setResults(filled.results);
        setHasMore(filled.hasMore);
        setNextOffset(filled.nextOffset);
        setAreaProgress(filled.areaProgress);
        setBudgetRemaining({
          requests: Math.max(
            0,
            budgetRemaining.requests - (budget.requests - filled.budgetRemaining.requests),
          ),
          credits: Math.max(
            0,
            budgetRemaining.credits - (budget.credits - filled.budgetRemaining.credits),
          ),
        });
        setFailedAreas((current) => [...new Set([...current, ...filled.failedAreaLabels])]);
      })
      .catch((error) => {
        if (requestRef.current === requestId) {
          console.warn("[Matrundan] Kartans komplettering kunde inte slutföras:", error);
        }
      })
      .finally(() => setMapFilling(false));
  }, [
    activeAreas,
    areaProgress,
    budgetRemaining,
    fillProviderPages,
    groupId,
    hasMore,
    hiddenLoading,
    isLive,
    loading,
    loadingMore,
    mapFilling,
    queuedMore,
    nextOffset,
    query,
    radiusKm,
    resultMatchesSearch,
    resultView,
    results,
  ]);

  const allSourceMatches = React.useMemo<SourceMatchResult[]>(() => {
    if (!canLinkSources || isLive) return [];
    return filteredResults.flatMap((result) => {
      if (
        addedResultIds.has(result.externalId) ||
        state.places.some((place) => hasActiveProviderSource(place, result)) ||
        hasLocalManualSourceLink(localSourceLinks, result)
      )
        return [];
      const match = findManualSourceLinkCandidate(state.places, result);
      return match ? [{ result, place: match.place, reason: match.reason }] : [];
    });
  }, [addedResultIds, canLinkSources, filteredResults, isLive, localSourceLinks, state.places]);
  const visibleResultIds = React.useMemo(
    () => new Set(visibleResults.map((result) => result.externalId)),
    [visibleResults],
  );
  const sourceMatches = React.useMemo(
    () => allSourceMatches.filter((match) => visibleResultIds.has(match.result.externalId)),
    [allSourceMatches, visibleResultIds],
  );
  const sourceMatchIds = React.useMemo(
    () => new Set(allSourceMatches.map((match) => match.result.externalId)),
    [allSourceMatches],
  );

  const statusForResult = React.useCallback(
    (suggestion: PlaceSuggestion): ResultStatus => {
      if (
        addedResultIds.has(suggestion.externalId) ||
        state.places.some((place) => hasActiveProviderSource(place, suggestion)) ||
        hasLocalManualSourceLink(localSourceLinks, suggestion)
      )
        return "existing";
      if (sourceMatchIds.has(suggestion.externalId)) return "linkable";
      if (isLive) {
        const canonical =
          suggestion.canonical ??
          suggestion.identity?.knownPlace ??
          unambiguousPlaceCandidate(suggestion);
        const own = canonical ? state.places.find((p) => p.id === canonical.placeId) : undefined;
        return (own?.collectionStatus ?? canonical?.groupStatus) === "active"
          ? "existing"
          : "available";
      }
      const match = matchingPlace(state.places, suggestion);
      return match && match.collectionStatus !== "archived" ? "existing" : "available";
    },
    [addedResultIds, isLive, localSourceLinks, sourceMatchIds, state.places],
  );
  const availableResults = React.useMemo(
    () => visibleResults.filter((result) => statusForResult(result) === "available"),
    [statusForResult, visibleResults],
  );
  const existingResults = React.useMemo(
    () => visibleResults.filter((result) => statusForResult(result) === "existing"),
    [statusForResult, visibleResults],
  );

  // Listpagination is independent of the map's larger, already fetched candidate pool.
  // Never render an unverified cross-group match: status and visibility still apply.
  const mapResults = React.useMemo(
    () =>
      selectMapCandidates(
        filteredResults.filter((result) => existingOpen || statusForResult(result) !== "existing"),
        activeAreas.map((area) => area.id),
      ),
    [activeAreas, existingOpen, filteredResults, statusForResult],
  );
  React.useEffect(() => {
    if (selectedId && !mapResults.some((result) => result.externalId === selectedId)) {
      setSelectedId(null);
    }
  }, [mapResults, selectedId]);

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
  }

  const mapItems: MultiAreaMapItem[] = mapResults.map((result) => {
    const nearestArea =
      activeAreas.find((area) => area.id === result.nearestAreaId) ??
      activeAreas.find((area) => shortSearchAreaLabel(area.label) === result.nearestAreaLabel);
    const areaContext = nearestArea
      ? searchAreaMode(nearestArea) === "boundary"
        ? ` · i ${shortSearchAreaLabel(nearestArea.label)}`
        : result.distanceKm != null
          ? ` · ~${formatSearchDistanceKm(result.distanceKm)} km från ${shortSearchAreaLabel(nearestArea.label)}`
          : ` · nära ${shortSearchAreaLabel(nearestArea.label)}`
      : result.distanceKm != null
        ? ` · ~${formatSearchDistanceKm(result.distanceKm)} km`
        : "";
    return {
      id: result.externalId,
      name: result.name,
      lat: result.lat,
      lng: result.lng,
      category: result.category,
      actionable: true,
      bulkSelectable: statusForResult(result) === "available" && canBulkAddSuggestion(result),
      actionLabel:
        statusForResult(result) === "existing"
          ? "Öppna stället"
          : statusForResult(result) === "linkable" || needsPlaceComparison(result)
            ? "Granska matchning"
            : (result.canonical ?? unambiguousPlaceCandidate(result))?.groupStatus === "archived"
              ? "Återställ"
              : "Lägg till",
      bulkSelected: bulkMode && selectedResultIds.has(result.externalId),
      eyebrow: `${CATEGORY_LABEL[result.category]}${areaContext}${result.searchAreaGroup === "nearby" ? " · utanför vald radie" : ""}`,
      description: [result.address, result.area, result.city].filter(Boolean).join(" · "),
    };
  });
  const unmappedCount = mapResults.filter(
    (result) => result.lat == null || result.lng == null,
  ).length;
  const mappableResultCount = mapResults.length - unmappedCount;
  const actionableResultCount = sourceMatches.length + availableResults.length;
  const resultSections = (
    <SearchResultSections
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
      showNearestAreaLabel={activeAreas.length > 1}
      disabled={interactionsDisabled}
    />
  );
  const map = (
    <MultiAreaPlaceMap
      items={mapItems}
      centers={activeAreasWithGeometry.map((area) => ({
        id: area.id,
        label: shortSearchAreaLabel(area.label),
        lat: area.lat,
        lng: area.lng,
        searchMode: searchAreaMode(area),
        boundary: area.boundary,
      }))}
      radiusKm={radiusKm}
      searchContextKey={JSON.stringify([query, radiusKm, activeAreas.map((area) => area.id)])}
      selectedId={selectedId}
      onSelect={handleMapSelect}
      onAction={(item) => {
        const result = mapResults.find((candidate) => candidate.externalId === item.id);
        if (!result) return;
        const sourceMatch = allSourceMatches.find((match) => match.result.externalId === item.id);
        if (sourceMatch) {
          onLinkSource(sourceMatch);
          return;
        }
        if (statusForResult(result) === "existing") {
          const placeId =
            (result.canonical ?? result.identity?.knownPlace ?? unambiguousPlaceCandidate(result))
              ?.placeId ?? matchingPlace(state.places, result)?.id;
          if (placeId) void navigate({ to: "/matstallen/$placeId", params: { placeId } });
        } else onBeginAdd(result);
      }}
      onToggleBulkSelection={
        bulkMode
          ? (item) => {
              const result = mapResults.find((candidate) => candidate.externalId === item.id);
              if (result && statusForResult(result) === "available") onToggleSelected(result);
            }
          : undefined
      }
      actionsDisabled={interactionsDisabled}
      className="h-[55vh] min-h-[340px] lg:h-[52vh] lg:min-h-[390px]"
    />
  );
  const genericSuggestions = React.useMemo(() => genericPlaceSearchSuggestions(query, 4), [query]);
  const placeAutocompleteSuggestions = React.useMemo(
    () =>
      query.trim().length < 2
        ? []
        : visibleResults.filter((result) => statusForResult(result) !== "existing").slice(0, 5),
    [query, statusForResult, visibleResults],
  );
  const suppressEmptyAutocomplete =
    query.trim().length >= 2 &&
    placeAutocompleteSuggestions.length === 0 &&
    existingResults.length > 0;

  return (
    <div className="space-y-4" data-search-observation={JSON.stringify(searchObservation)}>
      <SearchAreaControls
        heading="Sök i"
        addAreaActionLabel="Lägg till område eller adress"
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

      <PlaceSearchCombobox
        query={query}
        onQueryChange={setQuery}
        loading={searchInFlight}
        genericSuggestions={genericSuggestions}
        placeSuggestions={placeAutocompleteSuggestions}
        suppressEmptyState={suppressEmptyAutocomplete}
        resultsAlreadyShown={visibleResults.length > 0}
        onSelectPlace={(suggestion) => setSelectedId(suggestion.externalId)}
        onMissingPlace={onMissingPlace}
      />

      {activeAreas.length === 0 ? (
        <Empty text="Sök och välj minst ett sökområde." />
      ) : isInitialSearchLoading ? (
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
          {isReloadingResults ? (
            <div
              role="status"
              aria-live="polite"
              className="flex min-h-6 items-center gap-2 text-xs text-muted-foreground"
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Söker…
            </div>
          ) : null}
          {failedAreas.length > 0 ? (
            <div className="rounded-xl border border-amber-300/60 bg-amber-50/60 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
              Kunde inte söka i {failedAreas.join(", ")}. Övriga resultat visas.
            </div>
          ) : null}
          {failedBoundaryGeometryLabels.length > 0 ? (
            <div className="rounded-xl border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              Kunde inte visa gränsen för {failedBoundaryGeometryLabels.join(", ")} på kartan.
              Sökningen använder fortfarande det valda området.
            </div>
          ) : null}
          {visibleResults.length === 0 ? (
            <div className="space-y-3 rounded-xl border border-dashed border-border/70 bg-card/60 p-5 text-center">
              <div>
                <p className="text-sm font-medium">Inga matställen hittades</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {hasPointAreas
                    ? "Prova större avstånd runt punktvalen eller andra sökområden. Om stället saknas kan du lägga till det."
                    : "Prova andra sökområden. Om stället saknas kan du lägga till det."}
                </p>
              </div>
              <MissingPlaceButton disabled={interactionsDisabled} onActivate={onMissingPlace} />
            </div>
          ) : (
            <>
              {actionableResultCount > 0 ? (
                <>
                  <h3 className="text-sm font-medium lg:hidden">Ställen att lägga till</h3>
                  <div className="lg:hidden">
                    <ResultToggle value={resultView} onChange={setResultView} />
                    <div className="mt-2 flex min-h-11 items-center justify-between gap-3">
                      <span className="text-xs text-muted-foreground">
                        {resultView === "karta"
                          ? `Visar ${mappableResultCount} ställen på kartan`
                          : `Visar ${actionableResultCount} ${actionableResultCount === 1 ? "träff" : "träffar"} i listan`}
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
                </>
              ) : (
                <>
                  <div className="lg:hidden">{resultSections}</div>
                  <div className="hidden lg:block">{resultSections}</div>
                </>
              )}
              {canShowMore ? (
                <div className="flex justify-center">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="min-h-11 w-full sm:w-auto"
                    disabled={loadingMore || interactionsDisabled}
                    onClick={() => void showMoreResults()}
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Laddar fler…
                      </>
                    ) : (
                      "Visa fler"
                    )}
                  </Button>
                </div>
              ) : null}
              {unmappedCount > 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  {unmappedCount} {unmappedCount === 1 ? "träff saknar" : "träffar saknar"}{" "}
                  kartposition och visas bara i listan.
                </p>
              ) : null}
              <div className="flex min-w-0 flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Hittar du inte rätt ställe?</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Lägg till det som saknas först när sökningen inte räcker.
                  </p>
                </div>
                <MissingPlaceButton disabled={interactionsDisabled} onActivate={onMissingPlace} />
              </div>
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
        className={`flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm font-medium ${value === "lista" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
        onClick={() => onChange("lista")}
        aria-pressed={value === "lista"}
      >
        <List className="h-4 w-4" /> Lista
      </button>
      <button
        type="button"
        className={`flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm font-medium ${value === "karta" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
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

type PlaceSearchOption =
  | { kind: "generic"; key: string; label: string; meta: string; searchValue: string }
  | { kind: "place"; key: string; label: string; meta: string; suggestion: PlaceSuggestion };

function placeOptionMeta(suggestion: PlaceSuggestion): string {
  const location = suggestion.address?.trim()
    ? formatPlaceAddressWithCity(suggestion.address, suggestion.city)
    : [suggestion.area, suggestion.city].filter(Boolean).join(" · ");
  return [CATEGORY_LABEL[suggestion.category], location].filter(Boolean).join(" · ");
}

function PlaceSearchCombobox({
  query,
  onQueryChange,
  loading,
  genericSuggestions,
  placeSuggestions,
  suppressEmptyState = false,
  resultsAlreadyShown = false,
  onSelectPlace,
  onMissingPlace,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  loading: boolean;
  genericSuggestions: GenericPlaceSearchSuggestion[];
  placeSuggestions: PlaceSuggestion[];
  suppressEmptyState?: boolean;
  resultsAlreadyShown?: boolean;
  onSelectPlace: (suggestion: PlaceSuggestion) => void;
  onMissingPlace: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [activeIx, setActiveIx] = React.useState(-1);
  const genericOptions: PlaceSearchOption[] = genericSuggestions.map((suggestion) => ({
    kind: "generic",
    key: suggestion.id,
    label: suggestion.label,
    meta: suggestion.groupLabel,
    searchValue: suggestion.searchValue,
  }));
  const placeOptions: PlaceSearchOption[] = (resultsAlreadyShown ? [] : placeSuggestions).map(
    (suggestion) => ({
      kind: "place",
      key: suggestion.externalId,
      label: suggestion.name,
      meta: placeOptionMeta(suggestion),
      suggestion,
    }),
  );
  const isInternalOption = (option: PlaceSearchOption) =>
    option.kind === "place" &&
    (option.suggestion.kind === "canonical" ||
      !!unambiguousPlaceCandidate(option.suggestion) ||
      !!option.suggestion.identity?.knownPlace);
  const internalOptions = placeOptions.filter(isInternalOption);
  const externalOptions = placeOptions.filter((option) => !isInternalOption(option));
  const options = [...genericOptions, ...internalOptions, ...externalOptions];
  const hasQuery = query.trim().length >= 2;
  const showList =
    open && hasQuery && (options.length > 0 || (!suppressEmptyState && !resultsAlreadyShown));

  React.useEffect(() => {
    setActiveIx(-1);
  }, [query]);

  React.useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    let previousHeight = viewport.height;
    const onResize = () => {
      const nextHeight = viewport.height;
      // Android keyboard dismissal may resize the viewport without blurring the input.
      if (nextHeight - previousHeight > 120) setOpen(false);
      previousHeight = nextHeight;
    };
    viewport.addEventListener("resize", onResize);
    return () => viewport.removeEventListener("resize", onResize);
  }, []);

  function select(option: PlaceSearchOption) {
    if (option.kind === "generic") onQueryChange(option.label);
    else onSelectPlace(option.suggestion);
    setOpen(false);
    setActiveIx(-1);
  }

  function activateMissingPlace() {
    setOpen(false);
    setActiveIx(-1);
    onMissingPlace();
  }

  function move(direction: 1 | -1) {
    if (options.length === 0) return;
    setActiveIx((current) =>
      current < 0
        ? direction === 1
          ? 0
          : options.length - 1
        : (current + direction + options.length) % options.length,
    );
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (options.length === 0) return;
      event.preventDefault();
      setOpen(true);
      move(event.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (event.key === "Enter" && showList && activeIx >= 0) {
      event.preventDefault();
      select(options[activeIx]);
      return;
    }
    if (event.key === "Escape") {
      setOpen(false);
      setActiveIx(-1);
    }
  }

  function renderGroup(label: string, groupOptions: PlaceSearchOption[], offset: number) {
    if (groupOptions.length === 0) return null;
    return (
      <div
        role="group"
        aria-label={label}
        className="border-t border-border/60 pt-1 first:border-t-0 first:pt-0"
      >
        <p className="flex items-center gap-1.5 px-2 pb-1 pt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label === "Finns i Matrundan" ? <MatrundanBrand variant="mark" size="xs" /> : null}
          {label}
        </p>
        {groupOptions.map((option, index) => {
          const optionIndex = offset + index;
          return (
            <div
              key={`${option.kind}:${option.key}`}
              id={`place-search-opt-${optionIndex}`}
              role="option"
              aria-selected={optionIndex === activeIx}
            >
              <button
                type="button"
                className={[
                  "flex w-full min-w-0 items-center gap-2 rounded px-2 py-2 text-left hover:bg-accent",
                  optionIndex === activeIx ? "bg-accent" : "",
                ].join(" ")}
                onMouseDown={(event) => {
                  event.preventDefault();
                  select(option);
                }}
              >
                <span className="min-w-0 flex-1">
                  <span className="block min-w-0 break-words font-medium text-foreground">
                    {option.label}
                  </span>
                  {option.meta ? (
                    <span className="mt-0.5 block min-w-0 break-words text-xs leading-snug text-muted-foreground">
                      {option.meta}
                    </span>
                  ) : null}
                </span>
                {option.kind === "place" ? (
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                ) : null}
              </button>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor="place-query">Sök matställen</Label>
      <div className="relative min-w-0">
        <Search className="pointer-events-none absolute left-3 top-[22px] h-4 w-4 -translate-y-1/2 text-muted-foreground sm:top-1/2" />
        <Input
          id="place-query"
          className="pl-9"
          placeholder="Namn, kök eller typ"
          value={query}
          onChange={(event) => {
            onQueryChange(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls="place-search-listbox"
          aria-activedescendant={activeIx >= 0 ? `place-search-opt-${activeIx}` : undefined}
        />
        {showList ? (
          <div
            id="place-search-listbox"
            role="listbox"
            aria-label="Förslag på kök, typer och matställen"
            className="absolute left-0 right-0 top-full z-30 mt-1 max-h-[min(42dvh,20rem)] w-full min-w-0 overflow-auto overscroll-contain rounded-md border bg-popover p-1 text-sm shadow-md sm:max-h-72"
          >
            {options.length === 0 ? (
              <p className="px-2 py-2 text-muted-foreground">
                {loading ? "Söker…" : "Inga förslag"}
              </p>
            ) : (
              <>
                {renderGroup("Kök och typer", genericOptions, 0)}
                {renderGroup("Finns i Matrundan", internalOptions, genericOptions.length)}
                {renderGroup(
                  "Hittat i kartan",
                  externalOptions,
                  genericOptions.length + internalOptions.length,
                )}
                {loading ? (
                  <p className="px-2 py-2 text-xs text-muted-foreground">Söker fler matställen…</p>
                ) : null}
              </>
            )}
            {options.length === 0 && !loading ? (
              <div role="presentation" className="mt-1 border-t border-border/60 pt-1">
                <p className="px-2 pt-1 text-xs text-muted-foreground">
                  Hittar du inte rätt ställe?
                </p>
                <MissingPlaceButton
                  className="mt-1 w-full justify-start"
                  disabled={loading}
                  onActivate={activateMissingPlace}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MissingPlaceButton({
  disabled,
  onActivate,
  className = "",
}: {
  disabled?: boolean;
  onActivate: () => void;
  className?: string;
}) {
  const armedRef = React.useRef(false);
  return (
    <Button
      type="button"
      variant="outline"
      className={`min-h-11 ${className}`}
      disabled={disabled}
      onPointerDown={() => {
        armedRef.current = true;
      }}
      onClick={(event) => {
        const fromKeyboard = event.detail === 0;
        const fromOwnPointer = armedRef.current;
        armedRef.current = false;
        if (!fromKeyboard && !fromOwnPointer) return;
        onActivate();
      }}
    >
      <Plus className="h-4 w-4" />
      Lägg till ett ställe som saknas
    </Button>
  );
}
