import type { PlaceSuggestion } from "./places-provider";
import type { Place } from "./types";

const MAX_LINK_DISTANCE_KM = 0.1;

export type ManualSourceMatchReason =
  | "same_name_and_address"
  | "same_name_and_nearby"
  | "same_address_and_nearby";

export interface ManualSourceLinkCandidate {
  place: Place;
  reason: ManualSourceMatchReason;
  distanceKm: number | null;
}

export interface ProviderSourceLinkInput {
  placeId: string;
  provider: string;
  providerPlaceId: string;
  name: string;
  address: string;
  city: string;
  lat?: number;
  lng?: number;
  raw: unknown;
}

function normalize(value: string | undefined): string {
  return (value ?? "")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("sv-SE")
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ");
}

function coordinates(value: { lat?: number; lng?: number }): { lat: number; lng: number } | null {
  return Number.isFinite(value.lat) && Number.isFinite(value.lng)
    ? { lat: value.lat as number, lng: value.lng as number }
    : null;
}

export function distanceKm(
  first: { lat: number; lng: number },
  second: { lat: number; lng: number },
): number {
  const radiusKm = 6371;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDistance = toRadians(second.lat - first.lat);
  const longitudeDistance = toRadians(second.lng - first.lng);
  const value =
    Math.sin(latitudeDistance / 2) ** 2 +
    Math.cos(toRadians(first.lat)) *
      Math.cos(toRadians(second.lat)) *
      Math.sin(longitudeDistance / 2) ** 2;
  return 2 * radiusKm * Math.asin(Math.sqrt(value));
}

export function hasActiveProviderSource(place: Place, suggestion: PlaceSuggestion): boolean {
  const provider = normalize(suggestion.provider ?? "geoapify");
  const providerPlaceId = suggestion.externalId.trim();
  return (place.sources ?? []).some(
    (source) =>
      source.status === "active" &&
      normalize(source.provider) === provider &&
      source.providerPlaceId === providerPlaceId,
  );
}

function isProviderlessManualPlace(place: Place): boolean {
  return (
    place.origin === "manual" &&
    place.collectionStatus !== "archived" &&
    !(place.sources ?? []).some((source) => source.status === "active")
  );
}

function matchOne(place: Place, suggestion: PlaceSuggestion): ManualSourceLinkCandidate | null {
  if (!isProviderlessManualPlace(place)) return null;

  const sameName =
    normalize(place.name) !== "" && normalize(place.name) === normalize(suggestion.name);
  const sameAddress =
    normalize(place.address) !== "" &&
    normalize(place.address) === normalize(suggestion.address) &&
    normalize(place.city) === normalize(suggestion.city);
  const placeCoordinates = coordinates(place);
  const suggestionCoordinates = coordinates(suggestion);
  const measuredDistance =
    placeCoordinates && suggestionCoordinates
      ? distanceKm(placeCoordinates, suggestionCoordinates)
      : null;
  const nearby = measuredDistance != null && measuredDistance <= MAX_LINK_DISTANCE_KM;

  if (sameName && sameAddress) {
    return { place, reason: "same_name_and_address", distanceKm: measuredDistance };
  }
  if (sameName && nearby) {
    return { place, reason: "same_name_and_nearby", distanceKm: measuredDistance };
  }
  if (sameAddress && nearby) {
    return { place, reason: "same_address_and_nearby", distanceKm: measuredDistance };
  }
  return null;
}

export function findManualSourceLinkCandidate(
  places: Place[],
  suggestion: PlaceSuggestion,
): ManualSourceLinkCandidate | null {
  const matches = places.flatMap((place) => {
    const match = matchOne(place, suggestion);
    return match ? [match] : [];
  });
  return matches.length === 1 ? matches[0] : null;
}

export const MANUAL_SOURCE_MATCH_REASON_LABEL: Record<ManualSourceMatchReason, string> = {
  same_name_and_address: "Samma namn och adress",
  same_name_and_nearby: "Samma namn och kartposition i närheten",
  same_address_and_nearby: "Samma adress och kartposition i närheten",
};
