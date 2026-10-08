import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { placeResolutionSchema, resolveProviderPlaceInputSchema } from "./place-discovery.schemas";
import type { PlaceResolution } from "./place-discovery";
import type { BulkPlaceAddResult, BulkPlaceAddItemResult } from "./bulk-place-add";

export const resolveProviderPlace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => resolveProviderPlaceInputSchema.parse(input))
  .handler(async ({ data, context }): Promise<PlaceResolution> => {
    const verified = await context.supabase.rpc("get_place_discovery_context_v1", {
      _group_id: data.groupId,
    });
    if (verified.error) throw new Error("Gruppen kunde inte verifieras.");
    if (data.choice === "link" && !(verified.data as { canConfirm?: boolean }).canConfirm) {
      throw new Error("Gruppens admin behöver bekräfta matchningen.");
    }
    const { fetchVerifiedProviderPlace } = await import("./verified-provider-place.server");
    const provider = await fetchVerifiedProviderPlace(data.providerPlaceId, data.choice !== "auto");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const result = await supabaseAdmin.rpc("resolve_verified_provider_place_v1", {
      _actor_id: context.userId,
      _group_id: data.groupId,
      _data: { ...provider },
      _choice: data.choice,
      _place_id: data.placeId,
      _decisions: data.decisions,
      _provider_version: data.providerVersion,
      _occasions: data.occasions,
      _notes: data.notes,
    });
    if (result.error) throw new Error("Matstället kunde inte bekräftas. Försök igen.");
    const resolved = placeResolutionSchema.parse(result.data);
    return {
      ...resolved,
      provider:
        resolved.status === "review_required"
          ? {
              externalId: provider.externalId,
              provider: "geoapify",
              name: provider.name,
              category: provider.category,
              cuisines: provider.cuisines,
              address: provider.address,
              area: provider.area ?? undefined,
              city: provider.city,
              lat: provider.lat,
              lng: provider.lng,
            }
          : undefined,
    };
  });

export const resolveProviderPlacesBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        groupId: z.string().uuid(),
        items: z
          .array(
            z.object({
              externalId: z.string().min(1).max(240),
              providerPlaceId: z.string().min(1).max(240),
            }),
          )
          .min(1)
          .max(50),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<BulkPlaceAddResult> => {
    const verified = await context.supabase.rpc("get_place_discovery_context_v1", {
      _group_id: data.groupId,
    });
    if (verified.error) throw new Error("Gruppen kunde inte verifieras.");
    const { fetchVerifiedProviderPlace } = await import("./verified-provider-place.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const items: BulkPlaceAddItemResult[] = new Array(data.items.length);
    let cursor = 0;
    await Promise.all(
      Array.from({ length: Math.min(4, data.items.length) }, async () => {
        while (cursor < data.items.length) {
          const index = cursor++;
          const item = data.items[index];
          try {
            const provider = await fetchVerifiedProviderPlace(item.providerPlaceId);
            const result = await supabaseAdmin.rpc("resolve_verified_provider_place_v1", {
              _actor_id: context.userId,
              _group_id: data.groupId,
              _data: { ...provider },
            });
            if (result.error) throw result.error;
            const resolved = placeResolutionSchema.parse(result.data);
            const status =
              resolved.status === "created" || resolved.status === "linked"
                ? "added"
                : resolved.status === "restored"
                  ? "restored"
                  : resolved.status === "already_active"
                    ? "existing"
                    : "failed";
            const resolution: PlaceResolution = {
              ...resolved,
              provider:
                resolved.status === "review_required"
                  ? {
                      externalId: provider.externalId,
                      provider: "geoapify",
                      name: provider.name,
                      category: provider.category,
                      cuisines: provider.cuisines,
                      address: provider.address,
                      area: provider.area ?? undefined,
                      city: provider.city,
                      lat: provider.lat,
                      lng: provider.lng,
                    }
                  : undefined,
            };
            items[index] = {
              externalId: item.externalId,
              name: provider.name,
              status,
              placeId: resolved.placeId,
              resolution,
              message: status === "failed" ? "Granska matchningen innan stället läggs till." : null,
            };
          } catch {
            items[index] = {
              externalId: item.externalId,
              name: "Matställe",
              status: "failed",
              message: "Matstället kunde inte verifieras. Försök igen.",
            };
          }
        }
      }),
    );
    return {
      items,
      added: items.filter((item) => item.status === "added").length,
      restored: items.filter((item) => item.status === "restored").length,
      existing: items.filter((item) => item.status === "existing").length,
      failed: items.filter((item) => item.status === "failed").length,
    };
  });
