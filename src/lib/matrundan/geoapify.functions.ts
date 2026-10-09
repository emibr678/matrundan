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
import { createGeoapifyNameSearchAnchorResolver } from "./geoapify-name-search.server";
import { distanceKm } from "./manual-place-source-linking";
import { isBoundaryEligibleResultType } from "./search-areas";
import { expandedNameRadiusKm } from "./place-search-expansion";
import { matchesTypoPlaceName, typoProviderSearchSeed } from "./place-search-typo";
import { createShortLivedRequestCache } from "./short-lived-request-cache";
import {
  observeProviderRequest,
  observeSearchWithBudget,
  recordSearchPhaseMs,
  recordSearchCandidateCounts,
} from "./place-search-observation.server";
import { budgetProviderRequest, estimatedGeoapifyCredits } from "./place-search-budget.server";
import {
  canonicalPlaceCandidateSchema,
  providerIdentityReviewSchema,
} from "./place-discovery.schemas";
import {
  placeWithinBoundary,
  placeDistanceKm,
  matchesSpecificPlaceName,
  isSpecificPlaceName,
  manualFallbackProviderCandidates,
} from "./place-discovery";
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

const resolveNameSearchAnchor = createGeoapifyNameSearchAnchorResolver(callGeoapify, {
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
  nearestAreaId: string;
  matchingAreaLabels: string[];
  matchingAreaIds: string[];
  searchAreaGroup?: "nearby" | "name-outside";
  searchMatchType?: "tolerant";
};

type RankedMultiAreaPlaceSuggestion = MultiAreaPlaceSuggestion & {
  nearestAreaSearchMode: SearchAreaMode;
};

export interface MultiAreaSearchResponse {
  results: MultiAreaPlaceSuggestion[];
  failedAreaLabels: string[];
  hasMore: boolean;
  nextOffset: number;
  areaOffsets: Record<string, number>;
  exhaustedAreaIds: string[];
  failedAreaIds: string[];
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
  radiusKm: number | null;
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
  return geoapifyResponseCache.get(cacheKeyForGeoapify(url), () =>
    budgetProviderRequest(estimatedGeoapifyCredits(url), () =>
      observeProviderRequest(() => fetchGeoapify(url)),
    ),
  );
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
    /** The original #464 name recovery is used only for the primary search. */
    allowNameAnchorRecovery?: boolean;
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

  const anchor =
    nameQuery && input.allowNameAnchorRecovery !== false
      ? await resolveNameSearchAnchor(url, intent)
      : null;
  if (anchor) url.searchParams.set("bias", `proximity:${anchor.lng},${anchor.lat}`);

  const json = await callGeoapify(url);
  const rawFeatureCount = json.features?.length ?? 0;
  const seen = new Set<string>();
  const normalized: NormalizedPlaceSuggestion[] = [];
  for (const feature of json.features ?? []) {
    const place = normalizePlaceFeature(feature as Parameters<typeof normalizePlaceFeature>[0]);
    if (!place || seen.has(place.externalId)) continue;
    seen.add(place.externalId);

    if (!providerAlreadyAppliedIntent && !matchesPlaceSearchIntent(place, intent)) continue;
    if (anchor) {
      // Provider distance now refers to the anchor, not the user's search point.
      place.distanceKm =
        typeof place.lat === "number" &&
        Number.isFinite(place.lat) &&
        typeof place.lng === "number" &&
        Number.isFinite(place.lng)
          ? distanceKm(input, { lat: place.lat, lng: place.lng })
          : undefined;
    }
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
  .handler(async ({ data }): Promise<SearchAreaBoundaryResponse> =>
    resolveSearchAreaBoundary(data),
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

const multiAreaInputSchema = z.object({
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
  areaOffsets: z.record(z.number().int().min(0).max(10_000)).optional(),
  exhaustedAreaIds: z.array(z.string().min(1).max(120)).max(5).optional(),
  providerRequestLimit: z.number().int().min(0).max(25).optional(),
  providerCreditLimit: z.number().int().min(0).max(40).optional(),
  searchPhase: z.enum(["primary", "recovery", "complete"]).optional(),
});

async function searchProviderAreas(
  data: z.infer<typeof multiAreaInputSchema>,
): Promise<MultiAreaSearchResponse> {
  const nameIntent = resolvePlaceSearchIntent(data.text);
  const expandedRadius =
    data.searchPhase === "primary" &&
    nameIntent.kind === "text" &&
    isSpecificPlaceName(nameIntent.query) &&
    data.centers.every((center) => center.searchMode !== "boundary")
      ? expandedNameRadiusKm(data.radiusKm)
      : null;
  const exhausted = new Set(data.exhaustedAreaIds ?? []);
  const centers = data.centers.filter((center) => !exhausted.has(center.id));
  const offsets = { ...(data.areaOffsets ?? {}) };
  const settled = await Promise.allSettled(
    centers.map(async (center) => ({
      center,
      page: await searchPlacesAtArea({
        text: data.text,
        lat: center.lat,
        lng: center.lng,
        searchMode: center.searchMode ?? "point",
        placeId: center.placeId,
        radiusKm: expandedRadius ?? data.radiusKm,
        limit: data.limit ?? DISCOVERY_PAGE_SIZE,
        offset: offsets[center.id] ?? data.offset ?? 0,
        allowNameAnchorRecovery: data.searchPhase !== "primary",
      }),
    })),
  );

  const failedAreaLabels: string[] = [];
  const failedAreaIds: string[] = [];
  const merged = new Map<string, RankedMultiAreaPlaceSuggestion>();
  let firstFailure: unknown = null;
  let hasMore = false;
  let nextOffset = data.offset ?? 0;

  settled.forEach((outcome, index) => {
    const center = centers[index];
    if (outcome.status === "rejected") {
      firstFailure ??= outcome.reason;
      failedAreaLabels.push(center.label);
      failedAreaIds.push(center.id);
      return;
    }

    if (outcome.value.page.hasMore) hasMore = true;
    else exhausted.add(center.id);
    offsets[center.id] = outcome.value.page.nextOffset;
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
      const matchingAreaIds = Array.from(new Set([...(current?.matchingAreaIds ?? []), center.id]));
      const preferNext =
        !current ||
        (centerMode === "point" && current.nearestAreaSearchMode !== "point") ||
        (centerMode === current.nearestAreaSearchMode && nextDistance < currentDistance);

      if (preferNext) {
        merged.set(key, {
          ...place,
          nearestAreaLabel: center.label,
          nearestAreaId: center.id,
          matchingAreaLabels,
          matchingAreaIds,
          nearestAreaSearchMode: centerMode,
        });
      } else {
        merged.set(key, { ...current, matchingAreaLabels, matchingAreaIds });
      }
    }
  });

  if (centers.length > 0 && merged.size === 0 && failedAreaIds.length === centers.length) {
    throw firstFailure instanceof Error
      ? firstFailure
      : new Error("GEOAPIFY_UNAVAILABLE: Inga områden kunde sökas just nu.");
  }

  const rankedResults = [...merged.values()].sort((a, b) => {
    const da = a.distanceKm ?? Number.POSITIVE_INFINITY;
    const db = b.distanceKm ?? Number.POSITIVE_INFINITY;
    return da - db || a.name.localeCompare(b.name, "sv-SE");
  });
  const results: MultiAreaPlaceSuggestion[] = rankedResults.flatMap(
    ({ nearestAreaSearchMode, ...result }) => {
      if (nearestAreaSearchMode === "boundary") return [{ ...result, distanceKm: undefined }];
      if (expandedRadius == null || result.lat == null || result.lng == null) return [result];
      if (!data.centers.some((center) => distanceKm(center, result) <= expandedRadius)) return [];
      const primaryMemberships = data.centers.filter(
        (center) => distanceKm(center, result) <= (data.radiusKm ?? WIDE_AREA_RADIUS_KM),
      );
      if (primaryMemberships.length > 0) {
        return [
          {
            ...result,
            matchingAreaIds: primaryMemberships.map((center) => center.id),
            matchingAreaLabels: primaryMemberships.map((center) => center.label),
          },
        ];
      }
      if (!matchesSpecificPlaceName(nameIntent.query, result.name)) return [];
      return [
        { ...result, matchingAreaIds: [], matchingAreaLabels: [], searchAreaGroup: "nearby" as const },
      ];
    },
  );

  return {
    results,
    failedAreaLabels,
    failedAreaIds,
    hasMore: hasMore || failedAreaIds.length > 0,
    nextOffset,
    areaOffsets: offsets,
    exhaustedAreaIds: [...exhausted],
  };
}

export const geoapifySearchPlacesMulti = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => multiAreaInputSchema.parse(input))
  .handler(({ data }) => searchProviderAreas(data));

/** Public place identity only; private group state is projected for this group. */
export const searchPlaceDiscovery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => multiAreaInputSchema.extend({ groupId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) =>
    observeSearchWithBudget({
      requests: data.providerRequestLimit ?? 25,
      credits: data.providerCreditLimit ?? 40,
    })(async () => {
      const accessStarted = performance.now();
      const access = await context.supabase.rpc("get_place_discovery_context_v1", {
        _group_id: data.groupId,
      });
      recordSearchPhaseMs("access", performance.now() - accessStarted);
      if (access.error) throw new Error("Gruppen kunde inte verifieras.");
      const intent = resolvePlaceSearchIntent(data.text ?? "");
      const explicit = (data.text?.trim().length ?? 0) >= 2;
      const internalPromise = (async () => {
        if (!explicit || (data.offset ?? 0) > 0)
          return {
            results: [] as import("./places-provider").PlaceSuggestion[],
            incomplete: false,
          };
        const boundaries = await Promise.allSettled(
          data.centers.map(async (center) => {
            if (center.searchMode !== "boundary") return { center, boundary: null };
            const boundary = center.placeId ? await loadBoundary(center.placeId) : null;
            if (!boundary) throw new Error("Områdesgränsen kunde inte hämtas");
            return { center, boundary };
          }),
        );
        const valid = boundaries.flatMap((outcome) =>
          outcome.status === "fulfilled" ? [outcome.value] : [],
        );
        if (!valid.length) return { results: [], incomplete: true };
        const centers = valid.map(({ center, boundary }) => {
          const points = boundary
            ? boundary.type === "Polygon"
              ? boundary.coordinates.flat()
              : boundary.coordinates.flat(2)
            : [];
          return {
            lat: center.lat,
            lng: center.lng,
            radiusKm: data.radiusKm ?? 50,
            ...(boundary
              ? {
                  bounds: [
                    Math.min(...points.map((p) => p[0])),
                    Math.min(...points.map((p) => p[1])),
                    Math.max(...points.map((p) => p[0])),
                    Math.max(...points.map((p) => p[1])),
                  ],
                }
              : {}),
          };
        });
        const found =
          data.searchPhase === "recovery"
            ? { data: [], error: null }
            : await context.supabase.rpc("search_canonical_places_v1", {
                _group_id: data.groupId,
                _text: intent.kind === "text" ? intent.query : "",
                _centers: centers,
                _categories: intent.kind === "category" ? [intent.category] : [],
                _cuisines: intent.kind === "food-tag" ? [intent.tagId] : [],
                _limit: 200,
              });
        if (found.error) return { results: [], incomplete: true };
        const rows = z.array(canonicalPlaceCandidateSchema).parse(found.data);
        const primaryTruncated = rows.length === 200;
        let fuzzyIncomplete = false;
        const fuzzyIds = new Set<string>();
        const fuzzyRadius =
          data.searchPhase !== "complete" &&
          data.centers.every((center) => center.searchMode !== "boundary")
            ? expandedNameRadiusKm(data.radiusKm)
            : null;
        if (
          data.searchPhase !== "primary" &&
          intent.kind === "text" &&
          isSpecificPlaceName(intent.query) &&
          !rows.some((row) => matchesSpecificPlaceName(intent.query, row.name))
        ) {
          const fuzzy = await context.supabase.rpc("search_canonical_name_candidates_v1", {
            _group_id: data.groupId,
            _text: intent.query,
            _centers: fuzzyRadius == null
              ? centers
              : centers.map((center) => ({ ...center, radiusKm: fuzzyRadius })),
          });
          if (fuzzy.error) {
            // Missing migration or a provider/database fault is never a confirmed zero-result.
            fuzzyIncomplete = true;
          } else {
            const seen = new Set(rows.map((row) => row.placeId));
            for (const row of z.array(canonicalPlaceCandidateSchema).parse(fuzzy.data)) {
              if (seen.has(row.placeId)) continue;
              seen.add(row.placeId);
              fuzzyIds.add(row.placeId);
              rows.push(row);
            }
          }
        }
        const results = rows.flatMap((canonical) => {
          const matching = valid.filter(({ center, boundary }) =>
            boundary
              ? placeWithinBoundary(canonical, boundary)
              : placeDistanceKm(canonical, center) <=
                (intent.kind === "text" && matchesSpecificPlaceName(intent.query, canonical.name)
                  ? 50
                  : fuzzyIds.has(canonical.placeId) && fuzzyRadius != null
                    ? fuzzyRadius
                    : (data.radiusKm ?? 50)),
          );
          if (!matching.length) return [];
          const nearest = matching
            .map(({ center, boundary }) => ({
              center,
              boundary,
              distance: placeDistanceKm(canonical, center),
            }))
            .sort((a, b) => a.distance - b.distance)[0];
          return [
            {
              kind: "canonical" as const,
              searchMatchType: fuzzyIds.has(canonical.placeId) ? ("tolerant" as const) : undefined,
              resultKey: `canonical:${canonical.placeId}`,
              externalId: `canonical:${canonical.placeId}`,
              canonical,
              name: canonical.name,
              category: canonical.category,
              cuisines: canonical.cuisines,
              address: canonical.address,
              city: canonical.city,
              area: canonical.area ?? undefined,
              lat: canonical.lat,
              lng: canonical.lng,
              nearestAreaLabel: nearest.center.label,
              nearestAreaId: nearest.center.id,
              matchingAreaLabels: matching.map(({ center }) => center.label),
              matchingAreaIds: matching.map(({ center }) => center.id),
              distanceKm: nearest.boundary ? undefined : nearest.distance,
              searchAreaGroup:
                !nearest.boundary &&
                nearest.distance > (data.radiusKm ?? 50) &&
                (matchesSpecificPlaceName(intent.query, canonical.name) ||
                  fuzzyIds.has(canonical.placeId))
                  ? ("name-outside" as const)
                  : undefined,
            },
          ];
        });
        return {
          results,
          incomplete: primaryTruncated || fuzzyIncomplete || valid.length < data.centers.length,
        };
      })().catch(() => ({ results: [], incomplete: true }));
      const sourcesStarted = performance.now();
      const [providerOutcome, internal] = await Promise.all([
        data.searchPhase === "recovery"
          ? Promise.resolve({
              ok: true as const,
              value: {
                results: [] as MultiAreaSearchResponse["results"],
                failedAreaLabels: [] as string[],
                failedAreaIds: [] as string[],
                hasMore: false,
                nextOffset: 0,
                areaOffsets: {} as Record<string, number>,
                exhaustedAreaIds: [] as string[],
              },
            })
          : searchProviderAreas(data)
              .then((value) => ({ ok: true as const, value }))
              .catch(() => ({ ok: false as const })),
        internalPromise,
      ]);
      recordSearchPhaseMs("sources", performance.now() - sourcesStarted);
      const page = providerOutcome.ok
        ? providerOutcome.value
        : {
            results: [],
            failedAreaLabels: data.centers.map((c) => c.label),
            hasMore: false,
            nextOffset: data.offset ?? 0,
            areaOffsets: data.areaOffsets ?? {},
            exhaustedAreaIds: data.exhaustedAreaIds ?? [],
            failedAreaIds: data.centers.map((c) => c.id),
          };
      // One bounded external recovery after an exhausted primary name search.
      // Strong canonical 50-km results remain available without external expansion.
      const expansionRadius = expandedNameRadiusKm(data.radiusKm);
      const primaryOnly = data.searchPhase === "primary";
      const recoveryEligible =
        (data.offset ?? 0) === 0 &&
        !page.hasMore &&
        !page.failedAreaIds.length &&
        intent.kind === "text" &&
        isSpecificPlaceName(intent.query) &&
        ![...page.results, ...internal.results].some((place) =>
          matchesSpecificPlaceName(intent.query, place.name),
        );
      const recoveryStarted = performance.now();
      const nearbyCandidates: typeof page.results = [];
      const typoCandidates: typeof page.results = [];
      // One bounded candidate stage: try a broad-enough name prefix before
      // spending time on Geocoding -> Places verification. All returned
      // identities still come exclusively from Places and the group-scoped RPC.
      if (!primaryOnly && recoveryEligible && intent.kind === "text") {
        const allPoints = data.centers.every((center) => center.searchMode !== "boundary");
        const retrievalRadius = allPoints
          ? (expandedNameRadiusKm(data.radiusKm) ?? data.radiusKm)
          : data.radiusKm;
        const seen = new Set(page.results.map((place) => place.externalId));

        const recordCandidate = (
          candidate: (typeof page.results)[number],
          centerIndex: number,
          tolerant: boolean,
        ) => {
          if (seen.has(candidate.externalId)) return;
          const center = data.centers[centerIndex];
          const distances =
            allPoints && candidate.lat != null && candidate.lng != null
              ? data.centers.map((area) => ({
                  area,
                  km: distanceKm(area, { lat: candidate.lat!, lng: candidate.lng! }),
                }))
              : [];
          const selectedRadius = data.radiusKm ?? WIDE_AREA_RADIUS_KM;
          const maxRadius = retrievalRadius ?? WIDE_AREA_RADIUS_KM;
          if (allPoints && (!distances.length || distances.every(({ km }) => km > maxRadius)))
            return;
          const primary = allPoints
            ? distances.filter(({ km }) => km <= selectedRadius).map(({ area }) => area)
            : [center];
          const nearest = allPoints
            ? [...distances].sort((left, right) => left.km - right.km)[0]
            : null;
          seen.add(candidate.externalId);
          const normalized = {
            ...candidate,
            nearestAreaLabel: nearest?.area.label ?? center.label,
            nearestAreaId: nearest?.area.id ?? center.id,
            distanceKm: nearest?.km ?? candidate.distanceKm,
            matchingAreaLabels: primary.map((area) => area.label),
            matchingAreaIds: primary.map((area) => area.id),
            searchAreaGroup: primary.length ? undefined : ("nearby" as const),
            searchMatchType: tolerant ? ("tolerant" as const) : undefined,
          };
          if (tolerant) typoCandidates.push(normalized);
          else nearbyCandidates.push(normalized);
        };

        const prefix = typoProviderSearchSeed(intent.query);
        if (prefix) {
          const candidatePages = await Promise.allSettled(
            data.centers.map((center) =>
              searchPlacesAtArea({
                text: prefix,
                lat: center.lat,
                lng: center.lng,
                searchMode: center.searchMode ?? "point",
                placeId: center.placeId,
                radiusKm: retrievalRadius,
                limit: 50,
                offset: 0,
                allowNameAnchorRecovery: false,
              }),
            ),
          );
          candidatePages.forEach((outcome, centerIndex) => {
            if (outcome.status !== "fulfilled") return;
            for (const candidate of outcome.value.results) {
              const exact = matchesSpecificPlaceName(intent.query, candidate.name);
              const tolerant = !exact && matchesTypoPlaceName(intent.query, candidate.name);
              if (exact || tolerant) recordCandidate(candidate, centerIndex, tolerant);
            }
          });
        }

        // The Places name index can omit a real venue even for a valid prefix.
        // Keep the original bounded #464 name anchor as a LAST resort.
        if (nearbyCandidates.length === 0 && typoCandidates.length === 0) {
          const anchoredPages = await Promise.allSettled(
            data.centers.map((center) =>
              searchPlacesAtArea({
                text: data.text,
                lat: center.lat,
                lng: center.lng,
                searchMode: center.searchMode ?? "point",
                placeId: center.placeId,
                radiusKm: retrievalRadius,
                limit: 20,
                offset: 0,
                allowNameAnchorRecovery: true,
              }),
            ),
          );
          anchoredPages.forEach((outcome, centerIndex) => {
            if (outcome.status !== "fulfilled") return;
            for (const candidate of outcome.value.results) {
              if (matchesSpecificPlaceName(intent.query, candidate.name))
                recordCandidate(candidate, centerIndex, false);
            }
          });
        }
      }
      recordSearchPhaseMs("recovery", performance.now() - recoveryStarted);
      recordSearchCandidateCounts({
        primary: page.results.length,
        canonical: internal.results.length,
        nearby: nearbyCandidates.length,
        typo: typoCandidates.length,
      });
      const allProviderResults = [
        ...page.results,
        ...nearbyCandidates.slice(0, 3),
        ...typoCandidates.slice(0, 5),
      ];
      const items = allProviderResults.map((place) => {
        const source = JSON.parse(place.raw) as { osmType?: string; osmId?: string };
        return {
          externalId: place.externalId,
          name: place.name,
          category: place.category,
          cuisines: place.cuisines,
          address: place.address,
          area: place.area ?? null,
          city: place.city,
          lat: place.lat ?? null,
          lng: place.lng ?? null,
          osmType: source.osmType ?? null,
          osmId: source.osmId ?? null,
        };
      });
      const identityStarted = performance.now();
      const matches = items.length
        ? await context.supabase.rpc("match_place_discovery_candidates_v1", {
            _group_id: data.groupId,
            _items: items,
          })
        : { data: [], error: null };
      recordSearchPhaseMs("identity", performance.now() - identityStarted);
      const reviews = matches.error
        ? []
        : z.array(providerIdentityReviewSchema).parse(matches.data);
      const results: import("./places-provider").PlaceSuggestion[] = [
        ...internal.results,
        ...allProviderResults.map(({ raw: _raw, ...place }) => ({
          ...place,
          kind: "provider" as const,
          resultKey: `provider:geoapify:${place.externalId}`,
          identity: reviews.find((review) => review.providerPlaceId === place.externalId) ?? {
            providerPlaceId: place.externalId,
            providerVersion: "",
            knownPlace: null,
            candidates: [],
            reviewRequired: true,
            identityConflict: false,
          },
        })),
      ];
      return {
        ...page,
        results,
        canonicalIncomplete: internal.incomplete,
        pendingRecovery: primaryOnly && recoveryEligible,
        canConfirm: (access.data as { canConfirm: boolean }).canConfirm,
      };
    }),
  );

/** Final read-only check at the selected address, never a provider write authority. */
export const findNearbyPlacesForManualFallback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        groupId: z.string().uuid(),
        name: z.string().trim().min(2).max(120),
        address: z.string().max(500),
        city: z.string().max(200),
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const access = await context.supabase.rpc("get_place_discovery_context_v1", {
      _group_id: data.groupId,
    });
    if (access.error) throw new Error("Gruppen kunde inte verifieras.");
    const intent = resolvePlaceSearchIntent(data.name);
    if (intent.kind !== "text" || !matchesSpecificPlaceName(data.name, data.name)) return [];
    // Isolated from the previous search radius. Every candidate is later fetched
    // again by resolveProviderPlace before any identity write.
    try {
      const page = await searchProviderAreas({
        text: data.name,
        radiusKm: 1,
        centers: [
          { ...data, id: "manual-selected-location", label: data.address, searchMode: "point" },
        ],
        limit: 50,
        offset: 0,
      });
      return manualFallbackProviderCandidates(data, page.results).map(
        ({ raw: _raw, ...place }) => ({ ...place, provider: "geoapify" as const }),
      );
    } catch {
      return [];
    }
  });
