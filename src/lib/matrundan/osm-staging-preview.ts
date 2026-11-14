/** Staging-only search comparison. OSM evidence is never saved as place metadata. */
import { searchConceptById } from "./search-catalogue";
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

/** Deliberately limited to the three agreed search concepts, not all 38. */
export function osmPreviewTokens(
  id: OsmPreviewFilterId,
  phase: OsmPreviewPhase,
): string[] {
  if (phase === "related") return id === "specialty:pasta" ? ["italian"] : [];
  if (id === "specialty:pasta") return ["pasta"];
  if (id === "specialty:ramen") return ["ramen"];
  // Follow the agreed catalogue's Asian family instead of inventing new OSM mappings.
  return [...(searchConceptById("search:asiatiskt")?.tokens ?? [])];
}

export function osmPreviewKey(row: Pick<OsmPreviewRow, "osmType" | "osmId">): string {
  return row.osmType + ":" + row.osmId;
}

function osmCategory(row: OsmPreviewRow): PlaceCategory {
  if (row.shop === "bakery") return "bageri";
  if (row.amenity === "cafe") return "café";
  if (row.amenity === "fast_food") return "snabbmat";
  if (row.amenity === "pub" || row.amenity === "bar" || row.amenity === "biergarten")
    return "pub";
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
    name: row.name || "Matställe utan namn",
    category: osmCategory(row),
    address: "",
    city: "",
    // Raw OSM cuisine tags are shown as evidence, not persisted as Matrundan classifications.
    cuisines: row.cuisine?.split(";").map((value) => value.trim()).filter(Boolean),
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
