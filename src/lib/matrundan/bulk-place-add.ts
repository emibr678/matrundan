import type { PlaceSuggestion } from "./places-provider";
import type { PlaceCategory } from "./types";

export const MAX_BULK_PLACE_COUNT = 50;

export type BulkPlaceAddStatus = "added" | "restored" | "existing" | "failed";

export interface ProviderPlaceBatchInput {
  externalId: string;
  provider: string;
  providerPlaceId: string;
  name: string;
  category: PlaceCategory;
  cuisines: string[];
  address: string;
  area?: string;
  city: string;
  lat?: number;
  lng?: number;
  raw: unknown;
}

export interface BulkPlaceAddItemResult {
  externalId: string;
  name: string;
  status: BulkPlaceAddStatus;
  placeId?: string | null;
  message?: string | null;
}

export interface BulkPlaceAddResult {
  items: BulkPlaceAddItemResult[];
  added: number;
  restored: number;
  existing: number;
  failed: number;
}

function parseRawProviderData(raw: string | undefined): unknown {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return {};
  }
}

export function toProviderPlaceBatchInput(suggestion: PlaceSuggestion): ProviderPlaceBatchInput {
  return {
    externalId: suggestion.externalId,
    provider: suggestion.provider ?? "geoapify",
    providerPlaceId: suggestion.externalId,
    name: suggestion.name,
    category: suggestion.category,
    cuisines: suggestion.cuisines ?? [],
    address: suggestion.address ?? "",
    area: suggestion.area,
    city: suggestion.city ?? "",
    lat: suggestion.lat,
    lng: suggestion.lng,
    raw: parseRawProviderData(suggestion.raw),
  };
}

export function toggleBulkPlaceSelection(
  current: PlaceSuggestion[],
  suggestion: PlaceSuggestion,
): PlaceSuggestion[] {
  if (current.some((item) => item.externalId === suggestion.externalId)) {
    return current.filter((item) => item.externalId !== suggestion.externalId);
  }
  if (current.length >= MAX_BULK_PLACE_COUNT) return current;
  return [...current, suggestion];
}

export function remainingBulkSelections(
  current: PlaceSuggestion[],
  result: BulkPlaceAddResult,
): PlaceSuggestion[] {
  const failedIds = new Set(
    result.items.filter((item) => item.status === "failed").map((item) => item.externalId),
  );
  return current.filter((item) => failedIds.has(item.externalId));
}

export function completedBulkExternalIds(result: BulkPlaceAddResult): string[] {
  return result.items.filter((item) => item.status !== "failed").map((item) => item.externalId);
}

export function successfulBulkPlaceCount(result: BulkPlaceAddResult): number {
  return result.added + result.restored;
}
