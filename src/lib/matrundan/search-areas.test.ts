import { describe, expect, test } from "bun:test";
import type { PlaceSuggestion } from "./places-provider";
import {
  isBroadAdministrativeSearchArea,
  isSearchRadiusKm,
  mergeAreaSearchResults,
  SEARCH_RADIUS_OPTIONS,
  shortSearchAreaLabel,
} from "./search-areas";

function place(
  externalId: string,
  name: string,
  distanceKm: number,
  provider = "geoapify",
): PlaceSuggestion {
  return {
    externalId,
    provider,
    name,
    category: "restaurang",
    cuisines: [],
    address: `${name}gatan 1`,
    city: "Stockholm",
    distanceKm,
  };
}

describe("flera sökområden", () => {
  test("2 km är en tillåten gemensam radie", () => {
    expect(SEARCH_RADIUS_OPTIONS).toContain(2);
    expect(isSearchRadiusKm(2)).toBe(true);
    expect(isSearchRadiusKm(4)).toBe(false);
  });

  test("kommun-, läns- och landsnivå används inte som punktcentrum", () => {
    expect(isBroadAdministrativeSearchArea("county")).toBe(true);
    expect(isBroadAdministrativeSearchArea("state")).toBe(true);
    expect(isBroadAdministrativeSearchArea("country")).toBe(true);
    expect(isBroadAdministrativeSearchArea("city")).toBe(false);
    expect(isBroadAdministrativeSearchArea("district")).toBe(false);
    expect(isBroadAdministrativeSearchArea("building")).toBe(false);
    expect(isBroadAdministrativeSearchArea(undefined)).toBe(false);
  });

  test("samma providerställe visas en gång med kortaste avståndet", () => {
    const merged = mergeAreaSearchResults([
      {
        areaId: "a",
        areaLabel: "Gamla Enskede",
        results: [place("same", "Samma ställe", 1.4)],
      },
      {
        areaId: "b",
        areaLabel: "Slakthusområdet",
        results: [place("same", "Samma ställe", 0.4)],
      },
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0].distanceKm).toBe(0.4);
    expect(merged[0].nearestAreaLabel).toBe("Slakthusområdet");
    expect(merged[0].matchingAreaLabels).toEqual(["Gamla Enskede", "Slakthusområdet"]);
  });

  test("olika leverantörer dedupliceras inte av misstag", () => {
    const merged = mergeAreaSearchResults([
      {
        areaId: "a",
        areaLabel: "Haga",
        results: [place("same", "Geo", 0.2, "geoapify")],
      },
      {
        areaId: "b",
        areaLabel: "Linné",
        results: [place("same", "Demo", 0.1, "demo")],
      },
    ]);
    expect(merged).toHaveLength(2);
  });

  test("resultat sorteras på avstånd, därefter svenskt namn, och begränsas", () => {
    const merged = mergeAreaSearchResults(
      [
        {
          areaId: "a",
          areaLabel: "Haga",
          results: [place("3", "Örten", 2), place("2", "Ängen", 1), place("1", "Bageriet", 1)],
        },
      ],
      2,
    );
    expect(merged.map((item) => item.externalId)).toEqual(["1", "2"]);
  });

  test("långa Geoapify-etiketter får ett kort pillnamn", () => {
    expect(shortSearchAreaLabel("Gamla Enskede, Stockholm, Sverige")).toBe("Gamla Enskede");
  });
});
