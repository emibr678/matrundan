import type { MultiAreaPlaceSuggestion } from "./geoapify.functions";
import type { PlaceSuggestion } from "./places-provider";
import type {
  AppState,
  Occasion,
  Place,
  PlaceCategory,
  SearchArea,
} from "./types";

export type ManualPlaceDraft = {
  name: string;
  category: PlaceCategory;
  cuisines: string[];
  address: string;
  area: string;
  city: string;
  occasions: Occasion[];
  notes: string;
  photo: string;
};

export function providerMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Kunde inte hämta förslag.";
  if (/GEOAPIFY_NOT_CONFIGURED/i.test(message)) {
    return "Platssökningen är inte aktiverad på servern. Lägg till stället manuellt tills den är konfigurerad.";
  }
  if (/GEOAPIFY_RATE_LIMIT/i.test(message)) {
    return "Sökningen används mycket just nu. Försök igen om en stund.";
  }
  if (/GEOAPIFY_TIMEOUT/i.test(message)) return "Sökningen tog för lång tid. Försök igen.";
  if (/GEOAPIFY_|network|fetch/i.test(message)) {
    return "Kunde inte nå platstjänsten just nu. Försök igen strax.";
  }
  return message;
}

export function emptyManualPlace(city: string): ManualPlaceDraft {
  return {
    name: "",
    category: "restaurang",
    cuisines: [],
    address: "",
    area: "",
    city,
    occasions: [],
    notes: "",
    photo: "🍽️",
  };
}

function normalizeMatch(value: string | undefined) {
  return (value ?? "").trim().toLocaleLowerCase("sv-SE").replace(/\s+/g, " ");
}

export function matchingPlace(places: Place[], suggestion: PlaceSuggestion) {
  const name = normalizeMatch(suggestion.name);
  const address = normalizeMatch(suggestion.address);
  const city = normalizeMatch(suggestion.city);
  return places.find((place) => {
    if (normalizeMatch(place.name) !== name) return false;
    const placeAddress = normalizeMatch(place.address);
    if (address && placeAddress) return placeAddress === address;
    return normalizeMatch(place.city) === city;
  });
}

function demoAreas(city: string): SearchArea[] {
  if (city.toLocaleLowerCase("sv-SE").includes("stockholm")) {
    return [
      {
        id: "demo-area-sodermalm",
        label: "Södermalm, Stockholm",
        lat: 59.3153,
        lng: 18.0711,
        provider: "demo",
        placeId: "demo:sodermalm",
      },
      {
        id: "demo-area-vasastan-stockholm",
        label: "Vasastan, Stockholm",
        lat: 59.3427,
        lng: 18.0491,
        provider: "demo",
        placeId: "demo:vasastan-stockholm",
      },
    ];
  }
  return [
    {
      id: "demo-area-haga",
      label: "Haga, Göteborg",
      lat: 57.6994,
      lng: 11.9556,
      provider: "demo",
      placeId: "demo:haga",
    },
    {
      id: "demo-area-vasastan",
      label: "Vasastan, Göteborg",
      lat: 57.6975,
      lng: 11.9598,
      provider: "demo",
      placeId: "demo:vasastan",
    },
    {
      id: "demo-area-linne",
      label: "Linné, Göteborg",
      lat: 57.6963,
      lng: 11.9464,
      provider: "demo",
      placeId: "demo:linne",
    },
  ];
}

export function configuredSearchAreas(state: AppState, isLive: boolean): SearchArea[] {
  const areas = (state.group.searchAreas ?? []).filter(
    (area) => Number.isFinite(area.lat) && Number.isFinite(area.lng) && area.placeId.trim(),
  );
  if (areas.length > 0) return areas;
  const home = state.group.homeLocation;
  if (
    home?.verified &&
    home.lat != null &&
    home.lng != null &&
    home.placeId &&
    home.provider === "geoapify"
  ) {
    return [
      {
        id: `legacy-${home.placeId}`,
        label: home.label,
        lat: home.lat,
        lng: home.lng,
        provider: "geoapify",
        placeId: home.placeId,
      },
    ];
  }
  return isLive ? [] : demoAreas(state.group.city);
}

export function toPlaceSuggestion(row: MultiAreaPlaceSuggestion): PlaceSuggestion {
  return {
    externalId: row.externalId,
    provider: row.provider,
    name: row.name,
    category: row.category,
    cuisines: row.cuisines,
    address: row.address,
    city: row.city,
    area: row.area,
    lat: row.lat,
    lng: row.lng,
    distanceKm: row.distanceKm,
    raw: row.raw,
    nearestAreaLabel: row.nearestAreaLabel,
    matchingAreaLabels: row.matchingAreaLabels,
  };
}

export function safeParse(raw?: string): unknown {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function emojiForCategory(category: PlaceCategory) {
  return {
    restaurang: "🍽️",
    café: "☕",
    bageri: "🥐",
    snabbmat: "🍔",
    pub: "🍺",
    matvagn: "🌭",
  }[category];
}
