/**
 * Ren normalisering av Geoapify-svar till Matrundans domänmodell.
 * Filen innehåller ingen nätverks- eller secret-hantering.
 */
import type { PlaceCategory } from "./types";

export const GEOAPIFY_ATTRIBUTION =
  "Platsdata från Geoapify och © OpenStreetMap-bidragsgivare.";

export interface NormalizedPlaceSuggestion {
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
  distanceKm?: number;
  website?: string;
  phone?: string;
  externalUrl?: string;
  attribution: string;
  /** Begränsad, JSON-serialiserad metadata för place_sources.raw. */
  raw: string;
}

export interface NormalizedLocationSuggestion {
  placeId: string;
  label: string;
  name: string;
  city: string;
  area?: string;
  lat: number;
  lng: number;
  resultType?: string;
}

interface GeoapifyProperties {
  place_id?: string;
  name?: string;
  address_line1?: string;
  formatted?: string;
  street?: string;
  housenumber?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  district?: string;
  suburb?: string;
  neighbourhood?: string;
  quarter?: string;
  postcode?: string;
  country_code?: string;
  lat?: number;
  lon?: number;
  distance?: number;
  result_type?: string;
  categories?: string[];
  website?: string;
  contact?: { phone?: string };
  datasource?: {
    raw?: Record<string, unknown> & {
      cuisine?: string;
      amenity?: string;
      website?: string;
      phone?: string;
    };
  };
}

interface GeoapifyFeature {
  properties?: GeoapifyProperties;
}

function hasCategory(categories: string[], prefix: string): boolean {
  return categories.some((c) => c === prefix || c.startsWith(`${prefix}.`));
}

export function categoryFromGeoapify(
  categories: string[] | undefined,
  amenity?: string,
): PlaceCategory {
  const cats = categories ?? [];
  if (
    hasCategory(cats, "commercial.food_and_drink.bakery") ||
    hasCategory(cats, "catering.bakery")
  ) return "bageri";
  if (hasCategory(cats, "catering.cafe") || hasCategory(cats, "catering.ice_cream")) {
    return "café";
  }
  if (hasCategory(cats, "catering.food_truck")) return "matvagn";
  if (hasCategory(cats, "catering.fast_food") || hasCategory(cats, "catering.food_court")) {
    return "snabbmat";
  }
  if (
    hasCategory(cats, "catering.pub") ||
    hasCategory(cats, "catering.bar") ||
    hasCategory(cats, "catering.biergarten") ||
    hasCategory(cats, "catering.taproom")
  ) return "pub";

  switch (amenity) {
    case "cafe": return "café";
    case "fast_food": return "snabbmat";
    case "pub":
    case "bar":
    case "biergarten": return "pub";
    case "bakery": return "bageri";
    default: return "restaurang";
  }
}

const CUISINE_ALIASES: Record<string, string> = {
  swedish: "Svenskt/nordiskt",
  scandinavian: "Svenskt/nordiskt",
  nordic: "Svenskt/nordiskt",
  italian: "Italienskt",
  pizza: "Pizza",
  burger: "Burgare",
  american: "Burgare",
  japanese: "Japanskt",
  sushi: "Sushi",
  thai: "Thailändskt",
  chinese: "Kinesiskt",
  korean: "Koreanskt",
  vietnamese: "Vietnamesiskt",
  indian: "Indiskt",
  lebanese: "Mellanöstern",
  arab: "Mellanöstern",
  middle_eastern: "Mellanöstern",
  turkish: "Mellanöstern",
  mexican: "Mexikanskt/latinamerikanskt",
  latin_american: "Mexikanskt/latinamerikanskt",
  mediterranean: "Medelhavsmat",
  greek: "Medelhavsmat",
  french: "Franskt",
  seafood: "Fisk och skaldjur",
  fish: "Fisk och skaldjur",
  vegetarian: "Vegetariskt/veganskt",
  vegan: "Vegetariskt/veganskt",
  international: "Internationellt",
};

function normalizeCuisineToken(value: string): string | undefined {
  const token = value.trim().toLowerCase().replace(/[ -]+/g, "_");
  return CUISINE_ALIASES[token];
}

export function cuisinesFromGeoapify(props: GeoapifyProperties | undefined): string[] {
  if (!props) return [];
  const values: string[] = [];
  const rawCuisine = props.datasource?.raw?.cuisine;
  if (typeof rawCuisine === "string") values.push(...rawCuisine.split(/[;,]/));
  for (const category of props.categories ?? []) {
    if (
      category.startsWith("catering.restaurant.") ||
      category.startsWith("catering.fast_food.")
    ) values.push(category.split(".").at(-1) ?? "");
  }
  return Array.from(
    new Set(values.map(normalizeCuisineToken).filter((v): v is string => Boolean(v))),
  ).slice(0, 5);
}

export function areaFromGeoapify(props: GeoapifyProperties): string | undefined {
  return props.suburb || props.neighbourhood || props.quarter || props.district || undefined;
}

export function cityFromGeoapify(props: GeoapifyProperties): string {
  return props.city || props.town || props.village || props.municipality || props.county || "";
}

export function addressFromGeoapify(props: GeoapifyProperties): string {
  if (props.address_line1?.trim()) return props.address_line1.trim();
  const street = [props.street, props.housenumber].filter(Boolean).join(" ").trim();
  if (street) return street;
  return props.formatted?.split(",")[0]?.trim() ?? "";
}

export function normalizePlaceFeature(feature: GeoapifyFeature): NormalizedPlaceSuggestion | null {
  const p = feature.properties;
  const externalId = p?.place_id?.trim();
  const name = p?.name?.trim();
  if (!p || !externalId || !name) return null;

  const raw = p.datasource?.raw;
  const website = p.website || raw?.website;
  const phone = p.contact?.phone || raw?.phone;
  const categories = p.categories ?? [];
  const metadata = {
    categories,
    website: typeof website === "string" ? website : undefined,
    phone: typeof phone === "string" ? phone : undefined,
    attribution: GEOAPIFY_ATTRIBUTION,
  };

  return {
    externalId,
    provider: "geoapify",
    name,
    category: categoryFromGeoapify(
      categories,
      typeof raw?.amenity === "string" ? raw.amenity : undefined,
    ),
    cuisines: cuisinesFromGeoapify(p),
    address: addressFromGeoapify(p),
    city: cityFromGeoapify(p),
    area: areaFromGeoapify(p),
    lat: p.lat,
    lng: p.lon,
    distanceKm: typeof p.distance === "number" ? p.distance / 1000 : undefined,
    website: typeof website === "string" ? website : undefined,
    phone: typeof phone === "string" ? phone : undefined,
    externalUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      [name, addressFromGeoapify(p), cityFromGeoapify(p)].filter(Boolean).join(" "),
    )}`,
    attribution: GEOAPIFY_ATTRIBUTION,
    raw: JSON.stringify(metadata),
  };
}

export function normalizeLocationFeature(
  feature: GeoapifyFeature,
): NormalizedLocationSuggestion | null {
  const p = feature.properties;
  if (!p?.place_id || typeof p.lat !== "number" || typeof p.lon !== "number") return null;
  const city = cityFromGeoapify(p);
  if (!city) return null;
  const area = areaFromGeoapify(p);
  const name = p.name || area || city;
  return {
    placeId: p.place_id,
    label: p.formatted || (area ? `${area}, ${city}` : city),
    name,
    city,
    area,
    lat: p.lat,
    lng: p.lon,
    resultType: p.result_type,
  };
}
