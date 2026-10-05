import { describe, expect, test } from "bun:test";
import {
  canBulkAddSuggestion,
  mergeDiscoveryPages,
  normalizePlaceIdentity,
  placeWithinBoundary,
  type PlaceDiscoveryResult,
} from "./place-discovery";
import type { SearchAreaBoundaryGeometry } from "./types";

const boundary: SearchAreaBoundaryGeometry = {
  type: "MultiPolygon",
  coordinates: [
    [
      [
        [0, 0],
        [4, 0],
        [4, 4],
        [0, 4],
        [0, 0],
      ],
      [
        [1, 1],
        [2, 1],
        [2, 2],
        [1, 2],
        [1, 1],
      ],
    ],
    [
      [
        [5, 5],
        [6, 5],
        [6, 6],
        [5, 6],
        [5, 5],
      ],
    ],
  ],
};
describe("canonical place discovery", () => {
  test("matching folds Swedish spelling, accents and ampersands without matching unrelated names", () => {
    expect(normalizePlaceIdentity("  Café Åström & Co. ")).toBe(
      normalizePlaceIdentity("Cafe Astrom och Co"),
    );
    expect(normalizePlaceIdentity("Bistro Kvarn")).not.toBe(
      normalizePlaceIdentity("Bistro Kvarnbacken"),
    );
  });
  test("actual areas include islands and outer border, exclude holes and bbox gaps", () => {
    expect(placeWithinBoundary({ lat: 3, lng: 3 }, boundary)).toBe(true);
    expect(placeWithinBoundary({ lat: 5.5, lng: 5.5 }, boundary)).toBe(true);
    expect(placeWithinBoundary({ lat: 0, lng: 0 }, boundary)).toBe(true);
    expect(placeWithinBoundary({ lat: 1.5, lng: 1.5 }, boundary)).toBe(false);
    expect(placeWithinBoundary({ lat: 1, lng: 1 }, boundary)).toBe(false);
    expect(placeWithinBoundary({ lat: 4.5, lng: 4.5 }, boundary)).toBe(false);
  });
  test("later pages update identities without reordering visible results or mixing canonical and provider IDs", () => {
    const provider = {
      kind: "provider",
      resultKey: "provider:x",
      externalId: "x",
      name: "Cafe",
      category: "café",
      address: "",
      city: "",
      identity: {
        providerPlaceId: "x",
        providerVersion: "v1",
        knownPlace: null,
        candidates: [],
        reviewRequired: false,
        identityConflict: false,
      },
    } satisfies PlaceDiscoveryResult;
    const canonical = {
      ...provider,
      kind: "canonical",
      resultKey: "canonical:x",
      canonical: {
        placeId: "x",
        name: "Cafe",
        category: "café",
        cuisines: [],
        address: "",
        city: "",
        area: null,
        lat: 1,
        lng: 1,
        version: "v1",
        groupStatus: "not_linked",
      },
    } satisfies PlaceDiscoveryResult;
    const changed = { ...provider, identity: { ...provider.identity, reviewRequired: true } };
    const merged = mergeDiscoveryPages([provider, canonical], [changed]);
    expect(merged.map((r) => r.resultKey)).toEqual(["provider:x", "canonical:x"]);
    expect(merged[0]).toEqual(changed);
    expect(canBulkAddSuggestion(changed)).toBe(false);
    expect(canBulkAddSuggestion(canonical)).toBe(false);
    expect(canBulkAddSuggestion(provider)).toBe(true);
  });
});
