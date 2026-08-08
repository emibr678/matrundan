import { describe, expect, test } from "bun:test";
import {
  actionableSliceIndex,
  countActionableSuggestions,
  mergePlaceSearchPages,
} from "./place-search-pagination";
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
  test("bevarar ordningen på redan visade träffar exakt", () => {
    const merged = mergePlaceSearchPages(
      [
        suggestion({ externalId: "a", name: "Alfa", distanceKm: 5 }),
        suggestion({ externalId: "b", name: "Beta", distanceKm: 2 }),
      ],
      [suggestion({ externalId: "c", name: "Åsa", distanceKm: 1 })],
    );

    expect(merged.map((row) => row.externalId)).toEqual(["a", "b", "c"]);
  });

  test("lägger nya träffar sist i inkommande ordning", () => {
    const merged = mergePlaceSearchPages(
      [suggestion({ externalId: "a", distanceKm: 9 })],
      [
        suggestion({ externalId: "z", name: "Zeta", distanceKm: 1 }),
        suggestion({ externalId: "y", name: "Ypsilon", distanceKm: 8 }),
      ],
    );

    expect(merged.map((row) => row.externalId)).toEqual(["a", "z", "y"]);
  });

  test("dubbletter uppdaterar metadata på samma position", () => {
    const merged = mergePlaceSearchPages(
      [
        suggestion({ externalId: "a", distanceKm: 4, nearestAreaLabel: "Stockholm" }),
        suggestion({ externalId: "b", distanceKm: 6 }),
      ],
      [
        suggestion({ externalId: "b", distanceKm: 6 }),
        suggestion({ externalId: "a", distanceKm: 1.2, nearestAreaLabel: "Stavsnäs" }),
        suggestion({ externalId: "c", distanceKm: 3 }),
      ],
    );

    expect(merged.map((row) => row.externalId)).toEqual(["a", "b", "c"]);
    expect(merged[0].distanceKm).toBe(1.2);
    expect(merged[0].nearestAreaLabel).toBe("Stavsnäs");
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

describe("handlingsbara sidor", () => {
  const list = [
    suggestion({ externalId: "a" }),
    suggestion({ externalId: "b" }),
    suggestion({ externalId: "c" }),
    suggestion({ externalId: "d" }),
  ];
  const isActionable = (s: PlaceSuggestion) => s.externalId !== "b";

  test("räknar bara handlingsbara träffar", () => {
    expect(countActionableSuggestions(list, isActionable)).toBe(3);
    expect(countActionableSuggestions(list, () => false)).toBe(0);
  });

  test("klipper listan där målet handlingsbara träffar nås", () => {
    expect(actionableSliceIndex(list, isActionable, 1)).toBe(1);
    expect(actionableSliceIndex(list, isActionable, 2)).toBe(3);
    expect(actionableSliceIndex(list, isActionable, 3)).toBe(4);
  });

  test("returnerar hela listan när målet inte kan nås", () => {
    expect(actionableSliceIndex(list, isActionable, 20)).toBe(list.length);
    expect(actionableSliceIndex([], isActionable, 20)).toBe(0);
    expect(actionableSliceIndex(list, isActionable, 0)).toBe(0);
  });
});
