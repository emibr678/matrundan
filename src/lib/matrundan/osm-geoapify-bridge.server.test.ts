import { describe, expect, test } from "bun:test";
import {
  findVerifiedGeoapifyPlaceForOsm,
  normalizedExactOsmPlace,
  selectOsmDetail,
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
// These eight identities are sampled from actual staging generation 1,
// NOT evidence that the live Geoapify API lookup has been executed or succeeded.
const shortType = { node: "n", way: "w", relation: "r" } as const;
function place(
  source: OsmSource,
  placeId: string,
  featureType: "details" | "other" = "other",
  lat = 59.3293,
) {
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [18.0686, lat] },
    properties: {
      feature_type: featureType,
      place_id: placeId,
      name: "Testrestaurang",
      lat,
      lon: 18.0686,
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
    lat: 59.3293,
    lng: 18.0686,
    osmType: source.osmType,
    osmId: source.osmId,
    website: null,
    fetchedAt: "2026-11-15T00:00:00Z",
  };
}

describe("H2a: exakt OSM-identitet via Geoapify Places (#512)", () => {
  test.each(realStagingIds)("identifierar riktigt staging-OSM-ID med typ + ID (%j)", (source) => {
    expect(normalizedExactOsmPlace(place(source, "verified"), source)?.externalId).toBe("verified");
    const differentId = { ...source, osmId: String(Number(source.osmId) + 1) };
    expect(normalizedExactOsmPlace(place(source, "verified"), differentId)).toBeNull();
  });

  test("söker enbart med osm_id + osm_type, kräver samma objekt i Places och verifierar ID igen", async () => {
    const source: OsmSource = { osmType: "way", osmId: "92226503" };
    const urls: URL[] = [];
    const result = await findVerifiedGeoapifyPlaceForOsm(
      source,
      async (url) => {
        urls.push(new URL(url));
        return url.pathname === "/v2/place-details"
          ? { features: [place(source, "details-id", "details")] }
          : { features: [place(source, "places-123")] };
      },
      async (id, fresh, expected) => {
        expect([id, fresh, expected]).toEqual(["places-123", true, source]);
        return verified(source);
      },
    );
    expect(result.externalId).toBe("places-123");
    expect(urls).toHaveLength(2);
    expect(urls[0].searchParams.get("osm_id")).toBe(source.osmId);
    expect(urls[0].searchParams.get("osm_type")).toBe("w");
    expect(urls[0].searchParams.has("id")).toBe(false);
    expect(urls[1].searchParams.get("filter")).toContain("circle:");
    expect(urls[1].searchParams.get("limit")).toBe("50");
    expect(urls[1].searchParams.has("id")).toBe(false);
  });

  test("ett annat OSM-ID får aldrig matcha bara genom samma namn/position", async () => {
    const wanted: OsmSource = { osmType: "node", osmId: "6958798" };
    const other: OsmSource = { osmType: "node", osmId: "6958799" };
    await expect(
      findVerifiedGeoapifyPlaceForOsm(wanted, async (url) => ({
        features:
          url.pathname === "/v2/place-details"
            ? [place(wanted, "details", "details")]
            : [place(other, "same-name-and-position")],
      })),
    ).rejects.toThrow("OSM_PLACE_UNVERIFIED");
  });

  test("olika Geoapify-ID:n för samma objekt i en sida är oklart, inte auto-merge", async () => {
    const source: OsmSource = { osmType: "way", osmId: "40658252" };
    await expect(
      findVerifiedGeoapifyPlaceForOsm(source, async (url) => ({
        features:
          url.pathname === "/v2/place-details"
            ? [place(source, "details", "details")]
            : [place(source, "places-1"), place(source, "places-2")],
      })),
    ).rejects.toThrow("OSM_PLACE_AMBIGUOUS");
  });

  test("ett tomt eller flertydigt details-svar får inte bli en plats", () => {
    const source: OsmSource = { osmType: "node", osmId: "35176980" };
    expect(() => selectOsmDetail({ features: [] }, source)).toThrow("OSM_PLACE_UNVERIFIED");
    expect(() =>
      selectOsmDetail(
        { features: [place(source, "a", "details"), place(source, "b", "details")] },
        source,
      ),
    ).toThrow("OSM_PLACE_UNVERIFIED");
    expect(() => selectOsmDetail({ features: [place(source, "a", "other")] }, source)).toThrow();
  });

  test("koordinatförändring över 150 meter stoppas före kanonisk resolution", async () => {
    const source: OsmSource = { osmType: "node", osmId: "35177002" };
    await expect(
      findVerifiedGeoapifyPlaceForOsm(
        source,
        async (url) => ({
          features:
            url.pathname === "/v2/place-details"
              ? [place(source, "details", "details")]
              : [place(source, "places-123")],
        }),
        async () => ({ ...verified(source), lat: 59.3393 }),
      ),
    ).rejects.toThrow("OSM_PLACE_UNVERIFIED");
  });

  test("inget orelaterat OSM-objekt accepteras som details, även med giltigt Geoapify-ID", () => {
    const requested: OsmSource = { osmType: "relation", osmId: "123" };
    const differentType: OsmSource = { osmType: "way", osmId: "123" };
    expect(() =>
      selectOsmDetail({ features: [place(differentType, "details", "details")] }, requested),
    ).toThrow("OSM_PLACE_UNVERIFIED");
  });
});
