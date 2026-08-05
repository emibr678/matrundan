import { isCredibleStreetAddress } from "./place-links";

export const EXTERNAL_OSM_TYPES = ["node", "way", "relation"] as const;
export type ExternalOsmType = (typeof EXTERNAL_OSM_TYPES)[number];

export interface ExternalPlaceLocation {
  address: string;
  area: string | null;
  city: string;
  lat: number;
  lng: number;
  osmType: ExternalOsmType | null;
  osmId: string | null;
}

export interface CurrentPlaceLocation {
  name: string;
  address: string;
  area?: string | null;
  city: string;
  lat?: number | null;
  lng?: number | null;
}

export interface PlaceLocationDiff {
  addressChanged: boolean;
  areaChanged: boolean;
  cityChanged: boolean;
  positionChanged: boolean;
  hasChanges: boolean;
}

const POSITION_EPSILON = 0.00001;

function normalizedText(value: string | null | undefined): string {
  return (value ?? "").trim().toLocaleLowerCase("sv-SE").replace(/\s+/g, " ");
}

export function isUsableExternalLocation(
  location: ExternalPlaceLocation | null | undefined,
  placeName?: string | null,
): location is ExternalPlaceLocation {
  if (!location || !isCredibleStreetAddress(location.address, placeName)) return false;
  if (!Number.isFinite(location.lat) || location.lat < -90 || location.lat > 90) return false;
  if (!Number.isFinite(location.lng) || location.lng < -180 || location.lng > 180) return false;
  return Boolean(location.city.trim());
}

export function comparePlaceLocation(
  current: CurrentPlaceLocation,
  external: ExternalPlaceLocation | null | undefined,
): PlaceLocationDiff | null {
  if (!isUsableExternalLocation(external, current.name)) return null;

  const addressChanged = normalizedText(current.address) !== normalizedText(external.address);
  const areaChanged = normalizedText(current.area) !== normalizedText(external.area);
  const cityChanged = normalizedText(current.city) !== normalizedText(external.city);
  const positionChanged =
    current.lat == null ||
    current.lng == null ||
    Math.abs(current.lat - external.lat) > POSITION_EPSILON ||
    Math.abs(current.lng - external.lng) > POSITION_EPSILON;

  return {
    addressChanged,
    areaChanged,
    cityChanged,
    positionChanged,
    hasChanges: addressChanged || areaChanged || cityChanged || positionChanged,
  };
}

export function placeLocationLabel(location: {
  address?: string | null;
  city?: string | null;
}): string {
  return [location.address?.trim(), location.city?.trim()].filter(Boolean).join(", ");
}
