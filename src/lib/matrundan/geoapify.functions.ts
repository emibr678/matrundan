/**
 * Autentiserad serveradapter för Geoapify.
 * GEOAPIFY_API_KEY läses endast på servern och skickas aldrig till klienten.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  normalizeLocationFeature,
  normalizePlaceFeature,
  type NormalizedLocationSuggestion,
  type NormalizedPlaceSuggestion,
} from "./geoapify-normalize";
import {
  geoapifyCategoriesForPlaceSearchIntent,
  geoapifyNameQueryForPlaceSearchIntent,
  hasStructuredGeoapifyMapping,
} from "./geoapify-place-search";
import { matchesPlaceSearchIntent, resolvePlaceSearchIntent } from "./place-search-intent";
import { isBoundaryEligibleResultType } from "./search-areas";
import { createShortLivedRequestCache } from "./short-lived-request-cache";
import type { SearchAreaBoundaryGeometry, SearchAreaMode } from "./types";

const REQUEST_TIMEOUT_MS = 10_000;
const WIDE_AREA_RADIUS_KM = 50;
const DISCOVERY_PAGE_SIZE = 20;
const FALLBACK_PROVIDER_LIMIT = 50;
const GEOAPIFY_CACHE_TTL_MS = 5 * 60_000;

type GeoapifyPayload = { features?: unknown[] };
type GeoapifyFeature = {
  geometry?: { type?: unknown; coordinates?: unknown } | null;
  properties?: Record<string, unknown>;
};

const geoapifyResponseCache = createShortLivedRequestCache<GeoapifyPayload>({
  ttlMs: GEOAPIFY_CACHE_TTL_MS,
  maxEntries: 250,
});

const radiusSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(5),
  z.literal(10),
  z.literal(25),
  z.literal(50),
  z.null(),
]);

const searchModeSchema = z.enum(["point", "boundary"]);

export type MultiAreaPlaceSuggestion = NormalizedPlaceSuggestion & {
  nearestAreaLabel: string;
  matchingAreaLabels: string[];
};

type RankedMultiAreaPlaceSuggestion = MultiAreaPlaceSuggestion & {
  nearestAreaSearchMode: SearchAreaMode;
};

export interface MultiAreaSearchResponse {
  results: MultiAreaPlaceSuggestion[];
  failedAreaLabels: string[];
  hasMore: boolean;
  nextOffset: number;
}

export interface SearchAreaBoundaryResponse {
  searchMode: SearchAreaMode;
  boundary: SearchAreaBoundaryGeometry | null;
}

type PlaceSearchPage = {
  results: NormalizedPlaceSuggestion[];
  hasMore: boolean;
  nextOffset: number;
};

type SearchAreaInput = {
  lat: number;
  lng: number;
  radiusKm: 1 | 2 | 3 | 5 | 10 | 25 | 50 | null;
  searchMode?: SearchAreaMode;
  placeId?: string;
};

function readKey(): string {
  const key = process.env.GEOAPIFY_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "GEOAPIFY_NOT_CONFIGURED: Platssökningen är ännu inte aktiverad. Lägg till GEOAPIFY_API_KEY som serverhemlighet.",
    );
  }
  return key;
}

function cacheKeyForGeoapify(url: URL): string {
  const safe = new URL(url);
  safe.searchParams.delete("apiKey");
  return safe.toString();
}

async function fetchGeoapify(url: URL): Promise<GeoapifyPayload> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    if (response.status === 429) {
      throw new Error(
        "GEOAPIFY_RATE_LIMIT: Platssökningen används mycket just nu. Försök igen om en stund.",
      );
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error("GEOAPIFY_CONFIG_ERROR: Geoapify-nyckeln kunde inte användas.");
    }
    if (!response.ok) {
      throw new Error(`GEOAPIFY_UNAVAILABLE: Geoapify svarade med status ${response.status}.`);
    }
    const json = (await response.json()) as unknown;
    if (!json || typeof json !== "object" || !("features" in json)) {
      throw new Error("GEOAPIFY_MALFORMED: Geoapify returnerade ett oväntat svar.");
    }
    return json as GeoapifyPayload;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("GEOAPIFY_TIMEOUT: Platssökningen tog för lång tid. Försök igen.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function callGeoapify(url: URL): Promise<GeoapifyPayload> {
  return geoapifyResponseCache.get(cacheKeyForGeoapify(url), () => fetchGeoapify(url));
}

function boundaryGeometry(feature: unknown): SearchAreaBoundaryGeometry | null {
  if (!feature || typeof feature !== "object") return null;
  const geometry = (feature as GeoapifyFeature).geometry;
  if (!geometry || !Array.isArray(geometry.coordinates)) return null;
  if (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") return null;
  return geometry as SearchAreaBoundaryGeometry;
}

async function loadBoundaryWithFeatures(
  placeId: string,
  features: "details" | "details,details.full_geometry",
): Promise<SearchAreaBoundaryGeometry | null> {
  const url = new URL("https://api.geoapify.com/v2/place-details");
  url.searchParams.set("id", placeId);
  url.searchParams.set("features", features);
  url.searchParams.set("lang", "sv");
  url.searchParams.set("apiKey", readKey());
  const json = await callGeoapify(url);
  for (const feature of json.features ?? []) {
    const geometry = boundaryGeometry(feature);
    if (geometry) return geometry;
  }
  return null;
}

async function loadBoundary(placeId: string): Promise<SearchAreaBoundaryGeometry | null> {
  const detailsBoundary = await loadBoundaryWithFeatures(placeId, "details");
  if (detailsBoundary) return detailsBoundary;

  // Normal Place Details är förstahandsvalet. Geoapifys full_geometry är en
  // tilläggsfeature till details och begärs därför tillsammans med basdetaljen.
  return loadBoundaryWithFeatures(placeId, "details,details.full_geometry");
}

async function resolveSearchAreaBoundary(input: {
  placeId: string;
  resultType?: string;
}): Promise<SearchAreaBoundaryResponse> {
  if (!isBoundaryEligibleResultType(input.resultType)) {
    return { searchMode: "point", boundary: null };
  }
  const boundary = await loadBoundary(input.placeId);
  return boundary ? { searchMode: "boundary", boundary } : { searchMode: "point", boundary: null };
}

async function searchPlacesAtArea(
  input: SearchAreaInput & {
    text?: string;
    limit?: number;
    offset?: number;
  },
): Promise<PlaceSearchPage> {
  const radiusKm = input.radiusKm ?? WIDE_AREA_RADIUS_KM;
  const intent = resolvePlaceSearchIntent(input.text);
  const requestedLimit = Math.min(input.limit ?? DISCOVERY_PAGE_SIZE, 50);
  const providerAlreadyAppliedIntent = hasStructuredGeoapifyMapping(intent);
  const nameQuery = geoapifyNameQueryForPlaceSearchIntent(intent);
  const needsLocalFiltering =
    intent.kind !== "browse" && !providerAlreadyAppliedIntent && !nameQuery;
  const providerLimit = needsLocalFiltering
    ? Math.max(requestedLimit, FALLBACK_PROVIDER_LIMIT)
    : requestedLimit;
  const offset = input.offset ?? 0;
  const searchMode = input.searchMode === "boundary" ? "boundary" : "point";

  if (searchMode === "boundary" && !input.placeId?.trim()) {
    throw new Error("GEOAPIFY_MALFORMED: Sökområdet saknar verifierad provideridentitet.");
  }

  const url = new URL("https://api.geoapify.com/v2/places");
  url.searchParams.set("categories", geoapifyCategoriesForPlaceSearchIntent(intent).join(","));
  url.searchParams.set(
    "filter",
    searchMode === "boundary"
      ? `place:${input.placeId!.trim()}`
      : `circle:${input.lng},${input.lat},${Math.round(radiusKm * 1000)}`,
  );
  url.searchParams.set("bias", `proximity:${input.lng},${input.lat}`);
  url.searchParams.set("lang", "sv");
  url.searchParams.set("limit", String(providerLimit));
  if (offset > 0) url.searchParams.set("offset", String(offset));
  if (nameQuery) url.searchParams.set("name", nameQuery);
  url.searchParams.set("apiKey", readKey());

  const json = await callGeoapify(url);
  const rawFeatureCount = json.features?.length ?? 0;
  const seen = new Set<string>();
  const normalized: NormalizedPlaceSuggestion[] = [];
  for (const feature of json.features ?? []) {
    const place = normalizePlaceFeature(feature as Parameters<typeof normalizePlaceFeature>[0]);
    if (!place || seen.has(place.externalId)) continue;
    seen.add(place.externalId);

    if (!providerAlreadyAppliedIntent && !matchesPlaceSearchIntent(place, intent)) continue;
    normalized.push(place);
  }

  normalized.sort((a, b) => {
    const da = a.distanceKm ?? Number.POSITIVE_INFINITY;
    const db = b.distanceKm ?? Number.POSITIVE_INFINITY;
    return da - db || a.name.localeCompare(b.name, "sv-SE");
  });

  return {
    results: normalized,
    hasMore: rawFeatureCount >= providerLimit,
    nextOffset: offset + providerLimit,
  };
}

export const geoapifyAutocompleteLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        text: z.string().trim().min(2).max(120),
        limit: z.number().int().min(1).max(8).optional(),
        biasLat: z.number().min(-90).max(90).optional(),
        biasLng: z.number().min(-180).max(180).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<NormalizedLocationSuggestion[]> => {
    const url = new URL("https://api.geoapify.com/v1/geocode/autocomplete");
    url.searchParams.set("text", data.text);
    url.searchParams.set("filter", "countrycode:se");
    url.searchParams.set("lang", "sv");
    url.searchParams.set("format", "geojson");
    url.searchParams.set("limit", String(data.limit ?? 6));
    if (data.biasLat != null && data.biasLng != null) {
      url.searchParams.set("bias", `proximity:${data.biasLng},${data.biasLat}`);
    } else {
      url.searchParams.set("bias", "countrycode:se");
    }
    url.searchParams.set("apiKey", readKey());

    const json = await callGeoapify(url);
    const seen = new Set<string>();
    const result: NormalizedLocationSuggestion[] = [];
    for (const feature of json.features ?? []) {
      const normalized = normalizeLocationFeature(
        feature as Parameters<typeof normalizeLocationFeature>[0],
      );
      if (!normalized || seen.has(normalized.placeId)) continue;
      seen.add(normalized.placeId);
      result.push(normalized);
    }
    return result.slice(0, data.limit ?? 6);
  });

export const geoapifyResolveSearchAreaBoundary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        placeId: z.string().trim().min(1).max(240),
        resultType: z.string().trim().max(40).optional(),
      })
      .parse(input),
  )
  .handler(
    async ({ data }): Promise<SearchAreaBoundaryResponse> => resolveSearchAreaBoundary(data),
  );

export const geoapifyLoadSearchAreaBoundaries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        areas: z
          .array(
            z.object({
              id: z.string().min(1).max(120),
              placeId: z.string().trim().min(1).max(240),
              resultType: z.string().trim().max(40).optional(),
            }),
          )
          .max(5),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const rows = await Promise.all(
      data.areas.map(async (area) => ({
        id: area.id,
        ...(await resolveSearchAreaBoundary(area)),
      })),
    );
    return rows;
  });

export const geoapifySearchPlaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        text: z.string().trim().max(120).optional(),
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        radiusKm: radiusSchema,
        limit: z.number().int().min(1).max(50).optional(),
        offset: z.number().int().min(0).max(10_000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<NormalizedPlaceSuggestion[]> => {
    const page = await searchPlacesAtArea({ ...data, searchMode: "point" });
    return page.results.slice(0, data.limit ?? DISCOVERY_PAGE_SIZE);
  });

export const geoapifySearchPlacesMulti = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        text: z.string().trim().max(120).optional(),
        centers: z
          .array(
            z.object({
              id: z.string().min(1).max(120),
              label: z.string().trim().min(1).max(180),
              lat: z.number().min(-90).max(90),
              lng: z.number().min(-180).max(180),
              searchMode: searchModeSchema.optional(),
              placeId: z.string().trim().min(1).max(240).optional(),
            }),
          )
          .min(1)
          .max(5),
        radiusKm: radiusSchema,
        limit: z.number().int().min(1).max(50).optional(),
        offset: z.number().int().min(0).max(10_000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<MultiAreaSearchResponse> => {
    const settled = await Promise.allSettled(
      data.centers.map(async (center) => ({
        center,
        page: await searchPlacesAtArea({
          text: data.text,
          lat: center.lat,
          lng: center.lng,
          searchMode: center.searchMode ?? "point",
          placeId: center.placeId,
          radiusKm: data.radiusKm,
          limit: data.limit ?? DISCOVERY_PAGE_SIZE,
          offset: data.offset ?? 0,
        }),
      })),
    );

    const failedAreaLabels: string[] = [];
    const merged = new Map<string, RankedMultiAreaPlaceSuggestion>();
    let firstFailure: unknown = null;
    let hasMore = false;
    let nextOffset = data.offset ?? 0;

    settled.forEach((outcome, index) => {
      const center = data.centers[index];
      if (outcome.status === "rejected") {
        firstFailure ??= outcome.reason;
        failedAreaLabels.push(center.label);
        return;
      }

      hasMore ||= outcome.value.page.hasMore;
      nextOffset = Math.max(nextOffset, outcome.value.page.nextOffset);
      const centerMode: SearchAreaMode = center.searchMode === "boundary" ? "boundary" : "point";

      for (const place of outcome.value.page.results) {
        const key = `${place.provider}:${place.externalId}`;
        const current = merged.get(key);
        const nextDistance = place.distanceKm ?? Number.POSITIVE_INFINITY;
        const currentDistance = current?.distanceKm ?? Number.POSITIVE_INFINITY;
        const matchingAreaLabels = Array.from(
          new Set([...(current?.matchingAreaLabels ?? []), center.label]),
        );
        const preferNext =
          !current ||
          (centerMode === "point" && current.nearestAreaSearchMode !== "point") ||
          (centerMode === current.nearestAreaSearchMode && nextDistance < currentDistance);

        if (preferNext) {
          merged.set(key, {
            ...place,
            nearestAreaLabel: center.label,
            matchingAreaLabels,
            nearestAreaSearchMode: centerMode,
          });
        } else {
          merged.set(key, { ...current, matchingAreaLabels });
        }
      }
    });

    if (merged.size === 0 && failedAreaLabels.length === data.centers.length) {
      throw firstFailure instanceof Error
        ? firstFailure
        : new Error("GEOAPIFY_UNAVAILABLE: Inga områden kunde sökas just nu.");
    }

    const rankedResults = [...merged.values()].sort((a, b) => {
      const da = a.distanceKm ?? Number.POSITIVE_INFINITY;
      const db = b.distanceKm ?? Number.POSITIVE_INFINITY;
      return da - db || a.name.localeCompare(b.name, "sv-SE");
    });
    const results: MultiAreaPlaceSuggestion[] = rankedResults.map(
      ({ nearestAreaSearchMode, ...result }) =>
        nearestAreaSearchMode === "boundary" ? { ...result, distanceKm: undefined } : result,
    );

    return { results, failedAreaLabels, hasMore, nextOffset };
  });