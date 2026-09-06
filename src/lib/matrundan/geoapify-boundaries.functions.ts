/**
 * Server-side resolver för Geoapify-boundaries.
 *
 * Vissa autocomplete-träffar som ser administrativa ut pekar på en OSM-node
 * i stället för själva boundary-relationen. Då räcker Place Details inte för
 * att få Polygon/MultiPolygon och Boundaries API används som riktad fallback.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { selectMatchingGeoapifyBoundary } from "./geoapify-boundary-selection";
import { isBoundaryEligibleResultType, isBroadAdministrativeSearchArea } from "./search-areas";
import { createShortLivedRequestCache } from "./short-lived-request-cache";
import type { SearchAreaBoundaryGeometry, SearchAreaMode } from "./types";

const REQUEST_TIMEOUT_MS = 10_000;
const GEOAPIFY_CACHE_TTL_MS = 5 * 60_000;

type GeoapifyPayload = { features?: unknown[] };
type JsonRecord = Record<string, unknown>;

export interface SearchAreaBoundaryResponse {
  searchMode: SearchAreaMode;
  boundary: SearchAreaBoundaryGeometry | null;
  boundaryPlaceId: string | null;
}

const responseCache = createShortLivedRequestCache<GeoapifyPayload>({
  ttlMs: GEOAPIFY_CACHE_TTL_MS,
  maxEntries: 100,
});

function readKey(): string {
  const key = process.env.GEOAPIFY_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "GEOAPIFY_NOT_CONFIGURED: Platssökningen är ännu inte aktiverad. Lägg till GEOAPIFY_API_KEY som serverhemlighet.",
    );
  }
  return key;
}

function cacheKey(url: URL): string {
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

    const payload = (await response.json()) as unknown;
    if (!payload || typeof payload !== "object" || !("features" in payload)) {
      throw new Error("GEOAPIFY_MALFORMED: Geoapify returnerade ett oväntat svar.");
    }
    return payload as GeoapifyPayload;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("GEOAPIFY_TIMEOUT: Platssökningen tog för lång tid. Försök igen.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function callGeoapify(url: URL): Promise<GeoapifyPayload> {
  return responseCache.get(cacheKey(url), () => fetchGeoapify(url));
}

function objectValue(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function directBoundary(feature: unknown): {
  boundary: SearchAreaBoundaryGeometry;
  placeId?: string;
} | null {
  const row = objectValue(feature);
  const geometry = objectValue(row?.geometry);
  if (!geometry || !Array.isArray(geometry.coordinates)) return null;
  if (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") return null;

  const properties = objectValue(row?.properties);
  const returnedPlaceId =
    typeof properties?.place_id === "string" ? properties.place_id.trim() : undefined;
  return {
    boundary: geometry as unknown as SearchAreaBoundaryGeometry,
    placeId: returnedPlaceId || undefined,
  };
}

async function loadPlaceDetailsBoundary(placeId: string): Promise<{
  boundary: SearchAreaBoundaryGeometry;
  placeId: string;
} | null> {
  for (const features of ["details", "details,details.full_geometry"] as const) {
    const url = new URL("https://api.geoapify.com/v2/place-details");
    url.searchParams.set("id", placeId);
    url.searchParams.set("features", features);
    url.searchParams.set("lang", "sv");
    url.searchParams.set("apiKey", readKey());

    const payload = await callGeoapify(url);
    for (const feature of payload.features ?? []) {
      const resolved = directBoundary(feature);
      if (resolved) {
        return {
          boundary: resolved.boundary,
          placeId: resolved.placeId ?? placeId,
        };
      }
    }
  }
  return null;
}

async function loadPartOfBoundary(
  placeId: string,
  label: string,
): Promise<{
  boundary: SearchAreaBoundaryGeometry;
  placeId: string;
} | null> {
  const url = new URL("https://api.geoapify.com/v1/boundaries/part-of");
  url.searchParams.set("id", placeId);
  url.searchParams.set("boundaries", "administrative");
  url.searchParams.set("geometry", "geometry_1000");
  url.searchParams.set("lang", "sv");
  url.searchParams.set("apiKey", readKey());

  const payload = await callGeoapify(url);
  return selectMatchingGeoapifyBoundary(payload.features, label);
}

function boundaryResponse(resolved: {
  boundary: SearchAreaBoundaryGeometry;
  placeId: string;
}): SearchAreaBoundaryResponse {
  return {
    searchMode: "boundary",
    boundary: resolved.boundary,
    boundaryPlaceId: resolved.placeId,
  };
}

async function resolveSearchAreaBoundary(input: {
  placeId: string;
  label: string;
  resultType?: string;
}): Promise<SearchAreaBoundaryResponse> {
  if (!isBoundaryEligibleResultType(input.resultType)) {
    return { searchMode: "point", boundary: null, boundaryPlaceId: null };
  }

  // Kommuner, län och andra tydligt breda administrativa val behöver normalt
  // sin överordnade OSM-boundary, inte autocomplete-objektets punktgeometri.
  // Gå därför direkt till Boundaries API och undvik två onödiga Place Details-
  // anrop. Om providern redan gav en direkt boundaryidentitet finns fallbacken
  // kvar för robusthet.
  if (isBroadAdministrativeSearchArea(input.resultType, input.label)) {
    const inherited = await loadPartOfBoundary(input.placeId, input.label);
    if (inherited) return boundaryResponse(inherited);

    const direct = await loadPlaceDetailsBoundary(input.placeId);
    if (direct) return boundaryResponse(direct);

    return { searchMode: "point", boundary: null, boundaryPlaceId: null };
  }

  const direct = await loadPlaceDetailsBoundary(input.placeId);
  if (direct) return boundaryResponse(direct);

  const inherited = await loadPartOfBoundary(input.placeId, input.label);
  if (inherited) return boundaryResponse(inherited);

  return { searchMode: "point", boundary: null, boundaryPlaceId: null };
}

export const geoapifyResolveSearchAreaBoundary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        placeId: z.string().trim().min(1).max(240),
        label: z.string().trim().min(1).max(180),
        resultType: z.string().trim().max(40).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<SearchAreaBoundaryResponse> =>
    resolveSearchAreaBoundary(data),
  );
