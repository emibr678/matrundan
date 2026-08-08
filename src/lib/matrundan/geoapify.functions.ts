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
import { createShortLivedRequestCache } from "./short-lived-request-cache";

const REQUEST_TIMEOUT_MS = 10_000;
const WIDE_AREA_RADIUS_KM = 50;
const DISCOVERY_PAGE_SIZE = 20;
const FALLBACK_PROVIDER_LIMIT = 50;
const GEOAPIFY_CACHE_TTL_MS = 5 * 60_000;

type GeoapifyPayload = { features?: unknown[] };

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

export type MultiAreaPlaceSuggestion = NormalizedPlaceSuggestion & {
  nearestAreaLabel: string;
  matchingAreaLabels: string[];
};

export interface MultiAreaSearchResponse {
  results: MultiAreaPlaceSuggestion[];
  failedAreaLabels: string[];
  hasMore: boolean;
  nextOffset: number;
}

type PlaceSearchPage = {
  results: NormalizedPlaceSuggestion[];
  hasMore: boolean;
  nextOffset: number;
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

async function searchPlacesAtCenter(input: {
  text?: string;
  lat: number;
  lng: number;
  radiusKm: 1 | 2 | 3 | 5 | 10 | 25 | 50 | null;
  limit?: number;
  offset?: number;
}): Promise<PlaceSearchPage> {
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

  const url = new URL("https://api.geoapify.com/v2/places");
  url.searchParams.set("categories", geoapifyCategoriesForPlaceSearchIntent(intent).join(","));
  url.searchParams.set("filter", `circle:${input.lng},${input.lat},${Math.round(radiusKm * 1000)}`);
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
  .inputValidator((input) =>
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

export const geoapifySearchPlaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
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
    const page = await searchPlacesAtCenter(data);
    return page.results.slice(0, data.limit ?? DISCOVERY_PAGE_SIZE);
  });

export const geoapifySearchPlacesMulti = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
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
        page: await searchPlacesAtCenter({
          text: data.text,
          lat: center.lat,
          lng: center.lng,
          radiusKm: data.radiusKm,
          limit: data.limit ?? DISCOVERY_PAGE_SIZE,
          offset: data.offset ?? 0,
        }),
      })),
    );

    const failedAreaLabels: string[] = [];
    const merged = new Map<string, MultiAreaPlaceSuggestion>();
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

      for (const place of outcome.value.page.results) {
        const key = `${place.provider}:${place.externalId}`;
        const current = merged.get(key);
        const nextDistance = place.distanceKm ?? Number.POSITIVE_INFINITY;
        const currentDistance = current?.distanceKm ?? Number.POSITIVE_INFINITY;
        const matchingAreaLabels = Array.from(
          new Set([...(current?.matchingAreaLabels ?? []), center.label]),
        );

        if (!current || nextDistance < currentDistance) {
          merged.set(key, {
            ...place,
            nearestAreaLabel: center.label,
            matchingAreaLabels,
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

    const results = [...merged.values()].sort((a, b) => {
      const da = a.distanceKm ?? Number.POSITIVE_INFINITY;
      const db = b.distanceKm ?? Number.POSITIVE_INFINITY;
      return da - db || a.name.localeCompare(b.name, "sv-SE");
    });

    return { results, failedAreaLabels, hasMore, nextOffset };
  });
