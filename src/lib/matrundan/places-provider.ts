/**
 * Provider-gränssnitt för platssökning.
 *
 * Just nu returnerar demo-providern lokala förslag utan externt anrop.
 * Byt till Geoapify/OSM senare genom att implementera samma interface
 * och registrera i `getPlacesProvider()`. Lägg INTE hemligheter här –
 * de ska läsas i server-funktion via process.env när backend kopplas på.
 */

import type { PlaceCategory } from "./types";

export interface PlaceSuggestion {
  externalId: string;
  name: string;
  category: PlaceCategory;
  address: string;
  city: string;
  cuisines?: string[];
  lat?: number;
  lng?: number;
}

export interface PlacesProvider {
  readonly id: string;
  search(query: string, opts?: { city?: string }): Promise<PlaceSuggestion[]>;
}

const DEMO_SUGGESTIONS: PlaceSuggestion[] = [
  {
    externalId: "demo-1",
    name: "Trattoria La Strada",
    category: "restaurang",
    address: "Södra Vägen 20",
    city: "Göteborg",
    cuisines: ["italienskt"],
  },
  {
    externalId: "demo-2",
    name: "Café Husaren",
    category: "café",
    address: "Haga Nygata 24",
    city: "Göteborg",
    cuisines: ["fika", "kanelbulle"],
  },
  {
    externalId: "demo-3",
    name: "Sushi Sho",
    category: "restaurang",
    address: "Vasagatan 33",
    city: "Göteborg",
    cuisines: ["japanskt", "sushi"],
  },
  {
    externalId: "demo-4",
    name: "Kebab Express",
    category: "snabbmat",
    address: "Järntorget 5",
    city: "Göteborg",
    cuisines: ["kebab"],
  },
  {
    externalId: "demo-5",
    name: "Steampunk Bar",
    category: "pub",
    address: "Kyrkogatan 11",
    city: "Göteborg",
    cuisines: ["öl", "cocktails"],
  },
  {
    externalId: "demo-6",
    name: "Alvar & Ivar",
    category: "café",
    address: "Vasagatan 41",
    city: "Göteborg",
    cuisines: ["kaffe", "bakverk"],
  },
];

const demoProvider: PlacesProvider = {
  id: "demo",
  async search(query) {
    const q = query.trim().toLowerCase();
    await new Promise((r) => setTimeout(r, 220));
    if (!q) return DEMO_SUGGESTIONS.slice(0, 4);
    return DEMO_SUGGESTIONS.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.cuisines?.some((c) => c.toLowerCase().includes(q)) ||
        s.address.toLowerCase().includes(q),
    );
  },
};

export function getPlacesProvider(): PlacesProvider {
  // Framtid: return env.GEOAPIFY_KEY ? geoapifyProvider : demoProvider;
  return demoProvider;
}
