import { describe, expect, test } from "bun:test";
import type { PlaceSuggestion } from "./places-provider";
import {
  isBoundaryEligibleResultType,
  isBroadAdministrativeSearchArea,
  isSearchRadiusKm,
  mergeAreaSearchResults,
  SEARCH_RADIUS_OPTIONS,
  searchAreaMode,
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
  test("2 km är ett tillåtet avstånd för punktområden", () => {
    expect(SEARCH_RADIUS_OPTIONS).toContain(2);
    expect(isSearchRadiusKm(2)).toBe(true);
    expect(isSearchRadiusKm(4)).toBe(false);
  });

  test("äldre områden utan searchMode behåller punktsemantik", () => {
    expect(searchAreaMode({})).toBe("point");
    expect(searchAreaMode({ searchMode: "point" })).toBe("point");
    expect(searchAreaMode({ searchMode: "boundary" })).toBe("boundary");
  });

  test("kommun och lokal geografi kan vara boundary men adress är punkt", () => {
    expect(isBoundaryEligibleResultType("municipality")).toBe(true);
    expect(isBoundaryEligibleResultType("suburb")).toBe(true);
    expect(isBoundaryEligibleResultType("city")).toBe(true);
    expect(isBoundaryEligibleResultType("building")).toBe(false);
    expect(isBoundaryEligibleResultType("street")).toBe(false);
    expect(isBoundaryEligibleResultType("country")).toBe(false);
  });

  test("kommun-, läns-, region- och landsnivå används inte som punktcentrum", () => {
    expect(isBroadAdministrativeSearchArea("county")).toBe(true);
    expect(isBroadAdministrativeSearchArea("state")).toBe(true);
    expect(isBroadAdministrativeSearchArea("country")).toBe(true);
    expect(isBroadAdministrativeSearchArea("municipality")).toBe(true);
    expect(isBroadAdministrativeSearchArea("city", "Nacka kommun, Sverige")).toBe(true);
    expect(isBroadAdministrativeSearchArea("city", "Västra Götalands län, Sverige")).toBe(true);
    expect(isBroadAdministrativeSearchArea("city", "Region Stockholm, Sverige")).toBe(true);
    expect(isBroadAdministrativeSearchArea("city", "Nacka, Sverige")).toBe(false);
    expect(isBroadAdministrativeSearchArea("street", "Kommunalvägen, Huddinge")).toBe(false);
    expect(isBroadAdministrativeSearchArea("district")).toBe(false);
    expect(isBroadAdministrativeSearchArea("building")).toBe(false);
    expect(isBroadAdministrativeSearchArea(undefined)).toBe(false);
  });

  test("samma providerställe från boundary och punkt visas bara en gång", () => {
    const merged = mergeAreaSearchResults([
      {
        areaId: "boundary",
        areaLabel: "Värmdö kommun",
        results: [place("same", "Samma ställe", 7.4)],
      },
      {
        areaId: "point",
        areaLabel: "Skärgårdsvägen 8",
        results: [place("same", "Samma ställe", 0.4)],
      },
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0].distanceKm).toBe(0.4);
    expect(merged[0].nearestAreaLabel).toBe("Skärgårdsvägen 8");
    expect(merged[0].matchingAreaLabels).toEqual(["Värmdö kommun", "Skärgårdsvägen 8"]);
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
