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

test("äldre DB-projektion får inte ge implicit rätt att bekräfta kartkälla", async () => {
  const { identityCandidateSchema } = await import("./place-discovery.schemas");
  const candidate = identityCandidateSchema.parse({
    placeId: "38920000-0000-4000-8000-000000000001",
    name: "Café",
    category: "café",
    cuisines: [],
    address: "Gatan 1",
    area: null,
    city: "Teststad",
    lat: 59,
    lng: 18,
    groupStatus: "not_linked",
    version: "a".repeat(32),
    matchKind: "strong",
    distanceKm: 0,
  });
  expect(candidate.canConfirmSource).toBe(false);
});

import {
  placeAddressRelation,
  matchesSpecificPlaceName,
  presentPlaceSearchResults,
  unambiguousPlaceCandidate,
} from "./place-discovery";

test("ofullständig adress är kompatibel, motsägande gata eller nummer är motbevis", () => {
  expect(placeAddressRelation("Ringvägen", "Ringvägen 106")).toBe("compatible");
  expect(placeAddressRelation("Ringvägen 106", "Ringvägen")).toBe("compatible");
  expect(placeAddressRelation("Ringvägen 106", "Ringvägen 150")).toBe("conflict");
  expect(placeAddressRelation("Ringvägen 106", "Götgatan 106")).toBe("conflict");
  expect(placeAddressRelation("", "Ringvägen 106")).toBe("unknown");
  expect(placeAddressRelation("Ringvägen 106 A, Stockholm", "Ringvägen 106a")).toBe("equal");
});
test("bredare namnsökning är specifik och begränsad till exakt eller kort kvalificerat namn", () => {
  expect(matchesSpecificPlaceName("Monster Chicken", "Monster Chicken")).toBe(true);
  expect(matchesSpecificPlaceName("Monster Chicken", "Monster Chicken Söder")).toBe(true);
  expect(matchesSpecificPlaceName("Monster Chicken", "Monster Chickens")).toBe(false);
  for (const generic of ["pizza", "café", "hamburgare", "restauranger"])
    expect(matchesSpecificPlaceName(generic, generic)).toBe(false);
});
test("sökrader förenas enbart med serverns entydighetsbevis och behåller verifierad skrivväg", () => {
  const candidate = {
    placeId: "x",
    name: "Monster Chicken",
    category: "snabbmat" as const,
    cuisines: [],
    address: "Ringvägen 106",
    city: "Stockholm",
    area: null,
    lat: 59,
    lng: 18,
    version: "v1",
    groupStatus: "not_linked" as const,
    matchKind: "strong" as const,
    distanceKm: 0.007,
    canConfirmSource: true,
  };
  const provider = {
    externalId: "map",
    provider: "geoapify",
    name: candidate.name,
    category: candidate.category,
    address: "Ringvägen",
    city: candidate.city,
    kind: "provider" as const,
    identity: {
      providerPlaceId: "map",
      providerVersion: "v1",
      knownPlace: null,
      candidates: [candidate],
      reviewRequired: true,
      identityConflict: false,
    },
  };
  const canonical = {
    ...provider,
    externalId: "canonical:x",
    kind: "canonical" as const,
    canonical: candidate,
    identity: undefined,
  };
  const merged = presentPlaceSearchResults([canonical, provider]);
  expect(merged).toHaveLength(1);
  expect(merged[0].externalId).toBe("map");
  expect(merged[0].address).toBe("Ringvägen 106");
  const uncertain = {
    ...provider,
    identity: { ...provider.identity, candidates: [{ ...candidate, canConfirmSource: false }] },
  };
  expect(unambiguousPlaceCandidate(uncertain)).toBeNull();
  expect(presentPlaceSearchResults([canonical, uncertain])).toHaveLength(2);
  expect(
    presentPlaceSearchResults([
      canonical,
      {
        ...provider,
        identity: { ...provider.identity, candidates: [candidate, { ...candidate, placeId: "y" }] },
      },
    ]),
  ).toHaveLength(2);
});

import { manualFallbackProviderCandidates } from "./place-discovery";
import { FOOD_TAGS } from "./food-tags";

test("sista kartkontrollen är riktad till vald adress och avvisar motsägande filialer", () => {
  const query = {
    name: "Monster Chicken",
    address: "Ringvägen 106",
    city: "Stockholm",
    lat: 59,
    lng: 18,
  };
  const place = {
    ...query,
    category: "snabbmat" as const,
    externalId: "map",
    address: "Ringvägen",
    lat: 59.00006,
  };
  expect(manualFallbackProviderCandidates(query, [place])).toEqual([place]);
  expect(
    manualFallbackProviderCandidates(query, [
      { ...place, address: "Ringvägen 150" },
      { ...place, lat: 59.002 },
      { ...place, name: "Monster Hamburgare" },
      { ...place, city: "Göteborg" },
    ]),
  ).toEqual([]);
  expect(manualFallbackProviderCandidates(query, [])).toEqual([]);
});
test("alla etablerade kök och typer hålls geografiska även med långa generiska ord", () => {
  for (const tag of FOOD_TAGS)
    for (const query of [tag.id, tag.label, ...tag.aliases])
      expect(matchesSpecificPlaceName(query, query)).toBe(false);
});
