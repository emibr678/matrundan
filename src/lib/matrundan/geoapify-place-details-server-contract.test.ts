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
    expect(source).toContain('rpc("get_place_external_info_context_v1"');
    expect(source).toContain("groupId: z.string().uuid()");
    expect(source).toContain("placeId: z.string().uuid()");
  });

  test("API-nyckeln stannar på servern och rådata returneras inte", () => {
    expect(source).toContain("process.env.GEOAPIFY_API_KEY");
    expect(source).toContain('new URL("https://api.geoapify.com/v2/place-details")');
    expect(source).toContain("openingHours: parseOpeningHours(openingHours)");
    expect(source).not.toContain("return properties");
    expect(source).not.toContain("return parsed.data");
  });

  test("svaret är begränsat till produktens användbara uppgifter", () => {
    expect(source).toContain("openingHours: OpeningHoursSchedule | null");
    expect(source).toContain("website: string | null");
    expect(source).toContain("fetchedAt: string");
    expect(source).toContain("attribution: string");
  });
});
