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

const CATEGORIES = [
  "catering.restaurant",
  "catering.fast_food",
  "catering.food_court",
  "catering.cafe",
  "catering.pub",
  "catering.bar",
  "catering.biergarten",
  "catering.taproom",
  "catering.ice_cream",
  "commercial.food_and_drink.bakery",
].join(",");

const REQUEST_TIMEOUT_MS = 10_000;
const WIDE_AREA_RADIUS_KM = 50;
const DISCOVERY_RESULT_LIMIT = 50;

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
}

function readKey(): string {
  const key = process.env.GEOAPIFY_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "GEOAPIFY_NOT_CONFIGURED: Platssökningen är ännu inte aktiverad. Lägg till GEOAPIFY_API_KEY som serverhemlighet.",
    );
  }
  return key;
}

async function callGeoapify(url: URL): Promise<{ features?: unknown[] }> {
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
    return json as { features?: unknown[] };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("GEOAPIFY_TIMEOUT: Platssökningen tog för lång tid. Försök igen.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function likelyPlaceName(text: string): boolean {
  const value = text.trim();
  if (!value || value.length < 3 || value.length > 80) return false;
  const generic = new Set([
    "restaurang",
    "café",
    "cafe",
    "fika",
    "pizza",
    "pizzeria",
    "sushi",
    "burgare",
    "burger",
    "pub",
    "bar",
    "bageri",
    "snabbmat",
    "thai",
    "indiskt",
    "italienskt",
    "japanskt",
    "kinesiskt",
    "vegetariskt",
  ]);
  return !generic.has(value.toLowerCase());
}

function searchableText(place: NormalizedPlaceSuggestion): string {
  return [place.name, place.category, ...place.cuisines, place.address, place.area, place.city]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("sv-SE");
}

function matchesQuery(place: NormalizedPlaceSuggestion, query: string): boolean {
  const terms = query.trim().toLocaleLowerCase("sv-SE").split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const haystack = searchableText(place);
  return terms.every((term) => haystack.includes(term));
}

async function searchPlacesAtCenter(input: {
  text?: string;
  lat: number;
  lng: number;
  radiusKm: 1 | 2 | 3 | 5 | 10 | 25 | 50 | null;
  limit?: number;
}): Promise<NormalizedPlaceSuggestion[]> {
  const radiusKm = input.radiusKm ?? WIDE_AREA_RADIUS_KM;
  const query = input.text?.trim() ?? "";
  const requestedLimit = query
    ? Math.min(input.limit ?? 30, DISCOVERY_RESULT_LIMIT)
    : DISCOVERY_RESULT_LIMIT;

  const url = new URL("https://api.geoapify.com/v2/places");
  url.searchParams.set("categories", CATEGORIES);
  url.searchParams.set("filter", `circle:${input.lng},${input.lat},${Math.round(radiusKm * 1000)}`);
  url.searchParams.set("bias", `proximity:${input.lng},${input.lat}`);
  url.searchParams.set("lang", "sv");
  url.searchParams.set("limit", String(DISCOVERY_RESULT_LIMIT));
  if (query && likelyPlaceName(query)) url.searchParams.set("name", query);
  url.searchParams.set("apiKey", readKey());

  const json = await callGeoapify(url);
  const seen = new Set<string>();
  const normalized: NormalizedPlaceSuggestion[] = [];
  for (const feature of json.features ?? []) {
    const place = normalizePlaceFeature(feature as Parameters<typeof normalizePlaceFeature>[0]);
    if (!place || seen.has(place.externalId)) continue;
    seen.add(place.externalId);
    if (query && !matchesQuery(place, query)) continue;
    normalized.push(place);
  }

  normalized.sort((a, b) => {
    const da = a.distanceKm ?? Number.POSITIVE_INFINITY;
    const db = b.distanceKm ?? Number.POSITIVE_INFINITY;
    return da - db || a.name.localeCompare(b.name, "sv-SE");
  });
  return normalized.slice(0, requestedLimit);
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
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<NormalizedPlaceSuggestion[]> => searchPlacesAtCenter(data));

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
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<MultiAreaSearchResponse> => {
    const settled = await Promise.allSettled(
      data.centers.map(async (center) => ({
        center,
        results: await searchPlacesAtCenter({
          text: data.text,
          lat: center.lat,
          lng: center.lng,
          radiusKm: data.radiusKm,
          limit: DISCOVERY_RESULT_LIMIT,
        }),
      })),
    );

    const failedAreaLabels: string[] = [];
    const merged = new Map<string, MultiAreaPlaceSuggestion>();
    let firstFailure: unknown = null;

    settled.forEach((outcome, index) => {
      const center = data.centers[index];
      if (outcome.status === "rejected") {
        firstFailure ??= outcome.reason;
        failedAreaLabels.push(center.label);
        return;
      }

      for (const place of outcome.value.results) {
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

    const limit = data.limit ?? DISCOVERY_RESULT_LIMIT;
    const results = [...merged.values()]
      .sort((a, b) => {
        const da = a.distanceKm ?? Number.POSITIVE_INFINITY;
        const db = b.distanceKm ?? Number.POSITIVE_INFINITY;
        return da - db || a.name.localeCompare(b.name, "sv-SE");
      })
      .slice(0, limit);

    return { results, failedAreaLabels };
  });
