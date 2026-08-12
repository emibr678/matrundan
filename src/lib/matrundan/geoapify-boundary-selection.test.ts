import { describe, expect, test } from "bun:test";
import { selectMatchingGeoapifyBoundary } from "./geoapify-boundary-selection";

const partOfFeatures = [
  {
    geometry: { type: "Polygon", coordinates: [[[18, 59], [19, 59], [18, 59]]] },
    properties: { name: "Nacka kommun", place_id: "boundary-nacka" },
  },
  {
    geometry: { type: "Polygon", coordinates: [[[17, 58], [19, 58], [17, 58]]] },
    properties: { name: "Stockholms län", place_id: "boundary-stockholm-county" },
  },
  {
    geometry: { type: "MultiPolygon", coordinates: [[[[10, 55], [20, 55], [10, 55]]]] },
    properties: { name: "Sverige", place_id: "boundary-sweden" },
  },
];

describe("Geoapify boundaryurval", () => {
  test("väljer den boundary som exakt motsvarar den valda kommunen", () => {
    const selected = selectMatchingGeoapifyBoundary(
      partOfFeatures,
      "Nacka kommun, Stockholms län",
    );

    expect(selected?.placeId).toBe("boundary-nacka");
    expect(selected?.boundary.type).toBe("Polygon");
  });

  test("gör inte orten Nacka till Nacka kommun", () => {
    expect(selectMatchingGeoapifyBoundary(partOfFeatures, "Nacka")).toBeNull();
  });

  test("ignorerar namnmatch utan polygon eller provideridentitet", () => {
    expect(
      selectMatchingGeoapifyBoundary(
        [
          {
            geometry: { type: "Point", coordinates: [18, 59] },
            properties: { name: "Nacka kommun", place_id: "point" },
          },
          {
            geometry: { type: "Polygon", coordinates: [] },
            properties: { name: "Nacka kommun" },
          },
        ],
        "Nacka kommun",
      ),
    ).toBeNull();
  });
});
