import { describe, expect, test } from "bun:test";
import { mergePlaceSearchPages } from "./place-search-pagination";
import type { PlaceSuggestion } from "./places-provider";

function suggestion(overrides: Partial<PlaceSuggestion> & { externalId: string }): PlaceSuggestion {
  return {
    name: "Ställe",
    category: "restaurang",
    address: "Gatan 1",
    city: "Stockholm",
    provider: "geoapify",
    ...overrides,
  };
}

describe("mergePlaceSearchPages", () => {
  test("lägger till nya träffar och sorterar på avstånd och namn", () => {
    const merged = mergePlaceSearchPages(
      [suggestion({ externalId: "a", name: "Alfa", distanceKm: 2 })],
      [
        suggestion({ externalId: "b", name: "Beta", distanceKm: 1 }),
        suggestion({ externalId: "c", name: "Åsa", distanceKm: 1 }),
      ],
    );

    expect(merged.map((row) => row.externalId)).toEqual(["b", "c", "a"]);
  });

  test("deduplicerar på provider och externalId", () => {
    const merged = mergePlaceSearchPages(
      [suggestion({ externalId: "a", distanceKm: 1 })],
      [
        suggestion({ externalId: "a", distanceKm: 1 }),
        suggestion({ externalId: "a", provider: "demo", distanceKm: 1 }),
      ],
    );

    expect(merged).toHaveLength(2);
  });

  test("behåller kortaste verifierade avstånd och dess närmaste område", () => {
    const merged = mergePlaceSearchPages(
      [suggestion({ externalId: "a", distanceKm: 4, nearestAreaLabel: "Stockholm" })],
      [suggestion({ externalId: "a", distanceKm: 1.2, nearestAreaLabel: "Stavsnäs" })],
    );

    expect(merged[0].distanceKm).toBe(1.2);
    expect(merged[0].nearestAreaLabel).toBe("Stavsnäs");
  });

  test("behåller befintligt avstånd när nya saknar avstånd", () => {
    const merged = mergePlaceSearchPages(
      [suggestion({ externalId: "a", distanceKm: 3, nearestAreaLabel: "Stockholm" })],
      [suggestion({ externalId: "a" })],
    );

    expect(merged[0].distanceKm).toBe(3);
    expect(merged[0].nearestAreaLabel).toBe("Stockholm");
  });

  test("slår ihop matchingAreaLabels utan dubletter", () => {
    const merged = mergePlaceSearchPages(
      [
        suggestion({
          externalId: "a",
          distanceKm: 3,
          matchingAreaLabels: ["Stockholm", "Nacka"],
        }),
      ],
      [
        suggestion({
          externalId: "a",
          distanceKm: 1,
          matchingAreaLabels: ["Nacka", "Stavsnäs"],
        }),
      ],
    );

    expect(merged[0].matchingAreaLabels).toEqual(["Stockholm", "Nacka", "Stavsnäs"]);
  });
});
