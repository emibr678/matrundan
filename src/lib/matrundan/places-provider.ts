/**
 * Provider-gränssnitt för platssökning.
 *
 * Demo-providern returnerar lokala förslag utan externa anrop.
 * Byt till Geoapify/OSM/MapLibre senare genom att implementera samma
 * kontrakt (search({ query, near, mode }) → PlaceSuggestion[])
 * och registrera i `getPlacesProvider()`. Lägg INTE hemligheter här –
 * de ska läsas via server-funktion när backend kopplas på.
 *
 * Sökmodellen är autocomplete-orienterad: användaren väljer en plats
 * (`near`) från förslag, och kan sedan filtrera resultat till "nära"
 * (mjuk radie ~5 km) eller "överallt" (hela Sverige, sorterat efter
 * avstånd om en plats är vald).
 */

import type { PlaceCategory } from "./types";
import type { LocationBias } from "./location";

export interface PlaceSuggestion {
  externalId: string;
  name: string;
  category: PlaceCategory;
  address: string;
  city: string;
  area?: string;
  cuisines?: string[];
  lat?: number;
  lng?: number;
  distanceKm?: number;
}

export type SearchMode = "near" | "everywhere";

export interface PlacesSearchOpts {
  query?: string;
  /** Vald plats att söka nära. Om null: söker i hela Sverige. */
  near: LocationBias | null;
  /** "near" begränsar geografiskt, "everywhere" tar bort begränsningen. */
  mode: SearchMode;
}

export interface PlacesProvider {
  readonly id: string;
  search(opts: PlacesSearchOpts): Promise<PlaceSuggestion[]>;
}

/** Mjuk radie kring en vald plats när mode === "near". */
export const NEAR_RADIUS_KM = 5;

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

const DEMO_SUGGESTIONS: PlaceSuggestion[] = [
  { externalId: "demo-1", name: "Trattoria La Strada", category: "restaurang", address: "Södra Vägen 20", area: "Vasastan", city: "Göteborg", cuisines: ["italienskt"], lat: 57.6982, lng: 11.9782 },
  { externalId: "demo-2", name: "Café Husaren", category: "café", address: "Haga Nygata 24", area: "Haga", city: "Göteborg", cuisines: ["fika", "kanelbulle"], lat: 57.6994, lng: 11.9536 },
  { externalId: "demo-3", name: "Sushi Sho", category: "restaurang", address: "Vasagatan 33", area: "Vasastan", city: "Göteborg", cuisines: ["japanskt", "sushi"], lat: 57.6989, lng: 11.9612 },
  { externalId: "demo-4", name: "Kebab Express", category: "snabbmat", address: "Järntorget 5", area: "Linné", city: "Göteborg", cuisines: ["kebab"], lat: 57.6979, lng: 11.9497 },
  { externalId: "demo-5", name: "Steampunk Bar", category: "pub", address: "Kyrkogatan 11", area: "Centrum", city: "Göteborg", cuisines: ["öl", "cocktails"], lat: 57.7069, lng: 11.9682 },
  { externalId: "demo-6", name: "Alvar & Ivar", category: "café", address: "Vasagatan 41", area: "Vasastan", city: "Göteborg", cuisines: ["kaffe", "bakverk"], lat: 57.6987, lng: 11.9625 },
  { externalId: "demo-7", name: "Kajutan", category: "restaurang", address: "Klippan 1", area: "Majorna", city: "Göteborg", cuisines: ["fisk", "husmanskost"], lat: 57.6941, lng: 11.9089 },
  { externalId: "demo-8", name: "Bakverket", category: "bageri", address: "Andra Långgatan 8", area: "Linné", city: "Göteborg", cuisines: ["surdeg", "wienerbröd"], lat: 57.6975, lng: 11.9503 },
  { externalId: "demo-9", name: "Falafelvagnen", category: "matvagn", address: "Järntorget", area: "Linné", city: "Göteborg", cuisines: ["falafel", "vegetariskt"], lat: 57.698, lng: 11.949 },
  { externalId: "demo-10", name: "Pizzeria Napoli", category: "restaurang", address: "Götgatan 22", area: "Södermalm", city: "Stockholm", cuisines: ["italienskt", "pizza"], lat: 59.3155, lng: 18.0715 },
  { externalId: "demo-11", name: "Malmö Saluhall", category: "restaurang", address: "Gibraltargatan 6", city: "Malmö", cuisines: ["street food"], lat: 55.6117, lng: 12.9989 },
  { externalId: "demo-12", name: "Enskede Konditori", category: "bageri", address: "Enskedevägen 100", area: "Gamla Enskede", city: "Stockholm", cuisines: ["konditori", "kaffe"], lat: 59.282, lng: 18.085 },
  { externalId: "demo-13", name: "Möllans Ost", category: "café", address: "Möllevångstorget 3", area: "Möllevången", city: "Malmö", cuisines: ["ost", "vin"], lat: 55.5921, lng: 13.014 },
];

const demoProvider: PlacesProvider = {
  id: "demo",
  async search({ query, near, mode }) {
    await new Promise((r) => setTimeout(r, 220));
    const q = (query ?? "").trim().toLowerCase();

    let items = DEMO_SUGGESTIONS.slice();

    if (q) {
      items = items.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q) ||
          s.cuisines?.some((c) => c.toLowerCase().includes(q)) ||
          s.address.toLowerCase().includes(q) ||
          s.area?.toLowerCase().includes(q) ||
          s.city.toLowerCase().includes(q),
      );
    }

    const withDistance = items.map((s) => ({
      ...s,
      distanceKm:
        near && s.lat != null && s.lng != null
          ? Math.round(haversineKm(near, { lat: s.lat, lng: s.lng }) * 10) / 10
          : undefined,
    }));

    const filtered =
      near && mode === "near"
        ? withDistance.filter(
            (s) => s.distanceKm != null && s.distanceKm <= NEAR_RADIUS_KM,
          )
        : withDistance;

    filtered.sort((a, b) => {
      if (near) return (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999);
      return a.name.localeCompare(b.name);
    });
    return filtered;
  },
};

export function getPlacesProvider(): PlacesProvider {
  return demoProvider;
}
