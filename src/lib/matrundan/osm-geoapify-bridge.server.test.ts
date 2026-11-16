import { describe, expect, test } from "bun:test";
import {
  findVerifiedGeoapifyPlaceForOsm,
  normalizedExactOsmPlace,
  verifyOsmIndexSelection,
  type OsmSource,
} from "./osm-geoapify-bridge.server";
import type { VerifiedProviderPlace } from "./verified-provider-place.server";

const realStagingIds: OsmSource[] = [
  { osmType: "node", osmId: "6958798" },
  { osmType: "node", osmId: "35176980" },
  { osmType: "node", osmId: "35177002" },
  { osmType: "node", osmId: "38427810" },
  { osmType: "way", osmId: "40658252" },
  { osmType: "way", osmId: "88591504" },
  { osmType: "way", osmId: "92226503" },
  { osmType: "way", osmId: "92402068" },
];
// Actual staging generation-1 identities used as fixtures, not live Geoapify calls.
const shortType = { node: "n", way: "w", relation: "r" } as const;
const location = { lat: 59.3293, lng: 18.0686 };

function place(source: OsmSource, placeId: string, lat = location.lat) {
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [location.lng, lat] },
    properties: {
      place_id: placeId,
      name: "Testrestaurang",
      lat,
      lon: location.lng,
      city: "Stockholm",
      categories: ["catering.restaurant"],
      datasource: {
        raw: { osm_type: shortType[source.osmType], osm_id: Number(source.osmId) },
      },
    },
  };
}

function verified(source: OsmSource): VerifiedProviderPlace {
  return {
    externalId: "places-123",
    name: "Testrestaurang",
    category: "restaurang",
    cuisines: ["Italienskt"],
    address: "",
    area: null,
    city: "Stockholm",
    lat: location.lat,
    lng: location.lng,
    osmType: source.osmType,
    osmId: source.osmId,
    website: null,
    fetchedAt: "2026-11-15T00:00:00Z",
  };
}

describe("H2a: exakt OSM-identitet via dokumenterat Geoapify Places (#512)", () => {
  test.each(realStagingIds)("bevarar staging-OSM-typ + ID (%j)", (source) => {
    expect(normalizedExactOsmPlace(place(source, "verified"), source)?.externalId).toBe("verified");
    const differentId = { ...source, osmId: String(Number(source.osmId) + 1) };
    expect(normalizedExactOsmPlace(place(source, "verified"), differentId)).toBeNull();
  });

  test("Places cirkelsökning följs av ny verifiering av faktiskt provider-ID", async () => {
    const source: OsmSource = { osmType: "way", osmId: "92226503" };
    const urls: URL[] = [];
    const result = await findVerifiedGeoapifyPlaceForOsm(
      source,
      location,
      async (url) => {
        urls.push(new URL(url));
        return { features: [place(source, "places-123")] };
      },
      async (id, fresh, expected) => {
        expect([id, fresh, expected]).toEqual(["places-123", true, source]);
        return verified(source);
      },
    );
    expect(result.externalId).toBe("places-123");
    expect(urls).toHaveLength(1);
    expect(urls[0].pathname).toBe("/v2/places");
    expect(urls[0].searchParams.get("filter")).toBe("circle:18.0686,59.3293,150");
    expect(urls[0].searchParams.get("limit")).toBe("50");
    expect(urls[0].searchParams.has("osm_id")).toBe(false);
    expect(urls[0].searchParams.has("osm_type")).toBe(false);
  });

  test("kan paginera förbi 50 osläktade kandidater innan exakt OSM-matchning", async () => {
    const source: OsmSource = { osmType: "way", osmId: "88591504" };
    const urls: URL[] = [];
    await findVerifiedGeoapifyPlaceForOsm(
      source,
      location,
      async (url) => {
        urls.push(new URL(url));
        return {
          features: url.searchParams.has("offset")
            ? [place(source, "places-123")]
            : Array.from({ length: 50 }, (_, i) =>
                place({ ...source, osmId: String(i + 1) }, "not-selected-" + i),
              ),
        };
      },
      async () => verified(source),
    );
    expect(urls.map((url) => url.searchParams.get("offset"))).toEqual([null, "50"]);
  });

  test("samma namn/position men fel OSM-ID får aldrig kopplas", async () => {
    const source: OsmSource = { osmType: "node", osmId: "6958798" };
    await expect(
      findVerifiedGeoapifyPlaceForOsm(source, location, async () => ({
        features: [place({ ...source, osmId: "6958799" }, "same-name-and-position")],
      })),
    ).rejects.toThrow("OSM_PLACE_UNVERIFIED");
  });

  test("två Places-ID:n med samma OSM-ID ger konflikt", async () => {
    const source: OsmSource = { osmType: "way", osmId: "40658252" };
    await expect(
      findVerifiedGeoapifyPlaceForOsm(source, location, async () => ({
        features: [place(source, "places-1"), place(source, "places-2")],
      })),
    ).rejects.toThrow("OSM_PLACE_AMBIGUOUS");
  });

  test("utan Places-träff sker ingen osäker fallback", async () => {
    const source: OsmSource = { osmType: "node", osmId: "35176980" };
    await expect(
      findVerifiedGeoapifyPlaceForOsm(source, location, async () => ({ features: [] })),
    ).rejects.toThrow("OSM_PLACE_UNVERIFIED");
  });

  test("förändrad verifierad position över 150 meter avbryter tillägget", async () => {
    const source: OsmSource = { osmType: "node", osmId: "35177002" };
    await expect(
      findVerifiedGeoapifyPlaceForOsm(
        source,
        location,
        async () => ({ features: [place(source, "places-123")] }),
        async () => ({ ...verified(source), lat: 59.3393 }),
      ),
    ).rejects.toThrow("OSM_PLACE_UNVERIFIED");
  });

  test("fel OSM-typ accepteras inte även om ID och position är samma", async () => {
    const source: OsmSource = { osmType: "relation", osmId: "123" };
    const other: OsmSource = { osmType: "way", osmId: "123" };
    await expect(
      findVerifiedGeoapifyPlaceForOsm(source, location, async () => ({
        features: [place(other, "places-123")],
      })),
    ).rejects.toThrow("OSM_PLACE_UNVERIFIED");
  });

  test("stagingindexet intygar exakt klickad OSM-rad före provideruppslag", async () => {
    const source: OsmSource = { osmType: "node", osmId: "6958798" };
    const observed: unknown[] = [];
    const result = await verifyOsmIndexSelection(source, location, async (cursor) => {
      observed.push(cursor);
      if (cursor === null)
        return {
          status: "ok",
          results: [{ ...location, osmType: "node", osmId: 123, distanceM: 1 }],
          hasMore: true,
          cursor: { page: 2 },
        };
      return {
        status: "ok",
        results: [{ ...location, osmType: "node", osmId: 6958798, distanceM: 0 }],
        hasMore: false,
      };
    });
    expect(result).toEqual(location);
    expect(observed).toEqual([null, { page: 2 }]);
  });

  test("stagingindexet förhindrar att klienten byter identitet eller koordinat", async () => {
    const source: OsmSource = { osmType: "way", osmId: "92226503" };
    const page = async () => ({
      status: "ok" as const,
      results: [{ ...location, osmType: "way" as const, osmId: 92226503, distanceM: 0 }],
      hasMore: false,
    });
    await expect(
      verifyOsmIndexSelection({ ...source, osmId: "92226504" }, location, page),
    ).rejects.toThrow("OSM_PLACE_UNVERIFIED");
    await expect(
      verifyOsmIndexSelection(source, { ...location, lat: 59.3296 }, page),
    ).rejects.toThrow("OSM_PLACE_UNVERIFIED");
  });

  test("tillfälligt saknat stagingindex är inte en godkänd registreringskälla", async () => {
    await expect(
      verifyOsmIndexSelection(realStagingIds[0], location, async () => ({
        status: "not_loaded",
        results: [],
        hasMore: false,
      })),
    ).rejects.toThrow("OSM_PLACE_UNVERIFIED");
  });
});
