import { normalizePlaceFeature } from "./geoapify-normalize";
import { GEOAPIFY_DISCOVERY_CATEGORIES } from "./geoapify-place-search";
import { matchesPlaceSearchIntent, type PlaceSearchIntent } from "./place-search-intent";
import {
  createShortLivedRequestCache,
  type ShortLivedRequestCacheOptions,
} from "./short-lived-request-cache";

type Payload = { features?: unknown[] };
export type GeoapifyNameSearchAnchor = { lat: number; lng: number };

function hasRelevantPlace(payload: Payload, intent: PlaceSearchIntent): boolean {
  return (payload.features ?? []).some((feature) => {
    const place = normalizePlaceFeature(feature as Parameters<typeof normalizePlaceFeature>[0]);
    return place && matchesPlaceSearchIntent(place, intent);
  });
}

/**
 * Choose one bounded Places search stream, never a Geocoding place identity.
 * The first primary page decides the stream so later offsets cannot switch
 * back to primary results or restart a different anchor's pagination.
 */
async function resolveGeoapifyNameSearchAnchor(
  firstPageUrl: URL,
  intent: PlaceSearchIntent,
  load: (url: URL) => Promise<Payload>,
): Promise<GeoapifyNameSearchAnchor | null> {
  if (intent.kind !== "text" || !firstPageUrl.searchParams.has("name")) return null;

  const primary = await load(firstPageUrl);
  if (
    hasRelevantPlace(primary, intent) ||
    (primary.features?.length ?? 0) >= Number(firstPageUrl.searchParams.get("limit"))
  ) {
    // A full rejected page can still have relevant primary results later.
    return null;
  }

  const geocodeUrl = new URL("https://api.geoapify.com/v1/geocode/search");
  for (const key of ["name", "filter", "bias", "lang", "apiKey"]) {
    const value = firstPageUrl.searchParams.get(key);
    if (value != null) geocodeUrl.searchParams.set(key, value);
  }
  geocodeUrl.searchParams.set("type", "amenity");
  geocodeUrl.searchParams.set("format", "geojson");
  geocodeUrl.searchParams.set("limit", "10");
  const seeds = await load(geocodeUrl);
  const tried = new Set<string>();

  // At most three candidate positions; stop as soon as Places verifies one.
  for (const feature of (seeds.features ?? []).slice(0, 10)) {
    if (!feature || typeof feature !== "object") continue;
    const properties = (feature as { properties?: Record<string, unknown> }).properties;
    const category = properties?.category;
    const lat = properties?.lat;
    const lng = properties?.lon;
    if (
      properties?.result_type !== "amenity" ||
      typeof category !== "string" ||
      !GEOAPIFY_DISCOVERY_CATEGORIES.some((c) => category === c || category.startsWith(c + ".")) ||
      typeof lat !== "number" ||
      !Number.isFinite(lat) ||
      Math.abs(lat) > 90 ||
      typeof lng !== "number" ||
      !Number.isFinite(lng) ||
      Math.abs(lng) > 180
    )
      continue;

    const place = normalizePlaceFeature(feature as Parameters<typeof normalizePlaceFeature>[0]);
    if (!place || !matchesPlaceSearchIntent(place, intent)) continue;
    const positionKey = `${lng},${lat}`;
    if (tried.has(positionKey)) continue;
    tried.add(positionKey);

    const anchoredUrl = new URL(firstPageUrl);
    anchoredUrl.searchParams.set("bias", `proximity:${lng},${lat}`);
    if (hasRelevantPlace(await load(anchoredUrl), intent)) return { lat, lng };
    if (tried.size >= 3) break;
  }
  return null;
}

export function createGeoapifyNameSearchAnchorResolver(
  load: (url: URL) => Promise<Payload>,
  cacheOptions: ShortLivedRequestCacheOptions,
) {
  const cache = createShortLivedRequestCache<GeoapifyNameSearchAnchor | null>(cacheOptions);
  return (pageUrl: URL, intent: PlaceSearchIntent) => {
    const firstPageUrl = new URL(pageUrl);
    firstPageUrl.searchParams.delete("offset");
    const cacheKey = new URL(firstPageUrl);
    cacheKey.searchParams.delete("apiKey");
    return cache.get(cacheKey.toString(), () =>
      resolveGeoapifyNameSearchAnchor(firstPageUrl, intent, load),
    );
  };
}
