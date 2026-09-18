import { describe, expect, test } from "bun:test";

import type { PlaceSuggestion } from "@/lib/matrundan/places-provider";
import { resultLocationContextFor } from "./SearchResultSections";

function suggestion(overrides: Partial<PlaceSuggestion> = {}): PlaceSuggestion {
  return {
    externalId: "place-1",
    name: "Testställe",
    category: "restaurang",
    address: "Testgatan 1",
    city: "Stockholm",
    ...overrides,
  };
}

describe("resultLocationContextFor", () => {
  test("upprepar inte en ensam utgångspunkt efter avståndet", () => {
    const result = suggestion({
      area: "Södermalm",
      distanceKm: 0.8,
      nearestAreaLabel: "Folksam huset",
    });

    expect(resultLocationContextFor(result, false)).toBe(" · ~0.8 km");
  });

  test("visar närmaste utgångspunkt när flera är aktiva", () => {
    const result = suggestion({
      area: "Södermalm",
      distanceKm: 0.8,
      nearestAreaLabel: "Folksam huset",
    });

    expect(resultLocationContextFor(result, true)).toBe(" · ~0.8 km · närmast Folksam huset");
  });

  test("dubblerar inte närmaste utgångspunkt om den redan är platsens ort", () => {
    const result = suggestion({
      distanceKm: 0.8,
      nearestAreaLabel: "Stockholm",
    });

    expect(resultLocationContextFor(result, true)).toBe(" · ~0.8 km");
  });

  test("behåller sökområdeskontext för områdessökning utan avstånd", () => {
    const result = suggestion({
      city: "Gustavsberg",
      nearestAreaLabel: "Värmdö kommun",
    });

    expect(resultLocationContextFor(result, false)).toBe(" · Värmdö kommun");
  });
});
