import { GEOAPIFY_DISCOVERY_CATEGORIES } from "./geoapify-place-search";
import { normalizePlaceFeature } from "./geoapify-normalize";
import { createShortLivedRequestCache } from "./short-lived-request-cache";
import type { PlaceCategory } from "./types";

const verifiedDetails = createShortLivedRequestCache<VerifiedProviderPlace>({
  ttlMs: 60_000,
  maxEntries: 250,
});

export interface VerifiedProviderPlace {
  externalId: string;
  name: string;
  category: PlaceCategory;
  cuisines: string[];
  address: string;
  area: string | null;
  city: string;
  lat: number;
  lng: number;
  osmType: string | null;
  osmId: string | null;
  website: string | null;
  fetchedAt: string;
}

async function fetchDetails(providerPlaceId: string): Promise<VerifiedProviderPlace> {
  const key = process.env.GEOAPIFY_API_KEY?.trim();
  if (!key) throw new Error("GEOAPIFY_NOT_CONFIGURED");
  const url = new URL("https://api.geoapify.com/v2/place-details");
  url.searchParams.set("id", providerPlaceId);
  url.searchParams.set("features", "details");
  url.searchParams.set("lang", "sv");
  url.searchParams.set("apiKey", key);
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("GEOAPIFY_UNAVAILABLE");
  const payload = (await response.json()) as { features?: unknown[] };
  if (!Array.isArray(payload.features)) throw new Error("GEOAPIFY_MALFORMED");
  // An ID lookup returns one authoritative details record. Geoapify may
  // regenerate its place_id even when the underlying OSM object is unchanged.
  // Never select an arbitrary related feature or write using that changed ID.
  const details = payload.features.filter(
    (feature) =>
      feature &&
      typeof feature === "object" &&
      (feature as { properties?: { feature_type?: unknown } }).properties?.feature_type ===
        "details",
  );
  if (details.length !== 1) throw new Error("GEOAPIFY_MALFORMED");
  const place = normalizePlaceFeature(details[0] as Parameters<typeof normalizePlaceFeature>[0]);
  if (!place || !Number.isFinite(place.lat) || !Number.isFinite(place.lng)) {
    throw new Error("GEOAPIFY_MALFORMED");
  }
  const metadata = JSON.parse(place.raw) as {
    osmType?: string;
    osmId?: string;
    categories?: unknown[];
  };
  if (
    !metadata.categories?.some(
      (category) =>
        typeof category === "string" &&
        GEOAPIFY_DISCOVERY_CATEGORIES.some(
          (allowed) => category === allowed || category.startsWith(`${allowed}.`),
        ),
    )
  ) {
    throw new Error("GEOAPIFY_MALFORMED");
  }
  if (place.lat! < -90 || place.lat! > 90 || place.lng! < -180 || place.lng! > 180)
    throw new Error("GEOAPIFY_MALFORMED");
  // A changed provider ID is acceptable only with a stable OSM source identity.
  if (place.externalId !== providerPlaceId && (!metadata.osmType || !metadata.osmId)) {
    throw new Error("GEOAPIFY_MALFORMED");
  }
  return {
    externalId: providerPlaceId,
    name: place.name,
    category: place.category,
    cuisines: place.cuisines,
    address: place.address,
    area: place.area ?? null,
    city: place.city,
    lat: place.lat!,
    lng: place.lng!,
    osmType: metadata.osmType ?? null,
    osmId: metadata.osmId ?? null,
    website: place.website ?? null,
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchVerifiedProviderPlace(
  providerPlaceId: string,
  fresh = false,
  expectedSource?: { osmType: string; osmId: string },
): Promise<VerifiedProviderPlace> {
  const verified = fresh
    ? await fetchDetails(providerPlaceId)
    : await verifiedDetails.get(providerPlaceId, () => fetchDetails(providerPlaceId));
  // The selected search result is a consistency guard, not a source of
  // authority. Provider data is fetched anew server-side before the RPC write.
  if (
    expectedSource &&
    (verified.osmType !== expectedSource.osmType || verified.osmId !== expectedSource.osmId)
  ) {
    throw new Error("GEOAPIFY_MALFORMED");
  }
  return verified;
}
