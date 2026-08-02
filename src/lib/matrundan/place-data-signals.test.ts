import { describe, expect, test } from "bun:test";

import {
  localPlaceDataSignal,
  mergePlaceDataSignalTarget,
  placeSignalKey,
  signalTargetFromSuggestion,
  type PlaceDataSignalTarget,
} from "./place-data-signals";
import type { PlaceSuggestion } from "./places-provider";

function target(overrides: Partial<PlaceDataSignalTarget> = {}): PlaceDataSignalTarget {
  return {
    key: "provider:geoapify:geo-1",
    provider: "geoapify",
    providerPlaceId: "geo-1",
    hasWebsite: false,
    hasOpeningHours: null,
    ...overrides,
  };
}

describe("anonyma platsdatasignaler", () => {
  test("bygger en stabil nyckel utan grupp- eller användaridentitet", () => {
    expect(placeSignalKey({ provider: " GeoApify ", providerPlaceId: "geo-1" })).toBe(
      "provider:geoapify:geo-1",
    );
  });

  test("visar begränsad platsinformation bara när båda uppgifterna uttryckligen saknas", () => {
    expect(localPlaceDataSignal(target({ hasOpeningHours: false })).limitedInformation).toBe(true);
    expect(localPlaceDataSignal(target({ hasOpeningHours: null })).limitedInformation).toBe(false);
    expect(
      localPlaceDataSignal(target({ hasWebsite: true, hasOpeningHours: false })).limitedInformation,
    ).toBe(false);
  });

  test("bevarar auktoritativ öppettidsdata när en äldre ögonblicksbild saknar fältet", () => {
    const current = target({ hasWebsite: true, hasOpeningHours: true });
    const olderSnapshot = target({ hasWebsite: false, hasOpeningHours: null });

    expect(mergePlaceDataSignalTarget(current, olderSnapshot, false)).toEqual(current);
    expect(mergePlaceDataSignalTarget(current, olderSnapshot, true)).toEqual(olderSnapshot);
  });

  test("läser den neutrala öppettidsindikatorn från ett normaliserat sökresultat", () => {
    const suggestion = {
      externalId: "geo-1",
      provider: "geoapify",
      name: "Testköket",
      category: "restaurang",
      address: "Testgatan 1",
      city: "Stockholm",
      website: undefined,
      hasOpeningHours: false,
    } as PlaceSuggestion & { hasOpeningHours: boolean };

    expect(signalTargetFromSuggestion(suggestion)).toMatchObject({
      key: "provider:geoapify:geo-1",
      hasWebsite: false,
      hasOpeningHours: false,
    });
  });
});
