/** Staging-only search comparison. OSM evidence is never saved as place metadata. */
import { relatedSearchConcepts, searchConceptById } from "./search-catalogue";
import { rankNewPlaceSearchPage } from "./place-search-pagination";
import type { PlaceSuggestion } from "./places-provider";
import type { PlaceCategory } from "./types";

export const OSM_PREVIEW_FILTER_IDS = [
  "specialty:pasta",
  "specialty:ramen",
  "search:asiatiskt",
] as const;
export type OsmPreviewFilterId = (typeof OSM_PREVIEW_FILTER_IDS)[number];
export type OsmPreviewPhase = "direct" | "related";

export interface OsmPreviewRow {
  osmType: "node" | "way" | "relation";
  osmId: number;
  name: string;
  amenity?: string | null;
  shop?: string | null;
  cuisine?: string | null;
  lat: number;
  lng: number;
  distanceM: number;
}

export function isOsmPreviewFilter(id: string | null | undefined): id is OsmPreviewFilterId {
  return OSM_PREVIEW_FILTER_IDS.some((known) => known === id);
}

/** OSM cuisine mappings reuse the canonical search catalogue.
 * A separate three-filter pilot gate controls which mappings are exposed.
 */
export function osmConceptCuisineTokens(id: string, phase: OsmPreviewPhase): string[] {
  const concepts = phase === "direct" ? [searchConceptById(id)] : relatedSearchConcepts(id);
  return [...new Set(concepts.flatMap((concept) => concept?.tokens ?? []))].filter((token) =>
    /^[a-z0-9_:-]{1,64}$/.test(token),
  );
}

export function osmPreviewTokens(id: OsmPreviewFilterId, phase: OsmPreviewPhase): string[] {
  return osmConceptCuisineTokens(id, phase);
}

export function osmPreviewKey(row: Pick<OsmPreviewRow, "osmType" | "osmId">): string {
  return row.osmType + ":" + row.osmId;
}

function osmCategory(row: OsmPreviewRow): PlaceCategory {
  if (row.shop === "bakery") return "bageri";
  if (row.amenity === "cafe") return "café";
  if (row.amenity === "fast_food") return "snabbmat";
  if (row.amenity === "pub" || row.amenity === "bar" || row.amenity === "biergarten") return "pub";
  return "restaurang";
}

export function osmPreviewSuggestion(
  row: OsmPreviewRow,
  filter: OsmPreviewFilterId,
  phase: OsmPreviewPhase,
  areaId: string,
  areaLabel: string,
): PlaceSuggestion {
  return {
    kind: "provider",
    provider: "openstreetmap",
    externalId: osmPreviewKey(row),
    resultKey: "provider:openstreetmap:" + osmPreviewKey(row),
    searchIdentityKey: "osm:" + osmPreviewKey(row),
    name: row.name || "Matställe utan namn",
    category: osmCategory(row),
    address: "",
    city: "",
    // Raw OSM cuisine tags are shown as evidence, not persisted as Matrundan classifications.
    cuisines: row.cuisine
      ?.split(";")
      .map((value) => value.trim())
      .filter(Boolean),
    lat: row.lat,
    lng: row.lng,
    distanceKm: row.distanceM / 1000,
    nearestAreaId: areaId,
    nearestAreaLabel: areaLabel,
    searchEvidence: {
      intentId: filter,
      kind: phase === "direct" ? "metadata" : "association",
      ...(phase === "related" ? { relatedId: "cuisine:italian" } : {}),
    },
  };
}

/** Stable OSM type+ID only; never fuzzy-name or coordinate matching. */
export function mergeOsmPreviewPages(
  current: PlaceSuggestion[],
  incoming: PlaceSuggestion[],
): PlaceSuggestion[] {
  const seen = new Set(current.map((item) => item.externalId));
  return [
    ...current,
    ...incoming.filter((item) => {
      if (seen.has(item.externalId)) return false;
      seen.add(item.externalId);
      return true;
    }),
  ];
}

/** One read-only mixed list. Only exact OSM object identity may deduplicate.
 * Geoapify remains the only addable provider for this staging pilot.
 */
export function mergeHybridPreviewResults(
  geoapify: PlaceSuggestion[],
  osm: PlaceSuggestion[],
  query: string,
): PlaceSuggestion[] {
  const merged = new Map<string, PlaceSuggestion>();
  for (const result of geoapify) {
    const key =
      result.searchIdentityKey ?? (result.provider ?? "unknown") + ":" + result.externalId;
    merged.set(key, result);
  }
  for (const result of osm) {
    const key = result.searchIdentityKey ?? "openstreetmap:" + result.externalId;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, result);
      continue;
    }
    // Keep Geoapify's server-reviewed identity and addable action intact.
    // OSM provides only ephemeral search evidence, not persisted cuisines.
    if (existing.provider !== "openstreetmap") {
      merged.set(key, {
        ...existing,
        searchEvidence:
          existing.searchEvidence?.kind === "association" &&
          result.searchEvidence?.kind !== "association"
            ? result.searchEvidence
            : (existing.searchEvidence ?? result.searchEvidence),
      });
    }
  }
  return rankNewPlaceSearchPage([...merged.values()], query);
}
