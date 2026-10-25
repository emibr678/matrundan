import { describe, expect, test } from "bun:test";
import {
  GEOAPIFY_DISCOVERY_CATEGORIES,
  geoapifyCategoriesForPlaceSearchIntent,
  geoapifyNameQueryForPlaceSearchIntent,
  hasStructuredGeoapifyMapping,
} from "./geoapify-place-search";
import { resolvePlaceSearchIntent } from "./place-search-intent";
import { getPlacesProvider } from "./places-provider";

describe("providerstyrd matställessökning", () => {
  test("sushi använder specifik Geoapify-kategori i stället för name-filter", () => {
    const intent = resolvePlaceSearchIntent("sushi");
    expect(geoapifyCategoriesForPlaceSearchIntent(intent)).toEqual(["catering.restaurant.sushi"]);
    expect(hasStructuredGeoapifyMapping(intent)).toBe(true);
    expect(geoapifyNameQueryForPlaceSearchIntent(intent)).toBeUndefined();
  });

  test("Pasta har ingen gissad providerkategori och faller tillbaka till bred catering", () => {
    const intent = resolvePlaceSearchIntent("Pasta");
    expect(geoapifyCategoriesForPlaceSearchIntent(intent)).toEqual(GEOAPIFY_DISCOVERY_CATEGORIES);
    expect(hasStructuredGeoapifyMapping(intent)).toBe(false);
    expect(geoapifyNameQueryForPlaceSearchIntent(intent)).toBeUndefined();
  });

  test("Café använder providerkategori", () => {
    const intent = resolvePlaceSearchIntent("café");
    expect(geoapifyCategoriesForPlaceSearchIntent(intent)).toEqual(["catering.cafe"]);
    expect(hasStructuredGeoapifyMapping(intent)).toBe(true);
  });

  test("fri verksamhetstext använder provider-name men behåller breda kategorier", () => {
    const intent = resolvePlaceSearchIntent("Päronträdets Trattoria");
    expect(geoapifyCategoriesForPlaceSearchIntent(intent)).toEqual(GEOAPIFY_DISCOVERY_CATEGORIES);
    expect(geoapifyNameQueryForPlaceSearchIntent(intent)).toBe("Päronträdets Trattoria");
  });

  test("demo hittar sushi semantiskt trots att ordet saknas i verksamhetsnamnet", async () => {
    const results = await getPlacesProvider().search({
      query: "sushi",
      center: { lat: 57.6975, lng: 11.9598 },
      areaLabel: "Vasastan",
      radiusKm: 2,
    });

    expect(results.map((result) => result.name)).toContain("Rislyktans Izakaya");
  });

  test("demo visar exakta Pasta-träffar före italienska kandidater utan att ge dem Pasta-attribut", async () => {
    const results = await getPlacesProvider().search({
      query: "Pasta",
      center: { lat: 57.6975, lng: 11.9598 },
      areaLabel: "Vasastan",
      radiusKm: 2,
    });

    expect(results.map((result) => result.name)).toContain("Päronträdets Trattoria");
    const italian = results.find((result) => result.name === "Pizzagläntan")!;
    expect(italian.searchEvidence?.kind).toBe("association");
    expect(italian.cuisines).not.toContain("Pasta");
    expect(results[0].name).toBe("Päronträdets Trattoria");
  });
});
