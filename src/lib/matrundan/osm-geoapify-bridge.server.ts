/** Strict, staging-only OSM -> Geoapify Places identity bridge.
 * A Geoapify OSM-ID details lookup is NOT automatically a Places identity.
 * Do not use this module to copy source data into group or canonical metadata.
 */
import { GEOAPIFY_DISCOVERY_CATEGORIES } from "./geoapify-place-search";
import { normalizePlaceFeature, type NormalizedPlaceSuggestion } from "./geoapify-normalize";
import { placeDistanceKm } from "./place-discovery";
import { fetchVerifiedProviderPlace, type VerifiedProviderPlace } from "./verified-provider-place.server";

export interface OsmSource {
  osmType: "node" | "way" | "relation";
  osmId: string;
}
type GeoapifyPayload = { features?: unknown[] };
type Lookup = (url: URL) => Promise<GeoapifyPayload>;

const SOURCE_KIND: Record<OsmSource["osmType"], string> = {
  node: "n",
  way: "w",
  relation: "r",
};
const MAX_MATCH_DISTANCE_KM = 0.15;

/** Check the exact OSM object identifier, never a fuzzy name/coordinate match. */
export function normalizedExactOsmPlace(
  feature: unknown,
  source: OsmSource,
): NormalizedPlaceSuggestion | null {
  if (!feature || typeof feature !== "object") return null;
  const place = normalizePlaceFeature(feature as Parameters<typeof normalizePlaceFeature>[0]);
  if (!place || place.lat == null || place.lng == null) return null;
  let raw: { osmType?: string; osmId?: string };
  try {
    raw = JSON.parse(place.raw) as { osmType?: string; osmId?: string };
  } catch {
    return null;
  }
  return raw.osmType === source.osmType && raw.osmId === source.osmId ? place : null;
}

export function selectOsmDetail(
  payload: GeoapifyPayload,
  source: OsmSource,
): NormalizedPlaceSuggestion {
  const details = (payload.features ?? []).filter(
    (feature) =>
      feature &&
      typeof feature === "object" &&
      (feature as { properties?: { feature_type?: unknown } }).properties?.feature_type ===
        "details",
  );
  if (details.length !== 1) throw new Error("OSM_PLACE_UNVERIFIED");
  const match = normalizedExactOsmPlace(details[0], source);
  if (!match) throw new Error("OSM_PLACE_UNVERIFIED");
  return match;
}

/** Read-only adapter; the returned provider ID is verified again by the
 * existing server-side Geoapify Place Details path during the final write.
 */
export async function findVerifiedGeoapifyPlaceForOsm(
  source: OsmSource,
  lookup: Lookup,
  verify: typeof fetchVerifiedProviderPlace = fetchVerifiedProviderPlace,
): Promise<VerifiedProviderPlace> {
  const osmLookup = new URL("https://api.geoapify.com/v2/place-details");
  osmLookup.searchParams.set("osm_id", source.osmId);
  osmLookup.searchParams.set("osm_type", SOURCE_KIND[source.osmType]);
  osmLookup.searchParams.set("features", "details");
  osmLookup.searchParams.set("lang", "sv");
  const detail = selectOsmDetail(await lookup(osmLookup), source);

  let selected: NormalizedPlaceSuggestion | null = null;
  for (const offset of [0, 50]) {
    const url = new URL("https://api.geoapify.com/v2/places");
    url.searchParams.set("categories", GEOAPIFY_DISCOVERY_CATEGORIES.join(","));
    url.searchParams.set("filter", "circle:" + detail.lng + "," + detail.lat + ",150");
    url.searchParams.set("bias", "proximity:" + detail.lng + "," + detail.lat);
    url.searchParams.set("limit", "50");
    if (offset) url.searchParams.set("offset", String(offset));
    url.searchParams.set("lang", "sv");
    const page = await lookup(url);
    const candidates = (page.features ?? []).flatMap((feature) => {
      const place = normalizedExactOsmPlace(feature, source);
      if (!place) return [];
      return placeDistanceKm(
        { lat: detail.lat!, lng: detail.lng! },
        { lat: place.lat!, lng: place.lng! },
      ) <= MAX_MATCH_DISTANCE_KM
        ? [place]
        : [];
    });
    for (const candidate of candidates) {
      if (selected && selected.externalId !== candidate.externalId) {
        throw new Error("OSM_PLACE_AMBIGUOUS");
      }
      selected = candidate;
    }
    if (selected || (page.features?.length ?? 0) < 50) break;
  }
  if (!selected) throw new Error("OSM_PLACE_UNVERIFIED");
  // The selected ID must be an actual Places ID and remain tied to the same
  // OSM object in a fresh server-side Place Details request.
  const verified = await verify(selected.externalId, true, source);
  if (
    placeDistanceKm(
      { lat: detail.lat!, lng: detail.lng! },
      { lat: verified.lat, lng: verified.lng },
    ) > MAX_MATCH_DISTANCE_KM
  ) {
    throw new Error("OSM_PLACE_UNVERIFIED");
  }
  return verified;
}

async function lookupGeoapify(url: URL): Promise<GeoapifyPayload> {
  const key = process.env.GEOAPIFY_API_KEY?.trim();
  if (!key) throw new Error("GEOAPIFY_NOT_CONFIGURED");
  url.searchParams.set("apiKey", key);
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("GEOAPIFY_UNAVAILABLE");
  const payload = (await response.json()) as GeoapifyPayload;
  if (!Array.isArray(payload.features)) throw new Error("GEOAPIFY_MALFORMED");
  return payload;
}

/** Auth and group permission checks are performed by the calling server fn. */
export function resolveOsmGeoapifyIdentity(source: OsmSource): Promise<VerifiedProviderPlace> {
  return findVerifiedGeoapifyPlaceForOsm(source, lookupGeoapify);
}
