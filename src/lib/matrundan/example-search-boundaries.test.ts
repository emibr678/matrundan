import { describe, expect, test } from "bun:test";
import { EXAMPLE_FIXTURE_REFERENCE_TIME, buildExampleState } from "./example-data";
import { searchAreaMode } from "./search-areas";

describe("exempelgruppens sökområden", () => {
  test("startar med både kommunboundary och adresspunkt", () => {
    const state = buildExampleState(new Date(EXAMPLE_FIXTURE_REFERENCE_TIME));
    const areas = state.group.searchAreas ?? [];

    expect(areas).toHaveLength(2);
    expect(areas.map(searchAreaMode)).toEqual(["boundary", "point"]);
    expect(areas[0].resultType).toBe("municipality");
    expect(areas[0].boundary?.type).toBe("MultiPolygon");
    expect(areas[1].resultType).toBe("building");
    expect(areas[1].boundary).toBeUndefined();
    expect(state.group.defaultSearchRadiusKm).toBe(2);
  });
});
