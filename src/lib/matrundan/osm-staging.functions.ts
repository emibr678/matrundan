/** Temporary staging-only read-only adapter for public OSM index comparison (#516).
 * It cannot create or link Matrundan places, group entries, or visits.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { IS_STAGING } from "@/lib/app-environment";

const cursorSchema = z.object({
  g: z.number().int().positive(),
  s: z.string().min(1).max(64),
  d: z.number().finite().nonnegative(),
  t: z.enum(["node", "way", "relation"]),
  i: z.number().int().positive(),
});

const searchInput = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
  radiusKm: z.number().finite().min(0.1).max(50),
  tokens: z.array(z.string().regex(/^[a-z0-9_:-]{1,64}$/)).max(20),
  cursor: cursorSchema.nullable().optional(),
});

const resultSchema = z.object({
  osmType: z.enum(["node", "way", "relation"]),
  osmId: z.number().int().positive(),
  name: z.string(),
  amenity: z.string().nullable().optional(),
  shop: z.string().nullable().optional(),
  cuisine: z.string().nullable().optional(),
  lat: z.number().finite(),
  lng: z.number().finite(),
  distanceM: z.number().finite().nonnegative(),
});

const responseSchema = z.object({
  status: z.enum(["ok", "not_loaded"]),
  generation: z.number().int().positive().optional(),
  results: z.array(resultSchema),
  hasMore: z.boolean(),
  cursor: cursorSchema.nullable().optional(),
});

export type OsmStagingSearchResponse = z.infer<typeof responseSchema>;

/** Only a logged-in user's existing token can access this read-only SQL RPC. */
export const searchOsmStagingIndex = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => searchInput.parse(input))
  .handler(async ({ data, context }): Promise<OsmStagingSearchResponse> => {
    if (!IS_STAGING) throw new Error("OSM-testet är endast tillgängligt i staging.");

    // The live/generated types must not be updated until an explicitly
    // authorized staging migration is applied. This bridge is limited to
    // this one provisional RPC and its validated response schema.
    const call = context.supabase.rpc as unknown as (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { code?: string } | null }>;
    const result = await call("osm_staging_search_v1", {
      _lat: data.lat,
      _lng: data.lng,
      _radius_km: data.radiusKm,
      _tokens: data.tokens,
      _limit: 20,
      _cursor: data.cursor ?? null,
    });
    if (result.error) {
      if (result.error.code === "PGRST202" || result.error.code === "42883") {
        throw new Error("OSM-indexet är ännu inte installerat i staging.");
      }
      throw new Error("OSM-indexsökningen kunde inte genomföras.");
    }
    return responseSchema.parse(result.data);
  });
