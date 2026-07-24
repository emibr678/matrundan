/**
 * Provider-gränssnitt för platssökning.
 *
 * Demo-providern returnerar lokala förslag utan externa anrop.
 * Byt till Geoapify/OSM/MapLibre senare genom att implementera samma
 * kontrakt (search({ query, city, area, radiusKm }) → PlaceSuggestion[])
 * och registrera i `getPlacesProvider()`. Lägg INTE hemligheter här –
 * de ska läsas via server-funktion när backend kopplas på.
 */

import type { PlaceCategory } from "./types";

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

export interface PlacesSearchOpts {
  query?: string;
  city: string;
  area?: string;
  radiusKm: number;
}

export interface PlacesProvider {
  readonly id: string;
  search(opts: PlacesSearchOpts): Promise<PlaceSuggestion[]>;
}

// Ungefärliga centrum för några Göteborgs-områden (demo).
const AREA_CENTERS: Record<string, { lat: number; lng: number }> = {
  centrum: { lat: 57.7072, lng: 11.9668 },
  nordstan: { lat: 57.7089, lng: 11.9686 },
  haga: { lat: 57.6994, lng: 11.9556 },
  vasastan: { lat: 57.6975, lng: 11.9598 },
  majorna: { lat: 57.6969, lng: 11.9138 },
  linné: { lat: 57.6963, lng: 11.9464 },
  avenyn: { lat: 57.6994, lng: 11.9797 },
};

const CITY_CENTERS: Record<string, { lat: number; lng: number }> = {
  göteborg: { lat: 57.7089, lng: 11.9746 },
  stockholm: { lat: 59.3293, lng: 18.0686 },
  malmö: { lat: 55.6049, lng: 13.0038 },
};

function centerFor(city: string, area?: string) {
  if (area) {
    const c = AREA_CENTERS[area.trim().toLowerCase()];
    if (c) return c;
  }
  return CITY_CENTERS[city.trim().toLowerCase()] ?? CITY_CENTERS.göteborg;
}

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
  {
    externalId: "demo-1",
    name: "Trattoria La Strada",
    category: "restaurang",
    address: "Södra Vägen 20",
    area: "Vasastan",
    city: "Göteborg",
    cuisines: ["italienskt"],
    lat: 57.6982,
    lng: 11.9782,
  },
  {
    externalId: "demo-2",
    name: "Café Husaren",
    category: "café",
    address: "Haga Nygata 24",
    area: "Haga",
    city: "Göteborg",
    cuisines: ["fika", "kanelbulle"],
    lat: 57.6994,
    lng: 11.9536,
  },
  {
    externalId: "demo-3",
    name: "Sushi Sho",
    category: "restaurang",
    address: "Vasagatan 33",
    area: "Vasastan",
    city: "Göteborg",
    cuisines: ["japanskt", "sushi"],
    lat: 57.6989,
    lng: 11.9612,
  },
  {
    externalId: "demo-4",
    name: "Kebab Express",
    category: "snabbmat",
    address: "Järntorget 5",
    area: "Linné",
    city: "Göteborg",
    cuisines: ["kebab"],
    lat: 57.6979,
    lng: 11.9497,
  },
  {
    externalId: "demo-5",
    name: "Steampunk Bar",
    category: "pub",
    address: "Kyrkogatan 11",
    area: "Centrum",
    city: "Göteborg",
    cuisines: ["öl", "cocktails"],
    lat: 57.7069,
    lng: 11.9682,
  },
  {
    externalId: "demo-6",
    name: "Alvar & Ivar",
    category: "café",
    address: "Vasagatan 41",
    area: "Vasastan",
    city: "Göteborg",
    cuisines: ["kaffe", "bakverk"],
    lat: 57.6987,
    lng: 11.9625,
  },
  {
    externalId: "demo-7",
    name: "Kajutan",
    category: "restaurang",
    address: "Klippan 1",
    area: "Majorna",
    city: "Göteborg",
    cuisines: ["fisk", "husmanskost"],
    lat: 57.6941,
    lng: 11.9089,
  },
  {
    externalId: "demo-8",
    name: "Bakverket",
    category: "bageri",
    address: "Andra Långgatan 8",
    area: "Linné",
    city: "Göteborg",
    cuisines: ["surdeg", "wienerbröd"],
    lat: 57.6975,
    lng: 11.9503,
  },
  {
    externalId: "demo-9",
    name: "Falafelvagnen",
    category: "matvagn",
    address: "Järntorget",
    area: "Linné",
    city: "Göteborg",
    cuisines: ["falafel", "vegetariskt"],
    lat: 57.698,
    lng: 11.949,
  },
];

const demoProvider: PlacesProvider = {
  id: "demo",
  async search({ query, city, area, radiusKm }) {
    await new Promise((r) => setTimeout(r, 220));
    if (!city.trim()) return [];
    const q = (query ?? "").trim().toLowerCase();
    const a = (area ?? "").trim().toLowerCase();
    const center = centerFor(city, area);

    let items = DEMO_SUGGESTIONS.filter(
      (s) => s.city.toLowerCase() === city.trim().toLowerCase(),
    );

    if (a) {
      items = items.filter(
        (s) =>
          s.area?.toLowerCase().includes(a) ||
          s.address.toLowerCase().includes(a),
      );
    }

    if (q) {
      items = items.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q) ||
          s.cuisines?.some((c) => c.toLowerCase().includes(q)) ||
          s.address.toLowerCase().includes(q) ||
          s.area?.toLowerCase().includes(q),
      );
    }

    const withDistance = items.map((s) => ({
      ...s,
      distanceKm:
        s.lat != null && s.lng != null
          ? Math.round(haversineKm(center, { lat: s.lat, lng: s.lng }) * 10) / 10
          : undefined,
    }));

    const filtered = withDistance.filter(
      (s) => s.distanceKm == null || s.distanceKm <= radiusKm,
    );

    filtered.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
    return filtered;
  },
};

export function getPlacesProvider(): PlacesProvider {
  return demoProvider;
}
