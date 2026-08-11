import { describe, expect, test } from "bun:test";
import { demoBoundaryForPlaceId } from "./demo-location-suggestions";
import { getPlacesProvider } from "./places-provider";

describe("boundarybaserade sökområden", () => {
  test("boundary söker inom polygonen och ignorerar punktavståndet", async () => {
    const boundary = demoBoundaryForPlaceId("demo-location-varmdo-kommun");
    expect(boundary?.type).toBe("MultiPolygon");
    if (!boundary) throw new Error("Demo-boundary saknas");

    const results = await getPlacesProvider().search({
      center: { lat: 59.316, lng: 18.52 },
      areaLabel: "Värmdö kommun",
      radiusKm: 1,
      searchMode: "boundary",
      boundary,
    });
    const ids = results.map((result) => result.externalId);

    expect(ids).toContain("demo-varmdo-gustavsberg");
    expect(ids).toContain("demo-varmdo-stavnas");
    expect(ids).toContain("demo-varmdo-island");
    expect(ids).not.toContain("demo-10");
  });

  test("punktområde använder radien även när boundaryresultat finns i samma fixture", async () => {
    const results = await getPlacesProvider().search({
      center: { lat: 59.3264, lng: 18.3895 },
      areaLabel: "Skärgårdsvägen 8",
      radiusKm: 2,
      searchMode: "point",
    });
    const ids = results.map((result) => result.externalId);

    expect(ids).toContain("demo-varmdo-gustavsberg");
    expect(ids).not.toContain("demo-varmdo-stavnas");
    expect(ids).not.toContain("demo-varmdo-island");
  });
});
