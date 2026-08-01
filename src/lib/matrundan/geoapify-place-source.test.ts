import { describe, expect, test } from "bun:test";
import { normalizePlaceFeature } from "./geoapify-normalize";

describe("Geoapifys externa platsidentitet", () => {
  test("bevarar giltigt OSM-id och normaliserar objekttyp", () => {
    const result = normalizePlaceFeature({
      properties: {
        place_id: "geo-123",
        name: "Testköket",
        address_line1: "Testgatan 1",
        city: "Stockholm",
        categories: ["catering.restaurant"],
        datasource: {
          raw: {
            amenity: "restaurant",
            osm_type: "n",
            osm_id: 123456,
            website: "https://testkoket.se",
          },
        },
      },
    });

    expect(result).not.toBeNull();
    expect(JSON.parse(result?.raw ?? "{}")).toMatchObject({
      provider: "geoapify",
      providerPlaceId: "geo-123",
      osmType: "node",
      osmId: "123456",
      website: "https://testkoket.se",
    });
  });

  test("utelämnar ofullständig eller ogiltig OSM-identitet", () => {
    const result = normalizePlaceFeature({
      properties: {
        place_id: "geo-456",
        name: "Ett annat kök",
        city: "Stockholm",
        datasource: { raw: { osm_type: "unknown", osm_id: "abc" } },
      },
    });

    const raw = JSON.parse(result?.raw ?? "{}");
    expect(raw.osmType).toBeUndefined();
    expect(raw.osmId).toBeUndefined();
  });
});
