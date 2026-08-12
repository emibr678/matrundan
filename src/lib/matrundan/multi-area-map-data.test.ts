import { describe, expect, test } from "bun:test";
import type { MultiAreaMapCenter } from "@/components/matrundan/MultiAreaPlaceMap";
import { demoBoundaryForPlaceId } from "./demo-location-suggestions";
import {
  multiAreaBoundariesCollection,
  multiAreaBoundaryPositions,
  multiAreaCentersCollection,
  multiAreaRadiiCollection,
} from "./multi-area-map-data";

describe("kartdata för blandade sökområden", () => {
  test("boundary blir polygon medan bara punktområdet får centrum och radie", () => {
    const boundary = demoBoundaryForPlaceId("demo-location-varmdo-kommun");
    if (!boundary) throw new Error("Demo-boundary saknas");
    const centers: MultiAreaMapCenter[] = [
      {
        id: "boundary",
        label: "Värmdö kommun",
        lat: 59.316,
        lng: 18.52,
        searchMode: "boundary",
        boundary,
      },
      {
        id: "point",
        label: "Skärgårdsvägen 8",
        lat: 59.3264,
        lng: 18.3895,
        searchMode: "point",
      },
    ];

    const boundaries = multiAreaBoundariesCollection(centers);
    const pointCenters = multiAreaCentersCollection(centers);
    const radii = multiAreaRadiiCollection(centers, 5);

    expect(boundaries.features).toHaveLength(1);
    expect(boundaries.features[0].geometry.type).toBe("MultiPolygon");
    expect(pointCenters.features.map((feature) => feature.properties.id)).toEqual(["point"]);
    expect(radii.features).toHaveLength(1);
    expect(radii.features[0].geometry.type).toBe("Polygon");
    expect(multiAreaBoundaryPositions(centers[0]).length).toBeGreaterThan(8);
    expect(multiAreaBoundaryPositions(centers[1])).toEqual([]);
  });
});
