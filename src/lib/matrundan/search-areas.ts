import type { PlaceSuggestion } from "./places-provider";
import type { SearchArea, SearchRadiusKm } from "./types";

export const SEARCH_RADIUS_OPTIONS = [
  1, 2, 3, 5, 10, 25, 50,
] as const satisfies readonly SearchRadiusKm[];

const BROAD_ADMINISTRATIVE_RESULT_TYPES = new Set(["county", "state", "country"]);

export function isSearchRadiusKm(value: number): value is SearchRadiusKm {
  return (SEARCH_RADIUS_OPTIONS as readonly number[]).includes(value);
}

/**
 * Geoapify-resultat på kommun-, läns- eller landsnivå är för stora för
 * Matrundans punkt + radie-modell. Ort, stadsdel, gata, adress och postnummer
 * är fortsatt giltiga sökcentrum.
 */
export function isBroadAdministrativeSearchArea(resultType?: string): boolean {
  return BROAD_ADMINISTRATIVE_RESULT_TYPES.has(resultType?.trim().toLowerCase() ?? "");
}

export function shortSearchAreaLabel(label: string): string {
  const first = label
    .split(",")
    .map((part) => part.trim())
    .find(Boolean);
  return first || label.trim() || "Område";
}

export function verifiedSearchAreas(areas: SearchArea[] | undefined): SearchArea[] {
  return (areas ?? []).filter(
    (area) =>
      area.provider === "geoapify" &&
      area.placeId.trim().length > 0 &&
      Number.isFinite(area.lat) &&
      Number.isFinite(area.lng),
  );
}

export interface AreaSearchResult {
  areaId: string;
  areaLabel: string;
  results: PlaceSuggestion[];
}

export function mergeAreaSearchResults(
  searches: AreaSearchResult[],
  limit = 50,
): PlaceSuggestion[] {
  const merged = new Map<string, PlaceSuggestion>();

  for (const search of searches) {
    for (const suggestion of search.results) {
      const key = `${suggestion.provider ?? "unknown"}:${suggestion.externalId}`;
      const current = merged.get(key);
      const labels = new Set([
        ...(current?.matchingAreaLabels ?? []),
        ...(suggestion.matchingAreaLabels ?? []),
        search.areaLabel,
      ]);
      const nextDistance = suggestion.distanceKm ?? Number.POSITIVE_INFINITY;
      const currentDistance = current?.distanceKm ?? Number.POSITIVE_INFINITY;
      const useSuggestion = !current || nextDistance < currentDistance;
      const base = useSuggestion ? suggestion : current;

      merged.set(key, {
        ...base,
        nearestAreaLabel:
          useSuggestion || !current?.nearestAreaLabel
            ? (suggestion.nearestAreaLabel ?? search.areaLabel)
            : current.nearestAreaLabel,
        matchingAreaLabels: [...labels],
      });
    }
  }

  return [...merged.values()]
    .sort((a, b) => {
      const distance =
        (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY);
      return distance || a.name.localeCompare(b.name, "sv-SE");
    })
    .slice(0, Math.max(0, limit));
}
