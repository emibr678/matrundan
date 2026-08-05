import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(process.cwd(), "src/lib/matrundan/geoapify-place-details.functions.ts"),
  "utf8",
);

describe("Geoapifys platsdetaljer", () => {
  test("hämtas endast bakom autentisering och gruppskyddad RPC", () => {
    expect(source).toContain(".middleware([requireSupabaseAuth])");
    expect(source).toContain('rpc("get_place_external_info_context_v3"');
    expect(source).toContain('rpc("get_place_external_info_context_v2"');
    expect(source).toContain('rpc("get_place_external_info_context_v1"');
    expect(source).toContain("groupId: z.string().uuid()");
    expect(source).toContain("placeId: z.string().uuid()");
    expect(source).toContain("forceRefresh: z.boolean().optional().default(false)");
  });

  test("återanvänder en färsk snapshot och begränsar manuell omhämtning", () => {
    expect(source).toContain("SNAPSHOT_MAX_AGE_MS");
    expect(source).toContain("MANUAL_REFRESH_MIN_AGE_MS");
    expect(source).toContain("if (!data.forceRefresh && snapshotAge <= SNAPSHOT_MAX_AGE_MS)");
    expect(source).toContain("if (data.forceRefresh && snapshotAge <= MANUAL_REFRESH_MIN_AGE_MS)");
  });

  test("sparar en verifierad global snapshot endast genom serverrollen", () => {
    expect(source).toContain('import("@/integrations/supabase/client.server")');
    expect(source).toContain("supabaseAdmin.rpc.bind(supabaseAdmin)");
    expect(source).toContain('rpc("save_place_external_info_snapshot_v2"');
    expect(source).toContain('rpc("save_place_external_info_snapshot_v1"');
    expect(source).toContain("await saveVerifiedSnapshot(");
  });

  test("API-nyckeln stannar på servern och rådata returneras inte", () => {
    expect(source).toContain("process.env.GEOAPIFY_API_KEY");
    expect(source).toContain('new URL("https://api.geoapify.com/v2/place-details")');
    expect(source).toContain("openingHours: parseOpeningHours(openingHours)");
    expect(source).toContain("location: normalizeExternalLocation(properties)");
    expect(source).not.toContain("return properties");
    expect(source).not.toContain("return parsed.data");
  });

  test("svaret är begränsat till normaliserade produktuppgifter", () => {
    expect(source).toContain("openingHours: OpeningHoursSchedule | null");
    expect(source).toContain("website: string | null");
    expect(source).toContain("timezone: string | null");
    expect(source).toContain("location: ExternalPlaceLocation | null");
    expect(source).toContain("fetchedAt: string");
    expect(source).toContain("attribution: string");
  });

  test("kanonisk adress ändras bara genom uttrycklig och rollskyddad handling", () => {
    expect(source).toContain("export const applyGeoapifyPlaceLocation");
    expect(source).toContain("if (!verified.context.canApplyLocation)");
    expect(source).toContain('rpc("apply_place_external_location_v1"');
    expect(source).toContain("Kartdatan innehåller ingen säker adress och position att använda");
  });
});
