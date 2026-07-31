/**
 * Ren normalisering av Geoapify-svar till Matrundans domänmodell.
 * Filen innehåller ingen nätverks- eller secret-hantering.
 */
import { normalizeFoodTags } from "./food-tags";
import type { PlaceCategory } from "./types";

export const GEOAPIFY_ATTRIBUTION = "Platsdata från Geoapify och © OpenStreetMap-bidragsgivare.";

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
  return categories.some((category) => category === prefix || category.startsWith(`${prefix}.`));
}

function explicitLifecycleValue(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value !== "string") return false;
  return ["yes", "true", "1", "closed", "disused", "abandoned", "demolished", "removed"]
    .includes(value.trim().toLocaleLowerCase("en-US"));
}

export function isExplicitlyClosedGeoapifyPlace(
  properties: GeoapifyProperties | undefined,
): boolean {
  if (!properties) return false;
  const raw = properties.datasource?.raw;
  const categories = properties.categories ?? [];

  if (
    categories.some((category) =>
      /(^|\.)(abandoned|demolished|disused|razed|removed)(\.|$)/i.test(category),
    )
  ) {
    return true;
  }
  if (!raw) return false;

  for (const key of ["closed", "disused", "abandoned", "demolished", "razed", "removed"]) {
    if (explicitLifecycleValue(raw[key])) return true;
  }
  for (const key of [
    "disused:amenity",
    "abandoned:amenity",
    "demolished:amenity",
    "removed:amenity",
  ]) {
    if (typeof raw[key] === "string" && raw[key].trim()) return true;
  }
  return typeof raw.end_date === "string" && raw.end_date.trim().length > 0;
}

export function categoryFromGeoapify(
  categories: string[] | undefined,
  amenity?: string,
): PlaceCategory {
  const cats = categories ?? [];
  if (
    hasCategory(cats, "commercial.food_and_drink.bakery") ||
    hasCategory(cats, "catering.bakery")
  ) {
    return "bageri";
  }
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
  ) {
    return "pub";
  }

  switch (amenity) {
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
    default:
      return "restaurang";
  }
}

export function cuisinesFromGeoapify(props: GeoapifyProperties | undefined): string[] {
  if (!props) return [];
  const values: string[] = [];
  const rawCuisine = props.datasource?.raw?.cuisine;
  if (typeof rawCuisine === "string") values.push(...rawCuisine.split(/[;,]/));

  for (const category of props.categories ?? []) {
    if (category.startsWith("catering.restaurant.") || category.startsWith("catering.fast_food.")) {
      values.push(category.split(".").at(-1) ?? "");
    }
  }

  return normalizeFoodTags(values, false).slice(0, 8);
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
  const properties = feature.properties;
  const externalId = properties?.place_id?.trim();
  const name = properties?.name?.trim();
  if (!properties || !externalId || !name || isExplicitlyClosedGeoapifyPlace(properties)) return null;

  const providerRaw = properties.datasource?.raw;
  const website = properties.website || providerRaw?.website;
  const phone = properties.contact?.phone || providerRaw?.phone;
  const categories = properties.categories ?? [];
  const metadata = {
    provider: "geoapify",
    providerPlaceId: externalId,
    cuisine: typeof providerRaw?.cuisine === "string" ? providerRaw.cuisine : undefined,
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
      typeof providerRaw?.amenity === "string" ? providerRaw.amenity : undefined,
    ),
    cuisines: cuisinesFromGeoapify(properties),
    address: addressFromGeoapify(properties),
    city: cityFromGeoapify(properties),
    area: areaFromGeoapify(properties),
    lat: properties.lat,
    lng: properties.lon,
    distanceKm: typeof properties.distance === "number" ? properties.distance / 1000 : undefined,
    website: typeof website === "string" ? website : undefined,
    phone: typeof phone === "string" ? phone : undefined,
    externalUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      [name, addressFromGeoapify(properties), cityFromGeoapify(properties)]
        .filter(Boolean)
        .join(" "),
    )}`,
    attribution: GEOAPIFY_ATTRIBUTION,
    raw: JSON.stringify(metadata),
  };
}

export function normalizeLocationFeature(
  feature: GeoapifyFeature,
): NormalizedLocationSuggestion | null {
  const properties = feature.properties;
  if (
    !properties?.place_id ||
    typeof properties.lat !== "number" ||
    typeof properties.lon !== "number"
  ) {
    return null;
  }
  const city = cityFromGeoapify(properties);
  if (!city) return null;
  const area = areaFromGeoapify(properties);
  const name = properties.name || area || city;
  return {
    placeId: properties.place_id,
    label: properties.formatted || (area ? `${area}, ${city}` : city),
    name,
    city,
    area,
    lat: properties.lat,
    lng: properties.lon,
    resultType: properties.result_type,
  };
}
