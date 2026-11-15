/** Read-only OSM supplement for the ordinary staging discovery list. */
import * as React from "react";
import { searchOsmStagingPreview, type OsmStagingPreviewResponse } from "./osm-staging.functions";
import {
  isOsmPreviewFilter,
  mergeOsmPreviewPages,
  osmPreviewSuggestion,
  type OsmPreviewFilterId,
  type OsmPreviewPhase,
} from "./osm-staging-preview";
import type { PlaceSuggestion } from "./places-provider";
import type { SearchArea, SearchRadiusKm } from "./types";

type Cursor = NonNullable<OsmStagingPreviewResponse["cursor"]>;
interface State {
  key: string;
  pending: boolean;
  loadingMore: boolean;
  rows: PlaceSuggestion[];
  generation: number | null;
  directCursor: Cursor | null;
  relatedStarted: boolean;
  relatedCursor: Cursor | null;
  error: string | null;
}
function blank(key: string): State {
  return {
    key,
    pending: false,
    loadingMore: false,
    rows: [],
    generation: null,
    directCursor: null,
    relatedStarted: false,
    relatedCursor: null,
    error: null,
  };
}

export function useOsmHybridSearch({
  enabled,
  area,
  radiusKm,
  filterId,
  searchKey,
}: {
  enabled: boolean;
  area: SearchArea | null;
  radiusKm: SearchRadiusKm;
  filterId: string | null;
  searchKey: string;
}) {
  const [state, setState] = React.useState<State>(() => blank(searchKey));
  const [attempt, setAttempt] = React.useState(0);
  const currentKey = React.useRef(searchKey);
  currentKey.current = searchKey;
  const moreInFlight = React.useRef(false);
  const filter: OsmPreviewFilterId | null = isOsmPreviewFilter(filterId) ? filterId : null;
  const radius = radiusKm === 3 || radiusKm === 5 ? radiusKm : null;
  const eligible = enabled && area != null && filter !== null && radius !== null;

  React.useEffect(() => {
    let cancelled = false;
    moreInFlight.current = false;
    setState({ ...blank(searchKey), pending: eligible });
    if (!eligible || !area || !filter || !radius) return;
    const center = area;
    const selectedFilter = filter;
    const selectedRadius = radius;
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
        if (cancelled || currentKey.current !== searchKey) return;
        if (direct.status !== "ok") throw new Error("OSM-indexet är inte inläst i staging.");
        let rows = direct.results.map((row) =>
          osmPreviewSuggestion(row, selectedFilter, "direct", center.id, center.label),
        );
        let relatedStarted = false;
        let relatedCursor: Cursor | null = null;
        if (!direct.hasMore && selectedFilter === "specialty:pasta") {
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
          if (cancelled || currentKey.current !== searchKey) return;
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
        if (!cancelled && currentKey.current === searchKey) {
          setState({
            key: searchKey,
            pending: false,
            loadingMore: false,
            rows,
            generation: direct.generation ?? null,
            directCursor: direct.cursor ?? null,
            relatedStarted,
            relatedCursor,
            error: null,
          });
        }
      } catch (error) {
        if (!cancelled && currentKey.current === searchKey)
          setState({
            ...blank(searchKey),
            error: error instanceof Error ? error.message : "OSM-sökningen misslyckades.",
          });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchKey, attempt, eligible, area, filter, radius]);

  const ready = state.key === searchKey && eligible;
  const hasMore = Boolean(
    ready &&
    state.generation &&
    (state.directCursor ||
      (filter === "specialty:pasta" && !state.relatedStarted) ||
      state.relatedCursor),
  );

  const loadMore = React.useCallback(async () => {
    if (!ready || !hasMore || !area || !radius || !filter || moreInFlight.current) return;
    moreInFlight.current = true;
    const prior = state;
    const phase: OsmPreviewPhase = prior.directCursor ? "direct" : "related";
    const cursor = phase === "direct" ? prior.directCursor : prior.relatedCursor;
    setState((current) =>
      current.key === searchKey ? { ...current, loadingMore: true, error: null } : current,
    );
    try {
      const page = await searchOsmStagingPreview({
        data: {
          lat: area.lat,
          lng: area.lng,
          radiusKm: radius,
          filterId: filter,
          phase,
          cursor,
        },
      });
      if (currentKey.current !== searchKey) return;
      if (page.status !== "ok" || page.generation !== prior.generation)
        throw new Error("OSM-indexet ändrades under sökningen. Sök igen för att fortsätta.");
      setState((current) =>
        current.key !== searchKey
          ? current
          : {
              ...current,
              rows: mergeOsmPreviewPages(
                current.rows,
                page.results.map((row) =>
                  osmPreviewSuggestion(row, filter, phase, area.id, area.label),
                ),
              ),
              directCursor: phase === "direct" ? (page.cursor ?? null) : current.directCursor,
              relatedStarted: current.relatedStarted || phase === "related",
              relatedCursor: phase === "related" ? (page.cursor ?? null) : current.relatedCursor,
            },
      );
    } catch (error) {
      if (currentKey.current === searchKey)
        setState((current) =>
          current.key === searchKey
            ? {
                ...current,
                error:
                  error instanceof Error ? error.message : "Kunde inte hämta fler OSM-träffar.",
              }
            : current,
        );
    } finally {
      moreInFlight.current = false;
      if (currentKey.current === searchKey)
        setState((current) =>
          current.key === searchKey ? { ...current, loadingMore: false } : current,
        );
    }
  }, [area, filter, hasMore, radius, ready, searchKey, state]);

  return {
    rows: ready ? state.rows : [],
    pending: ready ? state.pending : false,
    loadingMore: ready ? state.loadingMore : false,
    hasMore,
    settled: ready && !state.pending && (state.generation !== null || state.error !== null),
    error: ready ? state.error : null,
    loadMore,
    retry: () => setAttempt((value) => value + 1),
  };
}
