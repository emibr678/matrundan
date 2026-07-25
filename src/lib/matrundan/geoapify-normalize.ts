/**
 * Ren normalisering av Geoapify-svar till Matrundans domänmodell.
 *
 * Helt fri från nätverk och secrets – kan användas både på server (i
 * `geoapify.functions.ts`) och testas isolerat. All logik som mappar
 * Geoapifys taxonomi (`categories`, `datasource.raw`, `cuisine`) till våra
 * `PlaceCategory`/`cuisines` bor här, så att förändringar i leverantören
 * bara påverkar en fil.
 */
import type { PlaceCategory } from "./types";

export interface NormalizedPlaceSuggestion {
  /** Geoapify place_id (stabil per feature). Används som `provider_place_id`. */
  externalId: string;
  provider: "geoapify";
  name: string;
  category: PlaceCategory;
  cuisines: string[];
  address: string;
  city: string;
  area?: string;
  lat?: number;
  lng?: number;
  /** JSON-serialiserad rå Geoapify-properties (för `place_sources.raw`). */
  raw: string;
}

export interface NormalizedLocationSuggestion {
  /** Formatterat namn för visning ("Haga, Göteborg"). */
  label: string;
  city: string;
  area?: string;
  lat?: number;
  lng?: number;
}

interface GeoapifyProperties {
  place_id?: string;
  name?: string;
  address_line1?: string;
  address_line2?: string;
  formatted?: string;
  street?: string;
  housenumber?: string;
  city?: string;
  town?: string;
  village?: string;
  county?: string;
  state?: string;
  district?: string;
  suburb?: string;
  neighbourhood?: string;
  quarter?: string;
  postcode?: string;
  country?: string;
  country_code?: string;
  lat?: number;
  lon?: number;
  categories?: string[];
  datasource?: {
    raw?: Record<string, unknown> & { cuisine?: string; amenity?: string };
  };
}

interface GeoapifyFeature {
  properties?: GeoapifyProperties;
}

const CATEGORY_PRIORITY: { match: (cats: string[]) => boolean; cat: PlaceCategory }[] = [
  { match: (c) => c.includes("commercial.food_and_drink.bakery") || c.includes("catering.bakery"), cat: "bageri" },
  { match: (c) => c.includes("catering.cafe") || c.includes("catering.ice_cream"), cat: "café" },
  { match: (c) => c.includes("catering.fast_food") || c.includes("catering.food_court"), cat: "snabbmat" },
  { match: (c) => c.includes("catering.pub") || c.includes("catering.bar") || c.includes("catering.biergarten") || c.includes("catering.nightclub"), cat: "pub" },
  { match: (c) => c.includes("catering.taxi") || c.includes("catering.food_truck"), cat: "matvagn" },
  { match: (c) => c.includes("catering.restaurant") || c.some((x) => x.startsWith("catering")), cat: "restaurang" },
];

export function categoryFromGeoapify(
  categories: string[] | undefined,
  amenity?: string,
): PlaceCategory {
  const cats = categories ?? [];
  for (const { match, cat } of CATEGORY_PRIORITY) {
    if (match(cats)) return cat;
  }
  switch (amenity) {
    case "restaurant":
      return "restaurang";
    case "cafe":
      return "café";
    case "fast_food":
      return "snabbmat";
    case "pub":
    case "bar":
    case "biergarten":
      return "pub";
    case "bakery":
      return "bageri";
    case "food_court":
      return "restaurang";
    default:
      return "restaurang";
  }
}

const CUISINE_ALIASES: Record<string, string> = {
  italian: "italienskt",
  pizza: "pizza",
  japanese: "japanskt",
  sushi: "sushi",
  chinese: "kinesiskt",
  thai: "thailändskt",
  vietnamese: "vietnamesiskt",
  indian: "indiskt",
  mexican: "mexikanskt",
  french: "franskt",
  greek: "grekiskt",
  turkish: "turkiskt",
  lebanese: "libanesiskt",
  american: "amerikanskt",
  burger: "burgare",
  kebab: "kebab",
  falafel: "falafel",
  seafood: "fisk",
  fish: "fisk",
  vegan: "vegan",
  vegetarian: "vegetariskt",
  bakery: "bakverk",
  bread: "surdeg",
  coffee_shop: "kaffe",
  ice_cream: "glass",
  breakfast: "frukost",
  brunch: "brunch",
  ramen: "ramen",
  noodle: "nudlar",
  bbq: "bbq",
  steak: "kött",
  tapas: "tapas",
  swedish: "svenskt",
  regional: "husmanskost",
};

export function cuisinesFromGeoapify(props: GeoapifyProperties | undefined): string[] {
  if (!props) return [];
  const raw = props.datasource?.raw?.cuisine;
  const list: string[] = [];
  if (typeof raw === "string" && raw.trim()) {
    for (const token of raw.split(/[;,]/)) {
      const t = token.trim().toLowerCase().replace(/\s+/g, "_");
      if (!t) continue;
      list.push(CUISINE_ALIASES[t] ?? t.replace(/_/g, " "));
    }
  }
  // Ta även med fina underkategorier från categories (t.ex. catering.restaurant.italian)
  for (const cat of props.categories ?? []) {
    const parts = cat.split(".");
    if (parts.length >= 3 && (parts[0] === "catering" || parts[0] === "commercial")) {
      const leaf = parts[parts.length - 1];
      if (CUISINE_ALIASES[leaf]) list.push(CUISINE_ALIASES[leaf]);
    }
  }
  // Unika, max 5
  return Array.from(new Set(list)).slice(0, 5);
}

export function areaFromGeoapify(props: GeoapifyProperties): string | undefined {
  return (
    props.suburb ||
    props.neighbourhood ||
    props.quarter ||
    props.district ||
    undefined
  );
}

export function cityFromGeoapify(props: GeoapifyProperties): string {
  return props.city || props.town || props.village || props.county || "";
}

export function addressFromGeoapify(props: GeoapifyProperties): string {
  if (props.address_line1 && props.address_line1.trim()) return props.address_line1.trim();
  const line = [props.street, props.housenumber].filter(Boolean).join(" ").trim();
  if (line) return line;
  return props.formatted?.split(",")[0]?.trim() ?? "";
}

export function normalizePlaceFeature(
  feature: GeoapifyFeature,
): NormalizedPlaceSuggestion | null {
  const p = feature.properties;
  if (!p?.place_id) return null;
  const name = (p.name || p.address_line1 || "").trim();
  if (!name) return null;
  const amenity = typeof p.datasource?.raw?.amenity === "string"
    ? p.datasource.raw.amenity
    : undefined;
  return {
    externalId: p.place_id,
    provider: "geoapify",
    name,
    category: categoryFromGeoapify(p.categories, amenity),
    cuisines: cuisinesFromGeoapify(p),
    address: addressFromGeoapify(p),
    city: cityFromGeoapify(p),
    area: areaFromGeoapify(p),
    lat: p.lat,
    lng: p.lon,
    raw: JSON.stringify(p),
  };
}

export function normalizeLocationFeature(
  feature: GeoapifyFeature,
): NormalizedLocationSuggestion | null {
  const p = feature.properties;
  if (!p) return null;
  const city = cityFromGeoapify(p);
  if (!city) return null;
  const area = areaFromGeoapify(p);
  const label = area ? `${area}, ${city}` : city;
  return { label, city, area, lat: p.lat, lng: p.lon };
}
