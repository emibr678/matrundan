/**
 * Ren normalisering av Geoapify-svar till Matrundans domänmodell.
 * Filen innehåller ingen nätverks- eller secret-hantering.
 */
import { normalizeFoodTags } from "./food-tags";
import { isCredibleStreetAddress } from "./place-links";
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
  hasOpeningHours: boolean;
  externalUrl?: string;
  attribution: string;
  /** Begränsad, JSON-serialiserad metadata för place_sources.raw. */
  raw: string;
}

export interface NormalizedLocationSuggestion {
  placeId: string;
  /** Naturlig etikett som sparas när användaren väljer träffen. */
  label: string;
  /** Kort huvudnamn för autocomplete-raden. */
  primaryLabel: string;
  /** Svensk resulttyp och relevant geografisk kontext. */
  secondaryLabel: string;
  name: string;
  city: string;
  area?: string;
  lat: number;
  lng: number;
  resultType?: string;
}

export interface GeoapifyLocationProperties {
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
  state?: string;
  country?: string;
  district?: string;
  suburb?: string;
  neighbourhood?: string;
  quarter?: string;
  postcode?: string;
  country_code?: string;
  result_type?: string;
}

interface GeoapifyProperties extends GeoapifyLocationProperties {
  place_id?: string;
  lat?: number;
  lon?: number;
  distance?: number;
  categories?: string[];
  website?: string;
  opening_hours?: string;
  contact?: { phone?: string };
  datasource?: {
    raw?: Record<string, unknown> & {
      cuisine?: string;
      amenity?: string;
      website?: string;
      phone?: string;
      opening_hours?: string;
      osm_id?: string | number;
      osm_type?: string;
    };
  };
}

interface GeoapifyFeature {
  properties?: GeoapifyProperties;
}

type OsmType = "node" | "way" | "relation";

export interface LocationPresentation {
  primaryLabel: string;
  secondaryLabel: string;
  selectionLabel: string;
}

function clean(value: string | undefined): string {
  return value?.trim() ?? "";
}

function samePlaceLabel(a: string, b: string): boolean {
  return Boolean(a && b && a.localeCompare(b, "sv-SE", { sensitivity: "base" }) === 0);
}

function firstDistinct(primary: string, ...values: string[]): string {
  return values.find((value) => value && !samePlaceLabel(primary, value)) ?? "";
}

function localityName(properties: GeoapifyLocationProperties): string {
  return clean(properties.city) || clean(properties.town) || clean(properties.village);
}

function locationArea(properties: GeoapifyLocationProperties): string {
  return (
    clean(properties.suburb) ||
    clean(properties.neighbourhood) ||
    clean(properties.quarter) ||
    clean(properties.district)
  );
}

function municipalityName(properties: GeoapifyLocationProperties): string {
  return clean(properties.municipality);
}

function countyName(properties: GeoapifyLocationProperties): string {
  return clean(properties.county);
}

function stateName(properties: GeoapifyLocationProperties): string {
  return clean(properties.state);
}

function countryName(properties: GeoapifyLocationProperties): string {
  return clean(properties.country);
}

function looksLikeMunicipality(value: string): boolean {
  return /\s(?:kommun|municipality)$/iu.test(value);
}

function looksLikeCounty(value: string): boolean {
  return /\s(?:län|county)$/iu.test(value);
}

function fallbackPrimary(properties: GeoapifyLocationProperties): string {
  return clean(properties.formatted).split(",")[0]?.trim() ?? "";
}

/**
 * Bygger användarcopy för geografiska autocomplete-träffar från strukturerad
 * Geoapify-data. Rå `formatted` används bara som defensiv fallback för
 * huvudnamnet och aldrig som normal sekundär kontext.
 */
export function resolveLocationPresentation(
  properties: GeoapifyLocationProperties,
): LocationPresentation | null {
  const resultType = clean(properties.result_type).toLocaleLowerCase("en-US");
  const rawName = clean(properties.name);
  const street = clean(properties.street);
  const houseNumber = clean(properties.housenumber);
  const streetAddress = [street, houseNumber].filter(Boolean).join(" ").trim();
  const credibleAddressLine = isCredibleStreetAddress(properties.address_line1, rawName)
    ? clean(properties.address_line1)
    : "";
  const address = houseNumber ? streetAddress || credibleAddressLine : credibleAddressLine;
  const locality = localityName(properties);
  const area = locationArea(properties);
  const municipality = municipalityName(properties);
  const county = countyName(properties);
  const state = stateName(properties);
  const country = countryName(properties);
  const formattedFallback = fallbackPrimary(properties);

  let primaryLabel = "";
  let kindLabel = "Plats";
  let contextLabel = "";

  if (address) {
    primaryLabel = address;
    kindLabel = "Adress";
    contextLabel = firstDistinct(primaryLabel, locality, municipality, county, state);
  } else if (resultType === "street" || (street && samePlaceLabel(rawName, street))) {
    primaryLabel = street || rawName || formattedFallback;
    kindLabel = "Gata";
    contextLabel = firstDistinct(primaryLabel, locality, municipality, county, state);
  } else if (
    resultType === "municipality" ||
    looksLikeMunicipality(rawName) ||
    (rawName && samePlaceLabel(rawName, municipality) && looksLikeMunicipality(municipality))
  ) {
    primaryLabel = rawName || municipality || formattedFallback;
    kindLabel = "Kommun";
    contextLabel = firstDistinct(primaryLabel, county, state);
  } else if (resultType === "county" || looksLikeCounty(rawName)) {
    primaryLabel = rawName || county || formattedFallback;
    kindLabel = "Län";
    contextLabel = firstDistinct(primaryLabel, state, country);
  } else if (resultType === "state" || resultType === "region") {
    primaryLabel = rawName || state || formattedFallback;
    kindLabel = looksLikeCounty(primaryLabel) ? "Län" : "Region";
    contextLabel = firstDistinct(primaryLabel, country);
  } else if (resultType === "country") {
    primaryLabel = rawName || country || formattedFallback;
    kindLabel = "Land";
  } else if (resultType === "postcode") {
    primaryLabel = clean(properties.postcode) || rawName || formattedFallback;
    kindLabel = "Postnummer";
    contextLabel = firstDistinct(primaryLabel, locality, municipality, county, state);
  } else if (resultType === "suburb") {
    primaryLabel = rawName || area || formattedFallback;
    kindLabel = "Stadsdel";
    contextLabel = firstDistinct(primaryLabel, locality, municipality, county, state);
  } else if (resultType === "district") {
    primaryLabel = rawName || area || formattedFallback;
    kindLabel = "Område";
    contextLabel = firstDistinct(primaryLabel, locality, municipality, county, state);
  } else if (["city", "town", "village", "locality"].includes(resultType)) {
    primaryLabel = rawName || locality || formattedFallback;
    kindLabel = looksLikeMunicipality(primaryLabel) ? "Kommun" : "Ort";
    contextLabel = firstDistinct(primaryLabel, municipality, county, state);
  } else {
    primaryLabel =
      rawName || area || locality || municipality || county || state || formattedFallback;
    contextLabel = firstDistinct(primaryLabel, area, locality, municipality, county, state);
  }

  if (!primaryLabel) return null;

  const secondaryLabel = [kindLabel, contextLabel].filter(Boolean).join(" · ");
  const selectionLabel = contextLabel ? `${primaryLabel}, ${contextLabel}` : primaryLabel;
  return { primaryLabel, secondaryLabel, selectionLabel };
}

function hasCategory(categories: string[], prefix: string): boolean {
  return categories.some((category) => category === prefix || category.startsWith(`${prefix}.`));
}

function normalizedOsmType(value: unknown): OsmType | undefined {
  if (typeof value !== "string") return undefined;
  switch (value.trim().toLocaleLowerCase("en-US")) {
    case "n":
    case "node":
      return "node";
    case "w":
    case "way":
      return "way";
    case "r":
    case "relation":
      return "relation";
    default:
      return undefined;
  }
}

function normalizedOsmId(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return String(value);
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return /^\d+$/.test(trimmed) && trimmed !== "0" ? trimmed : undefined;
}

function explicitLifecycleValue(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value !== "string") return false;
  return ["yes", "true", "1", "closed", "disused", "abandoned", "demolished", "removed"].includes(
    value.trim().toLocaleLowerCase("en-US"),
  );
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

export function areaFromGeoapify(props: GeoapifyLocationProperties): string | undefined {
  return props.suburb || props.neighbourhood || props.quarter || props.district || undefined;
}

export function cityFromGeoapify(props: GeoapifyLocationProperties): string {
  return props.city || props.town || props.village || props.municipality || props.county || "";
}

export function addressFromGeoapify(
  props: GeoapifyLocationProperties,
  placeName?: string | null,
): string {
  const street = [props.street, props.housenumber].filter(Boolean).join(" ").trim();
  if (street) return street;

  const addressLine = props.address_line1?.trim();
  if (isCredibleStreetAddress(addressLine, placeName)) return addressLine ?? "";

  const formattedFirstLine = props.formatted?.split(",")[0]?.trim();
  return isCredibleStreetAddress(formattedFirstLine, placeName) ? (formattedFirstLine ?? "") : "";
}

function hasOpeningHours(properties: GeoapifyProperties): boolean {
  const value = properties.opening_hours ?? properties.datasource?.raw?.opening_hours;
  return typeof value === "string" && value.trim().length > 0;
}

export function normalizePlaceFeature(feature: GeoapifyFeature): NormalizedPlaceSuggestion | null {
  const properties = feature.properties;
  const externalId = properties?.place_id?.trim();
  const name = properties?.name?.trim();
  if (!properties || !externalId || !name || isExplicitlyClosedGeoapifyPlace(properties))
    return null;

  const providerRaw = properties.datasource?.raw;
  const website = properties.website || providerRaw?.website;
  const phone = properties.contact?.phone || providerRaw?.phone;
  const openingHoursKnown = hasOpeningHours(properties);
  const osmType = normalizedOsmType(providerRaw?.osm_type);
  const osmId = normalizedOsmId(providerRaw?.osm_id);
  const categories = properties.categories ?? [];
  const address = addressFromGeoapify(properties, name);
  const city = cityFromGeoapify(properties);
  const metadata = {
    provider: "geoapify",
    providerPlaceId: externalId,
    osmType: osmType && osmId ? osmType : undefined,
    osmId: osmType && osmId ? osmId : undefined,
    cuisine: typeof providerRaw?.cuisine === "string" ? providerRaw.cuisine : undefined,
    categories,
    website: typeof website === "string" ? website : undefined,
    phone: typeof phone === "string" ? phone : undefined,
    hasOpeningHours: openingHoursKnown,
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
    address,
    city,
    area: areaFromGeoapify(properties),
    lat: properties.lat,
    lng: properties.lon,
    distanceKm: typeof properties.distance === "number" ? properties.distance / 1000 : undefined,
    website: typeof website === "string" ? website : undefined,
    phone: typeof phone === "string" ? phone : undefined,
    hasOpeningHours: openingHoursKnown,
    externalUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      [name, address, city].filter(Boolean).join(" "),
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

  const presentation = resolveLocationPresentation(properties);
  if (!presentation) return null;

  const city = cityFromGeoapify(properties);
  const area = areaFromGeoapify(properties);
  return {
    placeId: properties.place_id,
    label: presentation.selectionLabel,
    primaryLabel: presentation.primaryLabel,
    secondaryLabel: presentation.secondaryLabel,
    name: presentation.primaryLabel,
    city,
    area,
    lat: properties.lat,
    lng: properties.lon,
    resultType: properties.result_type,
  };
}
