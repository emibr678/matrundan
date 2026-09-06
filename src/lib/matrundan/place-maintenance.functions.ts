import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizePlaceFeature, type NormalizedPlaceSuggestion } from "./geoapify-normalize";
import { GEOAPIFY_DISCOVERY_CATEGORIES } from "./geoapify-place-search";

const REQUEST_TIMEOUT_MS = 10_000;
const SEARCH_RADIUS_METERS = 750;
const SEARCH_LIMIT = 8;

interface RpcResponse {
  data: unknown;
  error: { message?: string } | null;
}

type RpcCall = (fn: string, args?: Record<string, unknown>) => Promise<RpcResponse>;

const candidateContextSchema = z.object({
  candidateId: z.string().uuid(),
  placeId: z.string().uuid(),
  reason: z.literal("unmatched_verified_manual"),
  status: z.enum(["open", "needs_osm", "resolved", "dismissed"]),
  createdAt: z.string(),
  resolvedAt: z.string().nullable(),
  dismissalReason: z.string().nullable(),
  name: z.string().min(1),
  category: z.enum(["restaurang", "café", "bageri", "snabbmat", "pub", "matvagn"]),
  address: z.string(),
  area: z.string().nullable(),
  city: z.string(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  website: z.string().nullable(),
});

const workItemInputSchema = z.object({
  kind: z.literal("improvement_candidate"),
  workItemId: z.string().uuid(),
});
const linkInputSchema = workItemInputSchema.extend({
  providerPlaceId: z.string().trim().min(1).max(240),
});

export interface PlaceMaintenanceProviderMatch {
  providerPlaceId: string;
  name: string;
  category: "restaurang" | "café" | "bageri" | "snabbmat" | "pub" | "matvagn";
  address: string;
  area: string | null;
  city: string;
  lat: number;
  lng: number;
  distanceKm: number | null;
  website: string | null;
  externalUrl: string | null;
  attribution: string;
}

function readKey(): string {
  const key = process.env.GEOAPIFY_API_KEY?.trim();
  if (!key) {
    throw new Error("GEOAPIFY_NOT_CONFIGURED: Kartdata kan inte hämtas just nu.");
  }
  return key;
}

function rpcError(error: { message?: string } | null, fallback: string): Error {
  return new Error(error?.message?.trim() || fallback);
}

async function loadCandidate(rpc: RpcCall, workItemId: string) {
  const result = await rpc("get_place_improvement_candidate_for_maintenance_v1", {
    _candidate_id: workItemId,
  });
  if (result.error) throw rpcError(result.error, "Kunde inte läsa underhållsärendet.");
  return candidateContextSchema.parse(result.data);
}

async function fetchProviderMatches(candidate: z.infer<typeof candidateContextSchema>) {
  const url = new URL("https://api.geoapify.com/v2/places");
  url.searchParams.set("categories", GEOAPIFY_DISCOVERY_CATEGORIES.join(","));
  url.searchParams.set(
    "filter",
    `circle:${candidate.lng},${candidate.lat},${SEARCH_RADIUS_METERS}`,
  );
  url.searchParams.set("bias", `proximity:${candidate.lng},${candidate.lat}`);
  url.searchParams.set("name", candidate.name);
  url.searchParams.set("lang", "sv");
  url.searchParams.set("limit", String(SEARCH_LIMIT));
  url.searchParams.set("apiKey", readKey());

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    if (response.status === 429) {
      throw new Error(
        "GEOAPIFY_RATE_LIMIT: Karttjänsten används mycket just nu. Försök igen snart.",
      );
    }
    if (!response.ok) {
      throw new Error(`GEOAPIFY_UNAVAILABLE: Karttjänsten svarade med status ${response.status}.`);
    }
    const payload = (await response.json()) as { features?: unknown[] };
    const seen = new Set<string>();
    const matches: NormalizedPlaceSuggestion[] = [];
    for (const feature of payload.features ?? []) {
      const normalized = normalizePlaceFeature(
        feature as Parameters<typeof normalizePlaceFeature>[0],
      );
      if (!normalized || seen.has(normalized.externalId)) continue;
      if (normalized.lat == null || normalized.lng == null) continue;
      seen.add(normalized.externalId);
      matches.push(normalized);
    }
    matches.sort((a, b) => {
      const distanceA = a.distanceKm ?? Number.POSITIVE_INFINITY;
      const distanceB = b.distanceKm ?? Number.POSITIVE_INFINITY;
      return distanceA - distanceB || a.name.localeCompare(b.name, "sv-SE");
    });
    return matches.slice(0, SEARCH_LIMIT);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("GEOAPIFY_TIMEOUT: Kartdatan tog för lång tid att hämta. Försök igen.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function toPublicMatch(match: NormalizedPlaceSuggestion): PlaceMaintenanceProviderMatch {
  if (match.lat == null || match.lng == null) {
    throw new Error("Kartträffen saknar verifierad position.");
  }
  return {
    providerPlaceId: match.externalId,
    name: match.name,
    category: match.category,
    address: match.address,
    area: match.area ?? null,
    city: match.city,
    lat: match.lat,
    lng: match.lng,
    distanceKm: match.distanceKm ?? null,
    website: match.website ?? null,
    externalUrl: match.externalUrl ?? null,
    attribution: match.attribution,
  };
}

export const searchPlaceMaintenanceProviderMatches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => workItemInputSchema.parse(input))
  .handler(async ({ data, context }): Promise<PlaceMaintenanceProviderMatch[]> => {
    const rpc = context.supabase.rpc.bind(context.supabase) as unknown as RpcCall;
    const candidate = await loadCandidate(rpc, data.workItemId);
    if (!["open", "needs_osm"].includes(candidate.status)) return [];
    return (await fetchProviderMatches(candidate)).map(toPublicMatch);
  });

export const linkPlaceMaintenanceProviderMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => linkInputSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ placeId: string }> => {
    const rpc = context.supabase.rpc.bind(context.supabase) as unknown as RpcCall;
    const candidate = await loadCandidate(rpc, data.workItemId);
    if (!["open", "needs_osm"].includes(candidate.status)) {
      throw new Error("Underhållsärendet är redan avslutat.");
    }

    // Gör en färsk serversökning vid själva länkningsögonblicket. Klienten får
    // aldrig skicka rå Geoapify-data, gruppidentitet eller en egen position.
    const match = (await fetchProviderMatches(candidate)).find(
      (item) => item.externalId === data.providerPlaceId,
    );
    if (!match || match.lat == null || match.lng == null) {
      throw new Error("Kartträffen kunde inte verifieras längre. Kontrollera igen.");
    }

    let raw: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(match.raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        raw = parsed as Record<string, unknown>;
      }
    } catch {
      raw = {};
    }

    const linked = await rpc("link_provider_source_for_maintenance_work_item_v1", {
      _kind: data.kind,
      _work_item_id: candidate.candidateId,
      _provider: match.provider,
      _provider_place_id: match.externalId,
      _name: match.name,
      _address: match.address,
      _city: match.city,
      _lat: match.lat,
      _lng: match.lng,
      _raw: raw,
    });
    if (linked.error) throw rpcError(linked.error, "Kunde inte länka den externa källan.");
    return { placeId: z.string().uuid().parse(linked.data) };
  });
