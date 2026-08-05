import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  isOpeningHoursSchedule,
  parseOpeningHours,
  type OpeningHoursSchedule,
} from "./opening-hours";
import {
  EXTERNAL_OSM_TYPES,
  isUsableExternalLocation,
  type ExternalOsmType,
  type ExternalPlaceLocation,
} from "./place-location-sync";
import { isCredibleStreetAddress, normalizeWebsiteUrl } from "./place-links";

const REQUEST_TIMEOUT_MS = 10_000;
const SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MANUAL_REFRESH_MIN_AGE_MS = 5 * 60 * 1000;

interface RpcResponse {
  data: unknown;
  error: { message?: string } | null;
}

type RpcCall = (fn: string, args?: Record<string, unknown>) => Promise<RpcResponse>;

const externalLocationSchema = z.object({
  address: z.string().min(1),
  area: z.string().nullable(),
  city: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  osmType: z.enum(EXTERNAL_OSM_TYPES).nullable(),
  osmId: z.string().nullable(),
});

const externalDetailsSchema = z.object({
  openingHours: z.custom<OpeningHoursSchedule>(isOpeningHoursSchedule).nullable(),
  website: z.string().nullable(),
  timezone: z.string().nullable(),
  location: externalLocationSchema.nullable().optional().default(null),
  fetchedAt: z.string(),
  attribution: z.string(),
});

const contextSchema = z.object({
  providerPlaceId: z.string().min(1),
  canApplyLocation: z.boolean().optional().default(false),
  snapshot: externalDetailsSchema.nullable().optional(),
});

const geoapifyPropertiesSchema = z
  .object({
    address_line1: z.string().optional(),
    formatted: z.string().optional(),
    street: z.string().optional(),
    housenumber: z.string().optional(),
    suburb: z.string().optional(),
    neighbourhood: z.string().optional(),
    quarter: z.string().optional(),
    district: z.string().optional(),
    city: z.string().optional(),
    town: z.string().optional(),
    village: z.string().optional(),
    municipality: z.string().optional(),
    county: z.string().optional(),
    lat: z.number().optional(),
    lon: z.number().optional(),
    opening_hours: z.string().optional(),
    website: z.string().optional(),
    timezone: z
      .object({
        name: z.string().optional(),
      })
      .passthrough()
      .optional(),
    datasource: z
      .object({
        raw: z
          .object({
            opening_hours: z.string().optional(),
            website: z.string().optional(),
            osm_type: z.string().optional(),
            osm_id: z.union([z.string(), z.number()]).optional(),
          })
          .passthrough()
          .optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

const geoapifyResponseSchema = z.object({
  features: z
    .array(
      z.object({
        properties: geoapifyPropertiesSchema.optional(),
      }),
    )
    .default([]),
});

const applyLocationResultSchema = z.object({
  address: z.string(),
  area: z.string().nullable(),
  city: z.string(),
  lat: z.number(),
  lng: z.number(),
  sourceLinked: z.boolean(),
});

export interface PlaceExternalDetails {
  openingHours: OpeningHoursSchedule | null;
  website: string | null;
  timezone: string | null;
  location: ExternalPlaceLocation | null;
  fetchedAt: string;
  attribution: string;
}

export type ApplyPlaceExternalLocationResult = z.infer<typeof applyLocationResultSchema>;

function readKey(): string {
  const key = process.env.GEOAPIFY_API_KEY?.trim();
  if (!key) throw new Error("Kartdata kan inte hämtas just nu.");
  return key;
}

function missingRpc(message?: string, functionName?: string): boolean {
  const text = message ?? "";
  return (
    /could not find the function|schema cache/i.test(text) &&
    (!functionName ||
      text.toLocaleLowerCase("en-US").includes(functionName.toLocaleLowerCase("en-US")))
  );
}

function externalInfoContextError(message?: string): Error {
  if (/could not find the function|schema cache/i.test(message ?? "")) {
    return new Error("Kartdata är tillfälligt otillgänglig. Försök igen senare.");
  }
  return new Error("Matstället kunde inte verifieras för gruppen.");
}

function ageMs(value: string): number {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? Date.now() - parsed : Number.POSITIVE_INFINITY;
}

function cleanText(value: string | null | undefined): string {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function normalizeOsmType(value: string | undefined): ExternalOsmType | null {
  const normalized = value?.trim().toLocaleLowerCase("en-US");
  return EXTERNAL_OSM_TYPES.includes(normalized as ExternalOsmType)
    ? (normalized as ExternalOsmType)
    : null;
}

function normalizeOsmId(value: string | number | undefined): string | null {
  const normalized = String(value ?? "").trim();
  return /^\d+$/.test(normalized) ? normalized : null;
}

function normalizeExternalLocation(
  properties: z.infer<typeof geoapifyPropertiesSchema> | undefined,
): ExternalPlaceLocation | null {
  if (!properties) return null;
  const street = [cleanText(properties.street), cleanText(properties.housenumber)]
    .filter(Boolean)
    .join(" ");
  const addressLine = cleanText(properties.address_line1);
  const formattedFirstLine = cleanText(properties.formatted?.split(",")[0]);
  const address = street || addressLine || formattedFirstLine;
  const city = cleanText(
    properties.city ||
      properties.town ||
      properties.village ||
      properties.municipality ||
      properties.county,
  );
  const area =
    cleanText(
      properties.suburb || properties.neighbourhood || properties.quarter || properties.district,
    ) || null;
  if (!isCredibleStreetAddress(address) || !city) return null;
  if (!Number.isFinite(properties.lat) || !Number.isFinite(properties.lon)) return null;

  const raw = properties.datasource?.raw;
  const osmType = normalizeOsmType(raw?.osm_type);
  const osmId = normalizeOsmId(raw?.osm_id);
  const location: ExternalPlaceLocation = {
    address,
    area,
    city,
    lat: properties.lat as number,
    lng: properties.lon as number,
    osmType: osmType && osmId ? osmType : null,
    osmId: osmType && osmId ? osmId : null,
  };
  return isUsableExternalLocation(location) ? location : null;
}

async function fetchPlaceDetails(providerPlaceId: string): Promise<PlaceExternalDetails> {
  const url = new URL("https://api.geoapify.com/v2/place-details");
  url.searchParams.set("id", providerPlaceId);
  url.searchParams.set("features", "details");
  url.searchParams.set("lang", "sv");
  url.searchParams.set("apiKey", readKey());

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    if (response.status === 429) {
      throw new Error("Kartdata kan inte hämtas just nu. Försök igen om en stund.");
    }
    if (!response.ok) throw new Error("Kartdata kunde inte hämtas.");

    const parsed = geoapifyResponseSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error("Karttjänsten returnerade ett oväntat svar.");
    const properties = parsed.data.features[0]?.properties;
    const raw = properties?.datasource?.raw;
    const openingHours = properties?.opening_hours ?? raw?.opening_hours;
    const website = normalizeWebsiteUrl(properties?.website ?? raw?.website) ?? null;

    return {
      openingHours: parseOpeningHours(openingHours),
      website,
      timezone: properties?.timezone?.name?.trim() || null,
      location: normalizeExternalLocation(properties),
      fetchedAt: new Date().toISOString(),
      attribution: "Platsdata från Geoapify och © OpenStreetMap-bidragsgivare.",
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Kartdatan tog för lång tid att hämta. Försök igen.");
    }
    throw error instanceof Error ? error : new Error("Kartdata kunde inte hämtas.");
  } finally {
    clearTimeout(timeout);
  }
}

async function verifiedContext(
  rpc: RpcCall,
  groupId: string,
  placeId: string,
): Promise<{
  context: z.infer<typeof contextSchema>;
  supportsSnapshots: boolean;
  supportsLocationSync: boolean;
}> {
  const latest = await rpc("get_place_external_info_context_v3", {
    _group_id: groupId,
    _place_id: placeId,
  });
  if (!latest.error) {
    return {
      context: contextSchema.parse(latest.data),
      supportsSnapshots: true,
      supportsLocationSync: true,
    };
  }
  if (!missingRpc(latest.error.message, "get_place_external_info_context_v3")) {
    throw externalInfoContextError(latest.error.message);
  }

  const current = await rpc("get_place_external_info_context_v2", {
    _group_id: groupId,
    _place_id: placeId,
  });
  if (!current.error) {
    return {
      context: contextSchema.parse(current.data),
      supportsSnapshots: true,
      supportsLocationSync: false,
    };
  }
  if (!missingRpc(current.error.message, "get_place_external_info_context_v2")) {
    throw externalInfoContextError(current.error.message);
  }

  const previous = await rpc("get_place_external_info_context_v1", {
    _group_id: groupId,
    _place_id: placeId,
  });
  if (previous.error) throw externalInfoContextError(previous.error.message);
  return {
    context: contextSchema.parse(previous.data),
    supportsSnapshots: false,
    supportsLocationSync: false,
  };
}

async function saveVerifiedSnapshot(
  groupId: string,
  placeId: string,
  providerPlaceId: string,
  details: PlaceExternalDetails,
): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const rpc = supabaseAdmin.rpc.bind(supabaseAdmin) as unknown as RpcCall;
  const location = details.location;
  const saved = await rpc("save_place_external_info_snapshot_v2", {
    _group_id: groupId,
    _place_id: placeId,
    _provider_place_id: providerPlaceId,
    _website: details.website,
    _opening_hours: details.openingHours,
    _timezone: details.timezone,
    _address: location?.address ?? null,
    _area: location?.area ?? null,
    _city: location?.city ?? null,
    _lat: location?.lat ?? null,
    _lng: location?.lng ?? null,
    _osm_type: location?.osmType ?? null,
    _osm_id: location?.osmId ?? null,
    _fetched_at: details.fetchedAt,
  });
  if (!saved.error) return;
  if (!missingRpc(saved.error.message, "save_place_external_info_snapshot_v2")) {
    console.warn("[Matrundan] kunde inte spara platsdatasnapshot:", saved.error.message);
    return;
  }

  const legacy = await rpc("save_place_external_info_snapshot_v1", {
    _group_id: groupId,
    _place_id: placeId,
    _provider_place_id: providerPlaceId,
    _website: details.website,
    _opening_hours: details.openingHours,
    _timezone: details.timezone,
    _fetched_at: details.fetchedAt,
  });
  if (legacy.error && !missingRpc(legacy.error.message, "save_place_external_info_snapshot_v1")) {
    console.warn("[Matrundan] kunde inte spara äldre platsdatasnapshot:", legacy.error.message);
  }
}

export const geoapifyPlaceDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        groupId: z.string().uuid(),
        placeId: z.string().uuid(),
        forceRefresh: z.boolean().optional().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<PlaceExternalDetails> => {
    const rpc = context.supabase.rpc.bind(context.supabase) as unknown as RpcCall;
    const verified = await verifiedContext(rpc, data.groupId, data.placeId);
    const snapshot = verified.context.snapshot ?? null;
    if (snapshot) {
      const snapshotAge = ageMs(snapshot.fetchedAt);
      if (!data.forceRefresh && snapshotAge <= SNAPSHOT_MAX_AGE_MS) return snapshot;
      if (data.forceRefresh && snapshotAge <= MANUAL_REFRESH_MIN_AGE_MS) return snapshot;
    }

    const details = await fetchPlaceDetails(verified.context.providerPlaceId);
    if (verified.supportsSnapshots) {
      await saveVerifiedSnapshot(
        data.groupId,
        data.placeId,
        verified.context.providerPlaceId,
        details,
      );
    }
    return details;
  });

export const applyGeoapifyPlaceLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        groupId: z.string().uuid(),
        placeId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<ApplyPlaceExternalLocationResult> => {
    const rpc = context.supabase.rpc.bind(context.supabase) as unknown as RpcCall;
    const verified = await verifiedContext(rpc, data.groupId, data.placeId);
    if (!verified.supportsLocationSync) {
      throw new Error("Omsynk av adress kräver den senaste databasversionen.");
    }
    if (!verified.context.canApplyLocation) {
      throw new Error("Endast gruppens ägare och administratörer kan använda ny kartdata.");
    }

    const details = await fetchPlaceDetails(verified.context.providerPlaceId);
    if (!details.location) {
      throw new Error("Kartdatan innehåller ingen säker adress och position att använda.");
    }

    const location = details.location;
    const applied = await rpc("apply_place_external_location_v1", {
      _group_id: data.groupId,
      _place_id: data.placeId,
      _provider_place_id: verified.context.providerPlaceId,
      _address: location.address,
      _area: location.area,
      _city: location.city,
      _lat: location.lat,
      _lng: location.lng,
      _osm_type: location.osmType,
      _osm_id: location.osmId,
      _fetched_at: details.fetchedAt,
    });
    if (applied.error) {
      if (missingRpc(applied.error.message, "apply_place_external_location_v1")) {
        throw new Error("Omsynk av adress kräver den senaste databasversionen.");
      }
      throw new Error(applied.error.message ?? "Kartdatan kunde inte användas.");
    }

    await saveVerifiedSnapshot(
      data.groupId,
      data.placeId,
      verified.context.providerPlaceId,
      details,
    );
    return applyLocationResultSchema.parse(applied.data);
  });
