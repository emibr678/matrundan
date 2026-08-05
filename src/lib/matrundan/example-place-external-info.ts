import type { PlaceExternalDetails } from "./geoapify-place-details.functions";
import { parseOpeningHours } from "./opening-hours";
import type { ExternalPlaceLocation } from "./place-location-sync";
import type { Place } from "./types";

const LOCATION_OVERRIDE_PREFIX = "matrundan.example-place-location.v1";

export interface ExampleExternalInfoScenario {
  details: PlaceExternalDetails | null;
  error: string | null;
}

const WEBSITE_BY_PLACE: Record<string, string | null> = {
  p1: "https://rundans-bistro.example/",
  p2: "https://kardemummakoket.example/",
  p3: "https://tacoateljen.example/",
  p4: "https://brodverket47.example/",
  p5: "https://grona-terrassen.example/",
  p6: "https://kottbulleklubben.example/",
  p7: null,
  p8: "https://smakhallen.example/",
  p9: "https://kvartersbordet.example/",
};

const OPENING_HOURS_BY_PLACE: Record<string, string | null> = {
  p1: "Mo-Th 11:00-21:00; Fr-Sa 11:00-22:00; Su 12:00-20:00",
  p2: "Mo-Fr 07:00-18:00; Sa-Su 08:00-17:00",
  p3: "Tu-Th 11:00-21:00; Fr-Sa 11:00-23:00; Su 12:00-20:00",
  p4: "Mo-Fr 07:00-17:00; Sa-Su 08:00-16:00",
  p5: "Mo-Th 11:00-21:00; Fr-Sa 11:00-22:00; Su 12:00-20:00",
  p6: "Mo-Su 11:00-21:00",
  p7: null,
  p8: "Mo-Sa 11:00-22:00; Su 12:00-20:00",
  p9: "Mo-Th 15:00-23:00; Fr-Sa 15:00-01:00; Su 15:00-22:00",
};

function currentLocation(place: Place): ExternalPlaceLocation | null {
  if (!Number.isFinite(place.lat) || !Number.isFinite(place.lng)) return null;
  if (!place.address.trim() || !place.city.trim()) return null;
  return {
    address: place.address,
    area: place.area?.trim() || null,
    city: place.city,
    lat: place.lat as number,
    lng: place.lng as number,
    osmType: null,
    osmId: null,
  };
}

function scenarioDetails(place: Place): PlaceExternalDetails {
  const location = currentLocation(place);
  const adjustedLocation =
    place.id === "p5" && location
      ? {
          ...location,
          address: "Utsiktsgränd 25",
          lat: location.lat + 0.00018,
          lng: location.lng + 0.00012,
        }
      : location;

  return {
    openingHours: parseOpeningHours(OPENING_HOURS_BY_PLACE[place.id] ?? null),
    website: WEBSITE_BY_PLACE[place.id] ?? null,
    timezone: "Europe/Stockholm",
    location: adjustedLocation,
    fetchedAt: new Date().toISOString(),
    attribution: "Fiktiva exempeluppgifter i Matrundan.",
  };
}

export function exampleExternalInfoForPlace(
  place: Place,
): ExampleExternalInfoScenario | null {
  if (!/^p[1-9]$/.test(place.id)) return null;
  if (place.id === "p8") {
    return {
      details: null,
      error: "Uppgifterna kunde inte kontrolleras just nu. Försök igen senare.",
    };
  }
  return { details: scenarioDetails(place), error: null };
}

function locationOverrideKey(placeId: string): string {
  return `${LOCATION_OVERRIDE_PREFIX}.${placeId}`;
}

function isLocation(value: unknown): value is ExternalPlaceLocation {
  if (!value || typeof value !== "object") return false;
  const location = value as Partial<ExternalPlaceLocation>;
  return (
    typeof location.address === "string" &&
    typeof location.city === "string" &&
    (typeof location.area === "string" || location.area === null) &&
    typeof location.lat === "number" &&
    Number.isFinite(location.lat) &&
    typeof location.lng === "number" &&
    Number.isFinite(location.lng) &&
    (location.osmType === "node" ||
      location.osmType === "way" ||
      location.osmType === "relation" ||
      location.osmType === null) &&
    (typeof location.osmId === "string" || location.osmId === null)
  );
}

export function readExampleLocationOverride(placeId: string): ExternalPlaceLocation | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(locationOverrideKey(placeId)) ?? "null");
    return isLocation(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeExampleLocationOverride(
  placeId: string,
  location: ExternalPlaceLocation,
): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(locationOverrideKey(placeId), JSON.stringify(location));
}
