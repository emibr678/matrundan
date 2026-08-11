/**
 * Provider-gränssnitt för platssökning.
 *
 * Demo-providern returnerar fiktiva lokala förslag utan externa anrop.
 * Live-läget använder Geoapify via serverfunktioner och delar samma kontrakt.
 */

import { normalizeFoodTags } from "./food-tags";
import { matchesPlaceSearchIntent, resolvePlaceSearchIntent } from "./place-search-intent";
import type {
  PlaceCategory,
  SearchArea,
  SearchAreaBoundaryGeometry,
  SearchAreaMode,
} from "./types";

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
  provider?: string;
  website?: string;
  raw?: string;
  nearestAreaLabel?: string;
  matchingAreaLabels?: string[];
}

export interface PlacesSearchOpts {
  query?: string;
  city?: string;
  area?: string;
  center?: { lat: number; lng: number };
  areaLabel?: string;
  radiusKm: number | null;
  searchMode?: SearchAreaMode;
  boundary?: SearchAreaBoundaryGeometry;
}

export interface PlacesProvider {
  readonly id: string;
  search(opts: PlacesSearchOpts): Promise<PlaceSuggestion[]>;
}

const AREA_CENTERS: Record<string, { lat: number; lng: number }> = {
  centrum: { lat: 57.7072, lng: 11.9668 },
  "inom vallgraven": { lat: 57.7067, lng: 11.9686 },
  haga: { lat: 57.6994, lng: 11.9556 },
  vasastan: { lat: 57.6975, lng: 11.9598 },
  majorna: { lat: 57.6969, lng: 11.9138 },
  linné: { lat: 57.6963, lng: 11.9464 },
  rosenlund: { lat: 57.7005, lng: 11.9514 },
  södermalm: { lat: 59.3153, lng: 18.0711 },
  stavsnäs: { lat: 59.287, lng: 18.692 },
  gustavsberg: { lat: 59.3264, lng: 18.3895 },
};

const CITY_CENTERS: Record<string, { lat: number; lng: number }> = {
  göteborg: { lat: 57.7089, lng: 11.9746 },
  stockholm: { lat: 59.3293, lng: 18.0686 },
  malmö: { lat: 55.6049, lng: 13.0038 },
  uppsala: { lat: 59.8586, lng: 17.6389 },
  stavsnäs: { lat: 59.287, lng: 18.692 },
  gustavsberg: { lat: 59.3264, lng: 18.3895 },
};

function centerFor(city = "Göteborg", area?: string) {
  if (area) {
    const areaCenter = AREA_CENTERS[area.trim().toLowerCase()];
    if (areaCenter) return areaCenter;
  }
  return CITY_CENTERS[city.trim().toLowerCase()] ?? CITY_CENTERS.göteborg;
}

export function demoSearchAreaFromText(text: string, fallbackCity = "Göteborg"): SearchArea | null {
  const parts = text
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  const area = parts[0];
  const city = parts[1] ?? fallbackCity;
  const center = centerFor(city, area);
  return {
    id: `demo-temp-${area.toLocaleLowerCase("sv-SE")}-${city.toLocaleLowerCase("sv-SE")}`,
    label: parts.join(", "),
    lat: center.lat,
    lng: center.lng,
    provider: "demo",
    placeId: `demo:${parts.join(":").toLocaleLowerCase("sv-SE")}`,
    searchMode: "point",
  };
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const radius = 6371;
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const value =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(value));
}

function pointInRing(point: [number, number], ring: number[][]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = ring[i]?.[0];
    const yi = ring[i]?.[1];
    const xj = ring[j]?.[0];
    const yj = ring[j]?.[1];
    if (
      typeof xi !== "number" ||
      typeof yi !== "number" ||
      typeof xj !== "number" ||
      typeof yj !== "number" ||
      !Number.isFinite(xi) ||
      !Number.isFinite(yi) ||
      !Number.isFinite(xj) ||
      !Number.isFinite(yj)
    ) {
      continue;
    }
    const intersects =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInPolygon(point: [number, number], rings: number[][][]): boolean {
  const [outer, ...holes] = rings;
  if (!outer || !pointInRing(point, outer)) return false;
  return !holes.some((hole) => pointInRing(point, hole));
}

function pointInBoundary(point: [number, number], boundary: SearchAreaBoundaryGeometry): boolean {
  if (boundary.type === "Polygon") {
    return pointInPolygon(point, boundary.coordinates as number[][][]);
  }
  return (boundary.coordinates as number[][][][]).some((polygon) => pointInPolygon(point, polygon));
}

const DEMO_SUGGESTIONS: PlaceSuggestion[] = [
  {
    externalId: "demo-1",
    provider: "demo",
    name: "Päronträdets Trattoria",
    category: "restaurang",
    address: "Pärongränden 6",
    area: "Vasastan",
    city: "Göteborg",
    cuisines: ["italienskt", "pasta"],
    lat: 57.6982,
    lng: 11.9614,
  },
  {
    externalId: "demo-2",
    provider: "demo",
    name: "Hagabackens Kafferum",
    category: "café",
    address: "Backstigen 11",
    area: "Haga",
    city: "Göteborg",
    cuisines: ["fika", "kaffe"],
    lat: 57.6998,
    lng: 11.9548,
  },
  {
    externalId: "demo-3",
    provider: "demo",
    name: "Rislyktans Izakaya",
    category: "restaurang",
    address: "Lyktgatan 9",
    area: "Vasastan",
    city: "Göteborg",
    cuisines: ["japanskt", "sushi", "smårätter"],
    lat: 57.6978,
    lng: 11.9641,
  },
  {
    externalId: "demo-4",
    provider: "demo",
    name: "Falafelkompassen",
    category: "snabbmat",
    address: "Kompassgränden 2",
    area: "Linné",
    city: "Göteborg",
    cuisines: ["falafel", "vegetariskt"],
    lat: 57.6974,
    lng: 11.9485,
  },
  {
    externalId: "demo-5",
    provider: "demo",
    name: "Kopparkällaren",
    category: "pub",
    address: "Koppargränden 4",
    area: "Inom Vallgraven",
    city: "Göteborg",
    cuisines: ["pubmat", "svenskt"],
    lat: 57.7068,
    lng: 11.9694,
  },
  {
    externalId: "demo-6",
    provider: "demo",
    name: "Morgonrosten",
    category: "café",
    address: "Morgongatan 14",
    area: "Vasastan",
    city: "Göteborg",
    cuisines: ["kaffe", "bakverk"],
    lat: 57.6989,
    lng: 11.9597,
  },
  {
    externalId: "demo-7",
    provider: "demo",
    name: "Bryggans Gryta",
    category: "restaurang",
    address: "Bryggstråket 3",
    area: "Majorna",
    city: "Göteborg",
    cuisines: ["fisk", "husmanskost"],
    lat: 57.6954,
    lng: 11.9178,
  },
  {
    externalId: "demo-8",
    provider: "demo",
    name: "Deg & Dagg",
    category: "bageri",
    address: "Daggstigen 5",
    area: "Linné",
    city: "Göteborg",
    cuisines: ["surdeg", "wienerbröd"],
    lat: 57.6969,
    lng: 11.9467,
  },
  {
    externalId: "demo-9",
    provider: "demo",
    name: "Saffransvagnen",
    category: "matvagn",
    address: "Rosenlunds kaj",
    area: "Rosenlund",
    city: "Göteborg",
    cuisines: ["persiskt", "vegetariskt"],
    lat: 57.7001,
    lng: 11.9521,
  },
  {
    externalId: "demo-10",
    provider: "demo",
    name: "Söderglöden",
    category: "restaurang",
    address: "Glödgränden 18",
    area: "Södermalm",
    city: "Stockholm",
    cuisines: ["grillat", "vegetariskt"],
    lat: 59.3155,
    lng: 18.0715,
  },
  {
    externalId: "demo-11",
    provider: "demo",
    name: "Saltstänkets Mathall",
    category: "restaurang",
    address: "Havsgatan 6",
    city: "Malmö",
    cuisines: ["street food"],
    lat: 55.6117,
    lng: 12.9989,
  },
  {
    externalId: "demo-12",
    provider: "demo",
    name: "Päronträdets Trattoria Haga",
    category: "restaurang",
    address: "Hagagatan 18",
    area: "Haga",
    city: "Göteborg",
    cuisines: ["italienskt", "pasta"],
    lat: 57.6992,
    lng: 11.9562,
  },
  {
    externalId: "demo-13",
    provider: "demo",
    name: "Pizzagläntan",
    category: "restaurang",
    address: "Gläntstigen 3",
    area: "Haga",
    city: "Göteborg",
    cuisines: ["italienskt", "pizza"],
    lat: 57.7002,
    lng: 11.9569,
  },
  {
    externalId: "demo-existing-kardemumma",
    provider: "demo",
    name: "Kvarterets Kardemumma",
    category: "café",
    address: "Kanelgången 4",
    area: "Haga",
    city: "Göteborg",
    cuisines: ["kaffe", "surdeg", "bakverk"],
    lat: 57.6996,
    lng: 11.9552,
  },
  {
    externalId: "demo-varmdo-stavnas",
    provider: "demo",
    name: "Stavsnäs Sjökrog",
    category: "restaurang",
    address: "Stavsnäs vinterhamn 4",
    area: "Stavsnäs",
    city: "Stavsnäs",
    cuisines: ["fisk", "svenskt"],
    lat: 59.286,
    lng: 18.691,
  },
  {
    externalId: "demo-varmdo-gustavsberg",
    provider: "demo",
    name: "Hamnbageriet",
    category: "bageri",
    address: "Odelbergs väg 5",
    area: "Gustavsberg",
    city: "Gustavsberg",
    cuisines: ["surdeg", "fika"],
    lat: 59.326,
    lng: 18.39,
  },
  {
    externalId: "demo-varmdo-island",
    provider: "demo",
    name: "Öbordet",
    category: "restaurang",
    address: "Bryggan 2",
    area: "Skärgården",
    city: "Värmdö",
    cuisines: ["fisk", "smårätter"],
    lat: 59.31,
    lng: 18.86,
  },
];

const demoProvider: PlacesProvider = {
  id: "demo",
  async search({
    query,
    city = "",
    area,
    center: suppliedCenter,
    areaLabel,
    radiusKm,
    searchMode = "point",
    boundary,
  }) {
    await new Promise((resolve) => setTimeout(resolve, 220));
    if (!suppliedCenter && !city.trim()) return [];

    const intent = resolvePlaceSearchIntent(query);
    const normalizedArea = (area ?? "").trim().toLocaleLowerCase("sv-SE");
    const center = suppliedCenter ?? centerFor(city, area);
    const normalizedSuggestions = DEMO_SUGGESTIONS.map((suggestion) => ({
      ...suggestion,
      cuisines: normalizeFoodTags(suggestion.cuisines ?? []),
    }));
    let items = suppliedCenter
      ? normalizedSuggestions
      : normalizedSuggestions.filter(
          (suggestion) =>
            suggestion.city.toLocaleLowerCase("sv-SE") === city.trim().toLocaleLowerCase("sv-SE"),
        );

    if (!suppliedCenter && normalizedArea) {
      items = items.filter(
        (suggestion) =>
          suggestion.area?.toLocaleLowerCase("sv-SE").includes(normalizedArea) ||
          suggestion.address.toLocaleLowerCase("sv-SE").includes(normalizedArea),
      );
    }

    if (intent.kind !== "browse") {
      items = items.filter((suggestion) => matchesPlaceSearchIntent(suggestion, intent));
    }

    const withDistance = items.map((suggestion) => ({
      ...suggestion,
      distanceKm:
        suggestion.lat != null && suggestion.lng != null
          ? Math.round(haversineKm(center, { lat: suggestion.lat, lng: suggestion.lng }) * 10) / 10
          : undefined,
      nearestAreaLabel: areaLabel,
      matchingAreaLabels: areaLabel ? [areaLabel] : undefined,
    }));

    const filtered =
      searchMode === "boundary"
        ? boundary
          ? withDistance.filter(
              (suggestion) =>
                suggestion.lat != null &&
                suggestion.lng != null &&
                pointInBoundary([suggestion.lng, suggestion.lat], boundary),
            )
          : []
        : radiusKm == null || !Number.isFinite(radiusKm)
          ? withDistance
          : withDistance.filter(
              (suggestion) => suggestion.distanceKm == null || suggestion.distanceKm <= radiusKm,
            );

    filtered.sort(
      (a, b) =>
        (a.distanceKm ?? 999) - (b.distanceKm ?? 999) || a.name.localeCompare(b.name, "sv-SE"),
    );
    return filtered;
  },
};

export function getPlacesProvider(): PlacesProvider {
  return demoProvider;
}
