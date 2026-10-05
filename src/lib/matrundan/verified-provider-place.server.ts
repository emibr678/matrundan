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
  const suggestions = payload.features.map((feature) =>
    normalizePlaceFeature(feature as Parameters<typeof normalizePlaceFeature>[0]),
  );
  const place = suggestions.find((suggestion) => suggestion?.externalId === providerPlaceId);
  if (!place || !Number.isFinite(place.lat) || !Number.isFinite(place.lng)) {
    throw new Error("GEOAPIFY_MALFORMED");
  }
  const metadata = JSON.parse(place.raw) as { osmType?: string; osmId?: string };
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
): Promise<VerifiedProviderPlace> {
  return fresh
    ? fetchDetails(providerPlaceId)
    : verifiedDetails.get(providerPlaceId, () => fetchDetails(providerPlaceId));
}
