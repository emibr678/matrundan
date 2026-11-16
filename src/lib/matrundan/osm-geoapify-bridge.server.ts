/** Staging-only OSM selection through the documented Geoapify Places API.
 * The index and the Geoapify Places response must agree on exact OSM type+ID.
 * Never infer a Geoapify Places ID from an unsupported Place Details query.
 */
import { GEOAPIFY_DISCOVERY_CATEGORIES } from "./geoapify-place-search";
import { normalizePlaceFeature, type NormalizedPlaceSuggestion } from "./geoapify-normalize";
import { placeDistanceKm } from "./place-discovery";
import {
  fetchVerifiedProviderPlace,
  type VerifiedProviderPlace,
} from "./verified-provider-place.server";

export interface OsmSource {
  osmType: "node" | "way" | "relation";
  osmId: string;
}
export type OsmCoordinate = { lat: number; lng: number };
type OsmIndexPage = {
  status: "ok" | "not_loaded";
  results: Array<
    OsmCoordinate & { osmType: OsmSource["osmType"]; osmId: number; distanceM: number }
  >;
  hasMore: boolean;
  cursor?: unknown;
};
type GeoapifyPayload = { features?: unknown[] };
type Lookup = (url: URL) => Promise<GeoapifyPayload>;

const MAX_MATCH_DISTANCE_KM = 0.15;
const MAX_INDEX_SEARCH_PAGES = 5;

/** Verify the clicked row still exists in the staging index and is at the
 * requested position before consuming Geoapify credits. The caller supplies
 * an authenticated, catalogue-token-scoped index page reader.
 */
export async function verifyOsmIndexSelection(
  source: OsmSource,
  requested: OsmCoordinate,
  pageReader: (cursor: unknown) => Promise<OsmIndexPage>,
): Promise<OsmCoordinate> {
  if (!Number.isFinite(requested.lat) || !Number.isFinite(requested.lng))
    throw new Error("OSM_PLACE_UNVERIFIED");
  let cursor: unknown = null;
  for (let pageNumber = 0; pageNumber < MAX_INDEX_SEARCH_PAGES; pageNumber++) {
    const page = await pageReader(cursor);
    if (page.status !== "ok") break;
    const selected = page.results.find(
      (candidate) =>
        candidate.osmType === source.osmType &&
        Number.isSafeInteger(candidate.osmId) &&
        String(candidate.osmId) === source.osmId,
    );
    if (selected) {
      if (
        selected.distanceM > 15 ||
        !Number.isFinite(selected.lat) ||
        !Number.isFinite(selected.lng) ||
        placeDistanceKm(requested, selected) > 0.015
      )
        break;
      return { lat: selected.lat, lng: selected.lng };
    }
    if (!page.hasMore || !page.cursor) break;
    cursor = page.cursor;
  }
  throw new Error("OSM_PLACE_UNVERIFIED");
}

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

/** Geoapify Place Details documents lookups by Geoapify place ID or lat/lon,
 * NOT by osm_id/osm_type. Discover by documented Places circle search, then
 * fetch fresh Place Details for its genuine ID; fail closed if none matches.
 */
export async function findVerifiedGeoapifyPlaceForOsm(
  source: OsmSource,
  location: OsmCoordinate,
  lookup: Lookup,
  verify: typeof fetchVerifiedProviderPlace = fetchVerifiedProviderPlace,
): Promise<VerifiedProviderPlace> {
  if (!Number.isFinite(location.lat) || !Number.isFinite(location.lng))
    throw new Error("OSM_PLACE_UNVERIFIED");
  let selected: NormalizedPlaceSuggestion | null = null;
  for (const offset of [0, 50, 100]) {
    const url = new URL("https://api.geoapify.com/v2/places");
    url.searchParams.set("categories", GEOAPIFY_DISCOVERY_CATEGORIES.join(","));
    url.searchParams.set("filter", "circle:" + location.lng + "," + location.lat + ",150");
    url.searchParams.set("bias", "proximity:" + location.lng + "," + location.lat);
    url.searchParams.set("limit", "50");
    if (offset) url.searchParams.set("offset", String(offset));
    url.searchParams.set("lang", "sv");
    const page = await lookup(url);
    const candidates = (page.features ?? []).flatMap((feature) => {
      const place = normalizedExactOsmPlace(feature, source);
      if (!place) return [];
      return placeDistanceKm(location, { lat: place.lat!, lng: place.lng! }) <=
        MAX_MATCH_DISTANCE_KM
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
  // Fetch the genuine Places ID again on the server; the final write path
  // independently verifies it once more with expectedSource.
  const verified = await verify(selected.externalId, true, source);
  if (placeDistanceKm(location, { lat: verified.lat, lng: verified.lng }) > MAX_MATCH_DISTANCE_KM) {
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
export function resolveOsmGeoapifyIdentity(
  source: OsmSource,
  location: OsmCoordinate,
): Promise<VerifiedProviderPlace> {
  return findVerifiedGeoapifyPlaceForOsm(source, location, lookupGeoapify);
}
