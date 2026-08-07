import type { PlaceExternalDetails } from "./geoapify-place-details.functions";
import { EXAMPLE_IDS, exampleIsoTimestamp } from "./example-scenarios";
import { parseOpeningHours } from "./opening-hours";
import type { ExternalPlaceLocation } from "./place-location-sync";
import type { Place } from "./types";

const LOCATION_OVERRIDE_PREFIX = "matrundan.example-place-location.v1";

export interface ExampleExternalInfoScenario {
  details: PlaceExternalDetails | null;
  error: string | null;
}

const WEBSITE_BY_PLACE: Record<string, string | null> = {
  [EXAMPLE_IDS.places.providerBistro]: "https://rundans-bistro.example/",
  [EXAMPLE_IDS.places.repeatCafe]: "https://kardemummakoket.example/",
  [EXAMPLE_IDS.places.guestReviews]: "https://tacoateljen.example/",
  [EXAMPLE_IDS.places.archivedBakery]: "https://brodverket47.example/",
  [EXAMPLE_IDS.places.nextStop]: "https://grona-terrassen.example/",
  [EXAMPLE_IDS.places.formerMemberHistory]: "https://kottbulleklubben.example/",
  [EXAMPLE_IDS.places.limitedInfo]: null,
  [EXAMPLE_IDS.places.externalError]: "https://smakhallen.example/",
  [EXAMPLE_IDS.places.sharedVisit]: "https://kvartersbordet.example/",
  [EXAMPLE_IDS.places.longLayout]: "https://det-lilla-langbordet.example/",
};

const OPENING_HOURS_BY_PLACE: Record<string, string | null> = {
  [EXAMPLE_IDS.places.providerBistro]: "Mo-Th 11:00-21:00; Fr-Sa 11:00-22:00; Su 12:00-20:00",
  [EXAMPLE_IDS.places.repeatCafe]: "Mo-Fr 07:00-18:00; Sa-Su 08:00-17:00",
  [EXAMPLE_IDS.places.guestReviews]: "Tu-Th 11:00-21:00; Fr-Sa 11:00-23:00; Su 12:00-20:00",
  [EXAMPLE_IDS.places.archivedBakery]: "Mo-Fr 07:00-17:00; Sa-Su 08:00-16:00",
  [EXAMPLE_IDS.places.nextStop]: "Mo-Th 11:00-21:00; Fr-Sa 11:00-22:00; Su 12:00-20:00",
  [EXAMPLE_IDS.places.formerMemberHistory]: "Mo-Su 11:00-21:00",
  [EXAMPLE_IDS.places.limitedInfo]: null,
  [EXAMPLE_IDS.places.externalError]: "Mo-Sa 11:00-22:00; Su 12:00-20:00",
  [EXAMPLE_IDS.places.sharedVisit]: "Mo-Th 15:00-23:00; Fr-Sa 15:00-01:00; Su 15:00-22:00",
  [EXAMPLE_IDS.places.longLayout]: "Tu-Th 17:00-22:00; Fr-Sa 12:00-23:00; Su 12:00-20:00",
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

function scenarioDetails(place: Place, now: Date): PlaceExternalDetails {
  const location = currentLocation(place);
  const adjustedLocation =
    place.id === EXAMPLE_IDS.places.nextStop && location
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
    fetchedAt: exampleIsoTimestamp(now),
    attribution: "Fiktiva exempeluppgifter i Matrundan.",
  };
}

export function exampleExternalInfoForPlace(
  place: Place,
  now = new Date(),
): ExampleExternalInfoScenario | null {
  if (!(place.id in WEBSITE_BY_PLACE)) return null;
  if (place.id === EXAMPLE_IDS.places.externalError) {
    return {
      details: null,
      error: "Uppgifterna kunde inte kontrolleras just nu. Försök igen senare.",
    };
  }
  return { details: scenarioDetails(place, now), error: null };
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
    const parsed = JSON.parse(
      window.sessionStorage.getItem(locationOverrideKey(placeId)) ?? "null",
    );
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
