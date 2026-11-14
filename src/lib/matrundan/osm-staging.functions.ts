/** Read-only staging adapter for the already deployed isolated OSM index (#516).
 * No registration, linking, group/place writes or provider-id resolution.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { IS_STAGING } from "@/lib/app-environment";
import { osmPreviewTokens } from "./osm-staging-preview";

const cursorSchema = z.object({
  g: z.number().int().positive(),
  s: z.string().min(1).max(64),
  d: z.number().finite().nonnegative(),
  t: z.enum(["node", "way", "relation"]),
  i: z.number().int().positive(),
});
const inputSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
  radiusKm: z.union([z.literal(3), z.literal(5)]),
  filterId: z.enum(["specialty:pasta", "specialty:ramen", "search:asiatiskt"]),
  phase: z.enum(["direct", "related"]),
  cursor: cursorSchema.nullable().optional(),
});
const rowSchema = z.object({
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
  results: z.array(rowSchema),
  hasMore: z.boolean(),
  cursor: cursorSchema.nullable().optional(),
});
export type OsmStagingPreviewResponse = z.infer<typeof responseSchema>;

/** Validated filter and search phase select fixed tokens server-side. */
export const searchOsmStagingPreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => inputSchema.parse(input))
  .handler(async ({ data, context }): Promise<OsmStagingPreviewResponse> => {
    if (!IS_STAGING) throw new Error("OSM-jämförelsen finns endast i staging.");
    const tokens = osmPreviewTokens(data.filterId, data.phase);
    if (tokens.length === 0) throw new Error("Det sökvalet har inga associerade OSM-taggar.");

    // Provisional RPC is already present in staging; do not update generated
    // DB types or introduce a migration as part of the read-only search comparison.
    const call = context.supabase.rpc.bind(context.supabase) as unknown as (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { code?: string } | null }>;
    const response = await call("osm_staging_search_v1", {
      _lat: data.lat,
      _lng: data.lng,
      _radius_km: data.radiusKm,
      _tokens: tokens,
      _limit: 20,
      _cursor: data.cursor ?? null,
    });
    if (response.error) {
      if (response.error.code === "PGRST202" || response.error.code === "42883")
        throw new Error("OSM-indexet är inte tillgängligt i staging.");
      throw new Error("OSM-sökningen misslyckades. Försök igen.");
    }
    const parsed = responseSchema.parse(response.data);
    if (parsed.status === "ok" && (!parsed.generation || (parsed.hasMore && !parsed.cursor)))
      throw new Error("OSM-indexet returnerade ett ofullständigt svar.");
    return parsed;
  });
