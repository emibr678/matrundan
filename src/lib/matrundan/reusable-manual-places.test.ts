import { describe, expect, test } from "bun:test";

import { listLocalReusableManualPlaceCandidates } from "./reusable-manual-places";
import type { Place } from "./types";

function place(overrides: Partial<Place> = {}): Place {
  return {
    id: "place-1",
    name: "Bistro Malma Kvarn",
    category: "restaurang",
    cuisines: [],
    occasions: [],
    address: "Malma Kvarnväg 1",
    city: "Värmdö",
    area: "Malma",
    lat: 59.309,
    lng: 18.607,
    addedBy: "member-1",
    addedAt: "2026-08-08T00:00:00.000Z",
    origin: "manual",
    collectionStatus: "active",
    ...overrides,
  };
}

const query = {
  name: "Bistro Malma Kvarn",
  category: "restaurang" as const,
  address: "Malma Kvarnväg 1",
  city: "Värmdö",
  lat: 59.30902,
  lng: 18.60702,
};

describe("återanvändning av manuella kanoniska ställen", () => {
  test("klassar samma namn och verifierad plats som exakt kandidat", () => {
    const result = listLocalReusableManualPlaceCandidates([place()], query);

    expect(result).toHaveLength(1);
    expect(result[0]?.placeId).toBe("place-1");
    expect(result[0]?.matchKind).toBe("exact");
    expect(result[0]?.groupStatus).toBe("active");
  });

  test("tillåter en försiktig namnvariant bara mycket nära samma plats", () => {
    const result = listLocalReusableManualPlaceCandidates([place({ name: "Bistro Malma Kvarn" })], {
      ...query,
      name: "Bistro Malma Kvarn & Krog",
      address: "Malma Kvarnväg 1",
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.matchKind).toBe("similar");
  });

  test("blandar inte ihop samma namn på en annan plats", () => {
    const result = listLocalReusableManualPlaceCandidates(
      [place({ lat: 59.32, lng: 18.62 })],
      query,
    );

    expect(result).toEqual([]);
  });

  test("blandar inte ihop två olika verksamheter som bara ligger nära", () => {
    const result = listLocalReusableManualPlaceCandidates(
      [place({ name: "Malma Hamnkrog", address: "Malma Kvarnväg 1" })],
      query,
    );

    expect(result).toEqual([]);
  });

  test("ignorerar ställen som redan har en aktiv extern källa", () => {
    const result = listLocalReusableManualPlaceCandidates(
      [
        place({
          sources: [
            {
              provider: "geoapify",
              providerPlaceId: "provider-1",
              status: "active",
            },
          ],
        }),
      ],
      query,
    );

    expect(result).toEqual([]);
  });

  test("bevarar arkiverad status så samma placeId kan återaktiveras", () => {
    const result = listLocalReusableManualPlaceCandidates(
      [place({ collectionStatus: "archived", archivedAt: "2026-08-01T00:00:00.000Z" })],
      query,
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.placeId).toBe("place-1");
    expect(result[0]?.groupStatus).toBe("archived");
  });
});
