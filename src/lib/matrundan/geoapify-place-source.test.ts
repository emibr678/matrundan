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
            opening_hours: "Mo-Fr 11:00-22:00",
          },
        },
      },
    });

    expect(result).not.toBeNull();
    expect(result?.address).toBe("Testgatan 1");
    expect(result?.hasOpeningHours).toBe(true);
    expect(JSON.parse(result?.raw ?? "{}")).toMatchObject({
      provider: "geoapify",
      providerPlaceId: "geo-123",
      osmType: "node",
      osmId: "123456",
      website: "https://testkoket.se",
      hasOpeningHours: true,
    });
  });

  test("prioriterar Geoapifys separata gatufält framför ett verksamhetsnamn", () => {
    const result = normalizePlaceFeature({
      properties: {
        place_id: "geo-planen",
        name: "Planens restaurang",
        address_line1: "Planens restaurang",
        street: "Enskedevägen",
        housenumber: "98",
        city: "Stockholm",
        categories: ["catering.restaurant"],
      },
    });

    expect(result?.address).toBe("Enskedevägen 98");
    expect(decodeURIComponent(result?.externalUrl ?? "")).toContain(
      "Planens restaurang Enskedevägen 98 Stockholm",
    );
  });

  test("sparar inte verksamhetsnamnet som adress när gatufält saknas", () => {
    const result = normalizePlaceFeature({
      properties: {
        place_id: "geo-name-only",
        name: "Planens restaurang",
        address_line1: "Planens restaurang",
        formatted: "Planens restaurang, Stockholm, Sverige",
        city: "Stockholm",
        categories: ["catering.restaurant"],
      },
    });

    expect(result?.address).toBe("");
    expect(decodeURIComponent(result?.externalUrl ?? "")).toContain(
      "Planens restaurang Stockholm",
    );
  });

  test("utelämnar ofullständig OSM-identitet och markerar saknade öppettider", () => {
    const result = normalizePlaceFeature({
      properties: {
        place_id: "geo-456",
        name: "Ett annat kök",
        city: "Stockholm",
        datasource: { raw: { osm_type: "unknown", osm_id: "abc" } },
      },
    });

    const raw = JSON.parse(result?.raw ?? "{}");
    expect(result?.hasOpeningHours).toBe(false);
    expect(raw.osmType).toBeUndefined();
    expect(raw.osmId).toBeUndefined();
    expect(raw.hasOpeningHours).toBe(false);
  });
});
