import { afterEach, describe, expect, test } from "bun:test";
import { fetchVerifiedProviderPlace } from "./verified-provider-place.server";

const originalFetch = globalThis.fetch,
  originalKey = process.env.GEOAPIFY_API_KEY;
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.GEOAPIFY_API_KEY;
  else process.env.GEOAPIFY_API_KEY = originalKey;
});
function response(id: string, categories: string[], lat = 59) {
  return {
    features: [
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [18, lat] },
        properties: {
          place_id: id,
          name: "Café Test",
          categories,
          lat,
          lon: 18,
          city: "Teststad",
          street: "Testgatan",
          housenumber: "1",
          datasource: { raw: { osm_type: "node", osm_id: 389 } },
          website: "https://example.invalid",
        },
      },
    ],
  };
}
function mockProvider(payload: unknown) {
  process.env.GEOAPIFY_API_KEY = "fixture-server-only";
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;
}
describe("verified provider boundary", () => {
  test("refetches the requested stable food identity, emits only normalized fields", async () => {
    mockProvider(response("trusted:1", ["catering.cafe"]));
    const place = await fetchVerifiedProviderPlace("trusted:1", true);
    expect(place.externalId).toBe("trusted:1");
    expect(place.category).toBe("café");
    expect(place.osmId).toBe("389");
    expect(place.lat).toBe(59);
    expect(place).not.toHaveProperty("raw");
    expect(JSON.stringify(place)).not.toContain("fixture-server-only");
  });
  test("unrelated returned ID or non-food feature cannot establish a provider place", async () => {
    mockProvider(response("different:1", ["catering.cafe"]));
    await expect(fetchVerifiedProviderPlace("requested:1", true)).rejects.toThrow(
      "GEOAPIFY_MALFORMED",
    );
    mockProvider(response("hospital:1", ["healthcare.hospital"]));
    await expect(fetchVerifiedProviderPlace("hospital:1", true)).rejects.toThrow(
      "GEOAPIFY_MALFORMED",
    );
  });
  test("confirmation bypasses cached details and rejects invalid position", async () => {
    mockProvider(response("cached:1", ["catering.cafe"]));
    await fetchVerifiedProviderPlace("cached:1");
    mockProvider(response("cached:1", ["catering.cafe"], 59.1));
    expect((await fetchVerifiedProviderPlace("cached:1", true)).lat).toBe(59.1);
    mockProvider(response("invalid:1", ["catering.cafe"], 91));
    await expect(fetchVerifiedProviderPlace("invalid:1", true)).rejects.toThrow(
      "GEOAPIFY_MALFORMED",
    );
  });
});
