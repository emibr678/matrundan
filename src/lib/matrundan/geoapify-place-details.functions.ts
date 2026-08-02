import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  isOpeningHoursSchedule,
  parseOpeningHours,
  type OpeningHoursSchedule,
} from "./opening-hours";
import { normalizeWebsiteUrl } from "./place-links";

const REQUEST_TIMEOUT_MS = 10_000;
const SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MANUAL_REFRESH_MIN_AGE_MS = 5 * 60 * 1000;

interface RpcResponse {
  data: unknown;
  error: { message?: string } | null;
}

type RpcCall = (fn: string, args?: Record<string, unknown>) => Promise<RpcResponse>;

const externalDetailsSchema = z.object({
  openingHours: z.custom<OpeningHoursSchedule>(isOpeningHoursSchedule).nullable(),
  website: z.string().nullable(),
  timezone: z.string().nullable(),
  fetchedAt: z.string(),
  attribution: z.string(),
});

const contextSchema = z.object({
  providerPlaceId: z.string().min(1),
  snapshot: externalDetailsSchema.nullable().optional(),
});

const geoapifyPropertiesSchema = z
  .object({
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

export interface PlaceExternalDetails {
  openingHours: OpeningHoursSchedule | null;
  website: string | null;
  timezone: string | null;
  fetchedAt: string;
  attribution: string;
}

function readKey(): string {
  const key = process.env.GEOAPIFY_API_KEY?.trim();
  if (!key) throw new Error("Öppettider kan inte hämtas just nu.");
  return key;
}

function missingRpc(message?: string, functionName?: string): boolean {
  const text = message ?? "";
  return (
    /could not find the function|schema cache/i.test(text) &&
    (!functionName || text.toLocaleLowerCase("en-US").includes(functionName.toLocaleLowerCase("en-US")))
  );
}

function externalInfoContextError(message?: string): Error {
  if (/could not find the function|schema cache/i.test(message ?? "")) {
    return new Error("Öppettider är tillfälligt otillgängliga. Försök igen senare.");
  }
  return new Error("Matstället kunde inte verifieras för gruppen.");
}

function ageMs(value: string): number {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? Date.now() - parsed : Number.POSITIVE_INFINITY;
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
      throw new Error("Öppettider kan inte hämtas just nu. Försök igen om en stund.");
    }
    if (!response.ok) throw new Error("Öppettider kunde inte hämtas från kartdatan.");

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
      fetchedAt: new Date().toISOString(),
      attribution: "Platsdata från Geoapify och © OpenStreetMap-bidragsgivare.",
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Öppettiderna tog för lång tid att hämta. Försök igen.");
    }
    throw error instanceof Error ? error : new Error("Öppettider kunde inte hämtas.");
  } finally {
    clearTimeout(timeout);
  }
}

async function verifiedContext(
  rpc: RpcCall,
  groupId: string,
  placeId: string,
): Promise<{ context: z.infer<typeof contextSchema>; supportsSnapshots: boolean }> {
  const current = await rpc("get_place_external_info_context_v2", {
    _group_id: groupId,
    _place_id: placeId,
  });
  if (!current.error) {
    return { context: contextSchema.parse(current.data), supportsSnapshots: true };
  }
  if (!missingRpc(current.error.message, "get_place_external_info_context_v2")) {
    throw externalInfoContextError(current.error.message);
  }

  const previous = await rpc("get_place_external_info_context_v1", {
    _group_id: groupId,
    _place_id: placeId,
  });
  if (previous.error) throw externalInfoContextError(previous.error.message);
  return { context: contextSchema.parse(previous.data), supportsSnapshots: false };
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
      const saved = await rpc("save_place_external_info_snapshot_v1", {
        _group_id: data.groupId,
        _place_id: data.placeId,
        _provider_place_id: verified.context.providerPlaceId,
        _website: details.website,
        _opening_hours: details.openingHours,
        _timezone: details.timezone,
        _fetched_at: details.fetchedAt,
      });
      if (saved.error && !missingRpc(saved.error.message, "save_place_external_info_snapshot_v1")) {
        console.warn("[Matrundan] kunde inte spara platsdatasnapshot:", saved.error.message);
      }
    }
    return details;
  });
